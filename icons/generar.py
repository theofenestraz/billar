# Uso: python3 icons/generar.py icons
# Dibuja el icono de la bola 8 a 1024 px y lo reduce a los tamanos que piden los navegadores.
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
out = sys.argv[1]
N = 1024
# Fondo: verde tapete con vineta, para que el icono se vea bien en cualquier pantalla de inicio.
bg = Image.new('RGB', (N, N), '#11563f')
vig = Image.new('L', (N, N), 0)
ImageDraw.Draw(vig).ellipse((-N*0.25, -N*0.25, N*1.25, N*1.25), fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(N*0.12))
dark = Image.new('RGB', (N, N), '#06281d')
bg = Image.composite(bg, dark, vig)
# Sombra de la bola.
sh = Image.new('L', (N, N), 0)
ImageDraw.Draw(sh).ellipse((N*0.17, N*0.74, N*0.83, N*0.90), fill=150)
sh = sh.filter(ImageFilter.GaussianBlur(N*0.035))
bg = Image.composite(Image.new('RGB', (N, N), '#020806'), bg, sh)
# Bola: negro con degradado radial hacia una luz arriba a la izquierda.
c, r = N*0.5, N*0.36
ball = Image.new('RGB', (N, N), '#000000')
px = ball.load()
lx, ly = c - r*0.38, c - r*0.42
for y in range(int(c-r)-2, int(c+r)+3):
    for x in range(int(c-r)-2, int(c+r)+3):
        d = ((x-lx)**2 + (y-ly)**2) ** 0.5 / (r*1.55)
        v = max(0.0, 1 - d)
        g = int(8 + 70 * v**1.6)
        px[x, y] = (g, g, g+2)
mask = Image.new('L', (N, N), 0)
ImageDraw.Draw(mask).ellipse((c-r, c-r, c+r, c+r), fill=255)
bg = Image.composite(ball, bg, mask)
# Circulo blanco con el 8.
d = ImageDraw.Draw(bg)
cr = r*0.47
cx, cy = c - r*0.05, c - r*0.08
d.ellipse((cx-cr, cy-cr, cx+cr, cy+cr), fill='#f6f2e8')
font = ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc', int(cr*1.45), index=1)
d.text((cx, cy + cr*0.04), '8', font=font, fill='#101012', anchor='mm')
# Brillo especular.
spec = Image.new('L', (N, N), 0)
ImageDraw.Draw(spec).ellipse((c-r*0.72, c-r*0.86, c-r*0.18, c-r*0.5), fill=170)
spec = spec.filter(ImageFilter.GaussianBlur(N*0.022))
spec = ImageChops.multiply(spec, mask)
bg = Image.composite(Image.new('RGB', (N, N), '#ffffff'), bg, spec)
for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (64, 'favicon-64.png'), (32, 'favicon-32.png')]:
    bg.resize((size, size), Image.LANCZOS).save(f'{out}/{name}', optimize=True)
print('ok')
