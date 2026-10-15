# npmx: what it is and what it says of this project

Status: current, gathered 2026-10-13 from npmx's repository
(github.com/npmx-dev/npmx.dev, head af01d90 of 2026-10-12), its site
(npmx.dev, v0.20.0, marked alpha), its API at that date, and this
checkout with npm 10.9.9 and node 22.23.3.

## 1. What npmx is

A website that browses the npm registry. Its README: "a fast, modern
browser for the npm registry. We're not replacing the npm registry, but
instead providing an elevated developer experience through a fast,
modern UI." MIT licensed, a Nuxt 4 application, its package.json author Daniel
Roe.

- It installs nothing for a reader. Any npmjs.com URL works with the
  host changed to npmx.dev (`npmx.dev/package/node-pty/v/1.1.0`).
- A package page adds to what npmjs.com shows: vulnerability warnings
  from OSV, install size with transitive dependencies, module format
  (ESM, CJS or dual) and types badges, outdated-dependency marks,
  install-script, licence-change and size-change warnings, version
  diffs, a changelog and a publish timeline.
- Optional extras: `npmx-connector`, a local CLI that lets the site run
  owner and team operations through the reader's npm login, and
  vscode-npmx, an editor extension. Neither is needed to read a page.
- Its figures come from its own server, `/api/registry/<endpoint>/<name>/v/<version>`,
  which the page calls. The figures below are those responses.

How it computes them, from its source:

- Vulnerabilities: `server/utils/dependency-analysis.ts` posts every
  package of the tree to `https://api.osv.dev/v1/querybatch`.
- Tree and size: `server/utils/dependency-resolver.ts` resolves each
  declared range to the newest matching version in the registry, for
  linux-x64-glibc, and sums each version's `dist.unpackedSize`. It
  never sees a lockfile, so it reports what a fresh install would pull
  today, not what this project pins.

## 2. What it shows about this project

Commands, run 2026-10-13:

    npm ls --depth=0
    npm audit --json
    curl https://npmx.dev/api/registry/{vulnerabilities,install-size,analysis}/<name>/v/<version>
    du -sb node_modules/<name>

`npm audit --json`: exit 0, `"vulnerabilities": {"info": 0, "low": 0,
"moderate": 0, "high": 0, "critical": 0, "total": 0}`, `"dependencies":
{"prod": 11, "dev": 14, "optional": 1, ..., "total": 24}`.

Each direct dependency at the version `npm ls` reports. "npmx pkgs" is
npmx's `totalPackages`, "lock pkgs" the dependency's closure in
`package-lock.json`. Sizes in bytes.

| package | version | npmx vulns | npmx deprecated | npmx pkgs | lock pkgs | npmx own size | npmx total size | on disk | format | types |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| @xterm/addon-fit | 0.11.0 | 0 | 0 | 1 | 1 | 20727 | 20727 | 20727 | dual | included |
| @xterm/addon-unicode11 | 0.9.0 | 0 | 0 | 1 | 1 | 550989 | 550989 | 550989 | dual | included |
| @xterm/addon-web-links | 0.12.0 | 0 | 0 | 1 | 1 | 46676 | 46676 | 46676 | dual | included |
| @xterm/addon-webgl | 0.19.0 | 0 | 0 | 1 | 1 | 2358509 | 2358509 | 2358509 | dual | included |
| @xterm/xterm | 6.0.0 | 0 | 0 | 1 | 1 | 5921599 | 5921599 | 5921599 | dual | included |
| butterchurn | 2.6.7 | 0 | 0 | 3 | 3 | 728442 | 975657 | 728442 | cjs | none |
| electron | 44.7.0 | 0 | 0 | 13 | 13 | 1169792 | 13387053 | 297477352 | cjs | included |
| node-pty | 1.1.0 | 0 | 0 | 2 | 2 | 64363742 | 64760054 | 64490216 | cjs | included |
| playwright-core | 1.64.0 | 0 | 0 | 1 | 1 | 13655528 | 13655528 | 13655528 | dual | included |

The lock pkgs sum to 24, npm audit's total. Every transitive version
npmx resolved equals the lockfile's: the lock is current.

What agrees and what does not:

- Vulnerabilities: npmx and npm audit both report none. They ask
  different databases (OSV against the npm registry's advisory
  endpoint) over
  different trees (newest matching against the lockfile). Today the
  trees are the same, so the answers can be compared. After a lock goes
  stale they cannot.
- Size: for every package but two, npmx's own size equals the bytes on
  disk. Electron's disk figure is 296307560 bytes more, 296307552 of
  them `dist/`, the Electron binary, fetched by `node_modules/electron/install.js`, which
  `install.sh` runs, outside the registry. npmx cannot see it. node-pty's
  disk figure is 126474 bytes more, `build/` (118085) and other files
  its install script writes.
- `node_modules` is 398141676 bytes on disk. npmx's totals, summed over
  the direct dependencies, would count Electron's 13 MB and miss its
  296 MB.
- Module format and types: npm prints neither. butterchurn is the one
  package without types, which this project does not need (no
  TypeScript).
- Install scripts: the lockfile marks one package, node-pty, with
  `hasInstallScript` (install: `node scripts/prebuild.js || node-gyp
  rebuild`, postinstall: `node scripts/post-install.js`). npmx shows the
  same from the registry manifest's `scripts`, rendered in the browser.

## 3. Should the project use it

Ruled by the maintainer, 2026-10-13: as a reading aid in development, and
nowhere else.

- Before a dependency changes, open its npmx page for the new version:
  the version diff, the install-script and licence-change warnings and
  the size change are the parts npm does not show. That is a manual
  look, with no tool, script or dependency added.
- `npm audit` stays the check of record, because it reads the lockfile
  this project installs. npmx's vulnerability count describes a fresh
  resolution, so it cannot replace it.
- Not in the README. A user runs `install.sh`, which runs `npm ci` on
  the lockfile, and never picks a dependency. npmx answers nothing a
  user of the app asks.
- Not the connector or the editor extension: the project publishes no
  package and needs no npm owner operations.
