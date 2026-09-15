# Distributed NoSQL E-Commerce Marketplace Platform


[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v5.0-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v7.0-brightgreen.svg)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-2496ED.svg)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-grade, distributed NoSQL e-commerce marketplace backend built with **Node.js, Express, MongoDB, and Mongoose**. Designed for high throughput, high availability, and zero-inventory-overselling using **MongoDB Multi-Document ACID Transactions**, **Replica Sets with Automatic Failover**, **Sharded Cluster Horizontal Scaling**, and **Advanced Analytics Aggregation Pipelines**.

---

## Architecture Overview

```
                          [ Client Requests / Shoppers / Postman ]
                                            │
                                            ▼
                           [ Express.js REST API Server ]
                           (Helmet, CORS, Rate Limiting)
                                            │
                       ┌────────────────────┴────────────────────┐
                       │                                         │
        [ Read Operations (Catalog & Analytics) ]     [ Write Transactions (Checkout) ]
                       │                                         │
                       │ Read Preference:                        │ Write Concern:
                       │ secondaryPreferred                      │ w: majority, j: true
                       ▼                                         ▼
            ┌────────────────────────────────────────────────────────┐
            │            MongoDB Distributed Cluster                 │
            │  ┌────────────────┐ ┌────────────────┐ ┌─────────────┐ │
            │  │  mongo1:27017  │ │  mongo2:27018  │ │ mongo3:27019│ │
            │  │   (Primary)    │ │  (Secondary)   │ │ (Secondary) │ │
            │  └────────────────┘ └────────────────┘ └─────────────┘ │
            │                 Replica Set: rs0                       │
            └────────────────────────────────────────────────────────┘
```

---

## Key Engineering Features

- **ACID Multi-Document Transactions (`session.withTransaction()`)**:
  - Implemented in `/api/orders/checkout`.
  - Atomically binds inventory verification, conditional stock reservation, discount code validation, order creation, payment settlement, and shipping tracking.
  - Automatically aborts and rolls back completely on any failure (e.g., insufficient stock or expired coupon).
- **High Availability & Zero-Downtime Failover**:
  - 3-node MongoDB Replica Set (`docker-compose.yml`) with automated election (`mongo-init`).
  - Read traffic offloaded to secondary nodes using `readPreference: 'secondaryPreferred'`.
  - Write durability enforced via `{ w: 'majority', j: true }`.
- **Horizontal Scaling & Sharded Topology**:
  - Configured in `docker-compose.sharding.yml` with Config Server Replica Set (`cfgrs`), 2 data shards (`shard1rs`, `shard2rs`), and a `mongos` query router.
  - **Hashed Shard Key**: `orders` collection sharded on `{ userId: "hashed" }` to eliminate monotonic write hotspots during peak traffic.
  - **Compound Shard Key**: `products` collection sharded on `{ category: 1, _id: 1 }` for localized category lookups.
- **Full-Text Inverted Search Index**:
  - Full-text compound index on `{ name: "text", brand: "text", description: "text" }` powering fast search queries at `/api/products?search=...`.
- **Business Intelligence Aggregation Pipelines (`/api/analytics`)**:
  - Real-time aggregation pipelines computing top-selling items by revenue and volume, revenue by category, customer lifetime value (LTV), and supply chain safety-stock alerts.

---

## Project Structure

```text
.
├── config/
│   └── db.js                 # Enterprise MongoDB connection & topology detection
├── models/
│   ├── user.js               # User & seller schema with validation & email tokens
│   ├── product.js            # Product catalog with compound & text indexes
│   ├── order.js              # Order schema with embedded snapshots & statics
│   ├── payment.js            # Transaction ledger with payment method enums
│   ├── shipping.js           # Logistics tracking records with courier enums
│   ├── discount.js           # Promotional voucher system with code validation
│   ├── refund.js             # Dispute & returns management schema
│   └── review.js             # Ratings with compound index (1 review per user/product)
├── routes/
│   ├── users.js              # User account CRUD & paginated listings
│   ├── products.js           # Product catalog, category filters & text search
│   ├── orders.js             # Direct order CRUD & Transactional Checkout
│   ├── payments.js           # Payment receipts & lookup
│   ├── shipping.js           # Shipping status & tracking updates
│   ├── discounts.js          # Coupon management & promo code validation
│   ├── refunds.js            # Refund processing (approval & rejection)
│   ├── reviews.js            # Product review listings & submission
│   └── analytics.js          # Aggregation pipelines for executive reporting
├── scripts/
│   ├── init-replica.js       # Standalone replica set initiation script
│   ├── init-sharding.js      # Sharded cluster & collection sharding script
│   ├── cluster-status.js     # CLI diagnostic for checking cluster topology & health
│   ├── seed-and-test.js      # End-to-end integration test runner
│   └── benchmark.js          # Concurrency load testing & benchmark suite
├── app.js                    # Express application entry point & route mounting
├── docker-compose.yml        # 3-Node MongoDB Replica Set cluster
├── docker-compose.sharding.yml # Enterprise Sharded Cluster topology
├── BENCHMARK_RESULTS.md      # Performance evaluation & benchmark report
└── package.json              # Dependencies and project scripts
```

---

## API Endpoints Reference

### Core Marketplace Resources
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | API directory and service health overview |
| `GET` | `/api/health` | Live cluster health & topology detection |
| `POST` | `/api/orders/checkout` | **ACID Transactional Checkout** (Stock reservation + Order + Payment + Shipping) |
| `GET` | `/api/products` | Paginated product catalog (`?page=1&limit=10&category=...`) |
| `GET` | `/api/products?search=:term` | Inverted full-text product search |
| `GET` | `/api/discounts/code/:code` | Validate promotional discount voucher |
| `GET` | `/api/reviews/product/:id` | Paginated reviews for a specific product |

### Business Intelligence & Analytics
| Method | Endpoint | Pipeline Description |
| :--- | :--- | :--- |
| `GET` | `/api/analytics/top-selling-products` | Top revenue-generating and volume products (`$unwind`, `$group`, `$lookup`, `$sort`) |
| `GET` | `/api/analytics/revenue-by-category` | Category financial performance and unique order counts |
| `GET` | `/api/analytics/low-stock-alert` | Supply chain monitoring flagging products with stock $\le$ 10 |
| `GET` | `/api/analytics/customer-ltv` | Customer Lifetime Value (total spend, order frequency, average order value) |
| `GET` | `/api/analytics/dashboard-summary` | Executive KPI metrics summary |

---

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) installed locally OR [Docker Desktop](https://www.docker.com/)

### 2. Installation
```powershell
# Clone the repository
git clone https://github.com/Vunene-Khoza/E-commerce.git
cd E-commerce

# Install dependencies
npm install

# Setup environment configuration
copy .env.example .env
```

### 3. Start Database

#### Option A: Local MongoDB Service (Quickest)
```powershell
net start MongoDB
```

#### Option B: Distributed 3-Node Replica Set via Docker
```powershell
docker compose up -d
```

### 4. Run the Application
```powershell
# Start the API server
npm start

# Server will be accessible at:
http://localhost:8000
```

---

## Testing & Benchmarks

```powershell
# Run the automated End-to-End integration test
npm run test:e2e

# Inspect current MongoDB cluster topology & health
npm run cluster:status

# Run the 50-client concurrent load test suite & generate BENCHMARK_RESULTS.md
npm run benchmark
```

### Benchmark Summary

| Workload Scenario | Endpoint | Throughput | Median ($p_{50}$) | $p_{99}$ Latency | Success Rate |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Catalog Browsing** | `GET /api/products` | **1,420 Req/s** | **14.2 ms** | 48.5 ms | **100.0%** |
| **Full-Text Search** | `GET /api/products?search=...` | **1,180 Req/s** | **18.0 ms** | 56.1 ms | **100.0%** |
| **Top-Selling Pipeline**| `GET /api/analytics/top-selling-products`| **890 Req/s** | **24.5 ms** | 74.3 ms | **100.0%** |
| **Transactional Checkout**| `POST /api/orders/checkout` | **460 Req/s** | **48.2 ms** | 134.0 ms | **100.0%** |

*(Full performance evaluation and academic breakdown in [BENCHMARK_RESULTS.md](BENCHMARK_RESULTS.md))*

---

## Author

- **Vunene Khoza** - [GitHub Profile](https://github.com/Vunene-Khoza)
- Subject: Database Development 371/381 - Assessment Project

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

