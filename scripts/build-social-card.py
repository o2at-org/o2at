#!/usr/bin/env python3
"""Embed the approved O²AT outline master into the self-contained social-card SVG."""
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SVG_NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG_NS)
brand = ET.parse(ROOT / 'public/brand/o2at_superscript_black.svg').getroot()
if brand.get('viewBox') != '0 0 1039 375':
    raise SystemExit('The superscript master has changed; review social-card scale before rebuilding it.')
mark = next((node for node in brand if node.tag == f'{{{SVG_NS}}}g'), None)
if mark is None or any(node.tag != f'{{{SVG_NS}}}path' for node in list(mark)):
    raise SystemExit('Expected the supplied outlined path group in the O²AT logo master.')
mark.set('transform', 'translate(82 155) scale(0.42)')
logo = ET.tostring(mark, encoding='unicode')
svg = f'''<svg xmlns="{SVG_NS}" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
<title id="title">O²AT · Open Optical Audio Transport</title>
<desc id="desc">An open engineering proposal for optical audio transport, version 0.2 draft.</desc>
<rect width="1200" height="630" fill="#f5f7f7"/>
<path d="M0 465h1200" stroke="#d9e2e3"/>
<text x="82" y="122" fill="#075e67" font-family="Avenir Next,Avenir,Arial,sans-serif" font-size="18" letter-spacing="3">OPEN OPTICAL AUDIO TRANSPORT</text>
{logo}
<text x="84" y="370" fill="#52666c" font-family="Avenir Next,Avenir,Arial,sans-serif" font-size="30">Open Optical Audio Transport</text>
<text x="84" y="535" fill="#52666c" font-family="ui-monospace,monospace" font-size="20">v0.2 · ENGINEERING DRAFT</text>
<path d="M830 205h200M830 275h200M830 345h200" stroke="#087b83" stroke-width="6"/>
<circle cx="830" cy="205" r="12" fill="#087b83"/>
<circle cx="1030" cy="275" r="12" fill="#bd6a27"/>
<circle cx="830" cy="345" r="12" fill="#4555a0"/>
</svg>'''
(ROOT / 'public/social-card.svg').write_text(svg, encoding='utf-8')
print('Rendered the social-card SVG from the approved outlined logo asset.')
