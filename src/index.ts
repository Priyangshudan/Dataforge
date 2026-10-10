import { createApp } from './app';
import { config } from './config';
import { pool, closePool } from './db';

const app = createApp();

const server = app.listen(config.port, async () => {
  try {
    const res = await pool.query('SELECT current_database() as db, version() as ver');
    console.log(`====================================================`);
    console.log(` DataForge DBMS Backend is live on port ${config.port}`);
    console.log(` Environment: ${config.nodeEnv}`);
    console.log(` Connected DB: ${res.rows[0].db}`);
    console.log(` PostgreSQL:   ${res.rows[0].ver.split(' ')[1]}`);
    console.log(`====================================================`);
  } catch (err: any) {
    console.error('CRITICAL: Failed to connect to PostgreSQL database on startup:', err.message);
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down DataForge backend gracefully...');
  server.close(async () => {
    await closePool();
    console.log('PostgreSQL pool drained. Process exiting cleanly.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

