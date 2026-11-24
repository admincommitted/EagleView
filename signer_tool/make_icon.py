"""Draws eagleview_signer.ico (used by BUILD_SIGNER_EXE.bat)."""
from PIL import Image, ImageDraw

img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((8, 8, 248, 248), radius=56, fill=(35, 70, 184, 255))
d.line((68, 164, 120, 116, 184, 64), fill=(255, 255, 255, 255), width=24, joint="curve")
d.line((60, 200, 196, 200), fill=(255, 255, 255, 235), width=16)
img.save("eagleview_signer.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icon written")
