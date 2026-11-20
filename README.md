# O2AT website

Static Astro publication for the Open Optical Audio Transport engineering proposal.

## Source and status

The published specification is generated from the bundled `O2AT_Launch/reference/O2AT_v0.2_Whitepaper.odt`. Its SHA-256 is `df21b57cd1f6d6a188d9e5a78037f27d85f90614c6ad6d919b2ba213bd5b0a00`. The matching supplied PDF is retained as-is in `public/downloads`. The site's version (`0.1.1`) is separate from O2AT's proposed wire-version nibble (`0x2`).

O2AT v0.2 is an engineering draft for review. This repository contains the website, a generated HTML rendering and illustrative tools. It does not claim a hardware prototype, measured clock performance, independent conformance result, certification or manufacturer endorsement.

## Develop

Requirements: Node.js `>=22.23.4`, npm `>=9.6.5`, Python 3.11 or later, and the checked-in npm lockfile.

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
npm run qa:browser
```

The browser QA command expects Google Chrome at its standard macOS path or `CHROME_PATH` pointing to an installed Chromium-based browser. It renders every route at 375, 768, 1440 and 1920 pixels, audits key routes with axe-core and checks keyboard navigation and the calculator.

The ODT-to-HTML script reads the source ODT, verifies the expected hash, extracts the embedded source diagram and regenerates `src/generated/spec-body.html` and `src/generated/spec-toc.json`. It never writes to the ODT. `npm run build` writes only static files to `dist/`.

## Content maintenance

Use the source ODT for normative text. Do not edit generated HTML directly. Rebuild the web edition after a reviewed source revision and update `spec/source-manifest.json`, downloads, compatibility notes and tests together. The logo files in `public/brand/` are the supplied outlined vector masters. The superscript mark is used for the website; the baseline mark is retained for compact hardware identification.

Journal articles are editorial explanations and do not add requirements. The small `docs/publication/substack/` copies are local publication-ready text; they are not sent or scheduled automatically.

## Diagrams and numerical tools

Editable Mermaid sources are in `diagrams/`; the supplied workflow pack is preserved byte-for-byte under `diagrams/workflows/source-pack/`. The 34 workflow diagrams are rendered locally as SVG and published in a review gallery at `/workflows/`, with source downloads, section links and clear current/proposed status labels. Desktop diagrams use wide landscape canvases; smaller screens can scroll within each labelled diagram region. Use `npm run render:diagrams` and `npm run render:workflows` to regenerate the SVGs. Mermaid is not loaded from a third-party service, and SVGs use no embedded font. Diagram labels and signals are reviewed against the v0.2 ODT. The bandwidth formulas and clock/FIFO model are isolated in `src/client/` and have numerical unit tests. Explore-page labels identify analytical and illustrative output.

Regenerate the social preview with `npm run render:social` on macOS. The script embeds paths from the supplied approved logo master and rasterises the card to PNG with the built-in `sips` utility.

## Contribution route

The issue template requests a source version, section, defect, evidence, proposed edit and compatibility effect. A proposal is not adopted until the maintainer publishes it as a numbered revision. Do not file credentials, private equipment details or personal information.

## Privacy

The static website has no backend, account, email collection, analytics or third-party embedded content. Standard web request logs may be maintained by the hosting operator; see `/privacy/`.

## Release and rollback

See `docs/release/README.md` for the static release workflow. Host-specific inventory, addresses, account details and rollback state are kept outside this public repository.
