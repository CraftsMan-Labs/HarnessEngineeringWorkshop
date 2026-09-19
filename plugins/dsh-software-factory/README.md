# dsh-software-factory

Host+Client DeepSeek Harness plugin for one local software-factory slice:

`epic → Grill Me → approved ticket → implementation → quality gate → Three Whys learning`

Pinned runtime: `@deepseek-ai/dsh@0.1.5-rc.2`.

## What is implemented

- Epic and ticket CRUD (`factory_epic` / `factory_ticket`: create, get, list, update, delete, select); dashboard board matches
- Workspace-local system of record under `$FACTORY_STATE_PATH` (default `/workspace/.factory`)
- Ticket states: `aligning → approved → implementing → validating → pr_ready → done`
- Grill Me: one question at a time, recommended answer required, no approval while questions are pending
- Mutating tool guard until a ticket leaves `aligning`
- Quality-gate evidence + human review before `pr_ready`
- Session tool failures attach to a run; incidents are explicit
- Three Whys: exactly three answers, then a knowledge markdown file
- DSH Web dashboard (sidebar **Factory** button) over `127.0.0.1:13081`

## Not implemented (adapters later)

Linear, GitHub draft PRs, Grafana/Sentry ingestion, extra diagnostic DAGs.

## Artifacts

```
.factory/
  index.json
  history.jsonl
  epics/<id>.json
  epics/<id>.md
  tickets/<id>.json
  tickets/<id>.md
  runs/<id>.json
  incidents/<id>.json
  incidents/<id>.md
  knowledge/<id>.md
```

JSON is canonical. Markdown is the reviewable copy. Writes are temp-file + rename.

## Configure

| Env | Default | Meaning |
|---|---|---|
| `FACTORY_PLUGIN_ENABLED` | `1` | `0` skips Host mount and Docker install |
| `FACTORY_STATE_PATH` | `/workspace/.factory` | artifact root |
| `FACTORY_WORKSPACE` | `/workspace` | cwd for gate commands |
| `FACTORY_MUTATION_TOOLS` | `write,edit,bash,...` | tools blocked before approval |
| `FACTORY_GATE_COMMANDS` | `npm test` | `|`-separated commands that must exit 0 |
| `FACTORY_API_PORT` | `13081` | Host–Client HTTP bridge (published as 127.0.0.1 only; see docker/README.md) |
| `FACTORY_INCIDENT_THRESHOLD` | `3` | recorded for later auto-incident work; unused today |

## Docker

From the repo root, fresh machine:

```bash
cp .env.example .env
docker compose up -d --build
```

Open http://127.0.0.1:3080 and click **Factory**. `DSH_WEB_AUTH=0` (default) skips the `?token=` gate because this stack is loopback-only. Set `DSH_WEB_AUTH=1` to restore it. 9Router login is http://localhost:20128/dashboard (password `NINEROUTER_INITIAL_PASSWORD`, default `123456`); put the API key in `.env` as `NINEROUTER_API_KEY` and run `docker compose up -d dsh` once more.

That loads this checkout into the `web` profile as uid 1000 `node`. More detail: `docker/README.md`.

Disable: `FACTORY_PLUGIN_ENABLED=0`.

Uninstall from a live home volume:

```bash
docker compose exec dsh dsh plugin --profile web remove dsh-software-factory
```

## Verify

```bash
cd plugins/dsh-software-factory
npm test
npm run smoke
```

Recovery: artifacts are files. Restore `.factory/` from git or copy; `index.json` + `history.jsonl` are the ledger.
