import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Variables already set in the environment win over the .env file.
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // No .env file - rely on the environment / defaults.
}

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

if (isProd && !env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

export const config = {
  root,
  isProd,
  isTest,
  port: Number(env.PORT) || 5000,
  clientUrl: env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  dbFile: env.DB_FILE === ':memory:' ? ':memory:' : path.resolve(root, env.DB_FILE || 'data/portal.db'),
  uploadDir: path.resolve(root, env.UPLOAD_DIR || 'uploads'),
  studentEmailDomain: (env.STUDENT_EMAIL_DOMAIN || 'college.edu').toLowerCase(),
  maxResumeBytes: 5 * 1024 * 1024,
  admin: {
    name: env.ADMIN_NAME || 'Placement Cell',
    email: (env.ADMIN_EMAIL || 'admin@college.edu').toLowerCase(),
    password: env.ADMIN_PASSWORD || 'Admin@123',
  },
};

if (!isProd && !isTest && !env.JWT_SECRET) {
  console.warn('[config] JWT_SECRET not set - using an insecure development secret.');
}
