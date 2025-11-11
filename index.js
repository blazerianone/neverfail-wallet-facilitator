import express from "express";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' })); // Important for large tx

const PORT = process.env.PORT || 3001;
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// CHANGE THESE
const USDC_MINT = new PublicKey(process.env.USDC_MINT);
const RECIPIENT_WALLET = new PublicKey(process.env.RECIPIENT_WALLET);
const PRICE_USDC = process.env.PRICE_USDC_BASE;

// PREMIUM RPC — USE HELIUS FREE KEY (get at helius.xyz)
const PREMIUM_RPC_URL = process.env.PREMIUM_RPC_URL;

// Derive recipient ATA
const RECIPIENT_TOKEN_ACCOUNT = await getAssociatedTokenAddress(USDC_MINT, RECIPIENT_WALLET);

console.log("CORRECT Recipient ATA:", RECIPIENT_TOKEN_ACCOUNT.toBase58());
console.log("X402 PAY-PER-RPC FACILITATOR RUNNING");
console.log(`http://localhost:${PORT}/rpc`);

app.post("/rpc", async (req, res) => {
  const xPaymentHeader = req.header("X-Payment");

  if (xPaymentHeader) {
    try {
      console.log('=== X402 PAYMENT RECEIVED ===');

      const paymentData = JSON.parse(Buffer.from(xPaymentHeader, "base64").toString("utf-8"));
      const txBuffer = Buffer.from(paymentData.payload.serializedTransaction, "base64");

      const tx = Transaction.from(txBuffer);
      console.log('Tx deserialized OK. Instructions:', tx.instructions.length);

      // Verify transfer
      let validTransfer = false;
      for (const ix of tx.instructions) {
        if (ix.programId.equals(TOKEN_PROGRAM_ID) && (ix.data[0] === 3 || ix.data[0] === 12)) {
          const amount = Number(ix.data.readBigUInt64LE(1));
          const dest = ix.keys[1].pubkey;
          if (dest.equals(RECIPIENT_TOKEN_ACCOUNT) && amount >= PRICE_USDC) {
            validTransfer = true;
            console.log('VALID TRANSFER! Amount:', amount);
            break;
          }
        }
      }

      if (!validTransfer) {
        return res.status(402).json({ error: "Invalid transfer" });
      }

      // Submit tx
      const sig = await connection.sendRawTransaction(txBuffer, { skipPreflight: false });
      await connection.confirmTransaction(sig, "confirmed");
      console.log('TX CONFIRMED! Sig:', sig);

      // Proxy to premium RPC
      const premiumResp = await fetch(PREMIUM_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const premiumJson = await premiumResp.json();

      // SEND FINAL RESPONSE WITH PREMIUM URL
      res.json({
        ...premiumJson,
        premiumRpcUrl: PREMIUM_RPC_URL,
        paymentSignature: sig
      });

    } catch (e) {
      console.error('PAYMENT ERROR:', e);
      res.status(402).json({ error: "Payment failed", details: e.message });
    }
  } else {
    res.status(402).json({
      x402Version: 1,
      error: "X-PAYMENT header is required",
      accepts: [
        {
          scheme: "exact",
          network: process.env.X402_NETWORK || "solana-devnet",
          maxAmountRequired: "100",
          resource: "https://x402-neverfail.blockforge.live/rpc",
          description: "Never Fail Wallet Pay Per RPC— Pay 0.0001 USDC per call",
          mimeType: "application/json",
          payTo: process.env.RECIPIENT_WALLET,
          maxTimeoutSeconds: 60,
          asset: process.env.USDC_MINT,
          outputSchema: {
            input: {
              type: "http",
              method: "POST",
              bodyType: "json"
            }
          },
          extra: {
            feePayer: "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
          }
        }
      ]
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));