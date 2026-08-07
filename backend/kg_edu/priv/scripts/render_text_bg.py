#!/usr/bin/env python3
"""Render a solid-color background with wrapped CJK text into a PNG.

Usage:
  render_text_bg.py <bg_color> <size_w> <size_h> <text_file> <output.png>
"""
import sys
from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = [
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def pick_font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def wrap_text(text, font, max_width, draw):
    lines = []
    for raw in text.splitlines():
        line = ""
        for ch in raw:
            if draw.textlength(line + ch, font=font) > max_width:
                lines.append(line)
                line = ch
            else:
                line += ch
        lines.append(line)
    return lines


def main():
    bg_color, w, h, text_file, output = sys.argv[1:6]
    with open(text_file, encoding="utf-8") as f:
        text = f.read()

    img = Image.new("RGB", (int(w), int(h)), bg_color)
    draw = ImageDraw.Draw(img)

    base_size = int(int(h) * 0.045)
    font = pick_font(base_size)
    margin = int(w) * 8 // 100
    lines = wrap_text(text, font, int(w) - 2 * margin, draw)

    max_lines = 14
    lines = lines[:max_lines]
    line_height = int(base_size * 1.45)
    total_h = line_height * len(lines)
    y = (int(h) - total_h) // 2

    for line in lines:
        tw = draw.textlength(line, font=font)
        x = (int(w) - tw) // 2
        draw.text((x, y), line, font=font, fill="#ffffff")
        y += line_height

    img.save(output, "PNG")
    print("ok")


if __name__ == "__main__":
    main()
