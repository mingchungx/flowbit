# TODO: Publish SDK to npm

## Status: Not started

## Problem

`@flowbit/sdk` is a local workspace package. External developers and agents can't install it.

## Requirements

### Package Publishing
- Publish `@flowbit/sdk` to npm as a public package
- Semantic versioning (start at 0.1.0)
- Built JS + type declarations in the published artifact
- `package.json` needs: `main`, `types`, `files`, `repository`, `license` fields
- Remove `"private": true`

### Documentation
- README with install instructions: `npm install @flowbit/sdk`
- API reference for every method on `FlowbitClient`
- Code examples for common flows (create wallet, fund, send, agreements)
- TypeDoc or hand-written — either works

### Changelog
- Maintain a CHANGELOG.md for the SDK package
- Or use GitHub releases with auto-generated notes

### MCP Package
- Consider publishing `@flowbit/mcp` too so agents can `npx @flowbit/mcp` to start the server
- Or distribute as a single binary

## Files to Change

- `packages/sdk/package.json` — remove `private`, add `files`, `repository`, `license`
- `packages/sdk/README.md` — expand with install + full API reference
- Add `packages/sdk/.npmignore` or use `files` field to control what ships
- Root: add `publish:sdk` script
