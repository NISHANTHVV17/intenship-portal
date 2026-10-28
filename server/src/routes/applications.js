import { Router } from 'express';
import { z } from 'zod';
import { APPLICATION_STATUSES, WITHDRAWABLE_STATUSES } from '../constants.js';
import { nowIso, one, run, tx } from '../db.js';
import { authenticate, requireApprovedRecruiter, requireRole } from '../middleware/auth.js';
import { resumePath } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParam, statusUpdateSchema } from '../schemas.js';
import { historyFor, logStatus } from '../utils/history.js';
import { badRequest, forbidden, notFound } from '../utils/http.js';
import { notify } from '../utils/notify.js';
import { paginate, paginationShape } from '../utils/pagination.js';
import { parseJson } from '../utils/serialize.js';
import { allowedNextStatuses, canTransition } from '../utils/workflow.js';

const router = Router();
router.use(authenticate);
const byId = validate(idParam, 'params');

const DETAIL_SQL = `
  SELECT a.*, i.title, i.company, i.recruiter_id, i.deadline, i.location, i.mode, i.status AS internship_status,
         u.name AS student_name, u.email AS student_email,
         sp.register_number, sp.department, sp.year, sp.cgpa, sp.skills, sp.phone
  FROM applications a
  JOIN internships i ON i.id = a.internship_id
  JOIN users u ON u.id = a.student_id
  LEFT JOIN student_profiles sp ON sp.user_id = a.student_id
  WHERE a.id = ?`;

/** Loads an application the current user may see: its student, the posting's recruiter, or an admin. */
function loadAccessible(req) {
  const app = one(DETAIL_SQL, req.valid.params.id);
  if (!app) throw notFound('Application not found');
  const { role, id } = req.user;
  const allowed =
    role === 'admin' ||
    (role === 'student' && app.student_id === id) ||
    (role === 'recruiter' && app.recruiter_id === id);
  if (!allowed) throw notFound('Application not found');
  return app;
}

function serializeDetail(a, viewerRole) {
  return {
    id: a.id,
    status: a.status,
    remarks: a.remarks,
    coverNote: a.cover_note,
    hasResume: Boolean(a.resume_file),
    resumeName: a.resume_name,
    appliedAt: a.created_at,
    updatedAt: a.updated_at,
    canWithdraw: viewerRole === 'student' && WITHDRAWABLE_STATUSES.includes(a.status),
    nextStatuses: viewerRole === 'student' ? [] : allowedNextStatuses(a.status),
    internship: {
      id: a.internship_id,
      title: a.title,
      company: a.company,
      deadline: a.deadline,
      location: a.location,
      mode: a.mode,
      status: a.internship_status,
    },
    student: {
      id: a.student_id,
      name: a.student_name,
      email: a.student_email,
      registerNumber: a.register_number,
      department: a.department,
      year: a.year,
      cgpa: a.cgpa,
      skills: parseJson(a.skills),
      phone: a.phone,
    },
    history: historyFor([a.id])[a.id],
  };
}

const myQuery = z.preprocess(
  (q) => Object.fromEntries(Object.entries(q || {}).filter(([, v]) => v !== '')),
  z.object({ ...paginationShape, status: z.enum(APPLICATION_STATUSES).optional() }),
);

router.get('/me', requireRole('student'), validate(myQuery, 'query'), (req, res) => {
  const { page, limit, status } = req.valid.query;
  const where = ['a.student_id = ?'];
  const params = [req.user.id];
  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }
  const result = paginate({
    select: `a.id, a.status, a.remarks, a.cover_note, a.created_at, a.updated_at,
             i.id AS internship_id, i.title, i.company, i.location, i.mode, i.deadline, i.stipend, i.status AS internship_status`,
    from: 'applications a JOIN internships i ON i.id = a.internship_id',
    where,
    params,
    orderBy: 'a.updated_at DESC',
    page,
    limit,
  });
  const history = historyFor(result.items.map((r) => r.id));
  res.json({
    items: result.items.map((r) => ({
      id: r.id,
      status: r.status,
      remarks: r.remarks,
      coverNote: r.cover_note,
      appliedAt: r.created_at,
      updatedAt: r.updated_at,
      canWithdraw: WITHDRAWABLE_STATUSES.includes(r.status),
      internship: {
        id: r.internship_id,
        title: r.title,
        company: r.company,
        location: r.location,
        mode: r.mode,
        deadline: r.deadline,
        stipend: r.stipend,
        status: r.internship_status,
      },
      history: history[r.id],
    })),
    pagination: result.pagination,
  });
});

router.get('/:id', byId, (req, res) => {
  res.json(serializeDetail(loadAccessible(req), req.user.role));
});

router.post('/:id/withdraw', requireRole('student'), byId, (req, res) => {
  const app = loadAccessible(req);
  if (!WITHDRAWABLE_STATUSES.includes(app.status)) {
    throw badRequest(`Applications can only be withdrawn while ${WITHDRAWABLE_STATUSES.join(' or ')}`);
  }
  tx(() => {
    run(`UPDATE applications SET status = 'Withdrawn', updated_at = ? WHERE id = ?`, nowIso(), app.id);
    logStatus(app.id, app.status, 'Withdrawn', req.user, 'Withdrawn by student');
    notify(app.recruiter_id, {
      type: 'application_withdrawn',
      title: 'Application withdrawn',
      message: `${app.student_name} withdrew their application for "${app.title}".`,
      link: `/recruiter/internships/${app.internship_id}/applicants`,
    });
  });
  res.json(serializeDetail(one(DETAIL_SQL, app.id), 'student'));
});

router.patch(
  '/:id/status',
  requireRole('recruiter', 'admin'),
  requireApprovedRecruiter,
  byId,
  validate(statusUpdateSchema),
  (req, res) => {
    const app = loadAccessible(req);
    const { status, remarks } = req.body;
    if (!canTransition(app.status, status)) {
      const next = allowedNextStatuses(app.status);
      throw badRequest(
        next.length
          ? `Cannot move from "${app.status}" to "${status}". Allowed: ${next.join(', ')}`
          : `"${app.status}" is a final status and cannot be changed`,
      );
    }
    tx(() => {
      run(
        'UPDATE applications SET status = ?, remarks = COALESCE(?, remarks), updated_at = ? WHERE id = ?',
        status,
        remarks,
        nowIso(),
        app.id,
      );
      logStatus(app.id, app.status, status, req.user, remarks);
      notify(app.student_id, {
        type: 'status_changed',
        title: `Application ${status === 'Selected' ? 'selected 🎉' : 'updated'}`,
        message: `Your application for "${app.title}" at ${app.company} is now "${status}".${remarks ? ` Note: ${remarks}` : ''}`,
        link: `/student/applications?highlight=${app.id}`,
      });
    });
    res.json(serializeDetail(one(DETAIL_SQL, app.id), req.user.role));
  },
);

router.get('/:id/resume', byId, (req, res) => {
  const app = loadAccessible(req);
  if (req.user.role === 'recruiter' && app.recruiter_id !== req.user.id) throw forbidden();
  const file = resumePath(app.resume_file);
  if (!file) throw notFound('Resume file not found');
  const safeName = `${(app.student_name || 'student').replace(/[^\w.-]+/g, '_')}_${app.register_number || app.student_id}_resume.pdf`;
  res.download(file, safeName);
});

export default router;
