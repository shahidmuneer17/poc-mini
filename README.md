# 🚀 Serverless Crypto-to-Fiat Exchange (V2)

**Status:** Production Ready 🟢 | **Stack:** TypeScript & DynamoDB
**Live Demo:** [https://5jhzwxkp9e.execute-api.us-east-1.amazonaws.com]

A cloud-native financial transaction engine re-architected for **infinite scale**.
This project demonstrates a high-performance **Serverless Microservice** capable of processing high-volume crypto webhooks with strict **ACID compliance** and **Idempotency**.

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![AWS DynamoDB](https://img.shields.io/badge/-DynamoDB-4053D6?style=flat&logo=amazon-dynamodb&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/-AWS_Lambda-232F3E?style=flat&logo=amazon-aws&logoColor=white)
![Serverless Framework](https://img.shields.io/badge/-Serverless_Framework-FD5750?style=flat&logo=serverless&logoColor=white)

---

## 🏗 Architecture Evolution

This project has been upgraded from a traditional SQL-based architecture (V1) to a modern **NoSQL Event-Driven Architecture (V2)** to handle the throughput required by global fintech applications.

- **Compute:** AWS Lambda (Node.js 22.x) written in **TypeScript**.
- **Database:** **Amazon DynamoDB** (On-Demand Capacity).
- **API Gateway:** HTTP API (v2) for sub-millisecond routing.
- **IaC:** Serverless Framework (v3) with `serverless-plugin-typescript`.
- **CI/CD:** GitHub Actions (Type-Safe Deployments).

---

## ✨ Key Technical Features

### 1. ACID Transactions in NoSQL

Many developers believe NoSQL cannot handle financial ledgers. I implemented **`TransactWriteItems`** to ensure strict atomicity.

- **Mechanism:** The `Transaction` record insert and the `User Balance` update occur in a single atomic network call.
- **Result:** If the balance update fails, the transaction record is never created. **Zero partial states.**

### 2. Zero-Cost Idempotency

To prevent "Double-Spending" from webhook retries (e.g., Alchemy/QuickNode), I utilize DynamoDB's **Conditional Writes**.

- **Old Way (SQL):** `SELECT * FROM tx WHERE id = ...` (Slow & Expensive).
- **New Way (Dynamo):** `ConditionExpression: attribute_not_exists(tx_hash)`.
- **Result:** The write is rejected instantly at the database level if the hash exists. Faster, cheaper, and strictly consistent.

### 3. Type Safety & Validation

- **Strict Typing:** All logic is written in TypeScript to prevent runtime payload errors.
- **Input Validation:** Payload parsing forces `amount` to `Float` to prevent Type Mismatch errors during math operations.
- **Security:** API Key Authentication via `x-api-key` headers.

---

## 🛠 API Endpoints

### Base URL: `[https://5jhzwxkp9e.execute-api.us-east-1.amazonaws.com]`

| Method   | Endpoint             | Description                                                       |
| :------- | :------------------- | :---------------------------------------------------------------- |
| **POST** | `/deposit`           | Ingests a crypto deposit. Handles deduplication & ledger updates. |
| **GET**  | `/transactions/{id}` | Fetches transaction history for a user (via GSI).                 |
| **GET**  | `/balance/{id}`      | Returns the current fiat balance (via Key-Value Lookup).          |

### 🧪 Example Payloads

#### 1. Deposit (POST)

**Endpoint:** `/deposit`
**Headers:** `x-api-key: YOUR_SECRET`

```json
{
  "tx_hash": "0xABC_123_UNIQUE_HASH",
  "user_id": "1",
  "amount": 500.5,
  "currency": "USDT"
}
```
