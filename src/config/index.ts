import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/dataforge',
  testDatabaseUrl: process.env.TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/dataforge_test',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '52428800', 10), // 50MB
};

if (!config.databaseUrl) {
  throw new Error('CRITICAL CONFIG ERROR: DATABASE_URL must be defined.');
}

