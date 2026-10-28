import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import {
  APPLICATION_STATUSES,
  DEPARTMENTS,
  DOMAINS,
  MODES,
  PIPELINE,
  WITHDRAWABLE_STATUSES,
  YEARS,
} from './constants.js';
import { isModerationEnabled, one, run } from './db.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import adminRoutes from './routes/admin.js';
import applicationRoutes from './routes/applications.js';
import authRoutes from './routes/auth.js';
import internshipRoutes from './routes/internships.js';
import notificationRoutes from './routes/notifications.js';
import recruiterRoutes from './routes/recruiter.js';
import studentRoutes from './routes/students.js';

/** Creates the default placement-cell admin if the database has none. */
export function ensureAdmin() {
  if (one(`SELECT 1 FROM users WHERE role = 'admin'`)) return;
  run(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
    config.admin.name,
    config.admin.email,
    bcrypt.hashSync(config.admin.password, config.isTest ? 4 : 12),
  );
  if (!config.isTest) console.log(`[setup] Created admin account ${config.admin.email}`);
}

export function createApp() {
  ensureAdmin();
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientUrl.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  api.get('/meta', (_req, res) =>
    res.json({
      departments: DEPARTMENTS,
      domains: DOMAINS,
      modes: MODES,
      years: YEARS,
      applicationStatuses: APPLICATION_STATUSES,
      pipeline: PIPELINE,
      withdrawableStatuses: WITHDRAWABLE_STATUSES,
      studentEmailDomain: config.studentEmailDomain,
      moderationEnabled: isModerationEnabled(),
      maxResumeMb: config.maxResumeBytes / (1024 * 1024),
    }),
  );
  api.use('/auth', authRoutes);
  api.use('/students', studentRoutes);
  api.use('/internships', internshipRoutes);
  api.use('/applications', applicationRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/recruiter', recruiterRoutes);
  api.use('/admin', adminRoutes);
  api.use(notFoundHandler);
  app.use('/api', api);

  // In production, serve the built React app from ../client/dist.
  const clientDist = path.resolve(config.root, '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
