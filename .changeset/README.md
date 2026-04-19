# Changesets

Run `bun changeset` after making a change that should be released to any `@lunacord/*` package.

- Pick which packages changed.
- Pick a semver bump (patch / minor / major) per package.
- Write a short summary — it becomes the changelog entry.

CI will collect changesets on `master` and open a "Version Packages" PR; merging that PR publishes.

## Publish remaining packages from your machine (CLI)

If `lunacord.js` (or another package) is already on npm but scoped packages are not, build and publish whatever is still missing:

```bash
bun run publish:packages
```

That runs `turbo run build --filter='./packages/*'` then `changeset publish`. You must be logged in to npm with permission to publish `@lunacord/*` (organization on [npmjs.com](https://www.npmjs.com)).

**Auth:** `npm publish` reads the token from `NODE_AUTH_TOKEN` when using a registry `.npmrc` entry. If you use an env var file:

- **Bash:** `export NODE_AUTH_TOKEN="$(grep NPM_TOKEN .env | cut -d= -f2-)"` or paste an [Automation token](https://www.npmjs.com/settings/~/tokens) directly.
- **PowerShell:** `$env:NODE_AUTH_TOKEN = $env:NPM_TOKEN` (after setting `NPM_TOKEN`), or `$env:NODE_AUTH_TOKEN = 'npm_...'`.

Alternatively run `npm login` once in the same shell before `bun run publish:packages`.

**Order:** Changesets publishes all unpublished workspace packages that share the version; linked `@lunacord/*` packages go up together. No need to `cd` into each package manually.
