"""App icons from one barbell glyph (option A): dark #161616 background, accent #FFC400.
Run: python scripts/make-icons.py  (Pillow). Writes assets/{icon,android-icon-*,splash-icon,favicon}.png
"""
from PIL import Image, ImageDraw

BG, FG = (0x16, 0x16, 0x16, 255), (0xFF, 0xC4, 0x00, 255)
# Glyph in a 100×100 box: bar, then outer/inner plates on each side (x, y, w, h, radius).
SHAPES = [(14, 47, 72, 6, 3), (20, 30, 9, 40, 3), (31, 36, 7, 28, 3), (71, 30, 9, 40, 3), (62, 36, 7, 28, 3)]

def render(size, glyph_frac, bg=None, fg=FG, corner=0):
    s = size * 4  # supersample, then downscale for smooth edges
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg:
        d.rounded_rectangle((0, 0, s - 1, s - 1), corner * 4, fill=bg) if corner else d.rectangle((0, 0, s, s), fill=bg)
    k = s * glyph_frac / 100
    off = (s - 100 * k) / 2
    for x, y, w, h, r in SHAPES:
        d.rounded_rectangle((off + x * k, off + y * k, off + (x + w) * k, off + (y + h) * k), r * k, fill=fg)
    return im.resize((size, size), Image.LANCZOS)

render(1024, 0.80, BG).convert('RGB').save('assets/icon.png')  # iOS masks the corners itself
render(512, 0.62).save('assets/android-icon-foreground.png')  # inside the adaptive-icon safe zone
Image.new('RGBA', (512, 512), BG).save('assets/android-icon-background.png')
render(432, 0.62, fg=(255, 255, 255, 255)).save('assets/android-icon-monochrome.png')  # themed icons tint it
render(1024, 0.45).save('assets/splash-icon.png')
render(48, 0.84, BG, corner=11).save('assets/favicon.png')
print('icons written')
