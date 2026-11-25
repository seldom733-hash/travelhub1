#!/usr/bin/env python
"""Медленный проход синтеза речи: кэширует mp3 для всех сцен с большими паузами."""
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_video import AUDIO, ROOT, _split, _tts_chunk

FILES = [
    ROOT / "scenes" / "video1-spec.json",
    ROOT / "scenes" / "video2-spec.json",
]
AUDIO.mkdir(parents=True, exist_ok=True)

async def synth(text: str, out: Path) -> bool:
    chunks = _split(text)
    parts_dir = out.parent / f"{out.stem}-parts"
    if len(chunks) == 1:
        for attempt in range(12):
            try:
                await _tts_chunk(chunks[0], out)
                if out.exists() and out.stat().st_size > 1500:
                    return True
            except Exception as e:
                print(f"    retry {attempt + 1}: {type(e).__name__}", flush=True)
            await asyncio.sleep(20 + attempt * 10)
        return False

    parts_dir.mkdir(exist_ok=True)
    for i, chunk in enumerate(chunks):
        part = parts_dir / f"{i:02d}.mp3"
        if part.exists() and part.stat().st_size > 1500:
            continue
        ok = False
        for attempt in range(12):
            try:
                await _tts_chunk(chunk, part)
                if part.exists() and part.stat().st_size > 1500:
                    ok = True
                    break
            except Exception as e:
                print(f"    retry {attempt + 1}: {type(e).__name__}", flush=True)
            await asyncio.sleep(20 + attempt * 10)
        if not ok:
            return False
        await asyncio.sleep(8)
    return True

async def main():
    total = missing = 0
    for f in FILES:
        scenes = json.loads(f.read_text(encoding="utf-8-sig"))
        for sc in scenes:
            total += 1
            out = AUDIO / f"{sc['id']}.mp3"
            if out.exists() and out.stat().st_size > 1500:
                continue
            missing += 1
            print(f"synth {sc['id']} …", flush=True)
            ok = await synth(sc["narration"], out)
            print(f"  {sc['id']}: {'ok' if ok else 'FAILED'}", flush=True)
            if not ok:
                print("стоп: сервис не отвечает", flush=True)
                return
            await asyncio.sleep(8)
    print(f"готово: сцен {total}, синтезировано {missing}", flush=True)

asyncio.run(main())
