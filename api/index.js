import { create as IPFS } from 'ipfs-core';
import OrbitDB from 'orbit-db';
import express from 'express';
import bodyParser from 'body-parser';
import { verifyMessage } from 'ethers';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import client from 'prom-client';
import { cacheRecord, getCachedRecord } from './cache.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());

client.collectDefaultMetrics();


async function init() {
  // Initialize an IPFS node with basic options.
  const ipfsOptions = {
    repo: './ipfs',
    // Enable experimental pubsub for OrbitDB replication
    EXPERIMENTAL: { pubsub: true }
  };

  console.log('Starting IPFS node...');
  const ipfs = await IPFS(ipfsOptions);
  console.log('IPFS node is ready.');

  // Create an OrbitDB instance on top of the IPFS node.
  const orbitdb = await OrbitDB.createInstance(ipfs);

  // Create or open a document store database named "records"
  const db = await orbitdb.docstore("records", {
    indexBy: 'id',
  });
  await db.load();
  console.log('OrbitDB document store "records" is ready for entries.');

  const rolesDb = await orbitdb.docstore("roles", {
    indexBy: "id"
  });
  await rolesDb.load();
  console.log('OrbitDB document store "roles" is ready for roles.');

  const INITIAL_ADMIN_WALLET = process.env.ADMIN_ADDRESS || "0x63915621df7B675B839aF403BdE9C56fdfBc8555";
  const existingAdmin = rolesDb.get(INITIAL_ADMIN_WALLET);
  if (!existingAdmin || existingAdmin.length === 0) {
    await rolesDb.put({
      id: INITIAL_ADMIN_WALLET.toLowerCase(),
      role: "admin"
    });
    console.log(`Admin role assigned to ${INITIAL_ADMIN_WALLET}`);
  }

  // Create or open an audit log store for recording all changes.
  const auditDb = await orbitdb.docstore("auditLogs", {
    indexBy: "logId"
  });
  await auditDb.load();
  console.log('OrbitDB document store "auditLogs" is ready.');

  // Listen to replication events to help debugging distributed replication.
  db.events.on('replicated', async (peer) => {
    console.log(`Database replicated from ${peer}`);
    await db.load();
  });

  // ===============
  //  API Endpoints
  // ===============

  // --- Helper: Verify wallet signature ---
  // Expects: message, signature, and wallet address.
  function verifySignature(message, signature, wallet) {
    try {
      console.log("Verifying signature:", message, signature, wallet);
      const recoveredAddress = verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === wallet.toLowerCase();
    } catch (err) {
      console.error("Signature verification error:", err);
      return false;
    }
  }

  function getUserRole(wallet) {
    const records = rolesDb.get(wallet.toLowerCase());
    if (!records || records.length === 0) {
      return "viewer";
    }
    return records[0].role;
  }

  function userHasPermission(role, requiredRoles) {
    return requiredRoles.includes(role);
  }

  async function auditLog(operation, wallet, recordId, previousRecord, newRecord) {
    // Create a unique logId (could be timestamp + random string)
    const logId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 8);
    const logEntry = {
      logId,
      operation,            // e.g., "create", "update", "delete"
      wallet,
      recordId,
      previousRecord,       // can be null for create
      newRecord,            // the record after operation
      timestamp: new Date().toISOString()
    };

    try {
      await auditDb.put(logEntry);
      console.log(`Audit log entry ${logId} recorded for record ${recordId}`);
    } catch (err) {
      console.error("Error recording audit log:", err);
    }
  }

  // --- GET ROLE (GET /role/:wallet) ---
  app.get('/role/:wallet', async (req, res) => {
    const role = getUserRole(req.params.wallet);
    res.send({ success: true, role });
  });

  // --- GET ALL ROLES (GET /roles) ---
  app.get('/roles', async (req, res) => {
    const roles = rolesDb.get('');
    res.send(roles);
  });

  // --- SET ROLE (POST /setRole) ---
  // Expected payload: { adminWallet, signature, message, targetWallet, newRole }
  app.post('/setRole', async (req, res) => {
    const { adminWallet, signature, message, targetWallet, newRole } = req.body;
    if (!adminWallet || !signature || !message || !targetWallet || !newRole) {
      return res.status(400).send("Missing parameters");
    }
    if (!verifySignature(message, signature, adminWallet)) {
      return res.status(401).send("Invalid signature");
    }

    // Check that adminWallet indeed has "admin" role
    const adminRecords = rolesDb.get(adminWallet.toLowerCase());
    if (!adminRecords || adminRecords.length === 0 || adminRecords[0].role !== "admin") {
      return res.status(403).send("Unauthorized: only admin can set roles");
    }

    // Validate the new role
    const validRoles = ["admin", "contributor", "viewer"];
    if (!validRoles.includes(newRole)) {
      return res.status(400).send("Invalid role");
    }

    // Update the targetWallet's role
    await rolesDb.put({
      id: targetWallet.toLowerCase(),
      role: newRole
    });

    console.log(`Role of ${targetWallet} updated to ${newRole} by admin ${adminWallet}`);
    res.send({ success: true, newRole });
  });

  // --- CREATE (POST /record) ---
  // Expected payload: { wallet, signature, message, data }
  app.post('/record', async (req, res) => {
    const { wallet, signature, message, data } = req.body;
    if (!wallet || !signature || !message || !data) {
      return res.status(400).send("Missing parameters");
    }
    if (!verifySignature(message, signature, wallet)) {
      return res.status(401).send("Invalid signature");
    }

    // Only admin or contributor can create records.
    const role = getUserRole(wallet);
    if (!userHasPermission(role, ["admin", "contributor"])) {
      return res.status(403).send("Unauthorized: role does not permit create");
    }

    // Create a unique ID using current time and a random string.
    const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 8);
    const record = {
      id,
      timestamp: new Date().toISOString(),
      wallet,
      data,
      version: 1
    };

    try {
      await db.put(record);
      console.log(`Record ${id} created by ${wallet}`);
      await cacheRecord(record);
      await auditLog("create", wallet, id, null, record);
      res.send({ success: true, record });
    } catch (err) {
      console.error("Error writing record:", err);
      res.status(500).send("Error writing record: " + err.message);
    }
  });

  // --- READ (GET /record/:id) ---
  app.get('/record/:id', async (req, res) => {
    // Try to fetch from the local cache first
    console.log("Fetching record from cache:", req.params.id);
    let record = await getCachedRecord(req.params.id);
    console.log("Record from cache:", record);
    if (record) {
      return res.send(record);
    }
    // Fallback: fetch from OrbitDB
    console.log("Fetching record from OrbitDB:", req.params.id);
    const records = db.get(req.params.id);
    if (!records || records.length === 0) {
      return res.status(404).send("Record not found");
    }
    console.log("Record from OrbitDB:", records[0]);
    res.send(records[0]);
  });

  // --- READ ALL (GET /records) ---
  app.get('/records', async (req, res) => {
    const records = db.get('');
    res.send(records);
  });

  // --- UPDATE (PUT /record/:id) ---
  // Expected payload: { wallet, signature, message, data }
  // Only the admin can update.
  app.put('/record/:id', async (req, res) => {
    const { wallet, signature, message, data } = req.body;
    if (!wallet || !signature || !message || !data) {
      return res.status(400).send("Missing parameters");
    }
    if (!verifySignature(message, signature, wallet)) {
      return res.status(401).send("Invalid signature");
    }

    const role = getUserRole(wallet);
    // only admin can update any record
    if (role !== "admin") {
      return res.status(403).send("Unauthorized: only admin can update");
    }

    let records = db.get(req.params.id);
    if (!records || records.length === 0) {
      return res.status(404).send("Record not found");
    }
    // Only allow update if the wallet matches the one that created the record.
    if (records[0].wallet.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(403).send("Unauthorized: wallet mismatch");
    }
    const currentVersion = records[0].version || 1;
    const updatedRecord = {
      ...records[0],
      data,
      timestamp: new Date().toISOString(),
      version: currentVersion + 1,
      updated: true
    };
    try {
      await db.put(updatedRecord);
      await cacheRecord(updatedRecord);
      await auditLog("update", wallet, req.params.id, records[0], updatedRecord);
      console.log(`Record ${req.params.id} updated by ${wallet}`);
      res.send({ success: true, record: updatedRecord });
    } catch (err) {
      console.error("Error updating record:", err);
      res.status(500).send("Error updating record: " + err.message);
    }
  });

  // --- DELETE (DELETE /record/:id) ---
  // Expected payload: { wallet, signature, message }
  // Because OrbitDB docstores are append‑only, we “simulate” deletion by marking the record as deleted.
  app.delete('/record/:id', async (req, res) => {
    const { wallet, signature, message } = req.body;
    if (!wallet || !signature || !message) {
      return res.status(400).send("Missing parameters");
    }
    if (!verifySignature(message, signature, wallet)) {
      return res.status(401).send("Invalid signature");
    }

    const role = getUserRole(wallet);
    // only admin can delete records
    if (role !== "admin") {
      return res.status(403).send("Unauthorized: only admin can delete");
    }

    let records = db.get(req.params.id);
    if (!records || records.length === 0) {
      return res.status(404).send("Record not found");
    }
    if (records[0].wallet.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(403).send("Unauthorized: wallet mismatch");
    }
    try {
      // Mark the record as deleted.
      const currentVersion = records[0].version || 1;
      const deletedRecord = {
        ...records[0],
        deleted: true,
        timestamp: new Date().toISOString(),
        version: currentVersion + 1
      };
      await db.put(deletedRecord);
      await cacheRecord(deletedRecord);
      await auditLog("delete", wallet, req.params.id, records[0], deletedRecord);
      console.log(`Record ${req.params.id} marked as deleted by ${wallet}`);
      res.send({ success: true, record: deletedRecord });
    } catch (err) {
      console.error("Error deleting record:", err);
      res.status(500).send("Error deleting record: " + err.message);
    }
  });

  // --- GET /backup ---
  // Exports the current state of the records and audit logs to JSON files.
  app.get('/backup', async (req, res) => {
    try {
      // Export records and audit logs as JSON.
      const recordsSnapshot = db._oplog ? db._oplog.toJSON() : db.get('');
      const auditSnapshot = auditDb._oplog ? auditDb._oplog.toJSON() : auditDb.get('');

      // Write snapshots to files (adjust paths as needed).
      fs.writeFileSync(path.join(__dirname, 'backup_records.json'), JSON.stringify(recordsSnapshot, null, 2));
      fs.writeFileSync(path.join(__dirname, 'backup_audit.json'), JSON.stringify(auditSnapshot, null, 2));

      res.send({ success: true, message: "Backup created successfully." });
    } catch (err) {
      console.error("Backup error:", err);
      res.status(500).send("Backup error: " + err.message);
    }
  });

  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', client.register.contentType);
      res.end(await client.register.metrics());
    } catch (ex) {
      res.status(500).end(ex);
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).send("OK");
  });

  // --- Start the Express server ---
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

init();
