import path from 'node:path';
import dotenv from 'dotenv';

export const BACKEND_ROOT = path.resolve(import.meta.dirname, '..', '..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });

const MIN_JWT_SECRET_LENGTH = 16;

const readJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      '[Auth] JWT_SECRET is missing or too short in node-backend/.env. Server will not start without it.',
    );
  }
  return secret;
};

/** Settings read from node-backend/.env (and the process environment). */
export const env = Object.freeze({
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: readJwtSecret(),
  jobsDisabled: process.env.DISABLE_JOBS === '1',
  database: Object.freeze({
    dialect: process.env.DB_DIALECT === 'mssql' ? 'mssql' : 'sqlite',
    storage: process.env.DB_STORAGE || path.join(BACKEND_ROOT, 'database.sqlite'),
    host: process.env.DB_HOST,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    encrypt: process.env.DB_ENCRYPT === 'true',
    instanceName: process.env.DB_INSTANCE_NAME || undefined,
  }),
});

export const UPLOADS_DIR = path.join(BACKEND_ROOT, 'uploads');
export const PUBLIC_DIR = path.join(BACKEND_ROOT, 'public');
export const ASSETS_DIR = path.join(BACKEND_ROOT, 'assets');
export const TARIFF_LOOKUP_DIR = path.join(BACKEND_ROOT, '_tariff_load');
export const LOGS_DIR = path.join(BACKEND_ROOT, 'logs');
