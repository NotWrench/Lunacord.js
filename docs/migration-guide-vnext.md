# Migration Guide vNext

## Source layout

- Internal library code now lives under `src/`.
- Consumer examples live under `examples/`.
- Tests are grouped under `tests/unit`, `tests/integration`, and `tests/contract`.

## Public imports

Supported entrypoints:

- `lunacord`
- `lunacord/cache`
- `lunacord/plugins`
- `lunacord/lyrics`
- `lunacord/errors`

Avoid importing private file paths from the package.

## Plugin changes

Plugins now require explicit metadata:

- `name`
- `version`
- `apiVersion: "1"`

`pluginError` now reports a structured payload with:

- `plugin`
- `hook`
- optional `nodeId`
- optional `guildId`
- `error`
