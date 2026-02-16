# Serverless Crypto-to-Fiat Exchange POC

A cloud-native financial transaction engine built for high-volume crypto webhooks. This Proof of Concept (POC) demonstrates an **idempotent**, **ACID-compliant** ledger system deployed on AWS Lambda.

## 🚀 Architecture
This project uses an **Event-Driven Serverless Architecture** to handle crypto deposits and balance updates without managing servers.

* **Compute:** AWS Lambda (Node.js 22.x)
* **API Gateway:** HTTP API (v2) for low-latency routing.
* **Database:** PostgreSQL (AWS RDS) for relational data integrity.
* **Infrastructure as Code:** Serverless Framework (v3).
* **CI/CD:** GitHub Actions (Automated Deployments).

## ✨ Key Features (The "Why")

### 1. Idempotency (Double-Spend Protection)
To prevent a blockchain node (like QuickNode/Alchemy) from re-sending the same webhook twice, the `deposit` function checks the `tx_hash` before processing.
* *Result:* 100% guarantee that a user is never credited twice for the same transaction.

### 2. ACID Transactions
Financial data requires atomicity. The deposit logic uses SQL `BEGIN`, `COMMIT`, and `ROLLBACK`.
* *Result:* The **Transaction Log** and **User Balance** update simultaneously. If one fails, the entire operation rolls back.

### 3. Security
* **API Key Authentication:** All endpoints are protected via a shared secret header (`x-api-key`).
* **Environment Variables:** No secrets are committed to the repo; all credentials are injected at runtime via GitHub Secrets.

## 🛠 API Endpoints

### Base URL: `https://5jhzwxkp9e.execute-api.us-east-1.amazonaws.com`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/deposit` | Ingests a crypto deposit (Idempotent). |
| **GET** | `/transactions/{id}` | Fetches transaction history for a user. |
| **GET** | `/balance/{id}` | Returns the current fiat balance. |

#### Example: Deposit Payload
```json
{
  "tx_hash": "0xABC_123_HASH",
  "user_id": 1,
  "amount": 500.00,
  "currency": "USDT"
}
