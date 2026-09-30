"""Best-effort OCR for Summertour (SAMO) antibot captcha images.

Usage: python summertour-captcha-ocr.py <image>
Prints candidate digit strings, one per line (empty when nothing recognized).

Notes (verified live):
- The SAMO captcha is a short green-on-white digit code (2-3 digits), heavily
  stylized/crosshatched. RapidOCR/EasyOCR never read it; ddddocr does.
- The caller must POST exactly ONE candidate per image: a wrong answer rotates
  the code, so extra guesses on the same image are wasted.
"""
import io
import sys

try:
    import ddddocr
except Exception:  # pragma: no cover
    ddddocr = None

try:
    from PIL import Image, ImageOps
except Exception:  # pragma: no cover
    Image = None


def sanitize(text):
    if not text:
        return ""
    return "".join(ch for ch in str(text) if ch.isdigit())


def collect(raw, seen, out):
    d = sanitize(raw)
    if d and d not in seen and len(d) <= 6:
        seen.add(d)
        out.append(d)


def main():
    if len(sys.argv) < 2 or ddddocr is None:
        return
    try:
        with open(sys.argv[1], "rb") as f:
            data = f.read()
    except Exception:
        return
    if not data:
        return

    try:
        ocr = ddddocr.DdddOcr(show_ad=False)
    except Exception:
        ocr = ddddocr.DdddOcr()

    seen, out = set(), []
    for payload in (data, _inverted(data)):
        if not payload:
            continue
        try:
            collect(ocr.classification(payload), seen, out)
        except Exception:
            continue
        if out:
            break
    print("\n".join(out))


def _inverted(data):
    """White-on-black rendering reads worse in practice, but costs nothing to try."""
    if Image is None:
        return None
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        buf = io.BytesIO()
        ImageOps.invert(img).save(buf, format="PNG")
        return buf.getvalue()
    except Exception:
        return None


if __name__ == "__main__":
    main()
