#!/usr/bin/env python3
"""Interactive Runpod wizard that deploys Qwen3.8-27B NVFP4 with SGLang."""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
import questionary

API_ROOT = "https://api.runpod.io/v2"
RECIPE_PATH = Path(__file__).resolve().parent / "recipes" / "qwen38_27b_nvfp4.json"
NONE = frozenset({None, "", "NONE"})
STOCKED = ("HIGH", "MEDIUM", "LOW")
WAIT_SECONDS = 25 * 60
POLL_SECONDS = 15


class DeployError(SystemExit):
    pass


def load_recipe() -> dict[str, Any]:
    return json.loads(RECIPE_PATH.read_text())


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def resolve_runpod_key(cli_key: str | None) -> str:
    load_dotenv(Path(__file__).resolve().parent / ".env")
    key = (cli_key or os.environ.get("RUNPOD_API_KEY") or "").strip()
    if not key and sys.stdin.isatty():
        key = (questionary.password("Runpod API key (console.runpod.io → Settings)").ask() or "").strip()
    if not key:
        raise DeployError(
            "A Runpod API key is the only required credential. "
            "Pass --api-key, export RUNPOD_API_KEY, or paste it at the prompt."
        )
    return key


def resolve_hf_token(cli_token: str | None, use_runpod_secret: bool) -> str | None:
    token = (cli_token or os.environ.get("HF_TOKEN") or "").strip()
    if token.startswith("hf_"):
        return token
    if use_runpod_secret:
        return "{{ RUNPOD_SECRET_HF_TOKEN }}"
    return None


def client(api_key: str) -> httpx.Client:
    return httpx.Client(
        base_url=API_ROOT,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "User-Agent": "harness-qwen38-deploy/1.0",
        },
        timeout=45.0,
    )


def api_get(http: httpx.Client, path: str, params: dict[str, Any] | None = None) -> Any:
    r = http.get(path, params=params)
    if r.status_code >= 400:
        raise DeployError(f"GET {path} failed ({r.status_code}): {r.text[:400]}")
    return r.json()


def api_post(http: httpx.Client, path: str, body: dict[str, Any]) -> Any:
    r = http.post(path, json=body)
    if r.status_code >= 400:
        raise DeployError(f"POST {path} failed ({r.status_code}): {r.text[:600]}")
    return r.json() if r.content else {}


def list_gpus(http: httpx.Client, cloud: str, count: int) -> list[dict[str, Any]]:
    data = api_get(
        http,
        "/catalog/gpus",
        params={
            "include": "AVAILABILITY",
            "product": "POD",
            "cloud": cloud,
            "count": count,
            "minCudaVersion": "12.8",
        },
    )
    return list(data.get("gpus") or data.get("data") or [])


def stocked_dcs(gpu: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        dc
        for dc in gpu.get("dataCenters") or []
        if str(dc.get("availability") or "NONE").upper() in STOCKED
    ]


def is_stocked(gpu: dict[str, Any]) -> bool:
    if str(gpu.get("availability") or "NONE").upper() not in STOCKED:
        return False
    if str(gpu.get("id") or "").lower() == "unknown":
        return False
    return bool(stocked_dcs(gpu))


def hourly_price(gpu: dict[str, Any], cloud: str) -> float:
    price = gpu.get("price") or {}
    key = "secure" if cloud == "SECURE" else "community"
    return float(price.get(key) or 0)


def max_count(gpu: dict[str, Any], cloud: str) -> int:
    counts = gpu.get("maxCount") or {}
    key = "secure" if cloud == "SECURE" else "community"
    return int(counts.get(key) or 1) or 1


def format_gpu(gpu: dict[str, Any], cloud: str) -> str:
    dcs = stocked_dcs(gpu)
    dc_bits = [f"{dc['id']} {dc.get('availability')}" for dc in dcs[:4]]
    extra = "" if len(dcs) <= 4 else f" +{len(dcs) - 4}"
    vram = gpu.get("memory") or 0
    warn = "  (VRAM < 48 GB)" if int(vram) < 48 else ""
    return (
        f"{gpu.get('name') or gpu['id']}  |  {vram} GB  |  "
        f"${hourly_price(gpu, cloud):.2f}/hr  |  {gpu.get('availability')}  |  "
        f"{', '.join(dc_bits)}{extra}{warn}"
    )


def is_blackwell(gpu_id: str, recipe: dict[str, Any]) -> bool:
    lowered = gpu_id.lower()
    return any(marker in lowered for marker in recipe["blackwell_id_markers"])


def build_launch_argv(
    recipe: dict[str, Any],
    *,
    api_key: str,
    tp_size: int,
    use_marlin: bool,
) -> list[str]:
    argv = [
        "/opt/sglang/bin/python",
        "-m",
        "sglang.launch_server",
        "--model-path",
        recipe["model_path"],
        "--served-model-name",
        recipe["served_model_name"],
        "--host",
        "0.0.0.0",
        "--port",
        str(recipe["port"]),
        *recipe["sglang_flags"],
        "--api-key",
        api_key,
    ]
    if use_marlin:
        argv.extend(recipe["marlin_flags"])
    if tp_size > 1:
        argv.extend(["--tp-size", str(tp_size)])
    return argv


def build_start_command(launch_argv: list[str]) -> str:
    launch = " ".join(launch_argv)
    return (
        "bash -c '"
        "mkdir -p /root/.ssh /var/run/sshd; chmod 700 /root/.ssh; "
        'if [ -n "$PUBLIC_KEY" ]; then printf "%s\\n" "$PUBLIC_KEY" >> /root/.ssh/authorized_keys; '
        "chmod 600 /root/.ssh/authorized_keys; fi; "
        "if ! command -v sshd >/dev/null 2>&1; then "
        "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openssh-server; "
        "fi; ssh-keygen -A; "
        'sed -i "s/^#\\?PermitRootLogin.*/PermitRootLogin yes/" /etc/ssh/sshd_config; '
        'sed -i "s/^#\\?PubkeyAuthentication.*/PubkeyAuthentication yes/" /etc/ssh/sshd_config; '
        'sed -i "s/^#\\?PasswordAuthentication.*/PasswordAuthentication no/" /etc/ssh/sshd_config; '
        "/usr/sbin/sshd; echo SSHD_LISTENING; "
        f"exec {launch}"
        "'"
    )


def probe_counts(http: httpx.Client, cloud: str, gpu_id: str, ceiling: int) -> dict[int, dict[str, Any]]:
    found: dict[int, dict[str, Any]] = {}
    for count in range(1, min(8, ceiling) + 1):
        match = next((g for g in list_gpus(http, cloud, count) if g.get("id") == gpu_id), None)
        if match and is_stocked(match):
            found[count] = match
    return found


def pick_interactive(http: httpx.Client, recipe: dict[str, Any]) -> tuple[str, dict[str, Any], int]:
    cloud = questionary.select(
        "Cloud",
        choices=[
            questionary.Choice("SECURE (Runpod datacenter, default)", value="SECURE"),
            questionary.Choice("COMMUNITY (cheaper, host-dependent)", value="COMMUNITY"),
        ],
    ).ask()
    if not cloud:
        raise DeployError("Cancelled.")

    print(f"Loading {cloud} GPU stock for 1x …")
    gpus = [g for g in list_gpus(http, cloud, 1) if is_stocked(g)]
    gpus.sort(key=lambda g: (int(g.get("memory") or 0) < recipe["min_vram_warn_gb"], hourly_price(g, cloud)))
    if not gpus:
        raise DeployError(f"No in-stock GPUs on {cloud} with CUDA >= 12.8 right now.")

    gpu = questionary.select(
        "GPU type (in stock only)",
        choices=[questionary.Choice(format_gpu(g, cloud), value=g) for g in gpus],
    ).ask()
    if not gpu:
        raise DeployError("Cancelled.")

    print(f"Checking which GPU counts are in stock for {gpu['id']} …")
    by_count = probe_counts(http, cloud, gpu["id"], max_count(gpu, cloud))
    if not by_count:
        raise DeployError(f"Stock disappeared for {gpu['id']}.")

    count = questionary.select(
        "GPU count",
        choices=[
            questionary.Choice(
                f"{n}x  ·  ${hourly_price(by_count[n], cloud) * n:.2f}/hr  ·  {by_count[n].get('availability')}",
                value=n,
            )
            for n in sorted(by_count)
        ],
        default=1 if 1 in by_count else sorted(by_count)[0],
    ).ask()
    if not count:
        raise DeployError("Cancelled.")
    return cloud, by_count[count], count


def pick_flags(
    http: httpx.Client,
    recipe: dict[str, Any],
    *,
    cloud: str,
    gpu_id: str,
    count: int,
) -> tuple[str, dict[str, Any], int]:
    match = next((g for g in list_gpus(http, cloud, count) if g.get("id") == gpu_id), None)
    if not match or not is_stocked(match):
        raise DeployError(f"{count}x {gpu_id} is not in stock on {cloud} right now.")
    return cloud, match, count


def confirm_or_die(cloud: str, gpu: dict[str, Any], count: int, yes: bool) -> float:
    unit = hourly_price(gpu, cloud)
    total = unit * count
    dcs = ", ".join(f"{dc['id']} ({dc.get('availability')})" for dc in stocked_dcs(gpu))
    print()
    print(f"  GPU     {count}x {gpu['id']}")
    print(f"  VRAM    {gpu.get('memory')} GB each")
    print(f"  Cloud   {cloud}")
    print(f"  Stock   {gpu.get('availability')}  ·  {dcs}")
    print(f"  Price   ${unit:.2f}/GPU/hr  →  ${total:.2f}/hr while RUNNING")
    if int(gpu.get("memory") or 0) < 48:
        print("  Warn    VRAM under 48 GB — NVFP4 27B is tight and may OOM.")
    if count > 1:
        print("  Warn    Official Qwen3.8 recipes are single-GPU; --tp-size N is experimental.")
    print()
    if yes:
        return total
    ok = questionary.confirm(f"Create this pod at ${total:.2f}/hr?", default=True).ask()
    if not ok:
        raise DeployError("Cancelled.")
    return total


def create_pod(
    http: httpx.Client,
    recipe: dict[str, Any],
    *,
    cloud: str,
    gpu: dict[str, Any],
    count: int,
    sglang_key: str,
    hf_token: str | None,
) -> dict[str, Any]:
    use_marlin = not is_blackwell(str(gpu["id"]), recipe)
    launch = build_launch_argv(recipe, api_key=sglang_key, tp_size=count, use_marlin=use_marlin)
    env = dict(recipe["env"])
    if hf_token:
        env["HF_TOKEN"] = hf_token
    if use_marlin:
        env.update(recipe["marlin_env"])
    body = {
        "name": f"sglang-qwen38-nvfp4-{secrets.token_hex(3)}",
        "cloud": cloud,
        "image": recipe["image"],
        "disk": recipe["container_disk_gb"],
        "ports": [f"{recipe['port']}/http", "22/tcp"],
        "startSsh": True,
        "args": build_start_command(launch),
        "env": env,
        "gpu": {
            "id": gpu["id"],
            "count": count,
            "minCudaVersion": recipe["min_cuda_version"],
        },
        "dataCenterIds": [dc["id"] for dc in stocked_dcs(gpu)],
        "mounts": {
            "persistent": {
                "size": recipe["persistent_gb"],
                "path": recipe["persistent_path"],
            }
        },
    }
    created = api_post(http, "/pods", body)
    pod = created.get("pod") or created
    if not pod.get("id"):
        raise DeployError(f"Create returned no pod id: {created}")
    return pod


def ssh_block(pod: dict[str, Any]) -> dict[str, Any]:
    return pod.get("ssh") or {}


def proxy_base(pod_id: str, port: int) -> str:
    return f"https://{pod_id}-{port}.proxy.runpod.net/v1"


def wait_until_ready(http: httpx.Client, pod_id: str, sglang_key: str, port: int) -> dict[str, Any]:
    deadline = time.time() + WAIT_SECONDS
    last = ""
    models_url = proxy_base(pod_id, port) + "/models"
    while time.time() < deadline:
        pod = api_get(http, f"/pods/{quote(pod_id)}")
        pod = pod.get("pod") or pod
        status = pod.get("status") or "?"
        mapped = False
        for item in (pod.get("runtime") or {}).get("ports") or []:
            if int(item.get("private") or 0) == port:
                mapped = True
        note = f"{status}  ports={'yes' if mapped else 'no'}"
        if note != last:
            print(f"  pod {pod_id}: {note}")
            last = note
        if status == "RUNNING" and mapped:
            try:
                r = httpx.get(
                    models_url,
                    headers={
                        "Authorization": f"Bearer {sglang_key}",
                        "User-Agent": "Mozilla/5.0 harness-qwen38-deploy",
                    },
                    timeout=20.0,
                )
                if r.status_code == 200 and "qwen38-27b" in r.text:
                    print(f"  API ready: {models_url}")
                    return pod
                print(f"  waiting on /v1/models (http {r.status_code}) — first boot pulls ~22 GB")
            except httpx.HTTPError as exc:
                print(f"  waiting on /v1/models ({exc.__class__.__name__}) — first boot pulls ~22 GB")
        time.sleep(POLL_SECONDS)
    raise DeployError(
        f"Timed out after {WAIT_SECONDS // 60} min waiting for /v1/models. "
        f"Pod {pod_id} may still be downloading weights."
    )


def print_handoff(pod: dict[str, Any], sglang_key: str, model: str, port: int, hourly: float) -> None:
    pod_id = pod["id"]
    base = proxy_base(pod_id, port)
    ssh = ssh_block(pod)
    direct = (ssh.get("direct") or {}).get("command") or "ssh mapping not ready yet"
    proxy = (ssh.get("proxy") or {}).get("command") or ""
    print()
    print("Deployed")
    print(f"  Pod        {pod_id}  ({pod.get('name')})")
    print(f"  Status     {pod.get('status')}  ·  ${hourly:.2f}/hr until you stop/terminate")
    print(f"  Base URL   {base}")
    print(f"  API key    {sglang_key}")
    print(f"  Model      {model}")
    print(f"  SSH        {direct}")
    if proxy:
        print(f"  SSH proxy  {proxy}")
    print()
    print("  Keep the system prompt + tools byte-identical for prefix cache.")
    print("  First boot downloads ~22 GB; later boots reuse /workspace/hf-cache.")
    print()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Deploy Qwen3.8-27B NVFP4 on Runpod with SGLang")
    p.add_argument("--api-key", help="Runpod API key (else RUNPOD_API_KEY or .env)")
    p.add_argument(
        "--hf-token",
        help="Optional Hugging Face token. The NVFP4 checkpoint is public; skip this unless you hit rate limits.",
    )
    p.add_argument(
        "--use-runpod-hf-secret",
        action="store_true",
        help="Set pod HF_TOKEN from the account secret named HF_TOKEN (optional).",
    )
    p.add_argument("--cloud", choices=["SECURE", "COMMUNITY"], default=None)
    p.add_argument("--gpu", help="Exact GPU type id, e.g. 'NVIDIA RTX 6000 Ada Generation'")
    p.add_argument("--count", type=int, default=None, help="GPU count (default 1 in non-interactive)")
    p.add_argument("--yes", action="store_true", help="Skip the price confirm")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    recipe = load_recipe()
    print("Self-hosted Qwen3.8-27B NVFP4 — only a Runpod API key is required.")
    runpod_key = resolve_runpod_key(args.api_key)
    hf_token = resolve_hf_token(args.hf_token, args.use_runpod_hf_secret)
    sglang_key = secrets.token_hex(16)

    with client(runpod_key) as http:
        interactive = not (args.gpu and args.cloud)
        if interactive:
            if not sys.stdin.isatty():
                raise DeployError("Need a TTY for the dropdowns, or pass --cloud, --gpu, --count, and --yes.")
            cloud, gpu, count = pick_interactive(http, recipe)
        else:
            cloud, gpu, count = pick_flags(
                http,
                recipe,
                cloud=args.cloud or "SECURE",
                gpu_id=args.gpu,
                count=args.count or 1,
            )
        hourly = confirm_or_die(cloud, gpu, count, args.yes)
        print("Creating pod …")
        pod = create_pod(
            http,
            recipe,
            cloud=cloud,
            gpu=gpu,
            count=count,
            sglang_key=sglang_key,
            hf_token=hf_token,
        )
        print(f"  created {pod['id']}")
        print("Waiting for SGLang /v1/models (up to 25 min) …")
        pod = wait_until_ready(http, pod["id"], sglang_key, recipe["port"])
        print_handoff(pod, sglang_key, recipe["served_model_name"], recipe["port"], hourly)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
    except httpx.HTTPError as exc:
        print(f"HTTP error: {exc}", file=sys.stderr)
        sys.exit(1)
