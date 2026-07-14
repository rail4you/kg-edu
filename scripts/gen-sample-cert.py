#!/usr/bin/env python3
"""生成用于"扫描件模板"功能演示的示例证书扫描图。

输出: kg-edu-vite-antd/public/samples/sample-certificate.png (800x560)

布局:
  - 米色底 + 双层边框
  - 顶部深蓝渐变条 + 圆形校徽
  - 标题"结业证书"
  - 中部正文，姓名位置留白（方便在前端定位姓名框）
  - 底部签名线 + 红色印章

用法:
  pip install pillow
  python scripts/gen-sample-cert.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

W, H = 800, 560
OUT = os.path.join(
    os.path.dirname(__file__),
    "..",
    "kg-edu-vite-antd",
    "public",
    "samples",
    "sample-certificate.png",
)


def load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Supplemental/Songti.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_centered(draw, text, font, y, fill, spacing=0):
    if spacing:
        total = 0
        widths = []
        for ch in text:
            bbox = draw.textbbox((0, 0), ch, font=font)
            w = bbox[2] - bbox[0]
            widths.append(w)
            total += w + spacing
        total -= spacing
        x = (W - total) / 2
        for ch, w in zip(text, widths):
            draw.text((x, y), ch, font=font, fill=fill)
            x += w + spacing
    else:
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        draw.text(((W - w) / 2, y), text, font=font, fill=fill)


def main():
    img = Image.new("RGB", (W, H), "#FBF9F3")
    draw = ImageDraw.Draw(img)

    # 顶部深蓝渐变条
    band_h = 90
    top, bottom = (18, 38, 78), (52, 96, 158)
    for y in range(band_h):
        t = y / band_h
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # 圆形校徽
    cx, cy, cr = W // 2, band_h // 2, 30
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], outline="#d9c37a", width=3)
    draw.ellipse([cx - cr + 8, cy - cr + 8, cx + cr - 8, cy + cr - 8], outline="#d9c37a", width=1)
    seal_font = load_font(20, bold=True)
    b = draw.textbbox((0, 0), "校", font=seal_font)
    draw.text((cx - (b[2] - b[0]) / 2, cy - (b[3] - b[1]) / 2 - b[1]), "校", font=seal_font, fill="#f2e3a8")

    # 双层边框
    draw.rectangle([16, 16, W - 16, H - 16], outline="#8c6a2f", width=3)
    draw.rectangle([26, 26, W - 26, H - 26], outline="#c9a765", width=1)

    # 标题
    title_font = load_font(48, bold=True)
    draw_centered(draw, "结业证书", title_font, 130, "#1f2a44", spacing=12)
    sub_font = load_font(16)
    draw_centered(draw, "CERTIFICATE OF COMPLETION", sub_font, 190, "#8a8a86", spacing=4)

    # 正文（姓名位置留白）
    body_font = load_font(20)
    draw_centered(draw, "兹证明", body_font, 250, "#3a3a36")
    # 姓名留白横线（居中，约在 y=300）
    line_y = 322
    draw.line([(280, line_y), (520, line_y)], fill="#c9a765", width=1)
    draw_centered(draw, "同学在本机构学习期间，成绩合格，", body_font, 345, "#3a3a36")
    draw_centered(draw, "准予结业，特发此证，以资证明。", body_font, 378, "#3a3a36")

    # 底部签名线
    small_font = load_font(15)
    draw.line([(90, 470), (250, 470)], fill="#8a8a86", width=1)
    draw.text((110, 478), "签发人（签章）", font=small_font, fill="#7a7a74")
    draw.line([(90, 505), (250, 505)], fill="#8a8a86", width=1)
    draw.text((130, 512), "颁发日期", font=small_font, fill="#7a7a74")

    # 红色印章
    sx, sy, sr = 620, 460, 52
    draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], outline="#c0392b", width=3)
    stamp_font = load_font(14, bold=True)
    stamp_text = "教务处专用章"
    b = draw.textbbox((0, 0), stamp_text, font=stamp_font)
    draw.text((sx - (b[2] - b[0]) / 2, sy - (b[3] - b[1]) / 2 - b[1]), stamp_text,
              font=stamp_font, fill="#c0392b")
    # 五角星中心
    draw.text((sx - 6, sy - 34), "★", font=load_font(18), fill="#c0392b")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT)
    print("saved:", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
