import fs from 'fs';
import path from 'path';
import { withTransaction, pool } from './index';

export async function runSeeds(): Promise<void> {
  console.log('Seeding database with realistic demonstration data...');
  const seedFile = path.resolve(__dirname, '../../database/seeds/seed_data.sql');
  if (!fs.existsSync(seedFile)) {
    throw new Error(`Seed file not found: ${seedFile}`);
  }

  const sqlContent = fs.readFileSync(seedFile, 'utf-8');

  await withTransaction(async (client) => {
    await client.query(sqlContent);
  });

  // Query verification row counts
  const counts = await pool.query(`
    SELECT 'users' AS entity, COUNT(*) AS count FROM users
    UNION ALL SELECT 'projects', COUNT(*) FROM projects
    UNION ALL SELECT 'datasets', COUNT(*) FROM datasets
    UNION ALL SELECT 'dataset_versions', COUNT(*) FROM dataset_versions
    UNION ALL SELECT 'dataset_columns', COUNT(*) FROM dataset_columns
    UNION ALL SELECT 'models', COUNT(*) FROM models
    UNION ALL SELECT 'model_versions', COUNT(*) FROM model_versions
    UNION ALL SELECT 'experiments', COUNT(*) FROM experiments
    UNION ALL SELECT 'experiment_metrics', COUNT(*) FROM experiment_metrics
    UNION ALL SELECT 'dataset_lineage', COUNT(*) FROM dataset_lineage
    UNION ALL SELECT 'dataset_similarity', COUNT(*) FROM dataset_similarity
    UNION ALL SELECT 'activity_logs', COUNT(*) FROM activity_logs;
  `);

  console.log('Database seeded successfully. Current entity counts:');
  console.table(counts.rows);
}

if (require.main === module) {
  runSeeds()
    .then(() => {
      console.log('Seed runner finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

