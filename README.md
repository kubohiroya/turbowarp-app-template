# TurboWarp App Template

**English** | [日本語](README.ja.md)

An initial scaffold for a TurboWarp app. No use-case-specific features are implemented yet.

## What's included

This is the initial scaffold generated from turbowarp-app-template. Use-case-specific features are not implemented.

- Mode selection, guidance, and error display built on the shared app-shell.
- Unpacked SB3 sources plus a startup-check script that updates a state variable when the green flag is clicked.
- Builds for the SB3 and the distribution page, SHA-256 recording, and CI.

The distribution page does not embed the TurboWarp player; it offers the startup-check SB3 for download. Run `build:sb3` before downloading from the dev server.

## Planned

- Implement use-case-specific operations and extension connections.

## Modes

- **Startup check**: Download the SB3, open it in TurboWarp, and confirm startup with the green flag.

## Dependencies and responsibilities

- The template does not bundle use-case-specific extension dependencies.

The only actual dependency is turbowarp-app-shell 0.2.0 in package.json. The use-case-specific connections above are planned, and do not rely on any unreleased early extension. When one is added, its exact version, artifact hash, API manifest, and evaluation order will be pinned.

## Layout and development

Node.js >=22.18.0, pnpm 11.11.0.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

- `config/app.json`: name, modes, description, and planned work. English README text goes under `en`.
- `config/feature-flags.ts`: experimental feature flags, fixed at startup and OFF by default.
- `scripts/project.ts`: the source of truth for the startup-check SB3.
- `apps/main/source`: the unpacked SB3 sources, generated at build time (not tracked by Git).
- `src`: the distribution page built on the shared shell.
- `public/downloads`: the generated SB3 and release.json.
- `dist`: build output for the distribution page and downloads.

`pnpm build` generates `apps/main/source` from `project.ts`, then packs it with sb3-toolchain. The generated sources, SB3 files and `dist` are not tracked by Git.

## Staged rollout and acceptance criteria

1. In the related GitHub Issue, settle what to extract from the existing implementation, its dependencies, the DoD, and the rollback path.
2. Add the use-case-specific path behind a flag that is OFF by default, and replace the existing path with delegation.
3. Record error, latency, stalls, and recovery in hardware integration testing.
4. Do not reimplement the core extension's algorithms inside the app.

The DoD for the initial scaffold is: `pnpm check` passes, the SB3 updates its state on the green flag, and the distribution page shows the description, mode selection, and SB3 download. Real-device verification of camera-based features has not been performed.

## Rollback and task management

New paths are stopped by turning their flag OFF in `config/feature-flags.ts`, and compatibility reads for the old app path are kept during migration. Turning the initial flags ON does not implement any use-case-specific feature.

GitHub Issues are the source of truth for progress, recording start/done/blocked. This README is a local draft; nothing has been posted to Issues, pushed, or published.

## Origin

The shared structure is extracted from the kamishibai (picture-story) app and realtime-motion-capture-app. See the [extraction notes](docs/extraction.md) (Japanese) for details.

## License

MPL-2.0. The package is private in its initial state.

## Creating from the template

Clone an empty repository, prepare a config JSON in the `config/app.json` format, and run the command below. It keeps the existing `.git` and refuses to run if any other files are present.

```bash
pnpm template:init /absolute/path/turbowarp-example-app /absolute/path/app-config.json
```

In the generated project, run `pnpm install --frozen-lockfile`, `pnpm format:write`, and `pnpm check`. App-specific READMEs are generated as an English `README.md` and a Japanese `README.ja.md` that cross-link each other, and the template itself is not modified. If the config JSON omits `en`, the Japanese text is used in the English README too.
