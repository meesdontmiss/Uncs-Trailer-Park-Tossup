# Visual Asset Pipeline

OpenAI announced ChatGPT Images 2.0 on April 21, 2026. For API image generation, use the model name `gpt-image-2` where available. During verification propagation, the dated model ID `gpt-image-2-2026-04-21` was the reliable working target. This repo has the official `openai` npm package installed for app-side work, and the Codex image generation CLI can generate production PNGs when `OPENAI_API_KEY` is available.

Generated assets live in `public/assets/game/`.

## Current Assets

- `title-hero.png` - start screen and lobby background.
- `can-projectile.png` - thrown can sprite.
- `nav-can-logo.png` - restored gamified crushed can used in nav/loading UI.
- `impact-burst.png` - hit effect sprite.
- `blank-park-sign.png` - transparent prop/UI art.
- `lobby-park-sign.png` - restored gamified sign used in the lobby UI.
- `ground-clutter-decal.png` - transparent ground decals.
- `dirt-road-texture.png` - gameplay road texture.
- `patchy-grass-texture.png` - gameplay terrain texture.

## Batch Recipe

Use the documented prompt batch, then run the bundled imagegen CLI from the repo root:

```bash
set -a
source /mnt/main-drive/identity/secrets/ai-cloud.env
set +a

python3 /home/hackerman/.codex/skills/imagegen/scripts/image_gen.py generate-batch \
  --input docs/gpt-image-2-asset-pass.jsonl \
  --out-dir public/assets/game \
  --concurrency 2 \
  --model gpt-image-2-2026-04-21 \
  --force
```

Keep batch prompt files in `tmp/imagegen/` and remove them after generation unless they are being turned into documented production prompts.

## Transparent Sprite Workaround

As of this pass, `gpt-image-2-2026-04-21` rejects transparent-background generation. For sprite/decal assets, render the object on a flat chroma-magenta background with `--background opaque`, then remove magenta locally to restore alpha. The current `public/assets/game/` sprites were produced this way:

- `can-projectile.png`
- `impact-burst.png`
- `blank-park-sign.png`
- `ground-clutter-decal.png`

## Access Notes

`gpt-image-2` requires verified organization access. If the Image API returns a 403 asking for organization verification after verification is complete, wait for propagation and retry. The April 25 asset pass saw intermittent 403s that resolved on retry.
