# NeverFail x402 Facilitator (Solana Devnet)

A minimal **x402** facilitator for Solana that:
1) Returns **HTTP 402** with an `accepts` recipe (USDC on devnet),
2) Verifies the client’s **X-Payment** (signed USDC transfer),
3) Proxies the original JSON-RPC request to a **premium RPC** and returns the result.

> Built to pair with the NeverFail Wallet x402 Pay-per-RPC demo.

---

## Features
- Devnet **USDC** pay-per-request
- Verifies SPL **Transfer/TransferChecked** to your **recipient ATA**
- Proxies upstream to **your PREMIUM_RPC_URL**
- Returns original RPC result + `paymentSignature`

---

## Requirements
- **Node 18+** (or Bun 1.3+)  
- A **premium RPC** URL (e.g. Helius devnet)
- A **recipient** Solana wallet to receive USDC payments
- **USDC devnet mint** (default provided)

---

## Quick Start

```bash
git clone https://github.com/blazerianone/neverfail-wallet-facilitator.git
cd neverfail-wallet-facilitator

# 1) Copy and edit environment
cp .env.example .env
# edit .env: set RECIPIENT_WALLET and PREMIUM_RPC_URL at minimum

# 2) Install deps
npm i
# or: bun install

# 3) Run
node index.js
# or: bun index.js
````

You should see:

```
Recipient ATA: <...>
x402 facilitator running at http://localhost:3001/rpc
Server listening on http://127.0.0.1:3001/rpc
```

---

## Endpoint

**POST** `/rpc` → JSON-RPC proxy guarded by x402 payment.

* Without payment: returns **HTTP 402** with `accepts` recipe:

```json
{
  "x402Version": 1,
  "error": {},
  "accepts": [{
    "scheme": "exact",
    "network": "solana-devnet",
    "maxAmountRequired": "100",
    "resource": "http://localhost:3001/rpc",
    "description": "Never Fail Wallet Pay Per RPC— Pay 0.0001 USDC per call",
    "mimeType": "application/json",
    "payTo": "<RECIPIENT_WALLET>",
    "maxTimeoutSeconds": 60,
    "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        "outputSchema": {
        "input": {
            "type": "http",
            "method": "POST",
            "bodyType": "json"
        }
    },
    "extra": {
    "feePayer": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
    }
  }]
}
```

* With payment: attach **`X-Payment`** header (base64 of JSON):

```json
{
  "x402Version": 1,
  "payload": {
    "serializedTransaction": "<base64 signed tx bytes>"
  }
}
```

If valid, the server:

1. Submits the payment tx to **SUBMIT_RPC_URL**,
2. Proxies your original JSON-RPC to **PREMIUM_RPC_URL**,
3. Responds with the upstream JSON plus:

```json
{
  "...upstreamResult": "…",
  "premiumRpcUrl": "https://…",
  "paymentSignature": "<sig>"
}
```

---

## Curl Smoke Test

```bash
# Expect 402 with accepts
curl -i -X POST http://localhost:3001/rpc \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

---

## Environment

See **.env.example**; copy to **.env** and edit.

| Var                | Required | Default                         | Description                                |
| ------------------ | -------- | ------------------------------- | ------------------------------------------ |
| `PORT`             | no       | `3001`                          | Server port                                |
| `PUBLIC_BASE_URL`  | no       | `http://localhost:3001`         | Used in 402 `accepts.resource`             |
| `X402_NETWORK`     | no       | `solana-devnet`                 | Accepts `network` tag                      |
| `USDC_MINT`        | yes      | `4zMM...JgZJDncDU`              | Devnet USDC mint                           |
| `RECIPIENT_WALLET` | yes      | —                               | Your wallet to receive USDC                |
| `PRICE_USDC_BASE`  | no       | `100`                           | USDC base units (6dp). `100 = 0.0001 USDC` |
| `PREMIUM_RPC_URL`  | yes      | —                               | Upstream premium RPC for proxy             |
| `SUBMIT_RPC_URL`   | no       | `https://api.devnet.solana.com` | Where payment tx is sent/confirmed         |
| `COMMITMENT`       | no       | `confirmed`                     | Commitment for confirmations               |

---

## Notes

* The verifier checks **SPL Transfer/TransferChecked** and destination equals your **recipient ATA** for the mint, with `amount >= PRICE_USDC_BASE`.
* For production, consider stricter checks (fee payer, memo, nonce, freshness, replay protection).

---

## PM2 (optional)

```bash
npm i -g pm2
pm2 start index.js --name x402-facilitator
pm2 save
```

---

## License
[MIT](./LICENSE) © 2025 NeverFail Wallet