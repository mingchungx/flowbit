# TODO: Secure Private Key Storage

## Status: Not started (critical for production)

## Problem

Wallet private keys are stored as plaintext in the `wallets.private_key` column. This is acceptable for testnet development but is a critical security vulnerability for any production or mainnet use.

## Requirements

### Encryption at Rest
- Encrypt private keys before storing in Postgres
- Use AES-256-GCM with a master key from environment
- Decrypt only when needed for on-chain signing (which is rare — most operations are off-chain)

### Key Management Service (Better)
- Use AWS KMS, GCP Cloud KMS, or HashiCorp Vault
- Each wallet's private key is encrypted with a KMS-managed key
- The application never sees the raw key — KMS handles signing
- Audit trail on every key access

### Hardware Security Module (Best)
- For mainnet with real funds: use HSM-backed key storage
- AWS CloudHSM, Fireblocks, or similar custody solution
- Keys never leave the HSM — signing happens inside it

### Migration Path
1. **Phase 1**: Encrypt at rest with app-level encryption (AES-256-GCM + env master key)
2. **Phase 2**: Move to KMS-managed encryption
3. **Phase 3**: HSM for mainnet custody

## Files to Change

- `apps/web/src/lib/core/ledger.ts` — `createWallet` encrypts before storing
- `apps/web/src/lib/chain/index.ts` — `transferOnChain` decrypts before signing
- `apps/web/src/lib/db/schema.ts` — consider renaming column to `encrypted_private_key`
- New: `apps/web/src/lib/crypto/keys.ts` — encrypt/decrypt utilities
- New env var: `KEY_ENCRYPTION_SECRET`
