# Static release procedure

This file documents the project-only release procedure. Host addresses, vhost paths and account details are intentionally stored outside the public repository.

1. Select a reviewed Git commit and run `npm ci`, `npm test`, `npm run check` and `npm run build` with Node.js 24.22.2. The build runs the static link, asset, accessibility-markup, CSP and source-hash validator.
2. Inspect `dist/` for required pages, source downloads, SVG diagrams and absence of private files.
3. Create a versioned release directory in the existing static site root on the verified host. Transfer only the contents of `dist/`; never overwrite an existing release.
4. Validate ownership and read permissions, file count and SHA-256 manifest on host and local output.
5. Update the project-specific release pointer atomically, then run the existing web-server configuration check and graceful reload only if its vhost or certificate selection changed.
6. Probe apex and `www` over HTTP/HTTPS, inspect certificate names and renewal, test document downloads and the calculator/lab in a real browser, and check the other known hostnames against the pre-change baseline.
7. Keep the previous release. If the new release fails, atomically restore the prior pointer and validate/reload using the documented host-specific procedure.

The website repository contains only the generic security-header policy. Keep the environment-specific virtual host, release root, certificate paths and host inventory in private deployment records. Before installation, inspect the live Nginx include graph, existing ACME webroot, certificate automation and enabled-vhost convention. Issue the `o2at.net` / `www.o2at.net` certificate using the existing automation before enabling TLS. Do not copy or alter unrelated certificates.

No database, long-running Node process or paid infrastructure is required. A release is not complete until the public DNS points to the verified ingress and HTTPS is confirmed.
