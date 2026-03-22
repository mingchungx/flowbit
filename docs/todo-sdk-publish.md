# TODO: Publish SDK to npm

## Status: Partial (package prepared)

## Completed

### Package Preparation
- [x] Bumped to version 0.1.0
- [x] Removed `"private": true`
- [x] Added `files` field (dist + README)
- [x] Added `repository`, `license` (MIT), `keywords`, `description` fields
- [x] `main` and `types` already pointed to `./dist/`

## Remaining

### Publishing
- [ ] Publish to npm: `cd packages/sdk && pnpm publish --access public`
- [ ] Set up npm automation token for CI
- [ ] Add `publish:sdk` script to root package.json

### Documentation
- [ ] Expand `packages/sdk/README.md` with install instructions and API reference
- [ ] Code examples for common flows

### Changelog
- [ ] CHANGELOG.md or GitHub releases with auto-generated notes

### MCP Package
- [ ] Consider publishing `@flowbit/mcp` for `npx @flowbit/mcp`
- [ ] Or distribute as a single binary

## Files Changed

- `packages/sdk/package.json` — publishing fields added
