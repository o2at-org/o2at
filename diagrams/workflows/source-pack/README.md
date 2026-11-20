# O2AT Mermaid source pack

This pack contains 34 editable Mermaid diagrams, a complete illustrated-source catalogue, architecture notes and a source register for o2at.net.

## Start here

1. Read `O2AT_Mermaid_Workflows.md` for the architecture decisions, captions and complete code.
2. Open the required file in `mermaid/` and paste its contents into Mermaid Chart. Each file is one self-contained diagram.
3. Apply your preferred typography, colour and layout. There are no fixed themes, HTML labels, external icons or per-diagram configuration directives in the source.
4. Export SVG for the website and keep its `.mmd` source under version control. Inspect the exported result at desktop and mobile widths.
5. Keep the caption and proposal status with the figure. The new clock-transfer and clock-hub designs are proposals, not additions already adopted into the v0.2 wire specification.

## Suggested reading order

- 01: current v0.2 system overview.
- 25: Type 1, integrated audio and a forward frequency reference.
- 26: Type 2, DAC-master timing returned to the transport.
- 27 and 28: two physical candidates for Type 2.
- 31 and 32: proposed clock-distribution hub and the hub-to-DAC-to-transport hierarchy.
- 03, 13 and 11: negotiation, cumulative credits and reference-loss protection.
- 30: stereo groups remain together through the optical data stream.

## Scope

The packet and common clock workflows derive from the supplied O2AT v0.2 ODT. The new optical frequency-transfer designs and clock-only device role require a future specification and implementation programme. This package allocates no new wire values and does not alter the ODT.

The clock hub is an additional device role supporting Type 1 and Type 2. It is not a third audio transport type. The recommended Type 2 hierarchy is a qualified hub reference feeding the DAC's actual audio clock, followed by a DAC-originated reference feeding the transport. Data and receiver credits remain separately accounted for.

## Files

- `mermaid/`: 34 individual `.mmd` sources.
- `O2AT_Mermaid_Workflows.md`: complete source catalogue, explanatory notes and references.
- `diagram_index.json`: machine-readable titles, intended website pages, captions, status and provenance.
- `source_manifest.json`: source whitepaper identity and diagram-package scope.
- `validation.json`: Mermaid grammar results for each source and the limits of validation.
- `MANIFEST.sha256`: checksums of all other package files.

## Validation

Every source passed Mermaid grammar parsing using a plain-text sanitiser adapter in a DOM-free Node runtime. The code contains no HTML. Browser rendering was unavailable, so the final layout must be inspected in Mermaid Chart. No browser-rendered SVG or screenshot is represented as having been validated.

From this extracted folder on macOS, verify the package with:

```sh
shasum -a 256 -c MANIFEST.sha256
```

