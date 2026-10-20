"""Improved FSTravel captcha OCR: contrast boost + threshold + upscale.

Usage: python fstravel-captcha-ocr2.py <image>
Prints candidate digit strings, one per line.
"""
import sys

import numpy as np
from PIL import Image, ImageOps
from rapidocr_onnxruntime import RapidOCR


def digits_of(res):
    if not res:
        return ""
    return "".join("".join(t[1] for t in res).split())


def variants(img):
    gray = ImageOps.grayscale(img)
    out = []
    # 1) strong autocontrast then upscale
    ac = ImageOps.autocontrast(gray, cutoff=2)
    out.append(ac.resize((gray.width * 6, gray.height * 6), Image.LANCZOS).convert("RGB"))
    # 2) point-threshold (dark digits -> black on white)
    thr = gray.point(lambda p: 0 if p < 200 else 255)
    out.append(thr.resize((gray.width * 6, gray.height * 6), Image.LANCZOS).convert("RGB"))
    # 3) invert (some captchas read better inverted)
    inv = ImageOps.invert(gray)
    out.append(inv.resize((gray.width * 6, gray.height * 6), Image.LANCZOS).convert("RGB"))
    # 4) original upscaled
    out.append(gray.resize((gray.width * 6, gray.height * 6), Image.LANCZOS).convert("RGB"))
    return out


def main():
    if len(sys.argv) < 2:
        return
    img = Image.open(sys.argv[1])
    engine = RapidOCR()
    seen = set()
    out = []
    for cand in variants(img):
        res, _ = engine(np.array(cand))
        d = digits_of(res)
        if d and d not in seen:
            seen.add(d)
            out.append(d)
    print("\n".join(out))


if __name__ == "__main__":
    main()
