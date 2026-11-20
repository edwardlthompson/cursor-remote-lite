from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / "docs" / "en"
srcs = [
    root / "ui-tablet-landscape.png",
    root / "tablet-layout-after.png",
    root / "tablet-debug-tabs.png",
    root / "tablet-debug-final.png",
]
live_dir = root / "_gif_frames"
frames_in = [p for p in srcs if p.is_file() and p.stat().st_size > 1000]
if live_dir.is_dir():
    live = sorted(live_dir.glob("frame*.png"))
    if live:
        with Image.open(live[0]) as im0:
            if im0.size[0] >= im0.size[1]:
                frames_in = [live[0], live[-1]] + frames_in[:2]

W, H = 960, 600
out_frames = []
for p in frames_in:
    im = Image.open(p).convert("RGB")
    im.thumbnail((W, H), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (W, H), (30, 30, 30))
    canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    out_frames.append(canvas)

dest = root / "ui-tablet-dualpane.gif"
out_frames[0].save(
    dest,
    save_all=True,
    append_images=out_frames[1:],
    duration=1400,
    loop=0,
    optimize=True,
)
print("wrote", dest, "frames", len(out_frames), "bytes", dest.stat().st_size)
