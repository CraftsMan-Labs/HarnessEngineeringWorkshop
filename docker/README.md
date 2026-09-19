# dsh + 9Router (Docker)

Runs [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) and [9Router](https://github.com/decolua/9router) side by side in Docker, with dsh routing model calls through 9Router.

## Why it's built this way

- **Host networking.** dsh's CLI intentionally refuses `--host 0.0.0.0` — its web server only binds `127.0.0.1`. Both containers use `network_mode: host` so dsh's `127.0.0.1:3080` is reachable from your machine, and dsh can reach 9Router at `127.0.0.1:20128` with no Docker DNS or port mapping involved.
- **Writable workspace.** dsh runs as a non-root `dsh` user that owns `/workspace` (bind-mounted from `./workspace`) and `$DSH_HOME` (a named volume), so the agent can read and write files across container restarts.
- **Sandbox capabilities.** dsh's own local sandbox (bubblewrap, falling back to Landlock on Linux) needs nested namespaces to work; the `dsh` service adds `cap_add: SYS_ADMIN` and relaxed seccomp/apparmor for that. This is in addition to, not instead of, running dsh inside a disposable container — see [DeepSeek Harness's own safety notice](https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md).

## Run it

```bash
cp .env.example .env
docker compose up -d --build
```

1. Open the 9Router dashboard at http://localhost:20128/dashboard, log in with `NINEROUTER_INITIAL_PASSWORD` (default `123456`), and create an API key plus whichever provider routes you want.
2. Put that key in `.env` as `NINEROUTER_API_KEY`, set `NINEROUTER_MODEL` to a model id the dashboard lists, then `docker compose up -d dsh` to restart dsh with it picked up.
3. Open dsh's web UI at http://localhost:3080. Files the agent creates or edits land in `./workspace` on the host.

## Notes

- `settings.yaml` under the `dsh_home` volume is only written once, on first boot, so provider changes made later from the dsh Web UI (or by editing the file directly) survive restarts.
- `docker compose logs -f dsh` / `... ninerouter` for troubleshooting either service.
