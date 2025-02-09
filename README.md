# Decentralized Memory Organ
This repository implements a Decentralized Memory Organ using IPFS + OrbitDB for distributed data storage, with local caching in PostgreSQL, plus role-based permissions, versioning, backup/recovery, monitoring/logging, and load balancing across multiple nodes. It showcases how to build a robust, tamper-proof database that uses wallet-based authentication and runs across containers in a Docker environment.

---

## Project Overview
The Decentralized Memory Organ is a sample database system designed to be:

- Fully decentralized using IPFS and OrbitDB, with no single point of failure.
- Authenticated via wallet signatures, ensuring only valid owners can make changes.
- Resilient and auditable with versioning, audit logs, and backups.
- Scalable by leveraging load balancing, concurrent operations, and local caching in PostgreSQL.
- Tamper-proof via cryptographic signatures: no server operator can modify data without the corresponding wallet key.

This project meets or exceeds the hackathon’s qualification requirements and includes several advanced features for reliability and performance.


## Key Features

### Data Stored Across Multiple Nodes
Uses IPFS for peer-to-peer replication and OrbitDB for distributed data structures (DocStore).
Multiple backend nodes are run via Docker, ensuring no single node is a single point of failure.

### CRUD Operations
Implements create, read, update, delete endpoints using OrbitDB as the source of truth.
Data is versioned and appended only, ensuring historical integrity.

### Wallet Signature Authentication
Every write operation requires a valid ECDSA signature corresponding to the user’s Ethereum wallet address.
Uses ethers.js to verify signature against the provided message and wallet.

### Concurrent Operations
OrbitDB’s CRDT-based log structure handles concurrent writes.
Docker-based load balancing helps distribute traffic across multiple nodes in parallel.

### Offline Resilience
Data is stored and replicated across multiple IPFS nodes. If some nodes go offline, others can still serve the data.

### Tamper-Proof by Cryptographic Proof
All write operations require signatures.
Even server owners cannot forge data changes without valid signatures.

### Dockerized
Each service (backend, database, load balancer) runs in a Docker container.
Simplifies deployment and ensures consistency across environments.

## Architectural Design
```
                         ┌────────────────────────┐
                         │       Frontend UI      │
                         │  (React / Wagmi / etc) │
                         └─────────┬──────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │   Load Balancer   │
                         │   (Nginx / LB)    │
                         └─────────┬─────────┘
                   ┌───────────────┴─────────────────┐
                   │                │                 │
          ┌────────▼─────────┐  ┌──▼─────────┐  ┌────▼─────────┐
          │  Backend Node 1  │  │Node 2      │  │Node 3         │
          │(Express + OrbitDB│  │ + IPFS +   │  │ + IPFS +       │
          │ + IPFS + PG Cache│  │  PG Cache) │  │  PG Cache)     │
          └────────┬─────────┘  └────┬───────┘  └─────┬─────────┘
                   │                 │                │
                   │   IPFS Pubsub   │   IPFS Pubsub  │
                   │   OrbitDB Rep.  │   OrbitDB Rep. │
                   └─────────────────┴────────────────┘
                         Docker / Container Network

         ┌──────────────────────┐
         │ PostgreSQL Database  │
         │   (Local Caching)    │
         └──────────────────────┘

```

## Core Components

### IPFS & OrbitDB
Stores and replicates data across nodes.
Eventual consistency model using CRDTs.
Minimizes single points of failure.

### Node.js / Express
Offers CRUD endpoints, signature verification, and role-based checks.
Dockerized to run multiple replicas.

### Load Balancer (NGINX)
Routes inbound traffic to any healthy backend node.
Checks health endpoints (/health) to identify active nodes.

### Local Caching with PostgreSQL (or libSQL)
Speeds up reads by caching replicated data.
Reduces overhead on IPFS/OrbitDB for frequent read requests.

### Prometheus & Grafana
Offers real-time metrics (via /metrics endpoint) and visualization.
Monitors CPU, memory, request latencies, and more.

### Backup & Recovery
Provides snapshot endpoints (/backup) to export OrbitDB oplogs.
Also supports traditional pg_dump for local PostgreSQL backups.

### Roles & Permissions
Admin, Contributor, Viewer.
Admins can manage roles, update/delete records.
Contributors can create records, viewers can only read.

### Data Versioning & Audit Logs
Each record includes a version field.
An audit log store tracks every create/update/delete.

## Setup & Installation
### For Docker
1. Clone the repo.
2. Run `docker-compose up --build` which sets up the Docker container.
3. Access the API via the frontend or cURL.

### For non-Docker
1. Clone the repo.
2. Run `node index.js` on the root folder of the repo.
3. Access the API via the frontend or cURL.

## Usage
Users can access the API via the UI frontend or via cURL commands.