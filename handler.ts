import { APIGatewayProxyHandler, APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

// --- CONFIGURATION ---
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USERS_TABLE || "Users";
const TX_TABLE = process.env.TX_TABLE || "Transactions";

// --- INTERFACES (Type Safety) ---
interface TransactionPayload {
  tx_hash: string;
  user_id: string;
  amount: number;
  currency: string;
}

interface User {
  id: string;
  name: string;
  fiat_balance: number;
}

// --- SECURITY HELPER ---
const checkAuth = (event: APIGatewayProxyEvent): void => {
  const apiKey = event.headers["x-api-key"] || event.headers["X-Api-Key"];
  if (apiKey !== process.env.API_KEY) {
    throw new Error("Unauthorized: Invalid API Key");
  }
};

// --- HANDLERS ---
export const deposit: APIGatewayProxyHandler = async (event) => {
  try {
    checkAuth(event);

    if (!event.body) throw new Error("Missing Body");

    // 1. Parse & Validate Payload
    const body = JSON.parse(event.body);
    const { tx_hash, user_id, currency } = body;

    const amount = parseFloat(body.amount);

    // 2. Fail fast if validation fails
    if (!tx_hash || !user_id || !currency) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }
    if (isNaN(amount) || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid Amount" }),
      };
    }

    console.log(
      `Processing ${currency} Deposit: ${tx_hash} | Amount: ${amount}`,
    );

    // ATOMIC TRANSACTION
    const params = new TransactWriteCommand({
      TransactItems: [
        {
          // 1. Insert Transaction Record
          Put: {
            TableName: TX_TABLE,
            Item: {
              tx_hash, // Partition Key
              user_id, // GSI Key
              amount, // Stored as Number
              currency,
              status: "COMPLETED",
              created_at: new Date().toISOString(),
            },
            // Idempotency: Fail if tx_hash exists
            ConditionExpression: "attribute_not_exists(tx_hash)",
          },
        },
        {
          // 2. Credit User Balance
          Update: {
            TableName: USERS_TABLE,
            Key: { id: user_id },
            // FIX: Use 'if_not_exists' to handle cases where balance might be missing
            UpdateExpression:
              "SET fiat_balance = if_not_exists(fiat_balance, :zero) + :amount",
            ExpressionAttributeValues: {
              ":amount": amount,
              ":zero": 0,
            },
          },
        },
      ],
    });

    try {
      await docClient.send(params);
    } catch (err: any) {
      console.error(
        "DynamoDB Transaction Error:",
        JSON.stringify(err, null, 2),
      );

      // Handle Idempotency Failure (TransactionCanceledException)
      if (err.name === "TransactionCanceledException") {
        // Check which operation failed (Index 0 is the Put, Index 1 is the Update)
        const reasons = err.CancellationReasons;

        if (reasons && reasons[0].Code === "ConditionalCheckFailed") {
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: "Transaction already processed. Skipping.",
            }),
          };
        }
      }
      throw err; // Re-throw real errors (like DB down)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Deposit Successful",
        new_balance_status: "UPDATED",
      }),
    };
  } catch (err: any) {
    console.error(err);
    const statusCode = err.message.includes("Unauthorized") ? 401 : 500;
    return { statusCode, body: JSON.stringify({ error: err.message }) };
  }
};
export const getHistory: APIGatewayProxyHandler = async (event) => {
  try {
    checkAuth(event);
    const userId = event.pathParameters?.id;
    if (!userId)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing User ID" }),
      };

    const command = new QueryCommand({
      TableName: TX_TABLE,
      IndexName: "UserIdIndex",
      KeyConditionExpression: "user_id = :uid",
      ExpressionAttributeValues: {
        ":uid": userId,
      },
      ScanIndexForward: false, // Sort DESC (Newest first)
    });

    const res = await docClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        user_id: userId,
        count: res.Count,
        transactions: res.Items,
      }),
    };
  } catch (err: any) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

export const getBalance: APIGatewayProxyHandler = async (event) => {
  try {
    checkAuth(event);
    const userId = event.pathParameters?.id;
    if (!userId)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing User ID" }),
      };

    // Simple Key-Value Lookup
    const command = new GetCommand({
      TableName: USERS_TABLE,
      Key: { id: userId },
    });

    const res = await docClient.send(command);

    if (!res.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    const user = res.Item as User;

    return {
      statusCode: 200,
      body: JSON.stringify({
        user_id: user.id,
        name: user.name,
        balance: user.fiat_balance,
        currency: "USD",
      }),
    };
  } catch (err: any) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
