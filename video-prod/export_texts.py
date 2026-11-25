"""Выгрузка текстов видео в Markdown."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = [
    ("Видео 1. Как найти и забронировать услугу", ROOT / "scenes" / "video1-spec.json"),
    ("Видео 2. От заявки до закрытия сделки", ROOT / "scenes" / "video2-spec.json"),
]

out = ["# Тексты видео Navitravel", ""]
for title, path in FILES:
    scenes = json.loads(path.read_text(encoding="utf-8-sig"))
    out += [f"## {title}", "", f"Сцен: {len(scenes)}", ""]
    for i, sc in enumerate(scenes, start=1):
        caption = sc.get("caption") or sc.get("title") or ""
        out.append(f"### {i}. {caption}".rstrip())
        out.append("")
        out.append(sc["narration"].strip())
        out.append("")

target = ROOT / "ТЕКСТЫ-ВИДЕО.md"
target.write_text("\n".join(out), encoding="utf-8")
words = sum(len(sc["narration"].split()) for _, p in FILES for sc in json.loads(p.read_text(encoding="utf-8-sig")))
print("готово:", target, "| слов:", words)
