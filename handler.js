const { Client } = require("pg");

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
};

module.exports.deposit = async (event) => {
  const client = new Client(dbConfig);

  try {
    await client.connect();

    // Parse the simulated webhook
    const body = JSON.parse(event.body);
    const { tx_hash, user_id, amount, currency } = body;

    console.log(`Processing ${currency} Deposit: ${tx_hash}`);

    // IDEMPOTENCY CHECK
    const checkRes = await client.query(
      "SELECT 1 FROM transactions WHERE tx_hash = $1",
      [tx_hash],
    );
    if (checkRes.rows.length > 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Transaction already processed. Skipping.",
        }),
      };
    }

    // ATOMIC TRANSACTION
    await client.query("BEGIN"); // Start

    // 1. Record the Transaction
    await client.query(
      "INSERT INTO transactions(tx_hash, user_id, amount, currency, status) VALUES($1, $2, $3, $4, $5)",
      [tx_hash, user_id, amount, currency, "COMPLETED"],
    );

    // 2. Credit the User
    await client.query(
      "UPDATE users SET fiat_balance = fiat_balance + $1 WHERE id = $2",
      [amount, user_id],
    );

    await client.query("COMMIT"); // Save

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Deposit Successful",
        new_balance_status: "UPDATED",
      }),
    };
  } catch (err) {
    await client.query("ROLLBACK"); // Undo if error
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};
