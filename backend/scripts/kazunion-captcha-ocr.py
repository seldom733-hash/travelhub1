"""Best-effort OCR for KazUnion kcaptcha images.

Usage: python kazunion-captcha-ocr.py <image>
Prints candidate digit strings, one per line (empty when nothing recognized).
The caller POSTs every candidate — wrong answers do NOT invalidate the code
(verified live), and the final answer is verified with a GET round-trip.
"""
import sys

import numpy as np
from PIL import Image, ImageOps
from rapidocr_onnxruntime import RapidOCR


def digits_of(res):
    if not res:
        return ""
    return "".join("".join(t[1] for t in res).split())


def main():
    if len(sys.argv) < 2:
        return
    img = Image.open(sys.argv[1])
    gray = ImageOps.grayscale(img)
    big = gray.resize((gray.width * 4, gray.height * 4), Image.LANCZOS).convert("RGB")
    engine = RapidOCR()
    seen = set()
    out = []
    for cand in (big, img.convert("RGB")):
        res, _ = engine(np.array(cand))
        d = digits_of(res)
        if d and d not in seen:
            seen.add(d)
            out.append(d)
    print("\n".join(out))


if __name__ == "__main__":
    main()
