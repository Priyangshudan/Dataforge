# DataForge Frontend

DataForge is a dataset and machine-learning experiment lineage management platform built with React 19, TypeScript, and Vite against an authentic PostgreSQL 18 backend.

## Architecture

- **Framework:** React 19 + TypeScript + Vite 6
- **Styling:** Custom CSS variables theme with Dark Navy / Charcoal aesthetic (`#0B0F17`, `#111827`, `#151E2E`)
- **Typography:** Plus Jakarta Sans & JetBrains Mono
- **Icons:** Lucide React
- **Charts:** Recharts
- **Testing:** Vitest + React Testing Library + JSDOM

## Views & Functionality

1. **Dashboard (`DashboardPage`)**: High-level platform statistics (Projects, Datasets, Versions, Models, Experiments, Storage), dataset allocation by project, experiment execution distribution, top model metrics, and live PostgreSQL audit logs.
2. **Projects (`ProjectsPage`)**: Workspaces listing, search filters, project creation modal with auto-refresh and validation.
3. **Datasets (`DatasetsPage`)**: Dataset catalog filtered by project, version counts, latest row counts, and inspection actions.
4. **Dataset Registration Wizard (`DatasetRegistrationPage`)**: 6-step guided wizard:
   - Step 1: Assign Project Context (with in-wizard project creation).
   - Step 2: CSV File Upload (with drag-and-drop & dropzone size checks).
   - Step 3: Dataset Metadata (Name, description, tags).
   - Step 4: Schema Verification (client-side preview of headers, sample rows, and inferred data types).
   - Step 5: Version & Commit Details (version label, commit message).
   - Step 6: Confirmation & Final Commit (atomic creation of dataset record and file version with SHA-256 hash).
5. **Dataset Details (`DatasetDetailPage`)**:
   - Version Overview (row count, column count, SHA-256 hash, file size).
   - Version History table.
   - Relational Schema columns (column names, PostgreSQL data types, nullability, ordinal positions).
   - Schema Similarity (Jaccard similarity calculation) & Distribution Drift analysis.
   - Version Ancestry tree.
   - New version upload and commit modal.
6. **Models (`ModelsPage`)**: ML model registry tracking frameworks (PyTorch, XGBoost, Scikit-Learn), task types, checkpoint versions, and model creation modal.
7. **Experiments (`ExperimentsPage`)**: Training runs binding exact dataset versions to model checkpoints, status badges, and evaluation metric logging (Accuracy, Loss).
8. **Lineage Explorer (`LineagePage`)**: Interactive directed graph (DAG) representing relationships across Datasets &rarr; Versions &rarr; Model Checkpoints &rarr; Experiments, with interactive Node Inspector.
9. **Analytics (`AnalyticsPage`)**: System-wide aggregates, storage consumption, project distribution bar chart, status breakdown pie chart, and benchmark leaderboard.
10. **Audit Logs (`ActivityPage`)**: Filterable PostgreSQL activity journal with action badges and timestamps.
11. **Team & Users (`UsersPage`)**: Platform accounts roster and user registration modal.

## Development & Execution

```bash
# Start backend (from repository root)
npm run dev

# Start frontend (from frontend/ directory)
npm run dev
```

The frontend development server runs at `http://localhost:3000` with proxy configured for `/api` and `/uploads` to `http://localhost:5000`.

## Testing

```bash
# Run backend integration tests (from repository root)
npm test

# Run frontend unit tests (from frontend/ directory)
npx vitest run

# Build frontend production bundle
npm run build
```
