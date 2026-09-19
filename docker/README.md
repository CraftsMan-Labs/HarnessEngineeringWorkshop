# dsh + 9Router (Docker)

Runs [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) and [9Router](https://github.com/decolua/9router) side by side in Docker, with dsh routing model calls through 9Router.

## Why it's built this way

- **Host networking.** dsh's CLI intentionally refuses `--host 0.0.0.0` — its web server only binds `127.0.0.1`. Both containers use `network_mode: host` so dsh's `127.0.0.1:3080` is reachable from your machine, and dsh can reach 9Router at `127.0.0.1:20128` with no Docker DNS or port mapping involved.
- **Writable workspace.** dsh runs as the base image's non-root `node` (uid 1000) user, which owns `/workspace` (bind-mounted from `./workspace`) and `$DSH_HOME` (a named volume), so the agent can read and write files across container restarts.
- **Sandbox backend.** dsh's own local sandbox tries bubblewrap first, then falls back to Landlock (`docs/subsystems`/`packages/sandbox/sandbox-local`). Bubblewrap needs to mount a fresh `/proc` for a nested namespace, which only works with the container fully `--privileged` — not worth granting for a workshop container. Landlock needs no extra container capabilities at all and was verified working (allows workspace writes, denies writes elsewhere), so dsh's runner-chain probe picks it automatically here; no `cap_add`/`security_opt` is set. This sandboxing is in addition to, not instead of, running dsh inside a disposable container — see [DeepSeek Harness's own safety notice](https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md).

## Run it

```bash
cp .env.example .env
docker compose up -d --build
```

1. Open the 9Router dashboard at http://localhost:20128/dashboard, log in with `NINEROUTER_INITIAL_PASSWORD` (default `123456`), and create an API key plus whichever provider routes you want.
2. Put that key in `.env` as `NINEROUTER_API_KEY`, set `NINEROUTER_MODEL` to a model id the dashboard lists, then `docker compose up -d dsh` to restart dsh with it picked up.
3. Open http://127.0.0.1:3080. `DSH_WEB_AUTH=0` (default) skips dsh's `?token=` gate on this loopback workshop stack. Set `DSH_WEB_AUTH=1` in `.env` if you want the printed URL back.

Files the agent creates or edits land in `./workspace` on the host.

## Software factory plugin

The `dsh` service mounts [`plugins/dsh-software-factory`](../plugins/dsh-software-factory) at `/opt/dsh-software-factory` and, on first boot, runs `dsh plugin --profile web add` so the Host+Client bundle joins the same `web` profile that `dsh web` starts. dsh stays the non-root `node` user (uid 1000). Landlock/bubblewrap behavior is unchanged.

| Env | Default | Meaning |
|---|---|---|
| `FACTORY_PLUGIN_ENABLED` | `1` | `0` skips the profile install |
| `FACTORY_STATE_PATH` | `/workspace/.factory` | JSON/Markdown ledger (bind-mounted via `./workspace`) |
| `FACTORY_MUTATION_TOOLS` | `write,edit,bash,...` | tools blocked until a ticket is approved |
| `FACTORY_GATE_COMMANDS` | `npm test` | `|`-separated commands that must exit 0 before `pr_ready` |
| `FACTORY_API_PORT` | `13081` | Host–Client bridge, bound to `127.0.0.1` only |

Dashboard: http://127.0.0.1:3080 → sidebar **Factory**. Artifacts land in `./workspace/.factory` on the host.

If a previous `dsh_home` volume already has a `web` profile without the bundle, either `docker volume rm` that volume or:

```bash
docker compose exec dsh dsh plugin --profile web add /opt/dsh-software-factory
docker compose restart dsh
```

`@deepseek-ai/dsh` is pinned to `0.1.5-rc.2` in `docker/dsh/Dockerfile`. Installing `latest` would desync Cordis and client APIs from this plugin.

## Notes

- `settings.yaml` under the `dsh_home` volume is only written once, on first boot, so provider changes made later from the dsh Web UI (or by editing the file directly) survive restarts.
- `docker compose logs -f dsh` / `... ninerouter` for troubleshooting either service.
