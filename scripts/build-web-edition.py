#!/usr/bin/env python3
"""Convert the selected O2AT ODT to semantic HTML without modifying the master."""
from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
import zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ODT = ROOT / 'spec/source/O2AT_v0.2_Whitepaper.odt'
MANIFEST = ROOT / 'spec/source-manifest.json'
OUT = ROOT / 'src/generated/spec-body.html'
TOC = ROOT / 'src/generated/spec-toc.json'
MEDIA = ROOT / 'public/specification/media'

NS = {
    'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
    'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
    'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
    'style': 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
    'fo': 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
    'draw': 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
    'svg': 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
    'xlink': 'http://www.w3.org/1999/xlink',
}


def tag(local: str, prefix: str = 'text') -> str:
    return f"{{{NS[prefix]}}}{local}"


def slug(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-') or 'section'


def plain(node: ET.Element) -> str:
    return ''.join(node.itertext()).strip()


def build() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    digest = hashlib.sha256(ODT.read_bytes()).hexdigest()
    expected = manifest['sourceSha256']
    if digest != expected:
        raise SystemExit(f'ODT hash mismatch: expected {expected}, got {digest}; update the reviewed source manifest deliberately.')
    matching_pdf = ROOT / 'public/downloads/O2AT_v0.2_Whitepaper.pdf'
    pdf_digest = hashlib.sha256(matching_pdf.read_bytes()).hexdigest()
    expected_pdf = manifest['matchingPdfSha256']
    if pdf_digest != expected_pdf:
        raise SystemExit(f'Matching PDF hash mismatch: expected {expected_pdf}, got {pdf_digest}; do not publish a PDF from a different export.')
    (ROOT / 'public/specification/source-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    MEDIA.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ODT) as archive:
        content = ET.fromstring(archive.read('content.xml'))
        styles = ET.fromstring(archive.read('styles.xml'))
        style_props: dict[str, dict[str, str]] = {}
        for root in (styles, content):
            for style in root.findall('.//style:style', NS):
                name = style.get(tag('name', 'style'))
                props = style.find('style:text-properties', NS)
                if name and props is not None:
                    style_props[name] = {k.rsplit('}', 1)[-1]: v for k, v in props.attrib.items()}

        for member in archive.namelist():
            p = PurePosixPath(member)
            if p.parts[0] == 'Pictures' and p.suffix.lower() in {'.svg', '.png', '.jpg', '.jpeg', '.webp'}:
                target = MEDIA / p.name
                target.write_bytes(archive.read(member))

        note_nodes = content.findall('.//text:note', NS)
        note_citations: dict[str, str] = {}
        note_bodies: dict[str, str] = {}
        note_id_count: dict[str, int] = {}
        for index, note in enumerate(note_nodes, 1):
            note_id = note.get(tag('id', 'text')) or f'note-{index}'
            cite = plain(note.find('text:note-citation', NS)) if note.find('text:note-citation', NS) is not None else str(index)
            body = note.find('text:note-body', NS)
            note_citations[note_id] = cite
            note_bodies[note_id] = render_blocks(list(body), note_citations, note_id_count, style_props) if body is not None else ''

        body = content.find('.//office:body/office:text', NS)
        if body is None:
            raise SystemExit('ODT has no office:text document body')

        toc_items: list[dict[str, str | int]] = []
        for h in body.findall('.//text:h', NS):
            title = plain(h)
            level = int(h.get(tag('outline-level')) or '1')
            toc_items.append({'title': title, 'id': slug(title), 'level': level})

        body_html = render_blocks(list(body), note_citations, note_id_count, style_props, toc_items)
        if note_bodies:
            body_html += '<section class="spec-footnotes" aria-labelledby="footnotes-title"><h2 id="footnotes-title">Footnotes</h2><ol>'
            for note_id, note_body in note_bodies.items():
                cite = note_citations[note_id]
                body_html += f'<li id="{html.escape(note_id, quote=True)}"><span class="footnote-number">{html.escape(cite)}</span> {note_body}</li>'
            body_html += '</ol></section>'

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(body_html, encoding='utf-8')
    TOC.write_text(json.dumps(toc_items, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Generated semantic edition from {ODT.relative_to(ROOT)}: {len(toc_items)} headings, {len(note_nodes)} footnotes, {len(body_html):,} HTML characters.')


def render_inline(node: ET.Element, note_citations: dict[str, str], note_id_count: dict[str, int], style_props: dict[str, dict[str, str]]) -> str:
    result = html.escape(node.text or '')
    for child in list(node):
        local = child.tag.rsplit('}', 1)[-1]
        if child.tag == tag('note'):
            note_id = child.get(tag('id', 'text'), '')
            cite = note_citations.get(note_id, '?')
            note_id_count[note_id] = note_id_count.get(note_id, 0) + 1
            ref_id = f'footnote-ref-{slug(note_id)}-{note_id_count[note_id]}'
            result += f'<sup class="note-ref"><a id="{ref_id}" href="#{html.escape(note_id, quote=True)}" aria-label="Footnote {html.escape(cite, quote=True)}">{html.escape(cite)}</a></sup>'
        elif child.tag == tag('a'):
            href = child.get(f"{{{NS['xlink']}}}href", '')
            inner = render_inline(child, note_citations, note_id_count, style_props)
            if href.startswith(('https://', 'http://', 'mailto:')):
                result += f'<a href="{html.escape(href, quote=True)}" target="_blank" rel="noopener noreferrer">{inner}</a>'
            elif href.startswith('#'):
                result += f'<a href="{html.escape(href, quote=True)}">{inner}</a>'
            else:
                result += inner
        elif child.tag == tag('frame', 'draw'):
            image = child.find('.//draw:image', NS)
            if image is not None:
                href = image.get(f"{{{NS['xlink']}}}href", '')
                basename = PurePosixPath(href).name
                frame_title = child.find('svg:title', NS)
                frame_desc = child.find('svg:desc', NS)
                alt = plain(frame_desc) if frame_desc is not None else plain(frame_title) if frame_title is not None else 'O2AT specification diagram'
                result += f'<img class="source-figure" src="/specification/media/{html.escape(basename, quote=True)}" alt="{html.escape(alt, quote=True)}" loading="lazy">'
        elif child.tag == tag('s'):
            count = int(child.get(tag('c')) or '1')
            result += ' ' * min(count, 32)
        elif child.tag == tag('tab'):
            result += ' &nbsp; '
        elif child.tag == tag('line-break'):
            result += '<br>'
        elif child.tag == tag('span'):
            inner = render_inline(child, note_citations, note_id_count, style_props)
            style_name = child.get(tag('style-name'))
            props = style_props.get(style_name or '', {})
            if props.get('font-weight') == 'bold':
                inner = f'<strong>{inner}</strong>'
            if props.get('font-style') == 'italic':
                inner = f'<em>{inner}</em>'
            if 'text-position' in props:
                inner = f'<sup>{inner}</sup>' if props['text-position'].startswith('super') else f'<sub>{inner}</sub>' if props['text-position'].startswith('sub') else inner
            result += inner
        else:
            result += render_inline(child, note_citations, note_id_count, style_props)
        result += html.escape(child.tail or '')
    return result


def render_cell(cell: ET.Element, notes: dict[str, str], refs: dict[str, int], styles: dict[str, dict[str, str]]) -> str:
    pieces: list[str] = []
    for child in list(cell):
        if child.tag in {tag('p'), tag('h')}:
            text = render_inline(child, notes, refs, styles).strip()
            if text:
                pieces.append(text)
        elif child.tag == tag('list'):
            pieces.append(render_list(child, notes, refs, styles))
        elif child.tag == tag('table', 'table'):
            pieces.append(render_table(child, notes, refs, styles))
    return '<br>'.join(pieces)


def render_table(table: ET.Element, notes: dict[str, str], refs: dict[str, int], styles: dict[str, dict[str, str]], caption: str | None = None) -> str:
    header_rows: list[list[ET.Element]] = []
    body_rows: list[list[ET.Element]] = []
    header = table.find('table:table-header-rows', NS)
    if header is not None:
        header_rows.extend(r.findall('table:table-cell', NS) for r in header.findall('.//table:table-row', NS))
    body_rows.extend(row.findall('table:table-cell', NS) for row in table.findall('table:table-row', NS))
    if not header_rows and body_rows:
        header_rows.append(body_rows.pop(0))
    if not header_rows and not body_rows:
        return ''
    repeated_caption = table.get(tag('name', 'table'))
    out = '<div class="data-table-wrap" role="region" tabindex="0" aria-label="Specification table. Scroll horizontally to read all columns.">'
    out += '<p class="table-hint">This table is wider than the reading column. Scroll horizontally to read all columns.</p>'
    out += '<table>'
    label = caption or (repeated_caption.replace('_', ' ') if repeated_caption else None)
    if label:
        out += f'<caption>{html.escape(label)}</caption>'
    out += '<thead>'
    for cells in header_rows:
        out += '<tr>'
        for cell in cells:
            colspan = int(cell.get(tag('number-columns-spanned', 'table')) or '1')
            span_attr = f' colspan="{colspan}"' if colspan > 1 else ''
            out += f'<th scope="col"{span_attr}>{render_cell(cell, notes, refs, styles)}</th>'
        out += '</tr>'
    out += '</thead>'
    if body_rows:
        out += '<tbody>'
        for cells in body_rows:
            out += '<tr>'
            for cell in cells:
                colspan = int(cell.get(tag('number-columns-spanned', 'table')) or '1')
                span_attr = f' colspan="{colspan}"' if colspan > 1 else ''
                out += f'<td{span_attr}>{render_cell(cell, notes, refs, styles)}</td>'
            out += '</tr>'
        out += '</tbody>'
    out += '</table></div>'
    return out


def render_list(node: ET.Element, notes: dict[str, str], refs: dict[str, int], styles: dict[str, dict[str, str]]) -> str:
    is_ordered = 'number' in (node.get(tag('style-name')) or '').lower()
    tag_name = 'ol' if is_ordered else 'ul'
    out = f'<{tag_name}>'
    for item in node.findall('text:list-item', NS):
        out += '<li>'
        for child in list(item):
            if child.tag in {tag('p'), tag('h')}:
                out += render_inline(child, notes, refs, styles)
            elif child.tag == tag('list'):
                out += render_list(child, notes, refs, styles)
        out += '</li>'
    return out + f'</{tag_name}>'


def render_blocks(nodes: list[ET.Element], notes: dict[str, str], refs: dict[str, int], styles: dict[str, dict[str, str]], toc_items: list[dict[str, str | int]] | None = None) -> str:
    out: list[str] = []
    seen_heading: dict[str, int] = {}
    section_stack: list[int] = []
    pending_caption: str | None = None
    for node in nodes:
        if node.tag == tag('table-of-content'):
            continue
        if node.tag == tag('h'):
            title = plain(node)
            level = max(1, min(5, int(node.get(tag('outline-level')) or '1')))
            base_id = slug(title)
            seen_heading[base_id] = seen_heading.get(base_id, 0) + 1
            ident = base_id if seen_heading[base_id] == 1 else f'{base_id}-{seen_heading[base_id]}'
            if toc_items is not None:
                for item in toc_items:
                    if item['title'] == title and item['id'] == base_id:
                        item['id'] = ident
                        break
            while section_stack and section_stack[-1] >= level:
                out.append('</section>')
                section_stack.pop()
            out.append(f'<section class="spec-section" id="{ident}"><h{level + 1}>{render_inline(node, notes, refs, styles)}</h{level + 1}>')
            section_stack.append(level)
        elif node.tag == tag('p'):
            rendered = render_inline(node, notes, refs, styles).strip()
            if rendered:
                source_text = plain(node)
                if re.match(r'^Table\s+\d+\.', source_text):
                    pending_caption = source_text
                else:
                    if pending_caption:
                        out.append(f'<p class="table-caption-intro">{html.escape(pending_caption)}</p>')
                        pending_caption = None
                    out.append(f'<p>{rendered}</p>')
        elif node.tag == tag('table', 'table'):
            out.append(render_table(node, notes, refs, styles, pending_caption))
            pending_caption = None
        elif node.tag == tag('list'):
            out.append(render_list(node, notes, refs, styles))
        elif node.tag == tag('section', 'text'):
            out.append(render_blocks(list(node), notes, refs, styles))
    while section_stack:
        out.append('</section>')
        section_stack.pop()
    if pending_caption:
        out.append(f'<p class="table-caption-intro">{html.escape(pending_caption)}</p>')
    return '\n'.join(out)


if __name__ == '__main__':
    build()
