import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 8;
const STATUSES = ['active', 'inactive', 'locked'];
// 'director' approves / rejects / holds purchase orders; 'operator' is the old default role
const ROLES = ['admin', 'director', 'user', 'operator'];
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const hasRole = (role) => role !== undefined && role !== null && role !== '';

/** The first problem with the user fields, in the order the User Management screen expects them. */
function userProblem(user, isNew) {
  if (hasRole(user.role) && !ROLES.includes(String(user.role).toLowerCase()))
    return 'Role must be admin, director or user';
  if (user.password !== undefined && user.password !== '' && String(user.password).length < MIN_PASSWORD_LENGTH) {
    return 'Password must be at least 8 characters';
  }
  if (isNew && !user.password) return 'Password is required for a new user';
  if (user.status !== undefined && !STATUSES.includes(user.status)) return 'Status must be active, inactive or locked';
  if (user.email && !EMAIL_PATTERN.test(user.email)) return 'Email is not valid';
  return null;
}

/** The role is stored in lower case; an empty password box means "keep the password". */
function normalizeUser(user) {
  if (hasRole(user.role)) user.role = String(user.role).toLowerCase();
  if (user.password === '') delete user.password;
  return user;
}

const userSchema = (isNew) =>
  z
    .any()
    .superRefine((user, ctx) => {
      const problem = userProblem(user, isNew);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    })
    .transform(normalizeUser);

export const createUserSchema = userSchema(true);
export const updateUserSchema = userSchema(false);
