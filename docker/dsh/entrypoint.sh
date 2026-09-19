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

# Load the software-factory bundle into the web profile. `dsh web` is an alias
# for `--profile web`. Skip when disabled or the checkout is not mounted.
FACTORY_PLUGIN_ENABLED="${FACTORY_PLUGIN_ENABLED:-1}"
FACTORY_PLUGIN_PATH="${FACTORY_PLUGIN_PATH:-/opt/dsh-software-factory}"
if [ "$FACTORY_PLUGIN_ENABLED" = "1" ] && [ -f "$FACTORY_PLUGIN_PATH/package.json" ]; then
  profile_json="$DSH_HOME/profiles/web/package.json"
  if [ ! -f "$profile_json" ] || ! grep -q '"dsh-software-factory"' "$profile_json"; then
    dsh plugin --profile web add "$FACTORY_PLUGIN_PATH"
  fi
fi

exec dsh "$@"
