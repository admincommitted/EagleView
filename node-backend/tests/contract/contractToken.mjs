// A login token for the contract runs: the admin user (id 1) read from the database the test backend uses
// (DB_STORAGE, else node-backend/database.sqlite), signed with JWT_SECRET from node-backend/.env the same way
// POST /api/auth/login signs one.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import sqlite3 from 'sqlite3';

const BACKEND_ROOT = path.resolve(import.meta.dirname, '..', '..');
const ENV_FILE = path.join(BACKEND_ROOT, '.env');
const DATABASE_FILE = process.env.DB_STORAGE || path.join(BACKEND_ROOT, 'database.sqlite');
const ADMIN_USER_ID = 1;

const readJwtSecret = () => {
  const line = fs
    .readFileSync(ENV_FILE, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith('JWT_SECRET='));
  if (!line) throw new Error('JWT_SECRET is not in node-backend/.env');
  return line.slice('JWT_SECRET='.length).trim();
};

const readAdminUser = () =>
  new Promise((resolve, reject) => {
    const database = new sqlite3.Database(DATABASE_FILE, sqlite3.OPEN_READONLY);
    database.get('SELECT id, email, username, role FROM Users WHERE id = ?', [ADMIN_USER_ID], (error, row) => {
      database.close();
      if (error || !row) return reject(error || new Error(`User ${ADMIN_USER_ID} not found in ${DATABASE_FILE}`));
      return resolve(row);
    });
  });

export async function loginToken() {
  const { id, email, username, role } = await readAdminUser();
  return jwt.sign({ id, email, username, role, jti: crypto.randomBytes(16).toString('hex') }, readJwtSecret(), {
    expiresIn: '2h',
  });
}
