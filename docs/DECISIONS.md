# O2AT website decision log

## 2026-11-20: selected the bundled v0.2 source

The O2AT launch package manifest verified. The bundled ODT SHA-256 is `df21b57cd1f6d6a188d9e5a78037f27d85f90614c6ad6d919b2ba213bd5b0a00`; its matching PDF is `efc5e00a4056c18f25fd37768e48a83ad20cdf207f9a97081e93e6e89e28f989`. Broader local search found no newer O2AT ODT. A separate PDF copy has editorial differences and is excluded from publication.

## Static Astro output

The site uses a static build and existing Nginx static hosting if target validation permits. It needs no new runtime process, database, CMS, analytics or paid service.

## Proposed versus demonstrated capability

The specification and worked bandwidth tables are proposals and analytical results. Site copy and visualisations label implementation status explicitly; no prototype or listening claim is attributed to O2AT hardware.

## DNS ownership and change boundary

Public records show GoDaddy authoritative DNS at the time of reconnaissance. The principal will make any required GoDaddy DNS edits after receiving the verified target records. No DNS edit is made by the website agent.

## 2026-11-20: workflow-diagram source and presentation

The user-supplied Mermaid workflow archive is preserved byte-for-byte under `diagrams/workflows/source-pack/`; its manifest is checked during every production build. Rendered working copies use the Mermaid Chart theme and are published in a 34-item review gallery with source downloads, source-section links and clear current/proposed status labels. Process diagrams with a readable sequence use landscape left-to-right flow; sequence and state diagrams retain their appropriate forms. The system overview separates audio data, receiver feedback and conversion-clock paths by colour. Motion stops under `prefers-reduced-motion`. SVGs are rendered locally without embedding a font. This is a visual/source presentation decision only; it does not adopt proposed Type 1, Type 2 or clock-hub material into the v0.2 specification.
