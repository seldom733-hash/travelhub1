#!/usr/bin/env python
"""Сборка видео-инструкции: кадры + русская озвучка + титры.

Использование:
    python build_video.py scenes/video1-v2.json out/video1-v2.mp4
"""
import asyncio
import json
import math
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import edge_tts
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent           # video-prod/
SHOTS = ROOT / "shots"
BUILD = ROOT / "build"
AUDIO = BUILD / "audio"
FRAMES = BUILD / "frames"
CLIPS = BUILD / "clips"

FFMPEG = r"C:\Program Files\Python311\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v9.0.2.exe"
VOICE = "piper:ru_RU-denis-medium"
PIPER_MODEL = ROOT / "tools" / "piper" / "ru_RU-denis-medium.onnx"
PIPER_TXT = BUILD / "tts-input.txt"
W, H = 1920, 1080
FPS = 30

FONT_DIR = Path(r"C:\Windows\Fonts")


def font(name: str, size: int):
    for cand in (FONT_DIR / name, FONT_DIR / "segoeui.ttf"):
        if cand.exists():
            return ImageFont.truetype(str(cand), size)
    return ImageFont.load_default()


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"cmd failed: {' '.join(cmd)}\n{p.stderr[-1500:]}")
    return p


def duration_of(path: Path) -> float:
    """Длительность через ffmpeg (ffprobe в этой сборке нет)."""
    p = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    for line in p.stderr.splitlines():
        line = line.strip()
        if line.startswith("Duration:"):
            hms = line.split("Duration:")[1].split(",")[0].strip()
            h, m, s = hms.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise RuntimeError(f"cannot read duration: {path}")


async def _tts_chunk(text: str, out: Path) -> None:
    com = edge_tts.Communicate(text, VOICE, rate="-4%")
    await com.save(str(out))


def _split(text: str, limit: int = 230) -> list[str]:
    parts, cur = [], ""
    for sentence in re.split(r"(?<=[.!?])\s+", text.strip()):
        if not sentence:
            continue
        if len(cur) + len(sentence) + 1 <= limit:
            cur = (cur + " " + sentence).strip()
        else:
            if cur:
                parts.append(cur)
            cur = sentence
    if cur:
        parts.append(cur)
    return parts or [text]


async def tts(text: str, out: Path) -> None:
    """Локальный синтез Piper (мужской русский голос), без сети и лимитов."""
    PIPER_TXT.parent.mkdir(parents=True, exist_ok=True)
    PIPER_TXT.write_text(text, encoding="utf-8")
    run([
        sys.executable, "-m", "piper",
        "-m", str(PIPER_MODEL),
        "-i", str(PIPER_TXT),
        "-f", str(out),
        "--length-scale", "1.08",
        "--sentence-silence", "0.35",
    ])
    if not out.exists() or out.stat().st_size < 2000:
        raise RuntimeError("piper produced no audio")


def cover(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    ratio = max(W / img.width, H / img.height)
    new = (math.ceil(img.width * ratio), math.ceil(img.height * ratio))
    img = img.resize(new, Image.LANCZOS)
    left = (img.width - W) // 2
    top = (img.height - H) // 2
    return img.crop((left, top, left + W, top + H))


def chip(draw: ImageDraw.ImageDraw, xy, text: str, bg=(15, 23, 42, 215), fg=(255, 255, 255), size=30):
    f = font("segoeuib.ttf", size)
    x, y = xy
    pad_x, pad_y = 26, 14
    box = draw.textbbox((0, 0), text, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.rounded_rectangle([x, y, x + w + pad_x * 2, y + h + pad_y * 2], radius=14, fill=bg)
    draw.text((x + pad_x, y + pad_y - box[1]), text, font=f, fill=fg)


def section_frame(src: Path, caption: str, out: Path) -> None:
    base = cover(Image.open(src))
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    if caption:
        chip(d, (48, H - 96), caption, size=30)
    d.text((W - 210, 34), "Navitravel", font=font("segoeuib.ttf", 24), fill=(255, 255, 255, 170))
    base = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    base.save(out, quality=92)


def title_frame(title: str, subtitle: str, out: Path, accent=(16, 107, 95)) -> None:
    base = Image.new("RGB", (W, H), (8, 20, 24))
    d = ImageDraw.Draw(base)
    for i in range(H):
        t = i / H
        d.line([(0, i), (W, i)], fill=(int(8 + 10 * t), int(20 + 26 * t), int(24 + 24 * t)))
    d.rectangle([0, 0, 16, H], fill=accent)
    d.text((140, 360), title, font=font("segoeuib.ttf", 78), fill=(255, 255, 255))
    if subtitle:
        y = 480
        f = font("segoeui.ttf", 36)
        wrapped, cur = [], ""
        for word in subtitle.split():
            probe = (cur + " " + word).strip()
            if d.textlength(probe, font=f) > W - 320:
                wrapped.append(cur)
                cur = word
            else:
                cur = probe
        if cur:
            wrapped.append(cur)
        for line in wrapped:
            d.text((144, y), line, font=f, fill=(198, 214, 210))
            y += 48
    d.text((144, 900), "Navitravel", font=font("segoeuib.ttf", 34), fill=accent)
    base.save(out, quality=92)


def _draw_lines(d: ImageDraw.ImageDraw, lines: list[str], x: int, y: int, width: int, size=32, gap=48) -> None:
    f = font("segoeui.ttf", size)
    for line in lines:
        wrapped, cur = [], ""
        for word in line.split():
            probe = (cur + " " + word).strip()
            if d.textlength(probe, font=f) > width:
                wrapped.append(cur)
                cur = word
            else:
                cur = probe
        if cur:
            wrapped.append(cur)
        for wl in wrapped:
            d.text((x, y), wl, font=f, fill=(240, 228, 226))
            y += gap
        y += 8


def callout_frame(kicker: str, title: str, lines: list[str], out: Path) -> None:
    base = Image.new("RGB", (W, H), (26, 12, 14))
    d = ImageDraw.Draw(base)
    for i in range(H):
        t = i / H
        d.line([(0, i), (W, i)], fill=(int(30 + 12 * t), int(12 + 8 * t), int(14 + 8 * t)))
    d.rectangle([0, 0, 16, H], fill=(190, 40, 40))
    d.text((140, 170), kicker.upper(), font=font("segoeuib.ttf", 30), fill=(255, 160, 150))
    d.text((140, 230), title, font=font("segoeuib.ttf", 58), fill=(255, 255, 255))
    _draw_lines(d, lines, 144, 350, W - 320)
    d.text((144, H - 90), "Navitravel · внутренняя инструкция", font=font("segoeui.ttf", 26), fill=(160, 120, 120))
    base.save(out, quality=92)


def callout_over_frame(src: Path, kicker: str, title: str, lines: list[str], out: Path) -> None:
    base = cover(Image.open(src)).convert("RGBA")
    shade = Image.new("RGBA", base.size, (10, 6, 8, 205))
    base = Image.alpha_composite(base, shade)
    d = ImageDraw.Draw(base)
    d.rectangle([30, 30, W - 30, H - 30], outline=(214, 64, 54), width=6)
    d.text((90, 96), kicker.upper(), font=font("segoeuib.ttf", 30), fill=(255, 150, 140))
    d.text((88, 150), title, font=font("segoeuib.ttf", 56), fill=(255, 255, 255))
    _draw_lines(d, lines, 92, 270, W - 220)
    base.convert("RGB").save(out, quality=92)


def list_frame(title: str, items: list[str], out: Path, accent=(16, 107, 95)) -> None:
    base = Image.new("RGB", (W, H), (248, 250, 249))
    d = ImageDraw.Draw(base)
    d.rectangle([0, 0, 18, H], fill=accent)
    d.text((140, 140), title, font=font("segoeuib.ttf", 60), fill=(15, 40, 36))
    y = 290
    f = font("segoeui.ttf", 34)
    fb = font("segoeuib.ttf", 34)
    for i, item in enumerate(items, start=1):
        name, _, rest = item.partition(" — ")
        d.ellipse([150, y + 8, 190, y + 48], fill=accent)
        d.text((162, y + 11), str(i), font=font("segoeuib.ttf", 26), fill=(255, 255, 255))
        d.text((215, y), name, font=fb, fill=(15, 40, 36))
        y += 52
        if rest:
            wrapped, cur = [], ""
            for word in rest.split():
                probe = (cur + " " + word).strip()
                if d.textlength(probe, font=f) > W - 420:
                    wrapped.append(cur)
                    cur = word
                else:
                    cur = probe
            if cur:
                wrapped.append(cur)
            for wl in wrapped:
                d.text((215, y), wl, font=f, fill=(70, 90, 86))
                y += 44
        y += 22
    base.save(out, quality=92)


def encode_scene(frame: Path, audio: Path, out: Path, dur: float) -> None:
    frames = max(1, int(dur * FPS))
    zoom = (
        f"zoompan=z='min(zoom+0.00035,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d={frames}:s={W}x{H}:fps={FPS}"
    )
    cmd = [
        FFMPEG, "-y", "-loop", "1", "-i", str(frame), "-i", str(audio),
        "-filter_complex", f"[0:v]scale={W * 2}:-2,{zoom},format=yuv420p[v];[1:a]apad=pad_dur=0.7[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{dur:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", str(out),
    ]
    for attempt in range(4):
        try:
            if out.exists():
                out.unlink()
            run(cmd)
            return
        except RuntimeError as e:
            if "Permission" in str(e) and attempt < 3:
                time.sleep(3)
                continue
            raise


def build(scenes_path: Path, out_path: Path) -> None:
    for d in (AUDIO, FRAMES, CLIPS, out_path.parent):
        d.mkdir(parents=True, exist_ok=True)

    scenes = json.loads(scenes_path.read_text(encoding="utf-8-sig"))
    clips = []

    for idx, sc in enumerate(scenes, start=1):
        sid = sc.get("id") or f"s{idx:02d}"
        audio = AUDIO / f"{sid}.wav"
        frame = FRAMES / f"{sid}.png"
        clip = CLIPS / f"{sid}.mp4"

        if not (audio.exists() and audio.stat().st_size > 1500):
            asyncio.run(tts(sc["narration"], audio))
        dur = duration_of(audio) + 0.9

        kind = sc.get("kind", "shot")
        if kind == "title":
            title_frame(sc["title"], sc.get("subtitle", ""), frame)
        elif kind == "callout":
            if sc.get("image"):
                callout_over_frame(SHOTS / sc["image"], sc.get("kicker", "Найдено расхождение"), sc["title"], sc.get("lines", []), frame)
            else:
                callout_frame(sc.get("kicker", "Найдено расхождение"), sc["title"], sc.get("lines", []), frame)
        elif kind == "list":
            list_frame(sc["title"], sc.get("items", []), frame)
        else:
            section_frame(SHOTS / sc["image"], sc.get("caption", ""), frame)

        encode_scene(frame, audio, clip, dur)
        clips.append(clip)
        print(f"{sid}: {dur:5.1f}s  {sc.get('caption', sc.get('title', ''))}", flush=True)

    listfile = BUILD / f"{out_path.stem}-concat.txt"
    listfile.write_text("".join(f"file '{c.as_posix()}'\n" for c in clips), encoding="utf-8")
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(listfile), "-c", "copy", "-movflags", "+faststart", str(out_path)])
    print("Готово:", out_path, f"{duration_of(out_path) / 60:.1f} мин")


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path(sys.argv[2]))
