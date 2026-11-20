#!/usr/bin/env python3
"""Fail a static build on broken local links, missing assets, duplicate IDs or inline CSP hazards."""
from __future__ import annotations

import hashlib
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'


class PageAudit(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.links: list[str] = []
        self.assets: list[str] = []
        self.controls: list[tuple[str, str | None]] = []
        self.labels: set[str] = set()
        self.implicitly_labeled_controls: set[str] = set()
        self.label_depth = 0
        self.inline_scripts = 0
        self.inline_styles = 0
        self.inline_style_attributes = 0
        self.inline_handlers = 0
        self.images_missing_alt = 0
        self.unsafe_new_tab_links = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'] or '')
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'] or '')
            if a.get('target') == '_blank' and not {'noopener', 'noreferrer'} <= set((a.get('rel') or '').lower().split()):
                self.unsafe_new_tab_links += 1
        if tag == 'img':
            if a.get('src'):
                self.assets.append(a['src'] or '')
            if a.get('alt') is None:
                self.images_missing_alt += 1
        if tag == 'script':
            if a.get('src'):
                self.assets.append(a['src'] or '')
            else:
                self.inline_scripts += 1
        if tag == 'link' and ({'stylesheet', 'icon'} & set((a.get('rel') or '').split())) and a.get('href'):
            self.assets.append(a['href'] or '')
        if tag == 'meta' and a.get('property') == 'og:image' and a.get('content'):
            self.assets.append(a['content'] or '')
        if tag == 'label':
            self.label_depth += 1
            if a.get('for'):
                self.labels.add(a['for'] or '')
        if tag in {'input', 'select', 'textarea'} and a.get('id'):
            self.controls.append((a['id'] or '', a.get('aria-label')))
            if self.label_depth:
                self.implicitly_labeled_controls.add(a['id'] or '')
        if 'style' in a:
            self.inline_style_attributes += 1
        if any(k.lower().startswith('on') for k, _ in attrs):
            self.inline_handlers += 1

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag == 'style':
            self.inline_styles += 1
        if tag == 'label':
            self.label_depth = max(0, self.label_depth - 1)
        if tag == 'script':
            pass


def local_target(base_url: str, href: str) -> tuple[Path | None, str | None]:
    target = urlsplit(urljoin(base_url, href))
    if target.scheme not in {'http', 'https'} or target.netloc != 'o2at.net':
        return None, None
    path = unquote(target.path)
    if not path or path == '/':
        return DIST / 'index.html', target.fragment or None
    candidate = DIST / path.lstrip('/')
    if candidate.is_dir() or path.endswith('/'):
        candidate = candidate / 'index.html'
    elif not candidate.exists() and (candidate.parent / candidate.name / 'index.html').is_file():
        candidate = candidate / 'index.html'
    return candidate, target.fragment or None


def main() -> int:
    if not DIST.is_dir():
        print('dist/ is missing; run npm run build first.', file=sys.stderr)
        return 1
    errors: list[str] = []
    pages = sorted(DIST.rglob('*.html'))
    page_audits: dict[Path, PageAudit] = {}
    for path in pages:
        audit = PageAudit()
        audit.feed(path.read_text(encoding='utf-8'))
        page_audits[path] = audit
        duplicates = sorted({item for item in audit.ids if audit.ids.count(item) > 1})
        if duplicates:
            errors.append(f'{path.relative_to(DIST)}: duplicate IDs {duplicates[:8]}')
        if audit.inline_scripts or audit.inline_styles or audit.inline_style_attributes:
            errors.append(f'{path.relative_to(DIST)}: inline CSP content: scripts={audit.inline_scripts}, styles={audit.inline_styles}, style attributes={audit.inline_style_attributes}')
        if audit.inline_handlers:
            errors.append(f'{path.relative_to(DIST)}: inline event handler found.')
        if audit.images_missing_alt:
            errors.append(f'{path.relative_to(DIST)}: {audit.images_missing_alt} image(s) missing alt text.')
        if audit.unsafe_new_tab_links:
            errors.append(f'{path.relative_to(DIST)}: {audit.unsafe_new_tab_links} new-tab link(s) lack noopener and noreferrer.')
        for control_id, label in audit.controls:
            if control_id not in audit.labels and control_id not in audit.implicitly_labeled_controls and not label:
                errors.append(f'{path.relative_to(DIST)}: form control #{control_id} has no associated label')
        for asset in audit.assets:
            file, _ = local_target('https://o2at.net/', asset)
            if file is not None and not file.is_file():
                errors.append(f'{path.relative_to(DIST)}: missing asset {asset}')

    id_sets = {path: set(audit.ids) for path, audit in page_audits.items()}
    for path, audit in page_audits.items():
        relative = path.relative_to(DIST)
        if relative.name == 'index.html':
            parent = str(relative.parent)
            base_path = '/' if parent == '.' else '/' + parent + '/'
        else:
            base_path = '/' + str(relative)
        for href in audit.links:
            file, fragment = local_target('https://o2at.net' + base_path, href)
            if file is None:
                continue
            if not file.is_file():
                errors.append(f'{path.relative_to(DIST)}: broken local link {href}')
            elif fragment and file.suffix == '.html':
                if fragment not in id_sets.get(file, set()):
                    errors.append(f'{path.relative_to(DIST)}: missing fragment {href}')
    manifest = json.loads((ROOT / 'spec/source-manifest.json').read_text(encoding='utf-8'))
    checks = [
        (ROOT / 'spec/source/O2AT_v0.2_Whitepaper.odt', manifest['sourceSha256']),
        (DIST / 'downloads/O2AT_v0.2_Whitepaper.pdf', manifest['matchingPdfSha256']),
    ]
    for file, expected in checks:
        actual = hashlib.sha256(file.read_bytes()).hexdigest()
        if actual != expected:
            errors.append(f'{file}: SHA-256 mismatch: {actual}')
    if not (DIST / 'downloads/O2AT_v0.2_Whitepaper.odt').is_file():
        errors.append('Missing editable ODT download.')
    if (DIST / 'social-card.svg').is_file() and b'https://' in (DIST / 'social-card.svg').read_bytes():
        errors.append('Social card must be self-contained, with no remote asset dependency.')

    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'Static validation passed: {len(pages)} HTML pages, local links/assets, labels, CSP-safe markup and source/download hashes.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
