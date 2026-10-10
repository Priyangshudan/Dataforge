# DataForge — Dataset, Model, and Experiment Lineage Management DBMS

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

DataForge is an academic Database Management System (DBMS) platform designed to track, version, profile, and audit machine learning datasets, model checkpoints, training runs, and benchmark evaluations.

Built with **PostgreSQL 18** and **TypeScript** (Node.js/Express backend + React 19/Vite frontend), DataForge eliminates "black box" machine learning pipelines by enforcing strict relational integrity, cryptographic SHA-256 deduplication, recursive lineage graphs, and automated database triggers without hiding SQL behind an ORM.

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. System Architecture](#2-system-architecture)
- [3. Features](#3-features)
- [4. Technology Stack](#4-technology-stack)
- [5. Prerequisites](#5-prerequisites)
  - [Windows Prerequisites](#windows-prerequisites)
  - [macOS Prerequisites](#macos-prerequisites)
- [6. Clone the Repository](#6-clone-the-repository)
- [7. PostgreSQL Setup](#7-postgresql-setup)
  - [Windows PostgreSQL Configuration](#windows-postgresql-configuration)
  - [macOS PostgreSQL Configuration](#macos-postgresql-configuration)
- [8. Environment Variables](#8-environment-variables)
- [9. Database Migrations and Seed Data](#9-database-migrations-and-seed-data)
- [10. Quickstart Guide: Run DataForge from Scratch](#10-quickstart-guide-run-dataforge-from-scratch)
- [11. Running the Backend](#11-running-the-backend)
- [12. Running the Frontend](#12-running-the-frontend)
- [13. DBMS Features & Demonstration Queries](#13-dbms-features--demonstration-queries)
- [14. Testing & Verification Checklist](#14-testing--verification-checklist)
- [15. Troubleshooting](#15-troubleshooting)

---

## 1. Project Overview

In machine learning and data engineering, datasets constantly evolve through cleaning, feature engineering, and cohort addition. Without strict database-backed provenance, models are often trained on untracked data versions, making results irreproducible and introducing silent feature drift.

DataForge solves this by providing:

1. **Relational Dataset Lineage**: Treating dataset versions not as isolated files, but as nodes in a directed derivation graph connected to downstream models and experiments.
2. **Cryptographic Checksum Verification**: Enforcing SHA-256 byte-level duplicate detection and relational schema fingerprints.
3. **Pure PostgreSQL DBMS Focus**: Implementing primary keys, composite unique constraints, check constraints, database views, stored procedures/functions, recursive CTEs, and triggers directly in PostgreSQL rather than delegating constraints to an application-level ORM.
4. **Explainable Similarity & Drift**: Measuring Jaccard schema overlap and numerical feature distribution shifts persisted in queryable PostgreSQL tables.

---

## 2. System Architecture

The following diagram illustrates how the browser client, Vite development server, Express REST API, local filesystem storage, and PostgreSQL communicate:

```mermaid
flowchart TD
    subgraph Client ["Browser Client"]
        UI["React 19 SPA (Dashboard, Lineage DAG, Wizard)"]
    end

    subgraph FrontendDev ["Frontend Dev Server (Port 3000)"]
        Vite["Vite 6 Development Server\nProxy: /api & /uploads -> :5000"]
    end

    subgraph BackendAPI ["Backend REST API (Port 5000)"]
        Express["Express 4 Server + Routes"]
        Multer["Multer (Multipart CSV Parser)"]
        Services["Domain Services (Lineage, Analysis, Datasets)"]
        PGPool["pg (node-postgres) Connection Pool"]
    end

    subgraph Storage ["Local Storage & Database"]
        Uploads["Local Filesystem: uploads/ (*.csv)"]
        Postgres[("PostgreSQL 18 Database (Port 5432)\n- Tables & Foreign Keys\n- Triggers & Functions\n- Views & Recursive CTEs")]
    end

    UI -->|HTTP / SPA Navigation| Vite
    Vite -->|Proxy /api requests| Express
    Express -->|Ingest CSV file| Multer
    Multer -->|Store physical file| Uploads
    Express -->|Domain operations| Services
    Services -->|Parameterized SQL Queries| PGPool
    PGPool -->|TCP / SCRAM-SHA-256| Postgres
    Postgres -->|Trigger execution| Postgres
```

### Communication Flow & Ports

| Component | Default Port | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | `3000` | React 19 + TypeScript + Vite development server |
| **Backend REST API** | `5000` | Express application serving `/api/*` endpoints |
| **PostgreSQL Database** | `5432` | PostgreSQL 18 local database instance (`dataforge`) |

---

## 3. Features

### Implemented & Demonstrable Capabilities

1. **Project & User Workspaces**
   - User creation with platform roles (`ADMIN`, `DATA_ENGINEER`, `VIEWER`).
   - Project workspaces with unique slugs, owners, and membership role associations (`OWNER`, `CONTRIBUTOR`).
2. **6-Step Dataset Registration Wizard**
   - Guided client pipeline: Project Assignment &rarr; CSV Upload &rarr; Metadata Definition &rarr; Schema Preview &rarr; Version Configuration &rarr; Review & Atomic Commit.
3. **Dataset Metadata & Schema Extraction**
   - Automatic extraction of row count, column count, column names, ordinal positions, inferred data types (`VARCHAR`, `NUMERIC`, `BOOLEAN`), null counts, and distinct value counts.
4. **Dataset Versioning & Cryptographic Checksums**
   - Immutable version records with semantic labels (`v1.0.0`, `v1.1.0`), commit messages, and SHA-256 file checksums.
5. **Exact Duplicate File Detection**
   - Backend prevents duplicate uploads within the same dataset by comparing SHA-256 hashes against existing versions, returning HTTP `409 DUPLICATE_FILE`.
6. **Machine Learning Model Registry**
   - Model tracking across frameworks (`PyTorch`, `XGBoost`, `Scikit-Learn`) and task types (`Classification`, `Regression`, `LLM`).
   - Checkpoint versioning linked to dataset versions.
7. **Experiment Tracking & Metrics**
   - Training runs binding exact dataset versions to model checkpoints.
   - Status tracking (`COMPLETED`, `RUNNING`, `FAILED`).
   - Multi-metric logging: accuracy, precision, recall, f1-score, loss, and ROC-AUC.
8. **Interactive Lineage Explorer (DAG)**
   - Recursive Common Table Expressions (CTEs) traversing version derivation trees (`parent_version_id`).
   - Direct graph traversal mapping `Dataset -> Dataset Version -> Model Version -> Experiment Run`.
   - Node inspector displaying cryptographic metadata and properties.
9. **Explainable Similarity & Drift Analysis**
   - Set-based Jaccard schema similarity calculation between any two dataset versions.
   - Numerical feature drift profiling (mean shifts and drift scores) recorded in `dataset_similarity`.
10. **Analytics Views & Immutable Audit Logging**
    - High-level DBMS storage aggregation and project allocation.
    - PostgreSQL triggers (`trg_after_insert_dataset_version`) automatically journal version creations to `activity_logs`.
11. **Comprehensive PostgreSQL DBMS Primitives**
    - Multi-table constraints, partial indexes, check constraints, materialized summary views, and transactional rollbacks with filesystem compensation.

---

## 4. Technology Stack

- **Runtime:** Node.js (LTS v20+ recommended; tested on v24.19.0)
- **Package Manager:** npm (v10+)
- **Database Engine:** PostgreSQL 18 (compatible with PostgreSQL 15, 16, 17, and 18)
- **Database Driver:** `pg` (node-postgres v8.12.0)
- **Backend Framework:** Express v4.19.2 + TypeScript v5.5.2
- **Frontend Framework:** React v19.2.8 + Vite v6.4.4 + TypeScript
- **Icons & Visualization:** Lucide React + Recharts v3.10.1
- **Testing Frameworks:** Vitest (Backend integration suite + Frontend unit suite)

---

## 5. Prerequisites

Before installing DataForge, verify that the required runtimes and tools are installed.

### Official Installation Resources

- **Node.js LTS**: [https://nodejs.org/](https://nodejs.org/)
- **PostgreSQL**: [https://www.postgresql.org/download/](https://www.postgresql.org/download/)
- **Git**: [https://git-scm.com/downloads](https://git-scm.com/downloads)
- **Homebrew (macOS)**: [https://brew.sh/](https://brew.sh/)

---

### Windows Prerequisites

1. **Git for Windows**: Download from [git-scm.com](https://git-scm.com/downloads).
2. **Node.js LTS**: Download the Windows Installer (.msi) from [nodejs.org](https://nodejs.org/).
3. **PostgreSQL 18 for Windows**:
   - Download the interactive installer from the [PostgreSQL Windows Download Page](https://www.postgresql.org/download/windows/).
   - During installation, set a master password for the `postgres` administrative user (e.g., `postgres` or your own secure password). Remember this password!
   - Default port: `5432`.
   - Default locale: `[Default locale]`.
   - *Note on Stack Builder:* Stack Builder is unselected by default at the end of installation; it is **not** required for DataForge.
4. **Verifying PATH on Windows**:
   Open Windows PowerShell and check tool versions:

   ```powershell
   git --version
   node --version
   npm --version
   psql --version
   ```

   > **Troubleshooting Windows PATH for `psql`:**  
   > If `psql : The term 'psql' is not recognized` appears, the PostgreSQL `bin` folder is not in your System `PATH`.
   > 1. Press `Win + R`, type `sysdm.cpl`, and press Enter.
   > 2. Open the **Advanced** tab &rarr; click **Environment Variables**.
   > 3. Under **System variables**, select `Path` &rarr; click **Edit**.
   > 4. Click **New** and add the PostgreSQL binary path (example for PostgreSQL 18):  
   >    `C:\Program Files\PostgreSQL\18\bin`  
   >    *(or `C:\Program Files\PostgreSQL\17\bin` depending on your installed version)*
   > 5. Click **OK**, restart your PowerShell window, and re-run `psql --version`.

---

### macOS Prerequisites

1. **Git**: Installed via Xcode Command Line Tools:
   ```bash
   xcode-select --install
   ```
2. **Node.js LTS**: Install via the official installer or using Homebrew:
   ```bash
   brew install node@20
   ```
3. **PostgreSQL 18 via Homebrew**:
   ```bash
   brew install postgresql@18
   # Start the PostgreSQL background service
   brew services start postgresql@18
   ```
   *(Alternatively, use the official macOS graphical installer from [postgresql.org](https://www.postgresql.org/download/macosx/)).*

4. **Verify Installations on macOS**:
   ```bash
   git --version
   node --version
   npm --version
   psql --version
   ```

---

## 6. Clone the Repository

Clone the DataForge repository to your local machine:

### Windows (PowerShell)

```powershell
git clone https://github.com/Priyangshudan/Dataforge.git
cd Dataforge
Get-ChildItem
```

### macOS / Linux (Terminal)

```bash
git clone https://github.com/Priyangshudan/Dataforge.git
cd Dataforge
ls -la
```

---

## 7. PostgreSQL Setup

DataForge stores all application data in a dedicated database named `dataforge`. It also uses an optional test database named `dataforge_test` for running the integration test suite.

### Windows (PowerShell)

1. **Verify the PostgreSQL service is running:**
   ```powershell
   Get-Service -Name postgresql*
   ```
   If the status is `Stopped`, start it:
   ```powershell
   Start-Service postgresql*
   ```

2. **Connect to PostgreSQL using `psql`:**
   ```powershell
   psql -U postgres -h 127.0.0.1 -p 5432
   ```
   *(Enter the password you chose during installation when prompted).*

3. **Create the databases:**
   Inside the `psql` prompt, execute:
   ```sql
   CREATE DATABASE dataforge;
   CREATE DATABASE dataforge_test;
   ```

4. **Verify the databases exist:**
   ```sql
   \l
   ```
   *(Note: `\l`, `\c`, and `\dt` are psql meta-commands, not standard SQL statements).*

5. **Exit `psql`:**
   ```sql
   \q
   ```

---

### macOS (Terminal)

1. **Ensure the service is active:**
   ```bash
   brew services list
   ```

2. **Connect as administrative user:**
   ```bash
   psql -U postgres -h 127.0.0.1 -p 5432
   ```
   *(If your local macOS user is the default superuser, you can run `psql postgres`).*

3. **Create the databases:**
   ```sql
   CREATE DATABASE dataforge;
   CREATE DATABASE dataforge_test;
   ```

4. **Verify and exit:**
   ```sql
   \l
   \q
   ```

---

## 8. Environment Variables

DataForge reads its backend runtime configuration from a `.env` file located in the **root** directory of the repository.

### Backend `.env` Specification

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `5000` | Port for Express API server |
| `NODE_ENV` | No | `development` | Runtime environment (`development`, `production`, `test`) |
| `DATABASE_URL` | **Yes** | `postgresql://postgres:postgres@127.0.0.1:5432/dataforge` | Primary PostgreSQL connection string |
| `TEST_DATABASE_URL` | No | `postgresql://postgres:postgres@127.0.0.1:5432/dataforge_test` | Dedicated database for running integration tests |
| `UPLOAD_DIR` | No | `uploads` | Relative directory for ingested CSV files |
| `MAX_FILE_SIZE_BYTES` | No | `52428800` | Maximum uploaded file size in bytes (50 MB) |

### Database URL Format & Password Encoding

The connection URL follows this format:
```
postgresql://<USERNAME>:<PASSWORD>@<HOST>:<PORT>/<DATABASE_NAME>
```

> [!WARNING]
> **Special Characters in Passwords:** If your database password contains special characters (such as `@`, `:`, `/`, `?`, `#`, or `%`), you **must** URL-encode them.  
> - Example: `@` becomes `%40` (e.g., `Pass@123` &rarr; `Pass%40123`).  
> - Failure to URL-encode special characters will cause a PostgreSQL SASL / SCRAM authentication error.

### Creating `.env`

#### Windows (PowerShell)

```powershell
Copy-Item .env.example .env
```
Open `.env` in your text editor (e.g., `notepad .env`) and set your actual PostgreSQL password in `DATABASE_URL` and `TEST_DATABASE_URL`.

#### macOS / Linux (Terminal)

```bash
cp .env.example .env
```
Edit `.env` (e.g., `nano .env`) and update your credentials.

> [!IMPORTANT]
> Never commit `.env` to Git. The `.gitignore` file already excludes `.env` to prevent credentials from being exposed.

### Frontend Environment Configuration

The frontend in `frontend/` uses Vite's proxy configuration ([frontend/vite.config.ts](file:///c:/Users/priya/Documents/Coding/Dataforge/frontend/vite.config.ts)) which automatically proxies `/api` and `/uploads` requests to `http://localhost:5000`. **No frontend `.env` file is required for standard local development.**

---

## 9. Database Migrations and Seed Data

DataForge uses raw SQL migrations executed through a transaction runner ([src/db/migrate.ts](file:///c:/Users/priya/Documents/Coding/Dataforge/src/db/migrate.ts)) and a migration tracking table (`schema_migrations`).

### 1. Run Migrations

From the repository **root**, run:

```bash
npm run db:migrate
```

**What this executes in order:**
- `001_initial_schema.sql`: Creates core tables (`users`, `projects`, `project_members`, `datasets`, `dataset_versions`, `dataset_columns`, `models`, `model_versions`, `experiments`, `experiment_metrics`, `dataset_lineage`, `dataset_similarity`, `activity_logs`), primary keys, foreign keys, unique constraints, and B-tree indexes.
- `002_views_triggers.sql`: Defines `set_updated_at_timestamp()`, trigger `trg_after_insert_dataset_version` for audit logging, and domain views (`dataset_summary_view`, `best_experiments_view`, `project_analytics_view`).
- `003_compat_and_drift.sql`: Adds compatibility columns and analytical views.

*Migrations are recorded in `schema_migrations` and will safely skip files that have already been applied.*

### 2. Seed Demonstration Data

Populate the database with realistic demonstration data:

```bash
npm run db:seed
```

**What this populates:**
- **Users**: Admin, data engineer, and researcher personas.
- **Projects**: Customer intelligence, fraud detection, and retail demand forecasting.
- **Datasets & Versions**: Baseline churn datasets, fraud event streams, and footfall logs with extracted columns and SHA-256 hashes.
- **Models & Versions**: XGBoost and neural network classifiers.
- **Experiments & Metrics**: Multi-epoch training runs with accuracy, loss, and F1 scores.
- **Lineage Records**: Training linkages between dataset versions and model checkpoints.

*Idempotency: `npm run db:seed` uses `ON CONFLICT DO UPDATE` statements and can be safely re-run without creating duplicate records.*

---

## 10. Quickstart Guide: Run DataForge from Scratch

Follow these step-by-step commands to launch DataForge from a fresh clone.

### Windows (PowerShell)

**Terminal 1 — Backend & Database Setup:**
```powershell
# 1. Clone & Enter project
git clone https://github.com/Priyangshudan/Dataforge.git
cd Dataforge

# 2. Configure environment
Copy-Item .env.example .env
# Edit .env and enter your PostgreSQL password

# 3. Install backend dependencies & Build
npm install
npm run build

# 4. Migrate and Seed Database
npm run db:migrate
npm run db:seed

# 5. Start Backend Server
npm run dev
```

**Terminal 2 — Frontend Setup:**
```powershell
# 1. Enter frontend folder
cd Dataforge\frontend

# 2. Install dependencies
npm install

# 3. Start Frontend Development Server
npm run dev
```

Open your browser to: **`http://localhost:3000`**

---

### macOS / Linux (Terminal)

**Terminal 1 — Backend & Database Setup:**
```bash
# 1. Clone & Enter project
git clone https://github.com/Priyangshudan/Dataforge.git
cd Dataforge

# 2. Configure environment
cp .env.example .env
# Edit .env and enter your PostgreSQL password

# 3. Install backend dependencies & Build
npm install
npm run build

# 4. Migrate and Seed Database
npm run db:migrate
npm run db:seed

# 5. Start Backend Server
npm run dev
```

**Terminal 2 — Frontend Setup:**
```bash
# 1. Enter frontend folder
cd Dataforge/frontend

# 2. Install dependencies
npm install

# 3. Start Frontend Development Server
npm run dev
```

Open your browser to: **`http://localhost:3000`**

---

## 11. Running the Backend

All backend commands are executed from the **root** directory:

```bash
# Install dependencies
npm install

# Compile TypeScript to dist/
npm run build

# Start live reload development server (via tsx)
npm run dev

# Start compiled production server
npm run start

# Run database migrations
npm run db:migrate

# Seed demonstration data
npm run db:seed

# Run backend integration tests
npm test
```

### Verifying Backend Health

Verify that the backend is responding and connected to PostgreSQL by querying the `/api/health` endpoint:

**Using curl or PowerShell:**
```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/health
```

**Expected JSON Response:**
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "database": "connected",
    "database_latency_ms": 1,
    "timestamp": "2026-10-10T18:30:00.000Z",
    "version": "1.0.0"
  }
}
```

---

## 12. Running the Frontend

All frontend commands must be executed from the **`frontend/`** directory:

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server at http://localhost:3000
npm run dev

# Run frontend component tests (vitest + jsdom)
npx vitest run

# Compile production bundle to frontend/dist/
npm run build

# Preview production build locally
npm run preview
```

When you start the development server, open `http://localhost:3000` in your browser. The sidebar displays live PostgreSQL connection status and latency polled from the backend health check.

---

## 13. DBMS Features & Demonstration Queries

DataForge demonstrates core relational DBMS capabilities directly in PostgreSQL.

### Key Relational Features in Code

- **Checked Constraints & Types**: Enforcing positive row counts (`row_count >= 0`), non-negative file sizes (`file_size_bytes >= 0`), and valid statuses in [database/migrations/001_initial_schema.sql](file:///c:/Users/priya/Documents/Coding/Dataforge/database/migrations/001_initial_schema.sql).
- **Foreign Key Cascades & Restrictions**: Preventing accidental deletion of projects or datasets when child records exist.
- **Materialized Summary Views**: [database/migrations/002_views_triggers.sql](file:///c:/Users/priya/Documents/Coding/Dataforge/database/migrations/002_views_triggers.sql) defines `dataset_summary_view` and `best_experiments_view`.
- **Database Trigger Functions**: Function `log_dataset_version_creation()` executes `AFTER INSERT ON dataset_versions` to automatically append entries to `activity_logs`.
- **Recursive Lineage Common Table Expressions**: Traverses multi-generational dataset ancestry in [src/services/analysisService.ts](file:///c:/Users/priya/Documents/Coding/Dataforge/src/services/analysisService.ts).

### Demonstration SQL Queries

Connect to `psql -U postgres -d dataforge` to run these queries against the seeded schema:

#### Query 1: Inspect Projects and Their Aggregated Datasets
```sql
SELECT 
    p.name AS project_name,
    COUNT(d.id) AS total_datasets,
    COALESCE(SUM(v.file_size_bytes), 0) AS total_bytes
FROM projects p
LEFT JOIN datasets d ON d.project_id = p.id
LEFT JOIN dataset_versions v ON v.dataset_id = d.id
GROUP BY p.name
ORDER BY total_datasets DESC;
```

#### Query 2: Recursive Ancestry Lineage Query (PostgreSQL CTE)
Find the full lineage path of parent versions leading to a specific version:
```sql
WITH RECURSIVE version_tree AS (
    SELECT 
        id, dataset_id, version_label, parent_version_id, checksum_sha256, 1 as depth
    FROM dataset_versions
    WHERE id = 'd0000001-0000-0000-0000-000000000002'
    
    UNION ALL
    
    SELECT 
        p.id, p.dataset_id, p.version_label, p.parent_version_id, p.checksum_sha256, vt.depth + 1
    FROM dataset_versions p
    INNER JOIN version_tree vt ON vt.parent_version_id = p.id
)
SELECT depth, version_label, checksum_sha256 FROM version_tree;
```

#### Query 3: Best Performing Models & Experiment Metrics View
```sql
SELECT 
    model_name,
    algorithm,
    dataset_name,
    dataset_version_label,
    ROUND(accuracy::numeric, 4) AS accuracy,
    ROUND(loss::numeric, 4) AS loss,
    model_rank
FROM best_experiments_view
WHERE model_rank = 1
ORDER BY accuracy DESC NULLS LAST;
```

#### Query 4: Audit Activity Logs Created by Trigger
```sql
SELECT 
    action,
    entity_type,
    entity_name,
    details,
    created_at
FROM activity_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 14. Testing & Verification Checklist

### Automated Test Suites

```bash
# 1. Run Backend Integration Test Suite (from root)
npm test
# Executes 13 tests covering endpoints, duplicate detection, triggers, and transactions

# 2. Run Frontend Component Test Suite (from frontend/)
cd frontend
npx vitest run

# 3. Verify Production Builds
cd ..
npm run build         # Backend compile check
cd frontend
npm run build         # Frontend bundle check
```

### Manual Verification Checklist for New Users

- [ ] PostgreSQL service is running on `127.0.0.1:5432`.
- [ ] Database `dataforge` was created.
- [ ] `npm run db:migrate` completed with `All migrations completed successfully`.
- [ ] `npm run db:seed` displays table counts for all 12 entities.
- [ ] Backend is running on port 5000 (`http://localhost:5000/api/health` returns `status: UP`).
- [ ] Frontend opens at `http://localhost:3000` with green `PostgreSQL Live` status indicator.
- [ ] Projects appear under the **Projects** tab.
- [ ] Click **Create New Project** and verify it appears immediately in the list.
- [ ] Click **Register Dataset** and complete the 6-step wizard using any CSV file.
- [ ] Attempting to upload the exact same CSV twice to the same dataset displays a duplicate warning (`409 DUPLICATE_FILE`).
- [ ] Navigate to **Lineage Explorer** and verify that nodes and edges display derivation paths.
- [ ] Navigate to **Audit Logs** and verify trigger-generated log records are present.

---

## 15. Troubleshooting

### 1. `psql` is not recognized (Windows)
- **Cause:** PostgreSQL binary folder is missing from the system environment variable `Path`.
- **Solution:** Add `C:\Program Files\PostgreSQL\18\bin` (or your version's path) to the `Path` variable in Windows System Properties and restart your terminal.

### 2. `password authentication failed for user "postgres"`
- **Cause:** The password specified in `.env` does not match your PostgreSQL installation password, or contains special characters that are not URL-encoded.
- **Solution:** 
  - Ensure special characters are percent-encoded (`@` &rarr; `%40`, `#` &rarr; `%23`, etc.).
  - To reset the password via `psql` on Windows/macOS if superuser access is available:
    ```sql
    ALTER USER postgres WITH PASSWORD 'newpassword';
    ```
    Then update `DATABASE_URL` in `.env`.

### 3. Port 5000 or 3000 already in use
- **Cause:** Another process is holding port 5000 (backend) or port 3000 (frontend).
- **Solution (Windows PowerShell):**
  ```powershell
  # Check which process is listening on port 5000
  Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess
  Stop-Process -Id <PID> -Force
  ```
- **Solution (macOS):**
  ```bash
  lsof -i :5000
  kill -9 <PID>
  ```

### 4. `database "dataforge" does not exist`
- **Cause:** Migrations were run before creating the database.
- **Solution:** Connect to `psql` and execute `CREATE DATABASE dataforge;`, then re-run `npm run db:migrate`.

### 5. `ECONNREFUSED 127.0.0.1:5432`
- **Cause:** PostgreSQL service is stopped.
- **Solution:**
  - **Windows:** Run `Start-Service postgresql*` in PowerShell.
  - **macOS:** Run `brew services start postgresql@18` in Terminal.

### 6. CSV Upload Fails with `Upload directory cannot be created`
- **Cause:** File permissions issue with the `uploads/` folder.
- **Solution:** Ensure the `uploads/` directory exists in the project root:
  - Windows: `New-Item -ItemType Directory -Force uploads`
  - macOS: `mkdir -p uploads`

---

## License

This project is developed for academic DBMS research and coursework demonstration. Open-source licensed under the MIT License.
