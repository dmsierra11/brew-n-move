# Devnet settlement

This is a confirmed Devnet execution. It is not a local validator run.

- Program: `DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL` ([Explorer](https://explorer.solana.com/address/DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL?cluster=devnet))
- Network: Devnet
- Mint: `G7x5tLBCGq5Qyv7orQN9ZGKYQdmr4WVa9BYm7Uhdxqe2` ([Explorer](https://explorer.solana.com/address/G7x5tLBCGq5Qyv7orQN9ZGKYQdmr4WVa9BYm7Uhdxqe2?cluster=devnet))
- Budget PDA: `HBDQNikwtoukq4Zy2hCjacNr5QjZiyHf4DsCTQFqGE53` ([Explorer](https://explorer.solana.com/address/HBDQNikwtoukq4Zy2hCjacNr5QjZiyHf4DsCTQFqGE53?cluster=devnet))
- Vault: `4m32fmbzLBsBaABJgcNZquyXhsg3bm1Jf6Sv7cph2qyH` ([Explorer](https://explorer.solana.com/address/4m32fmbzLBsBaABJgcNZquyXhsg3bm1Jf6Sv7cph2qyH?cluster=devnet))
- Authority: `i7d7ASxYiz8bUaeQMoVrLXYA17GnviQoehznW2ADb1b`
- Verifier: `CDyck2egjjBpdJ5ZcvYsHinjjxf3dhSgdNFLhW5TRtdU`
- Sponsor: `7h1X9cXWFzzpKnNgQy1oeTBimL8vFr47tDDTGGn2inj5`
- Provider token account: `9gLvkZd5HxD5MDprLoJKWAxJfEhjyMrVTNmXa4P1fD2n`
- Platform token account: `2XgG7osvijUqnko6evZzskQBeYHynbZ5jxLUVW4gYCru`
- Withdrawal destination: `7LXBpwMNJh6vnZpg84iYsAh9pDuFqXjzkizQ7oUuuSsh`
- Budget id: `70302d64656d6f2d627564676574`
- Funding signature: `4DA2B47PCUxPyX7C5d97xHdkCawb2UFwcWTrh3BySwPkDvegw83AD7z4ZrXHkQAX2iLytn2rXU1iQM82jNstMLLx` ([Explorer](https://explorer.solana.com/tx/4DA2B47PCUxPyX7C5d97xHdkCawb2UFwcWTrh3BySwPkDvegw83AD7z4ZrXHkQAX2iLytn2rXU1iQM82jNstMLLx?cluster=devnet))
- Settlement signature: `5dcdr4iCiPy64DKqMJxTik6sjWsHrXb5wCRMEuVYnQGDgCN492vovLryY8Kw3XcgRRoLBQgKYYbzsdE9DsJswzwX` ([Explorer](https://explorer.solana.com/tx/5dcdr4iCiPy64DKqMJxTik6sjWsHrXb5wCRMEuVYnQGDgCN492vovLryY8Kw3XcgRRoLBQgKYYbzsdE9DsJswzwX?cluster=devnet))
- Receipt: `AfFg1Zyh2nt66P6ND8zGb55uEKxoiXSo5gmM5dNPWz2R` owned by `DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL` ([Explorer](https://explorer.solana.com/address/AfFg1Zyh2nt66P6ND8zGb55uEKxoiXSo5gmM5dNPWz2R?cluster=devnet))
- Receipt budget: `HBDQNikwtoukq4Zy2hCjacNr5QjZiyHf4DsCTQFqGE53`
- Receipt redemption id: `d3333333333343338333333333333333`
- Receipt original: `4000000`
- Receipt discount: `800000`
- Receipt commission: `160000`
- Receipt provider reimbursement: `640000`
- Vault: 100000000 → 99200000
- Provider: 0 → 640000 (delta 640000)
- Platform: 0 → 160000 (delta 160000)

The vault held enough tokens for this settlement. Outstanding reimbursements are not reserved on-chain.

## Hosted follow-up

Settlement `5d4b6c6d-eec1-4e6c-b498-698b1a090164` is `needs_reconciliation` (`invalid_placeholder_accounts`). Its frozen snapshot and redemption `2b18362c-62d7-4ea1-b8d8-74dc0cd204be` were not changed.

A later redemption `f9b8569b-9173-4ce7-9501-8deb6bd18ed9` used the live budget addresses. Settlement `692066b5-9796-4a9d-8ca0-9ba32208628f` is confirmed from a receipt owned by the program.

- Settlement signature: `5LUArgmjrhHBbYtCEChuR6V9j8nfZBrJqHDHaVzXRTParhHNXptiJLDwN6DPiYETmrAkhYU7QY2ThoLFGQy7KWLu` ([Explorer](https://explorer.solana.com/tx/5LUArgmjrhHBbYtCEChuR6V9j8nfZBrJqHDHaVzXRTParhHNXptiJLDwN6DPiYETmrAkhYU7QY2ThoLFGQy7KWLu?cluster=devnet))
- Receipt: `619r1TH13cwPDief7s8WeaPcmZTXckgQyvLsTBn1hbXM` owned by `DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL`
- Vault: 99200000 → 98400000
- Provider: 640000 → 1280000 (delta 640000)
- Platform: 160000 → 320000 (delta 160000)

A later redemption `61f1b800-e3bc-4cdd-8d18-fe5a6a76c7b5` (member `4a6748c6-9dac-4b3d-8486-e5ee6808d6f9`, 3fe Demo Café, 50 points) settled through hosted `settle-reward` with no local signing. The worker claimed, signed as the verifier, recorded the signature, and matched the receipt. Confirmed 3s after redeem.

- Settlement: `6877b0cb-7b30-4451-b9b8-359b260dc1f6`
- Settlement signature: `58YMFR81FoHpXFBdKJNCEm37QK3FMkDxodx5SDzbV2b8VfMDedcdN4zqm1tPUhg5QJfXMJpxGiWCbDhgofif81sM` ([Explorer](https://explorer.solana.com/tx/58YMFR81FoHpXFBdKJNCEm37QK3FMkDxodx5SDzbV2b8VfMDedcdN4zqm1tPUhg5QJfXMJpxGiWCbDhgofif81sM?cluster=devnet))
- Fee payer / signer: `CDyck2egjjBpdJ5ZcvYsHinjjxf3dhSgdNFLhW5TRtdU`
- Receipt: `GDSg3RTf1SoGgzsn5K8Sh5oRtBHxLg1e5V97vR1ftqEN` owned by `DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL`
- Vault: 98400000 → 97600000
- Provider: 1280000 → 1920000 (delta 640000)
- Platform: 320000 → 480000 (delta 160000)
