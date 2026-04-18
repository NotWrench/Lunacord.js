# Changesets

Run `bun changeset` after making a change that should be released to any `@lunacord/*` package.

- Pick which packages changed.
- Pick a semver bump (patch / minor / major) per package.
- Write a short summary — it becomes the changelog entry.

CI will collect changesets on `master` and open a "Version Packages" PR; merging that PR publishes.
