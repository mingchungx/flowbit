# TODO: Secure Private Key Storage

## Status: Partial

**Done:** Phase 1 — AES-256-GCM encryption at rest with env-based master key.
**Not done:** Phase 2 (KMS-managed encryption), Phase 3 (HSM for mainnet).

## Done

- [x] AES-256-GCM encryption via `KEY_ENCRYPTION_SECRET` env var (`apps/web/src/lib/crypto/keys.ts`)
- [x] `encryptPrivateKey()` called during wallet creation in `ledger.ts`
- [x] `decryptPrivateKey()` called before on-chain signing in `chain/index.ts`
- [x] Backward-compatible migration: detects unencrypted `0x`-prefixed keys and passes them through
- [x] Dev mode: encryption skipped when `KEY_ENCRYPTION_SECRET` is not set
- [x] Storage format: base64-encoded `IV (12B) + AuthTag (16B) + Ciphertext`

## Not Done

### Phase 2: KMS-Managed Encryption
- [ ] AWS KMS, GCP Cloud KMS, or HashiCorp Vault integration
- [ ] Application never sees the raw private key — KMS handles encryption/decryption
- [ ] Audit trail on every key access

### Phase 3: HSM for Mainnet Custody
- [ ] Hardware Security Module — keys never leave the HSM, signing happens inside it
- [ ] AWS CloudHSM, Fireblocks, or similar custody solution
- [ ] Required before handling real funds on mainnet
