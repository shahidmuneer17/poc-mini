const { Client } = require("pg");

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
};

const checkAuth = (event) => {
  const apiKey = event.headers["x-api-key"] || event.headers["X-Api-Key"];

  if (apiKey !== process.env.API_KEY) {
    throw new Error("Unauthorized: Invalid API Key");
  }
};

module.exports.deposit = async (event) => {
  const client = new Client(dbConfig);

  try {
    checkAuth(event);

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

module.exports.getHistory = async (event) => {
  const client = new Client(dbConfig);

  try {
    checkAuth(event);

    await client.connect();

    // 1. Get the User ID from the URL
    const userId = event.pathParameters.id;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing User ID" }),
      };
    }

    console.log(`Fetching history for User ID: ${userId}`);

    // 2. Query the Database
    const res = await client.query(
      "SELECT * FROM transactions WHERE user_id = $1 ORDER BY tx_hash DESC",
      [userId],
    );

    // 3. Return the Rows
    return {
      statusCode: 200,
      body: JSON.stringify({
        user_id: userId,
        count: res.rowCount,
        transactions: res.rows,
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};

module.exports.getBalance = async (event) => {
  const client = new Client(dbConfig);

  try {
    checkAuth(event);

    await client.connect();

    const userId = event.pathParameters.id;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing User ID" }),
      };
    }

    // 1. Query the User Table
    const res = await client.query(
      "SELECT id, name, fiat_balance FROM users WHERE id = $1",
      [userId],
    );

    // 2. Handle "User Not Found"
    if (res.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    // 3. Return the Balance
    return {
      statusCode: 200,
      body: JSON.stringify({
        user_id: res.rows[0].id,
        name: res.rows[0].name,
        balance: res.rows[0].fiat_balance,
        currency: "USD", // Hardcoded for this demo
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};
