# DataForge

DataForge is an academic DBMS platform for dataset versioning, machine learning model and experiment tracking, artifact lineage, and analytics. It uses PostgreSQL as its authoritative database engine to enforce relational integrity, SHA-256 deduplication, schema comparisons, and trigger-based audit logging without an ORM.

---

## Prerequisites

Install Git, Node.js (LTS v20+), and PostgreSQL (v15+ / v18 recommended):

- **Git:** [git-scm.com/downloads](https://git-scm.com/downloads)
- **Node.js LTS:** [nodejs.org](https://nodejs.org/)
- **PostgreSQL:** [postgresql.org/download](https://www.postgresql.org/download/) *(Stack Builder is optional and not required)*

Verify installations in your terminal:

```bash
git --version
node --version
npm --version
psql --version
```

> **Windows Note:** If `psql` is not recognized, add your PostgreSQL `bin` directory (e.g., `C:\Program Files\PostgreSQL\18\bin`) to your system `Path` environment variable and reopen PowerShell.

---

## 1. Clone the Repository

**Windows PowerShell & macOS Terminal:**

```bash
git clone https://github.com/Priyangshudan/Dataforge.git
cd Dataforge
```

---

## 2. Configure PostgreSQL

Ensure your local PostgreSQL service is running, then connect with `psql` and create the application database `dataforge`:

**Windows PowerShell & macOS Terminal:**

```bash
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE dataforge;"
```

*(Optional: To run backend automated tests with `npm test`, also create the test database: `psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE dataforge_test;"`)*

---

## 3. Configure Environment Variables

Copy `.env.example` to `.env` in the root directory:

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS Terminal:**

```bash
cp .env.example .env
```

Open `.env` in your editor and update `DATABASE_URL` with your local PostgreSQL password:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/dataforge
TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/dataforge_test
UPLOAD_DIR=uploads
MAX_FILE_SIZE_BYTES=52428800
```

> **Password Note:** If your password contains special characters (like `@`, `#`, or `%`), URL-encode them (e.g., `@` becomes `%40`). The frontend requires no separate `.env` file.

---

## 4. Install Dependencies, Migrate, and Seed

From the repository **root**, run the setup commands in order:

**Windows PowerShell & macOS Terminal:**

```bash
# 1. Install backend dependencies & build TypeScript
npm install
npm run build

# 2. Run database migrations (creates schema, views, and triggers)
npm run db:migrate

# 3. Seed demonstration data (users, projects, datasets, models, experiments)
npm run db:seed
```

*Note: Migrations and seed scripts are idempotent and can be safely re-run.*

---

## 5. Run DataForge

Start the backend and frontend in two separate terminals.

### Terminal 1 — Backend (from repository root)

```bash
npm run dev
```

*The Express API starts on `http://localhost:5000`.*

### Terminal 2 — Frontend (from `frontend/` directory)

**Windows PowerShell:**

```powershell
cd frontend
npm install
npm run dev
```

**macOS Terminal:**

```bash
cd frontend
npm install
npm run dev
```

*The Vite development server starts on `http://localhost:3000` and automatically proxies `/api` and `/uploads` requests to the backend.*

Open **`http://localhost:3000`** in your browser. The backend must be running for the frontend to display database records.

---

## 6. Verify the Setup

Check that the backend API is live and connected to PostgreSQL:

**Windows PowerShell:**

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

**macOS Terminal:**

```bash
curl http://localhost:5000/api/health
```

*Expected response:* `{"success":true,"data":{"status":"UP","database":"connected",...}}`.

To inspect the created tables directly in PostgreSQL:

```bash
psql -U postgres -d dataforge -c "\dt"
```

A successful setup shows 13 populated tables, and the web interface displays active projects, datasets, model checkpoints, and interactive lineage graphs.

---

## 7. Troubleshooting

- **`psql` not recognized (Windows):** Add your PostgreSQL installation `bin` folder (e.g., `C:\Program Files\PostgreSQL\18\bin`) to Windows System Environment Variables `Path` and restart your terminal.
- **PostgreSQL service not running:**
  - *Windows:* Run `Start-Service postgresql*` in PowerShell as Administrator.
  - *macOS:* Run `brew services start postgresql@18` in Terminal.
- **Password authentication failed:** Ensure the password in `.env` matches your local PostgreSQL `postgres` user password, and URL-encode any special characters (`@` &rarr; `%40`).
- **Database "dataforge" does not exist:** Run `psql -U postgres -c "CREATE DATABASE dataforge;"` before executing `npm run db:migrate`.
- **Port 5000 or 3000 already in use:** Stop the process using the port (`Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force` on Windows, or `kill -9 $(lsof -t -i:5000)` on macOS).
- **Frontend cannot connect to backend:** Ensure Terminal 1 is running `npm run dev` in the root folder so the API is reachable at `http://localhost:5000`.
