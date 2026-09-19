#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$DSH_HOME"

# Bootstrap the 9Router provider once; leave it alone on later starts so
# changes made from the dsh Web UI (or $DSH_HOME/settings.yaml) survive restarts.
if [ ! -f "$DSH_HOME/settings.yaml" ] && [ -n "${NINEROUTER_BASE_URL:-}" ]; then
  cat > "$DSH_HOME/settings.yaml" <<YAML
llm-pi-ai:
  providers:
    ninerouter:
      apiKeyEnv: NINEROUTER_API_KEY
      api: openai-completions
      baseURL: ${NINEROUTER_BASE_URL}
      models:
        - id: ${NINEROUTER_MODEL:-cc/claude-opus-4-6}
YAML
fi

exec dsh "$@"
