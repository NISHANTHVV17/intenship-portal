import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db.js';
import { HttpError, forbidden } from '../utils/http.js';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

function resolveUser(req) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  // Always re-read the user so deactivation/role changes apply immediately.
  const user = one('SELECT id, name, email, role, is_active FROM users WHERE id = ?', payload.sub);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  if (!user.is_active) throw new HttpError(403, 'Your account has been deactivated');
  return user;
}

export function authenticate(req, _res, next) {
  const user = resolveUser(req);
  if (!user) throw new HttpError(401, 'Authentication required');
  req.user = user;
  next();
}

/** Attaches req.user when a valid token is present; never rejects. */
export function optionalAuth(req, _res, next) {
  try {
    req.user = resolveUser(req);
  } catch {
    req.user = null;
  }
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };

/** Recruiters must be approved by the placement cell; admins pass through. */
export function requireApprovedRecruiter(req, _res, next) {
  if (req.user?.role !== 'recruiter') return next();
  const profile = one('SELECT approval_status FROM recruiter_profiles WHERE user_id = ?', req.user.id);
  if (profile?.approval_status !== 'approved') {
    throw forbidden('Your recruiter account is awaiting approval by the placement cell');
  }
  next();
}
