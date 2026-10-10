import fs from 'fs';
import path from 'path';
import { pool, withTransaction } from './index';

export async function runMigrations(): Promise<void> {
  console.log('Running database migrations...');
  
  // Ensure schema_migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.resolve(__dirname, '../../database/migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const existing = await pool.query(
      'SELECT id FROM schema_migrations WHERE migration_name = $1',
      [file]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`- Skipping migration (already applied): ${file}`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    console.log(`+ Applying migration: ${file}`);
    await withTransaction(async (client) => {
      await client.query(sqlContent);
      await client.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
        [file]
      );
    });
    console.log(`✓ Migration applied successfully: ${file}`);
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('All migrations completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

