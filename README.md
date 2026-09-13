# Self-hosted Qwen3.8-27B NVFP4

Anyone with a **Runpod API key** can stand up the same SGLang endpoint we used in this workshop: OpenAI-compatible `/v1`, cache-aware prefix reuse, 128k context.

That API key is the only required credential. The NVFP4 weights are public.

## Deploy

1. Create a key at [console.runpod.io/user/settings](https://console.runpod.io/user/settings)
2. Run the wizard:

```bash
uv run python deploy_qwen38.py
```

or:

```bash
python3 -m pip install -r requirements.txt
python3 deploy_qwen38.py --api-key rpa_...
```

The script prompts for the key if it is not already in `RUNPOD_API_KEY` or `.env`. Then it shows live stock as dropdowns:

1. Cloud (Secure default, or Community)
2. GPU type — **in-stock only**, with VRAM, $/hr, and DCs
3. GPU count — **only counts that have stock**
4. Confirm the hourly price, then create

It waits until `GET /v1/models` is live (first boot downloads ~22 GB, often 10–20 minutes) and prints:

- OpenAI base URL `https://<podId>-30000.proxy.runpod.net/v1`
- API key and model `qwen38-27b`
- SSH commands

Non-interactive:

```bash
uv run python deploy_qwen38.py \
  --cloud SECURE \
  --gpu "NVIDIA RTX 6000 Ada Generation" \
  --count 1 \
  --yes
```

`count > 1` sets `--tp-size N`. Official Qwen3.8 recipes are single-GPU; multi-GPU TP is experimental.

## Call it

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<podId>-30000.proxy.runpod.net/v1",
    api_key="<printed by the wizard>",
)
resp = client.chat.completions.create(
    model="qwen38-27b",
    messages=[{"role": "user", "content": "Hello"}],
    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
)
```

Keep the system prompt and tool schemas byte-identical so prefix cache hits. Responses include `usage.prompt_tokens_details.cached_tokens`.

## Optional

| Item | Why |
|---|---|
| `HF_TOKEN` or `--hf-token` | Only if Hugging Face rate-limits the public pull |
| `--use-runpod-hf-secret` | Use an account secret named `HF_TOKEN` instead |
| 48 GB+ GPU | 27B NVFP4 is tight below that; the wizard warns, it does not block |

The pod bills at the catalog hourly rate until you stop or terminate it in the Runpod console.
