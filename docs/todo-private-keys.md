# TODO: Secure Private Key Storage

## Status: Phase 1 done (encryption at rest)

## Completed

### Phase 1: Encryption at Rest
- [x] AES-256-GCM encryption with env-based master key (`KEY_ENCRYPTION_SECRET`)
- [x] `encryptPrivateKey()` and `decryptPrivateKey()` in `apps/web/src/lib/crypto/keys.ts`
- [x] Wallet creation encrypts private key before storage
- [x] On-chain signing decrypts private key before use
- [x] Graceful migration: detects unencrypted `0x` keys and passes them through
- [x] Dev mode: if `KEY_ENCRYPTION_SECRET` is not set, encryption is skipped

### Storage Format
- Encrypted keys stored as base64: `IV (12 bytes) + Auth Tag (16 bytes) + Ciphertext`
- Unencrypted keys start with `0x` — auto-detected for backward compatibility

## Remaining

### Phase 2: KMS-Managed Encryption
- [ ] Use AWS KMS, GCP Cloud KMS, or HashiCorp Vault
- [ ] Application never sees raw key — KMS handles signing
- [ ] Audit trail on every key access

### Phase 3: HSM for Mainnet
- [ ] Hardware Security Module for production custody
- [ ] Keys never leave the HSM — signing happens inside it
- [ ] AWS CloudHSM, Fireblocks, or similar

## Files Changed

- `apps/web/src/lib/crypto/keys.ts` — encrypt/decrypt utilities
- `apps/web/src/lib/core/ledger.ts` — encrypts on `createWallet`
- `apps/web/src/lib/chain/index.ts` — decrypts in `transferOnChain`
