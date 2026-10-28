import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { one, run, tx } from '../db.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  changePasswordSchema,
  loginSchema,
  registerRecruiterSchema,
  registerStudentSchema,
} from '../schemas.js';
import { HttpError, conflict } from '../utils/http.js';
import { notifyAdmins } from '../utils/notify.js';
import {
  serializeRecruiterProfile,
  serializeStudentProfile,
  serializeUser,
} from '../utils/serialize.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Too many attempts, please try again in a few minutes' },
});

const BCRYPT_ROUNDS = config.isTest ? 4 : 12;
// Compared against when the email is unknown so response timing does not reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export function loadUser(id) {
  return one(
    `SELECT u.*, rp.approval_status FROM users u
     LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id WHERE u.id = ?`,
    id,
  );
}

function authResponse(userId) {
  const user = loadUser(userId);
  return { token: signToken(user), user: serializeUser(user) };
}

function assertEmailFree(email) {
  if (one('SELECT 1 FROM users WHERE email = ?', email)) {
    throw conflict('An account with this email already exists');
  }
}

router.post('/register/student', authLimiter, validate(registerStudentSchema), (req, res) => {
  const b = req.body;
  const hash = bcrypt.hashSync(b.password, BCRYPT_ROUNDS);
  const userId = tx(() => {
    assertEmailFree(b.email);
    if (one('SELECT 1 FROM student_profiles WHERE register_number = ?', b.registerNumber)) {
      throw conflict('This register number is already registered');
    }
    const { id } = run(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'student')`,
      b.name,
      b.email,
      hash,
    );
    run(
      `INSERT INTO student_profiles (user_id, register_number, department, year, cgpa) VALUES (?, ?, ?, ?, ?)`,
      id,
      b.registerNumber,
      b.department,
      b.year,
      b.cgpa,
    );
    return id;
  });
  res.status(201).json(authResponse(userId));
});

router.post('/register/recruiter', authLimiter, validate(registerRecruiterSchema), (req, res) => {
  const b = req.body;
  const hash = bcrypt.hashSync(b.password, BCRYPT_ROUNDS);
  const userId = tx(() => {
    assertEmailFree(b.email);
    const { id } = run(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'recruiter')`,
      b.name,
      b.email,
      hash,
    );
    run(
      `INSERT INTO recruiter_profiles (user_id, company_name, website, phone, designation) VALUES (?, ?, ?, ?, ?)`,
      id,
      b.companyName,
      b.website,
      b.phone,
      b.designation,
    );
    return id;
  });
  notifyAdmins({
    type: 'recruiter_registered',
    title: 'Recruiter awaiting approval',
    message: `${b.name} from ${b.companyName} registered and needs approval.`,
    link: '/admin/users?role=recruiter&approval=pending',
  });
  res.status(201).json(authResponse(userId));
});

router.post('/login', authLimiter, validate(loginSchema), (req, res) => {
  const user = one('SELECT * FROM users WHERE email = ?', req.body.email);
  const ok = bcrypt.compareSync(req.body.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Invalid email or password');
  if (!user.is_active) throw new HttpError(403, 'Your account has been deactivated. Contact the placement cell.');
  res.json(authResponse(user.id));
});

router.get('/me', authenticate, (req, res) => {
  const user = loadUser(req.user.id);
  let profile = null;
  if (user.role === 'student') {
    profile = serializeStudentProfile(one('SELECT * FROM student_profiles WHERE user_id = ?', user.id));
  } else if (user.role === 'recruiter') {
    profile = serializeRecruiterProfile(one('SELECT * FROM recruiter_profiles WHERE user_id = ?', user.id));
  }
  res.json({ user: serializeUser(user), profile });
});

router.put('/password', authenticate, validate(changePasswordSchema), (req, res) => {
  const user = one('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!bcrypt.compareSync(req.body.currentPassword, user.password_hash)) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(req.body.newPassword, BCRYPT_ROUNDS), req.user.id);
  res.json({ message: 'Password updated' });
});

export default router;
