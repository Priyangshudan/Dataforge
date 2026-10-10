import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createApp } from '../src/app';
import { pool, closePool, withTransaction } from '../src/db';
import { runMigrations } from '../src/db/migrate';

describe('DataForge Backend Integration & Acceptance Test Suite', () => {
  const app = createApp();

  // Test state across lifecycle
  let testUserId: string;
  let testProjectId: string;
  let testDatasetId: string;
  let testVersion1Id: string;
  let testVersion2Id: string;
  let testModelId: string;
  let testModelVersionId: string;
  let testExperimentId: string;

  const sampleCsv1Path = path.resolve(__dirname, 'test_sample1.csv');
  const sampleCsv2Path = path.resolve(__dirname, 'test_sample2.csv');

  beforeAll(async () => {
    // 1. Ensure migrations are applied on test database
    await runMigrations();

    // Create temporary physical test CSV files
    fs.writeFileSync(
      sampleCsv1Path,
      'feature_a,feature_b,feature_c,target\n10,20.5,true,0\n20,35.0,false,1\n30,50.2,true,1\n40,65.8,false,0\n50,80.1,true,1\n'
    );

    fs.writeFileSync(
      sampleCsv2Path,
      'feature_a,feature_b,feature_c,new_feature,target\n12,22.0,true,100,0\n25,38.5,false,150,1\n32,54.0,true,200,1\n45,70.2,false,250,0\n55,85.4,true,300,1\n'
    );
  });

  afterAll(async () => {
    // Clean up temporary local files
    if (fs.existsSync(sampleCsv1Path)) fs.unlinkSync(sampleCsv1Path);
    if (fs.existsSync(sampleCsv2Path)) fs.unlinkSync(sampleCsv2Path);

    // Close database pool gracefully
    await closePool();
  });

  // 1. Health & Database Connectivity
  it('1. GET /api/health should verify live PostgreSQL connectivity', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
    expect(res.body.data.database).toBe('connected');
    expect(typeof res.body.data.database_latency_ms).toBe('number');
  });

  // 2. User Creation & Retrieval
  it('2. POST /api/users should create a new user and enforce uniqueness', async () => {
    const userPayload = {
      name: 'Dr. Alan Turing',
      email: `alan.turing.${Date.now()}@dataforge.ai`,
      role: 'ADMIN',
    };

    const res = await request(app).post('/api/users').send(userPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.email).toBe(userPayload.email);
    testUserId = res.body.data.id;

    // Verify committed directly in PostgreSQL
    const dbUser = await pool.query('SELECT * FROM users WHERE id = $1', [testUserId]);
    expect(dbUser.rowCount).toBe(1);
    expect(dbUser.rows[0].email).toBe(userPayload.email);

    // Duplicate email check
    const dupRes = await request(app).post('/api/users').send(userPayload);
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.success).toBe(false);
  });

  // 3 & 4. Mandatory Project-Creation Regression Test
  it('3. Mandatory Regression: POST /api/projects followed immediately by GET /api/projects and direct SQL', async () => {
    const projectPayload = {
      name: `Regression Test Project ${Date.now()}`,
      description: 'Verifying atomic project creation, owner enrollment, and list visibility.',
      owner_id: testUserId,
    };

    // Step 1: Create project via API
    const postRes = await request(app).post('/api/projects').send(projectPayload);
    expect(postRes.status).toBe(201);
    expect(postRes.body.success).toBe(true);
    testProjectId = postRes.body.data.id;
    expect(testProjectId).toBeDefined();

    // Step 2: Immediate GET /api/projects must include the created project
    const getRes = await request(app).get('/api/projects');
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    const foundInList = getRes.body.data.some((p: any) => p.id === testProjectId);
    expect(foundInList).toBe(true);

    // Step 3: Direct SQL query confirms committed row exists in PostgreSQL
    const dbProject = await pool.query('SELECT * FROM projects WHERE id = $1', [testProjectId]);
    expect(dbProject.rowCount).toBe(1);
    expect(dbProject.rows[0].name).toBe(projectPayload.name);
    expect(dbProject.rows[0].owner_id).toBe(testUserId);

    // Step 4: Verify owner was automatically added to project_members table inside the same transaction
    const dbMember = await pool.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
      [testProjectId, testUserId]
    );
    expect(dbMember.rowCount).toBe(1);
    expect(dbMember.rows[0].role).toBe('OWNER');
  });

  // 5. Dataset Creation under Project & Invalid Project Rejection
  it('4. POST /api/datasets should create a dataset under project, reject non-existent projects', async () => {
    // Valid creation
    const dsPayload = {
      name: `Telemetry Benchmark ${Date.now()}`,
      project_id: testProjectId,
      description: 'Sensor reading logs and anomaly flags',
      type: 'Structured Tabular',
      created_by: testUserId,
    };

    const res = await request(app).post('/api/datasets').send(dsPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    testDatasetId = res.body.data.id;
    expect(testDatasetId).toBeDefined();

    // Verify foreign key in PostgreSQL
    const dbDs = await pool.query('SELECT * FROM datasets WHERE id = $1', [testDatasetId]);
    expect(dbDs.rowCount).toBe(1);
    expect(dbDs.rows[0].project_id).toBe(testProjectId);

    // Invalid project ID rejection
    const invalidRes = await request(app).post('/api/datasets').send({
      name: 'Invalid Dataset',
      project_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.success).toBe(false);
  });

  // 6. CSV Upload, Metadata Extraction & Version 1 Creation
  it('5. POST /api/datasets/:id/versions should upload CSV, extract schema, calculate SHA-256, and trigger activity log', async () => {
    const res = await request(app)
      .post(`/api/datasets/${testDatasetId}/versions`)
      .attach('file', sampleCsv1Path)
      .field('commit_message', 'Initial sensor baseline upload')
      .field('version_label', 'v1.0.0')
      .field('created_by', testUserId);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBeDefined();
    expect(res.body.data.columns).toBeDefined();

    const ver = res.body.data.version;
    testVersion1Id = ver.id;
    expect(ver.version_number).toBe(1);
    expect(ver.version_label).toBe('v1.0.0');
    expect(Number(ver.row_count)).toBe(5);
    expect(Number(ver.column_count)).toBe(4);
    expect(ver.checksum_sha256).toBeDefined();

    // Verify SHA-256 matches actual file bytes
    const expectedHash = crypto.createHash('sha256').update(fs.readFileSync(sampleCsv1Path)).digest('hex');
    expect(ver.checksum_sha256).toBe(expectedHash);

    // Verify columns were extracted into dataset_columns in PostgreSQL
    const cols = await pool.query(
      'SELECT * FROM dataset_columns WHERE version_id = $1 ORDER BY ordinal_position ASC',
      [testVersion1Id]
    );
    expect(cols.rowCount).toBe(4);
    expect(cols.rows[0].column_name).toBe('feature_a');
    expect(cols.rows[0].data_type).toBe('INTEGER');

    // Verify automatic activity log trigger created an entry
    const logCheck = await pool.query(
      "SELECT * FROM activity_logs WHERE entity_id = $1 AND entity_type = 'DATASET_VERSION'",
      [testVersion1Id]
    );
    expect(logCheck.rowCount).toBe(1);
    expect(logCheck.rows[0].action).toBe('CREATE');
  });

  // 7. Duplicate File Detection (SHA-256 Conflict Policy)
  it('6. POST /api/datasets/:id/versions should reject exact duplicate file in the same dataset with 409', async () => {
    const res = await request(app)
      .post(`/api/datasets/${testDatasetId}/versions`)
      .attach('file', sampleCsv1Path)
      .field('commit_message', 'Attempting duplicate upload')
      .field('created_by', testUserId);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_FILE');
    expect(res.body.error.details.existing_version_id).toBe(testVersion1Id);
  });

  // 8. Version 2 Creation with Parent Ancestry & Schema Evolution
  it('7. POST /api/datasets/:id/versions should create v2 referencing v1 as parent', async () => {
    const res = await request(app)
      .post(`/api/datasets/${testDatasetId}/versions`)
      .attach('file', sampleCsv2Path)
      .field('commit_message', 'Appended new_feature column and recalibrated readings')
      .field('version_label', 'v2.0.0')
      .field('parent_version_id', testVersion1Id)
      .field('created_by', testUserId);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    testVersion2Id = res.body.data.version.id;
    expect(res.body.data.version.version_number).toBe(2);
    expect(res.body.data.version.parent_version_id).toBe(testVersion1Id);

    // Verify derivation lineage record was created in PostgreSQL
    const lineage = await pool.query(
      'SELECT * FROM dataset_lineage WHERE source_version_id = $1 AND target_version_id = $2',
      [testVersion1Id, testVersion2Id]
    );
    expect(lineage.rowCount).toBe(1);
  });

  // 9. Transaction Rollback & Physical File Compensation on Induced Error
  it('8. Transaction Rollback: A failure during version creation must rollback DB and delete uploaded file', async () => {
    const preCount = await pool.query('SELECT count(*) FROM dataset_versions WHERE dataset_id = $1', [testDatasetId]);

    // Force error by passing invalid parent_version_id from a different/non-existent entity
    const dummyBadParent = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const res = await request(app)
      .post(`/api/datasets/${testDatasetId}/versions`)
      .attach('file', sampleCsv1Path)
      .field('commit_message', 'Should rollback cleanly')
      .field('parent_version_id', dummyBadParent);

    expect(res.status).toBe(400);

    // Verify row count did not increment in PostgreSQL
    const postCount = await pool.query('SELECT count(*) FROM dataset_versions WHERE dataset_id = $1', [testDatasetId]);
    expect(postCount.rows[0].count).toBe(preCount.rows[0].count);
  });

  // 10. Schema Comparison & Drift Analysis
  it('9. Analysis: Schema comparison and numerical distribution drift calculation', async () => {
    // Schema Comparison
    const compareRes = await request(app).get(`/api/versions/${testVersion1Id}/compare/${testVersion2Id}`);
    expect(compareRes.status).toBe(200);
    expect(compareRes.body.success).toBe(true);
    expect(compareRes.body.data.added_columns).toContain('new_feature');
    expect(compareRes.body.data.shared_columns.length).toBe(4);
    expect(compareRes.body.data.jaccard_similarity).toBeGreaterThan(0.7);

    // Distribution Drift
    const driftRes = await request(app).post('/api/analysis/drift').send({
      base_version_id: testVersion1Id,
      compared_version_id: testVersion2Id,
    });
    expect(driftRes.status).toBe(200);
    expect(driftRes.body.success).toBe(true);
    expect(driftRes.body.data.similarity_score).toBeDefined();
    expect(driftRes.body.data.drift_score).toBeDefined();

    // Verify saved in dataset_similarity in PostgreSQL
    const dbSim = await pool.query(
      'SELECT * FROM dataset_similarity WHERE base_version_id = $1 AND compared_version_id = $2',
      [testVersion1Id, testVersion2Id]
    );
    expect(dbSim.rowCount).toBe(1);
  });

  // 11. Model & Model Version Management
  it('10. Models: Create model and model version linked to dataset version', async () => {
    const modelPayload = {
      project_id: testProjectId,
      name: 'Anomaly Forest Classifier',
      framework: 'Scikit-learn',
      task_type: 'Anomaly Detection',
      created_by: testUserId,
    };

    const mRes = await request(app).post('/api/models').send(modelPayload);
    expect(mRes.status).toBe(201);
    testModelId = mRes.body.data.id;

    const mvPayload = {
      version: 'v1.0.0',
      dataset_version_id: testVersion2Id,
      algorithm: 'IsolationForest',
      hyperparameters: { n_estimators: 100, contamination: 0.05 },
      created_by: testUserId,
    };

    const mvRes = await request(app).post(`/api/models/${testModelId}/versions`).send(mvPayload);
    expect(mvRes.status).toBe(201);
    testModelVersionId = mvRes.body.data.id;

    // Verify training lineage created in PostgreSQL
    const trainLineage = await pool.query(
      'SELECT * FROM dataset_lineage WHERE source_version_id = $1 AND model_version_id = $2',
      [testVersion2Id, testModelVersionId]
    );
    expect(trainLineage.rowCount).toBe(1);
  });

  // 12. Experiment Creation & Metrics Persistence
  it('11. Experiments: Record experiment and multi-dimensional evaluation metrics', async () => {
    const expPayload = {
      name: 'Sensor Anomaly Baseline Sweep',
      dataset_version_id: testVersion2Id,
      model_version_id: testModelVersionId,
      notes: 'Initial test run with contamination threshold 0.05',
      created_by: testUserId,
    };

    const expRes = await request(app).post('/api/experiments').send(expPayload);
    expect(expRes.status).toBe(201);
    testExperimentId = expRes.body.data.id;

    const metricPayload = {
      accuracy: 0.9450,
      precision_score: 0.9200,
      recall_score: 0.8900,
      f1_score: 0.9047,
      loss: 0.1250,
      roc_auc: 0.9650,
      extra_metrics: { val_loss: 0.14, false_positive_rate: 0.03 },
    };

    const metricRes = await request(app).post(`/api/experiments/${testExperimentId}/metrics`).send(metricPayload);
    expect(metricRes.status).toBe(201);

    // Verify stored directly in experiment_metrics in PostgreSQL
    const dbMetric = await pool.query('SELECT * FROM experiment_metrics WHERE experiment_id = $1', [testExperimentId]);
    expect(dbMetric.rowCount).toBe(1);
    expect(Number(dbMetric.rows[0].accuracy)).toBe(0.945);
  });

  // 13. Recursive Lineage Graph Retrieval
  it('12. Lineage: Traverse recursive lineage ancestry and export full graph', async () => {
    // Version recursive ancestry
    const verLineageRes = await request(app).get(`/api/lineage/versions/${testVersion2Id}`);
    expect(verLineageRes.status).toBe(200);
    expect(verLineageRes.body.success).toBe(true);
    expect(verLineageRes.body.data.ancestry.length).toBeGreaterThanOrEqual(2);
    expect(verLineageRes.body.data.trained_models.length).toBeGreaterThanOrEqual(1);

    // Dataset graph lineage
    const dsLineageRes = await request(app).get(`/api/lineage/datasets/${testDatasetId}`);
    expect(dsLineageRes.status).toBe(200);
    expect(dsLineageRes.body.success).toBe(true);
    expect(dsLineageRes.body.data.nodes.length).toBeGreaterThanOrEqual(3);
    expect(dsLineageRes.body.data.edges.length).toBeGreaterThanOrEqual(2);
  });

  // 14. Analytics Endpoints Backed by PostgreSQL Views
  it('13. Analytics: Summary, dataset distribution, and top experiments', async () => {
    const summaryRes = await request(app).get('/api/analytics/summary');
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.success).toBe(true);
    expect(Number(summaryRes.body.data.total_projects)).toBeGreaterThan(0);
    expect(Number(summaryRes.body.data.total_datasets)).toBeGreaterThan(0);

    const dsAnalyticsRes = await request(app).get('/api/analytics/datasets');
    expect(dsAnalyticsRes.status).toBe(200);
    expect(dsAnalyticsRes.body.success).toBe(true);
    expect(Array.isArray(dsAnalyticsRes.body.data.projects)).toBe(true);

    const expAnalyticsRes = await request(app).get('/api/analytics/experiments');
    expect(expAnalyticsRes.status).toBe(200);
    expect(expAnalyticsRes.body.success).toBe(true);
    expect(Array.isArray(expAnalyticsRes.body.data.best_experiments)).toBe(true);
  });
});
