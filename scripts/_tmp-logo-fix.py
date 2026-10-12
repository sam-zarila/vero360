from PIL import Image

src = Image.open(r"scripts/_tmp-logo-orig.png").convert("RGB")
w, h = src.size
px = src.load()

# Recover the orange mark from the black matte and keep edge softness as alpha.
out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
op = out.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        alpha = max(r, g, b)
        if alpha < 12:
            continue
        # Un-premultiply so the stroke stays the original orange, not a faded tint.
        op[x, y] = (
            min(255, int(r * 255 / alpha + 0.5)),
            min(255, int(g * 255 / alpha + 0.5)),
            min(255, int(b * 255 / alpha + 0.5)),
            alpha,
        )

# Crop to the ink with a little padding, then place on white.
bbox = out.getbbox()
pad = 36
x0 = max(0, bbox[0] - pad)
y0 = max(0, bbox[1] - pad)
x1 = min(w, bbox[2] + pad)
y1 = min(h, bbox[3] + pad)
cropped = out.crop((x0, y0, x1, y1))

# Square canvas so the mark stays centered in the navbar slot.
side = max(cropped.size)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(cropped, ((side - cropped.size[0]) // 2, (side - cropped.size[1]) // 2), cropped)

white = Image.new("RGB", canvas.size, (255, 255, 255))
white.paste(canvas, mask=canvas.split()[-1])
white.save(r"scripts/_tmp-logo-on-white.png", "PNG")
canvas.save(r"scripts/_tmp-logo-alpha.png", "PNG")
print("canvas", canvas.size, "bbox", bbox)
