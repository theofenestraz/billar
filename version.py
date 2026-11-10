#!/usr/bin/env python3
"""Cambia el sufijo ?v=N de los modulos del navegador para que no se sirvan de la cache.
Uso: python3 version.py 5
Los modulos de physics, rules y game no llevan sufijo porque tambien los cargan los tests con jsc."""
import glob, os, re, sys

V = sys.argv[1]
WEB = ('src/render', 'src/player', 'src/ui', 'src/audio')
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
open('index.html', 'w', encoding='utf-8').write(h)
