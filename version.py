#!/usr/bin/env python3
"""Cambia el sufijo ?v=N de los modulos del navegador para que no se sirvan de la cache.
Uso: python3 version.py 5
Los modulos de physics, rules y game no llevan sufijo en el codigo porque tambien los cargan los tests
con jsc; en el navegador se les pone con el import map de index.html, para que no se queden en cache."""
import glob, os, re, sys

V = sys.argv[1]
WEB = ('src/render', 'src/player', 'src/ui', 'src/audio', 'src/net')
files = [f for d in WEB for f in glob.glob(d + '/*.js')] + ['src/main.js']
for f in files:
    s = open(f, encoding='utf-8').read()

    def sub(m, f=f):
        spec = m.group(2).split('?')[0]
        target = os.path.normpath(os.path.join(os.path.dirname(f), spec))
        versioned = target.startswith(WEB) or target == 'src/main.js'
        return m.group(1) + spec + ('?v=' + V if versioned else '') + m.group(3)

    open(f, 'w', encoding='utf-8').write(re.sub(r"(from\s+')(\.{1,2}/[^']+)(')", sub, s))
h = open('index.html', encoding='utf-8').read()
h = re.sub(r'src="src/main\.js(\?v=\d+)?"', 'src="src/main.js?v=' + V + '"', h)
h = re.sub(r'href="styles\.css(\?v=\d+)?"', 'href="styles.css?v=' + V + '"', h)
# Import map: cada modulo compartido con los tests se redirige a su copia con ?v=N.
SHARED = sorted(f for d in ('src/physics', 'src/rules', 'src/game') for f in glob.glob(d + '/*.js'))
lines = ['      "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"',
         '      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"']
lines += ['      "./%s": "./%s?v=%s"' % (f, f, V) for f in SHARED]
block = '    "imports": {\n' + ',\n'.join(lines) + '\n    }'
h = re.sub(r'    "imports": \{.*?\n    \}', lambda m: block, h, count=1, flags=re.S)
open('index.html', 'w', encoding='utf-8').write(h)
