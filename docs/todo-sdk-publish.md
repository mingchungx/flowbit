# TODO: Publish SDK to npm

## Status: Partial

**Done:** Package.json prepared with all publishing fields, version 0.1.0.
**Not done:** Actually publish, documentation, changelog, MCP package.

## Done

- [x] Version bumped to 0.1.0
- [x] Removed `"private": true` from `packages/sdk/package.json`
- [x] Added `files` (dist + README), `repository`, `license` (MIT), `keywords`, `description`
- [x] `main` and `types` point to `./dist/index.js` and `./dist/index.d.ts`

## Not Done

### Publishing
- [ ] Run `cd packages/sdk && pnpm publish --access public`
- [ ] Set up npm automation token for CI-based publishing
- [ ] Add `publish:sdk` script to root package.json

### Documentation
- [ ] Expand `packages/sdk/README.md` with install instructions (`npm install @flowbit/sdk`)
- [ ] Full API reference for every method on `FlowbitClient`
- [ ] Code examples for common flows: create wallet, fund, send, agreements

### Changelog
- [ ] CHANGELOG.md in the SDK package, or use GitHub releases with auto-generated notes

### MCP Package
- [ ] Consider publishing `@flowbit/mcp` so agents can run `npx @flowbit/mcp`
- [ ] Or distribute as a single binary
