-- DataForge Idempotent Realistic Demonstration Seed Data

-- 1. Users
INSERT INTO users (id, name, email, role, avatar, status)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'Elena Rostova', 'elena.rostova@dataforge.ai', 'ADMIN', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', 'Active'),
    ('a0000000-0000-0000-0000-000000000002', 'Marcus Vance', 'marcus.vance@dataforge.ai', 'DATA_ENGINEER', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', 'Active'),
    ('a0000000-0000-0000-0000-000000000003', 'Aria Chen', 'aria.chen@dataforge.ai', 'VIEWER', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', 'Active')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;

-- 2. Projects
INSERT INTO projects (id, name, slug, description, owner_id)
VALUES 
    ('b0000001-0000-0000-0000-000000000001', 'Enterprise Customer Intelligence', 'customer-intelligence', 'Predictive modeling for enterprise customer retention, lifetime value, and churn prevention.', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000001-0000-0000-0000-000000000002', 'Autonomous Fraud Detection', 'fraud-detection', 'High-throughput real-time financial transaction fraud classification and anomaly detection.', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000001-0000-0000-0000-000000000003', 'Omnichannel Retail Analytics', 'retail-analytics', 'Store inventory demand forecasting, basket analysis, and cross-channel conversion pipelines.', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    owner_id = EXCLUDED.owner_id;

-- 3. Project Members
INSERT INTO project_members (project_id, user_id, role)
VALUES 
    ('b0000001-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'OWNER'),
    ('b0000001-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'CONTRIBUTOR'),
    ('b0000001-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'OWNER'),
    ('b0000001-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'OWNER')
ON CONFLICT (project_id, user_id) DO UPDATE SET 
    role = EXCLUDED.role;

-- 4. Datasets
INSERT INTO datasets (id, name, project_id, description, source, type, status, tags, created_by)
VALUES 
    ('c0000001-0000-0000-0000-000000000001', 'Customer Churn Baseline', 'b0000001-0000-0000-0000-000000000001', 'Synthesized telco customer dataset with demographic, service subscription, and tenure attributes.', 'CRM_EXPORT', 'TABULAR', 'Active', ARRAY['churn', 'classification', 'tabular'], 'a0000000-0000-0000-0000-000000000001'),
    ('c0000001-0000-0000-0000-000000000002', 'Financial Transaction Streams', 'b0000001-0000-0000-0000-000000000002', 'Credit card transaction event logs labeled with confirmed fraudulent activity indicators.', 'KAFKA_STREAM', 'TABULAR', 'Active', ARRAY['fraud', 'anomaly-detection', 'finance'], 'a0000000-0000-0000-0000-000000000002'),
    ('c0000001-0000-0000-0000-000000000003', 'Retail Store Footfall & Sales', 'b0000001-0000-0000-0000-000000000003', 'Aggregated daily point-of-sale logs across regional department stores.', 'POS_DATABASE', 'TABULAR', 'Active', ARRAY['retail', 'timeseries', 'sales'], 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 5. Dataset Versions
INSERT INTO dataset_versions (id, dataset_id, version_number, version_label, parent_version_id, file_name, storage_path, file_size_bytes, row_count, column_count, checksum_sha256, schema_fingerprint, commit_message, status, created_by)
VALUES 
    ('d0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 1, 'v1.0.0', NULL, 'customer_churn_v1.csv', 'uploads/customer_churn_v1.csv', 1048576, 7043, 6, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'f1a2b3c4d5e6f7a8', 'Initial baseline upload for churn study.', 'Active', 'a0000000-0000-0000-0000-000000000001'),
    ('d0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 2, 'v1.1.0', 'd0000001-0000-0000-0000-000000000001', 'customer_churn_v2.csv', 'uploads/customer_churn_v2.csv', 1258291, 8500, 7, 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e', 'f1a2b3c4d5e6f7a9', 'Appended Q3 subscriber cohorts and net promoter score feature.', 'Active', 'a0000000-0000-0000-0000-000000000001'),
    ('d0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000002', 1, 'v1.0.0', NULL, 'fraud_transactions_v1.csv', 'uploads/fraud_transactions_v1.csv', 5242880, 284807, 8, 'c4ca4238a0b923820dcc509a6f75849bca37a3465133663a8c3d9a2be9b6b72a', '8f7a6b5c4d3e2f1a', 'Initial raw credit card stream transactions.', 'Active', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET 
    commit_message = EXCLUDED.commit_message,
    file_size_bytes = EXCLUDED.file_size_bytes;

-- 6. Dataset Columns
INSERT INTO dataset_columns (id, version_id, column_name, data_type, is_nullable, ordinal_position, null_count, distinct_count, sample_values)
VALUES 
    ('20000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'customer_id', 'TEXT', false, 1, 0, 7043, '["CUST-001", "CUST-002"]'::jsonb),
    ('20000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001', 'tenure_months', 'INTEGER', false, 2, 0, 72, '[1, 12, 24, 60]'::jsonb),
    ('20000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000001', 'monthly_charges', 'NUMERIC', false, 3, 0, 1585, '[29.85, 56.95, 89.10]'::jsonb),
    ('20000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000001', 'total_charges', 'NUMERIC', true, 4, 11, 6531, '[29.85, 683.4, 5342.1]'::jsonb),
    ('20000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000001', 'contract_type', 'TEXT', false, 5, 0, 3, '["Month-to-month", "One year", "Two year"]'::jsonb),
    ('20000001-0000-0000-0000-000000000006', 'd0000001-0000-0000-0000-000000000001', 'churned', 'BOOLEAN', false, 6, 0, 2, '[true, false]'::jsonb)
ON CONFLICT (version_id, column_name) DO UPDATE SET 
    data_type = EXCLUDED.data_type,
    is_nullable = EXCLUDED.is_nullable;

-- 7. Models
INSERT INTO models (id, name, project_id, description, framework, task_type, status, created_by)
VALUES 
    ('e0000001-0000-0000-0000-000000000001', 'Customer Churn Gradient Booster', 'b0000001-0000-0000-0000-000000000001', 'Ensemble XGBoost classifier targeting high-risk customer cancellation prediction.', 'XGBoost', 'Classification', 'Active', 'a0000000-0000-0000-0000-000000000001'),
    ('e0000001-0000-0000-0000-000000000002', 'Fraud Anomaly Isolation Forest', 'b0000001-0000-0000-0000-000000000002', 'Unsupervised outlier detector identifying irregular credit card charge sequences.', 'Scikit-learn', 'Anomaly Detection', 'Active', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 8. Model Versions
INSERT INTO model_versions (id, model_id, version, dataset_version_id, algorithm, hyperparameters, endpoint_url, status, created_by)
VALUES 
    ('f0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'v1.0.0', 'd0000001-0000-0000-0000-000000000001', 'XGBClassifier', '{"learning_rate": 0.05, "max_depth": 6, "n_estimators": 200}'::jsonb, 'https://models.internal.dataforge/churn/v1', 'Active', 'a0000000-0000-0000-0000-000000000001'),
    ('f0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001', 'v1.1.0', 'd0000001-0000-0000-0000-000000000002', 'XGBClassifier', '{"learning_rate": 0.03, "max_depth": 5, "n_estimators": 350}'::jsonb, 'https://models.internal.dataforge/churn/v2', 'Active', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET 
    algorithm = EXCLUDED.algorithm;

-- 9. Experiments
INSERT INTO experiments (id, name, dataset_version_id, model_version_id, status, notes, created_by)
VALUES 
    ('10000001-0000-0000-0000-000000000001', 'Baseline Telco Churn XGB Run', 'd0000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 'COMPLETED', '[Demonstration Record] Initial 5-fold cross validation on raw customer tabular dataset.', 'a0000000-0000-0000-0000-000000000001'),
    ('10000001-0000-0000-0000-000000000002', 'Retrained Telco Churn with NPS Feature', 'd0000001-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000002', 'COMPLETED', '[Demonstration Record] Retrained model with net promoter score feature and extended Q3 cohort.', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET 
    notes = EXCLUDED.notes;

-- 10. Experiment Metrics
INSERT INTO experiment_metrics (id, experiment_id, accuracy, precision_score, recall_score, f1_score, loss, roc_auc, extra_metrics)
VALUES 
    ('50000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000001', 0.8140, 0.7650, 0.6890, 0.7249, 0.384200, 0.8620, '{"log_loss": 0.384, "cohen_kappa": 0.58}'::jsonb),
    ('50000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000002', 0.8520, 0.8120, 0.7410, 0.7749, 0.312500, 0.8980, '{"log_loss": 0.312, "cohen_kappa": 0.65}'::jsonb)
ON CONFLICT (experiment_id) DO UPDATE SET 
    accuracy = EXCLUDED.accuracy,
    loss = EXCLUDED.loss;

-- 11. Dataset Lineage
INSERT INTO dataset_lineage (id, source_version_id, target_version_id, model_version_id, transformation_type)
VALUES 
    ('30000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000002', NULL, 'VERSION_DERIVATION'),
    ('30000001-0000-0000-0000-000000000002', 'd0000001-0000-0000-0000-000000000001', NULL, 'f0000001-0000-0000-0000-000000000001', 'MODEL_TRAINING'),
    ('30000001-0000-0000-0000-000000000003', 'd0000001-0000-0000-0000-000000000002', NULL, 'f0000001-0000-0000-0000-000000000002', 'MODEL_TRAINING')
ON CONFLICT (id) DO NOTHING;

-- 12. Dataset Similarity
INSERT INTO dataset_similarity (id, base_version_id, compared_version_id, similarity_score, drift_score, comparison_method, details)
VALUES 
    ('40000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000001', 'd0000001-0000-0000-0000-000000000002', 0.8571, 0.0412, 'JACCARD_SCHEMA_SIMILARITY', '{"common_columns": 6, "total_unique_columns": 7, "added_columns": ["net_promoter_score"], "drift_risk": "LOW"}'::jsonb)
ON CONFLICT (base_version_id, compared_version_id) DO UPDATE SET 
    similarity_score = EXCLUDED.similarity_score,
    drift_score = EXCLUDED.drift_score,
    details = EXCLUDED.details;
