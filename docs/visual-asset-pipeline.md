# Visual Asset Pipeline

OpenAI's currently documented GPT Image model is `gpt-image-1.5`; there is not a public `gpt-image-2.0` model name to install. This repo has the official `openai` npm package installed for app-side work, and the Codex image generation CLI can generate production PNGs when `OPENAI_API_KEY` is available.

Generated assets live in `public/assets/game/`.

## Current Assets

- `title-hero.png` - start screen and lobby background.
- `can-projectile.png` - thrown can sprite.
- `impact-burst.png` - hit effect sprite.
- `blank-park-sign.png` - transparent prop/UI art.
- `ground-clutter-decal.png` - transparent ground decals.
- `dirt-road-texture.png` - gameplay road texture.
- `patchy-grass-texture.png` - gameplay terrain texture.

## Batch Recipe

Create a JSONL prompt file under `tmp/imagegen/`, then use the bundled imagegen CLI from the repo root:

```bash
set -a
source /mnt/main-drive/identity/secrets/ai-cloud.env
set +a

python3 /home/hackerman/.codex/skills/imagegen/scripts/image_gen.py generate-batch \
  --input tmp/imagegen/visual-pass-assets.jsonl \
  --out-dir public/assets/game \
  --concurrency 3 \
  --model gpt-image-1.5
```

Keep batch prompt files in `tmp/imagegen/` and remove them after generation unless they are being turned into documented production prompts.
