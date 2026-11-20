from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MERMAID = ROOT / 'node_modules' / '.bin' / 'mmdc'


def main() -> None:
    if not MERMAID.exists():
        raise SystemExit('Mermaid CLI is missing. Run npm ci before rendering diagrams.')
    env = os.environ.copy()
    if env.get('CHROME_PATH'):
        env.setdefault('PUPPETEER_EXECUTABLE_PATH', env['CHROME_PATH'])
    for name in ('architecture', 'clock-lifecycle'):
        source = ROOT / 'diagrams' / f'{name}.mmd'
        target = ROOT / 'public' / 'diagrams' / f'{name}.svg'
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
    print('Rendered primary architecture and clock-lifecycle diagrams.')


if __name__ == '__main__':
    main()
