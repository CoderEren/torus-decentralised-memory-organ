import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pkg;

// Adjust the connection string as needed (or use environment variables)
const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:supersecurepassword@localhost:5432/memoryorgan"
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initDbFilePath = path.join(__dirname, 'init-db.sql');
const initDbQuery = fs.readFileSync(initDbFilePath, 'utf8');

// Connect to PostgreSQL and initialize the database
client.connect().then(async () => {
  console.log("Connected to PostgreSQL for local caching.");

  // Execute the SQL initialization script
  await client.query(initDbQuery);
  console.log("Database initialized successfully from init-db.sql.");

}).catch(err => {
  console.error("PostgreSQL connection error:", err);
});

// Function to insert/update a record in the cache
export async function cacheRecord(record) {
  const queryText = `
    INSERT INTO records(id, wallet, data, version, timestamp, deleted)
    VALUES($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE 
      SET wallet = EXCLUDED.wallet, data = EXCLUDED.data, version = EXCLUDED.version, timestamp = EXCLUDED.timestamp, deleted = EXCLUDED.deleted;
  `;
  const values = [
    record.id,
    record.wallet,
    record.data,
    record.version,
    record.timestamp,
    record.deleted || false
  ];
  await client.query(queryText, values);
}

// Function to retrieve a record from the cache by ID
export async function getCachedRecord(id) {
  const res = await client.query('SELECT * FROM records WHERE id = $1', [id]);
  return res.rows[0] || null;
}
