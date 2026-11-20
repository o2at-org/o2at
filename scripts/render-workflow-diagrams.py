from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'diagrams' / 'workflows'
SOURCE_PACK = SOURCE_DIR / 'source-pack'
OUTPUT_DIR = ROOT / 'public' / 'diagrams' / 'workflows'
MERMAID = ROOT / 'node_modules' / '.bin' / 'mmdc'


def main() -> None:
    if not MERMAID.exists():
        raise SystemExit('Mermaid CLI is missing. Run npm ci before rendering workflows.')
    sources = sorted((SOURCE_DIR / 'mermaid').glob('*.mmd'))
    if len(sources) != 34:
        raise SystemExit(f'Expected 34 supplied Mermaid sources, found {len(sources)}.')

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    public_sources = OUTPUT_DIR / 'mermaid'
    public_sources.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    if env.get('CHROME_PATH'):
        env.setdefault('PUPPETEER_EXECUTABLE_PATH', env['CHROME_PATH'])

    for source in sources:
        target = OUTPUT_DIR / f'{source.stem}.svg'
        subprocess.run([
            str(MERMAID), '-i', str(source), '-o', str(target),
            '-b', 'transparent', '--no-font-embed', '-q',
        ], check=True, cwd=ROOT, env=env)
        svg = target.read_text()
        root_id = re.search(r'<svg[^>]*\bid="([^"]+)"', svg)
        if root_id and ('edge-animation-' in svg or 'animation:dash' in svg):
            svg = svg.replace(
                '</style>',
                f'@media (prefers-reduced-motion: reduce) {{ #{root_id.group(1)} .edge-animation-slow, '
                f'#{root_id.group(1)} .edge-animation-fast {{ animation: none !important; '
                f'stroke-dasharray: none !important; stroke-dashoffset: 0 !important; }} }}</style>',
                1,
            )
            target.write_text(svg)
        shutil.copy2(source, public_sources / source.name)

    for name in ('README.md', 'O2AT_Mermaid_Workflows.md', 'source_manifest.json', 'MANIFEST.sha256'):
        shutil.copy2(SOURCE_PACK / name, OUTPUT_DIR / name)
    shutil.copy2(SOURCE_DIR / 'diagram_index.json', OUTPUT_DIR / 'diagram_index.json')
    print(f'Rendered {len(sources)} supplied Mermaid workflows and copied their editable sources.')


if __name__ == '__main__':
    main()
