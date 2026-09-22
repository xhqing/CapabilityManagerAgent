#!/usr/bin/env python3
"""Check that no <text> element in an SVG overflows the canvas or margin.

Method: render the SVG twice (as-is, and with all <text> elements removed),
diff the two images pixel-by-pixel to isolate text pixels, then verify the
text bounding box stays inside the safe area (canvas minus margin).

Exit code 0 = pass, 1 = overflow detected, 2 = tool error.

Usage:
  check-text-bounds.py <logo.svg> [--margin-pct 5] [--scale 2]
"""
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"


def render(svg_path: Path, out_png: Path, scale: float) -> None:
    cmd = ["rsvg-convert", "-z", str(scale), "-o", str(out_png), str(svg_path)]
    subprocess.run(cmd, check=True, capture_output=True)


def strip_text(svg_path: Path, out_path: Path) -> None:
    tree = ET.parse(svg_path)
    root = tree.getroot()
    for parent in root.iter():
        for child in list(parent):
            tag = child.tag.split("}")[-1]
            if tag in ("text", "tspan"):
                parent.remove(child)
    tree.write(out_path, encoding="unicode", xml_declaration=False)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = {a.split("=")[0]: a.split("=")[1] for a in sys.argv[1:] if a.startswith("--")}
    if not args:
        print(__doc__)
        return 2
    svg = Path(args[0]).expanduser().resolve()
    if not svg.exists():
        print(f"ERROR: {svg} not found")
        return 2
    margin_pct = float(opts.get("--margin-pct", "5"))
    scale = float(opts.get("--scale", "2"))

    try:
        from PIL import Image, ImageChops
    except ImportError:
        print("ERROR: Pillow not installed (pip3 install pillow)")
        return 2

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        full_svg = td / "full.svg"
        notext_svg = td / "notext.svg"
        full_png = td / "full.png"
        notext_png = td / "notext.png"
        full_svg.write_text(svg.read_text(encoding="utf-8"), encoding="utf-8")
        strip_text(full_svg, notext_svg)
        try:
            render(full_svg, full_png, scale)
            render(notext_svg, notext_png, scale)
        except FileNotFoundError:
            print("ERROR: rsvg-convert not found (brew install librsvg)")
            return 2
        except subprocess.CalledProcessError as e:
            print(f"ERROR: render failed: {e.stderr.decode(errors='replace')}")
            return 2

        a = Image.open(full_png).convert("RGB")
        b = Image.open(notext_png).convert("RGB")
        w, h = a.size
        diff = ImageChops.difference(a, b)
        mask = diff.convert("L").point(lambda v: 255 if v > 24 else 0)
        bbox = mask.getbbox()
        if bbox is None:
            print("PASS: no text pixels detected (no <text> elements render?)")
            return 0

        mx = round(w * margin_pct / 100)
        my = round(h * margin_pct / 100)
        left, top, right, bottom = bbox  # right/bottom are exclusive
        right -= 1
        bottom -= 1

        problems = []
        if left < mx:
            problems.append(f"left edge {left}px < margin {mx}px")
        if top < my:
            problems.append(f"top edge {top}px < margin {my}px")
        if right > w - 1 - mx:
            problems.append(f"right edge {right}px > safe limit {w - 1 - mx}px (canvas {w}px)")
        if bottom > h - 1 - my:
            problems.append(f"bottom edge {bottom}px > safe limit {h - 1 - my}px (canvas {h}px)")

        print(f"canvas: {w}x{h}px  margin: {margin_pct}% ({mx}px horiz, {my}px vert)")
        print(f"text bbox: x [{left}, {right}]  y [{top}, {bottom}]")
        if problems:
            print("FAIL: text overflows safe area:")
            for p in problems:
                print(f"  - {p}")
            return 1
        print("PASS: all text inside safe area")
        return 0


if __name__ == "__main__":
    sys.exit(main())
