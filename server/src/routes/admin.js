import { Router } from 'express';
import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  APPROVAL_STATUSES,
  DEPARTMENTS,
  INTERNSHIP_STATUSES,
  ROLES,
} from '../constants.js';
import { all, isModerationEnabled, nowIso, one, run, setSetting, tx } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { removeResumeFile } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../schemas.js';
import { sendCsv } from '../utils/csv.js';
import { badRequest, notFound } from '../utils/http.js';
import { notify } from '../utils/notify.js';
import { likeTerm, paginate, paginationShape } from '../utils/pagination.js';
import {
  parseJson,
  serializeInternship,
  serializeRecruiterProfile,
  serializeStudentProfile,
  serializeUser,
} from '../utils/serialize.js';
import { publishInternship } from './internships.js';

const router = Router();
router.use(authenticate, requireRole('admin'));
const byId = validate(idParam, 'params');
const dropEmpty = (q) => Object.fromEntries(Object.entries(q || {}).filter(([, v]) => v !== ''));

// ---------- Users ----------

const usersQuery = z.preprocess(
  dropEmpty,
  z.object({
    ...paginationShape,
    role: z.enum(ROLES).optional(),
    approval: z.enum(APPROVAL_STATUSES).optional(),
    active: z.enum(['true', 'false']).optional(),
    department: z.enum(DEPARTMENTS).optional(),
    q: z.string().trim().max(100).optional(),
  }),
);

const USER_SELECT = `u.*, sp.register_number, sp.department, sp.year, sp.cgpa, sp.resume_file,
  rp.company_name, rp.approval_status, rp.approval_remarks, rp.website, rp.designation,
  (SELECT COUNT(*) FROM applications a WHERE a.student_id = u.id) AS application_count,
  (SELECT COUNT(*) FROM internships i WHERE i.recruiter_id = u.id) AS internship_count`;
const USER_FROM = `users u LEFT JOIN student_profiles sp ON sp.user_id = u.id LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id`;

function serializeAdminUser(r) {
  const base = serializeUser(r);
  if (r.role === 'student') {
    base.student = {
      registerNumber: r.register_number,
      department: r.department,
      year: r.year,
      cgpa: r.cgpa,
      hasResume: Boolean(r.resume_file),
      applicationCount: r.application_count,
    };
  }
  if (r.role === 'recruiter') {
    base.recruiter = {
      companyName: r.company_name,
      website: r.website,
      designation: r.designation,
      approvalStatus: r.approval_status,
      approvalRemarks: r.approval_remarks,
      internshipCount: r.internship_count,
    };
  }
  return base;
}

router.get('/users', validate(usersQuery, 'query'), (req, res) => {
  const f = req.valid.query;
  const where = [];
  const params = [];
  const add = (clause, ...values) => {
    where.push(clause);
    params.push(...values);
  };
  if (f.role) add('u.role = ?', f.role);
  if (f.approval) add('rp.approval_status = ?', f.approval);
  if (f.active) add('u.is_active = ?', f.active === 'true' ? 1 : 0);
  if (f.department) add('sp.department = ?', f.department);
  if (f.q) {
    const cols = ['u.name', 'u.email', 'sp.register_number', 'rp.company_name'];
    add(`(${cols.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`, ...cols.map(() => likeTerm(f.q)));
  }
  const result = paginate({
    select: USER_SELECT,
    from: USER_FROM,
    where,
    params,
    orderBy: `CASE WHEN rp.approval_status = 'pending' THEN 0 ELSE 1 END, u.created_at DESC`,
    page: f.page,
    limit: f.limit,
  });
  const counts = Object.fromEntries(all('SELECT role, COUNT(*) AS n FROM users GROUP BY role').map((r) => [r.role, r.n]));
  counts.pendingRecruiters = one(`SELECT COUNT(*) AS n FROM recruiter_profiles WHERE approval_status = 'pending'`).n;
  res.json({ items: result.items.map(serializeAdminUser), pagination: result.pagination, counts });
});

router.get('/users/:id', byId, (req, res) => {
  const row = one(`SELECT ${USER_SELECT} FROM ${USER_FROM} WHERE u.id = ?`, req.valid.params.id);
  if (!row) throw notFound('User not found');
  const out = serializeAdminUser(row);
  if (row.role === 'student') {
    out.profile = serializeStudentProfile(one('SELECT * FROM student_profiles WHERE user_id = ?', row.id));
    out.applications = all(
      `SELECT a.id, a.status, a.created_at, i.title, i.company FROM applications a
       JOIN internships i ON i.id = a.internship_id WHERE a.student_id = ? ORDER BY a.created_at DESC`,
      row.id,
    ).map((a) => ({ id: a.id, status: a.status, appliedAt: a.created_at, title: a.title, company: a.company }));
  }
  if (row.role === 'recruiter') {
    out.profile = serializeRecruiterProfile(one('SELECT * FROM recruiter_profiles WHERE user_id = ?', row.id));
    out.internships = all('SELECT * FROM internships WHERE recruiter_id = ? ORDER BY created_at DESC', row.id).map(
      serializeInternship,
    );
  }
  res.json(out);
});

router.patch('/users/:id/active', byId, validate(z.object({ isActive: z.boolean() })), (req, res) => {
  const id = req.valid.params.id;
  if (id === req.user.id) throw badRequest('You cannot deactivate your own account');
  const { changes } = run('UPDATE users SET is_active = ? WHERE id = ?', req.body.isActive, id);
  if (!changes) throw notFound('User not found');
  res.json(serializeAdminUser(one(`SELECT ${USER_SELECT} FROM ${USER_FROM} WHERE u.id = ?`, id)));
});

router.delete('/users/:id', byId, (req, res) => {
  const id = req.valid.params.id;
  if (id === req.user.id) throw badRequest('You cannot delete your own account');
  const user = one('SELECT role FROM users WHERE id = ?', id);
  if (!user) throw notFound('User not found');
  const files =
    user.role === 'student'
      ? [
          one('SELECT resume_file FROM student_profiles WHERE user_id = ?', id)?.resume_file,
          ...all('SELECT resume_file FROM applications WHERE student_id = ?', id).map((r) => r.resume_file),
        ]
      : [];
  run('DELETE FROM users WHERE id = ?', id);
  new Set(files.filter(Boolean)).forEach(removeResumeFile);
  res.status(204).end();
});

const approvalSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  remarks: z.string().trim().max(500).optional(),
});

router.patch('/recruiters/:id/approval', byId, validate(approvalSchema), (req, res) => {
  const id = req.valid.params.id;
  const profile = one('SELECT * FROM recruiter_profiles WHERE user_id = ?', id);
  if (!profile) throw notFound('Recruiter not found');
  const { status, remarks } = req.body;
  tx(() => {
    run(
      'UPDATE recruiter_profiles SET approval_status = ?, approval_remarks = ?, reviewed_by = ?, reviewed_at = ? WHERE user_id = ?',
      status,
      remarks ?? null,
      req.user.id,
      nowIso(),
      id,
    );
    notify(id, {
      type: 'account_review',
      title: status === 'approved' ? 'Recruiter account approved' : 'Recruiter account not approved',
      message:
        status === 'approved'
          ? 'Your account was approved by the placement cell. You can now post internships.'
          : `Your account was not approved.${remarks ? ` Reason: ${remarks}` : ''}`,
      link: '/recruiter',
    });
  });
  res.json(serializeAdminUser(one(`SELECT ${USER_SELECT} FROM ${USER_FROM} WHERE u.id = ?`, id)));
});

// ---------- Internship moderation ----------

const internshipsQuery = z.preprocess(
  dropEmpty,
  z.object({ ...paginationShape, status: z.enum(INTERNSHIP_STATUSES).optional(), q: z.string().trim().max(100).optional() }),
);

router.get('/internships', validate(internshipsQuery, 'query'), (req, res) => {
  const { page, limit, status, q } = req.valid.query;
  const where = [];
  const params = [];
  if (status) {
    where.push('i.status = ?');
    params.push(status);
  }
  if (q) {
    where.push(`(i.title LIKE ? ESCAPE '\\' OR i.company LIKE ? ESCAPE '\\')`);
    params.push(likeTerm(q), likeTerm(q));
  }
  const result = paginate({
    select: `i.*, u.name AS recruiter_name,
      (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id AND a.status != 'Withdrawn') AS applicant_count,
      (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id AND a.status = 'Selected') AS selected_count`,
    from: 'internships i JOIN users u ON u.id = i.recruiter_id',
    where,
    params,
    orderBy: `CASE WHEN i.status = 'pending' THEN 0 ELSE 1 END, i.created_at DESC`,
    page,
    limit,
  });
  const counts = Object.fromEntries(INTERNSHIP_STATUSES.map((s) => [s, 0]));
  all('SELECT status, COUNT(*) AS n FROM internships GROUP BY status').forEach((r) => (counts[r.status] = r.n));
  res.json({ items: result.items.map(serializeInternship), pagination: result.pagination, counts });
});

const moderationSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  remarks: z.string().trim().max(500).optional(),
});

router.patch('/internships/:id/moderation', byId, validate(moderationSchema), (req, res) => {
  const internship = one('SELECT * FROM internships WHERE id = ?', req.valid.params.id);
  if (!internship) throw notFound('Internship not found');
  if (!['pending', 'rejected'].includes(internship.status)) {
    throw badRequest('Only pending or rejected postings can be moderated');
  }
  const { decision, remarks } = req.body;
  run('UPDATE internships SET moderation_remarks = ?, updated_at = ? WHERE id = ?', remarks ?? null, nowIso(), internship.id);
  if (decision === 'approve') {
    publishInternship(internship.id);
  } else {
    run(`UPDATE internships SET status = 'rejected' WHERE id = ?`, internship.id);
  }
  notify(internship.recruiter_id, {
    type: 'internship_review',
    title: decision === 'approve' ? 'Internship approved and live' : 'Internship not approved',
    message:
      decision === 'approve'
        ? `"${internship.title}" is now visible to students.`
        : `"${internship.title}" was not approved.${remarks ? ` Reason: ${remarks}` : ''} Edit and resubmit it.`,
    link: `/recruiter/internships/${internship.id}/edit`,
  });
  res.json(serializeInternship(one('SELECT * FROM internships WHERE id = ?', internship.id)));
});

// ---------- Settings ----------

router.get('/settings', (_req, res) => res.json({ moderationEnabled: isModerationEnabled() }));

router.put('/settings', validate(z.object({ moderationEnabled: z.boolean() })), (req, res) => {
  setSetting('moderation_enabled', req.body.moderationEnabled);
  res.json({ moderationEnabled: isModerationEnabled() });
});

// ---------- Analytics ----------

function departmentStats() {
  const rows = all(`
    SELECT sp.department,
      COUNT(DISTINCT sp.user_id) AS students,
      COUNT(DISTINCT CASE WHEN a.status != 'Withdrawn' THEN a.student_id END) AS participants,
      COUNT(CASE WHEN a.status != 'Withdrawn' THEN a.id END) AS applications,
      COUNT(CASE WHEN a.status = 'Selected' THEN a.id END) AS selected
    FROM student_profiles sp LEFT JOIN applications a ON a.student_id = sp.user_id
    GROUP BY sp.department`);
  const byDept = Object.fromEntries(rows.map((r) => [r.department, r]));
  return DEPARTMENTS.map((department) => {
    const r = byDept[department] || { students: 0, participants: 0, applications: 0, selected: 0 };
    return {
      department,
      students: r.students,
      participants: r.participants,
      applications: r.applications,
      selected: r.selected,
      participationRate: r.students ? +((r.participants / r.students) * 100).toFixed(1) : 0,
    };
  });
}

function perInternshipStats(limit) {
  return all(
    `SELECT i.id, i.title, i.company, i.status, i.openings, i.deadline,
       COUNT(CASE WHEN a.status != 'Withdrawn' THEN 1 END) AS applications,
       COUNT(CASE WHEN a.status IN ('Shortlisted','Interview Scheduled','Selected') THEN 1 END) AS shortlisted,
       COUNT(CASE WHEN a.status = 'Selected' THEN 1 END) AS selected
     FROM internships i LEFT JOIN applications a ON a.internship_id = i.id
     WHERE i.status IN ('open', 'closed')
     GROUP BY i.id ORDER BY applications DESC, i.id DESC ${limit ? 'LIMIT ?' : ''}`,
    ...(limit ? [limit] : []),
  ).map((r) => ({ ...r, selectionRate: r.applications ? +((r.selected / r.applications) * 100).toFixed(1) : 0 }));
}

router.get('/analytics', (_req, res) => {
  const statusBreakdown = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
  all('SELECT status, COUNT(*) AS n FROM applications GROUP BY status').forEach((r) => (statusBreakdown[r.status] = r.n));
  const internshipsByStatus = Object.fromEntries(INTERNSHIP_STATUSES.map((s) => [s, 0]));
  all('SELECT status, COUNT(*) AS n FROM internships GROUP BY status').forEach((r) => (internshipsByStatus[r.status] = r.n));

  const activeApplications = Object.entries(statusBreakdown)
    .filter(([s]) => s !== 'Withdrawn')
    .reduce((sum, [, n]) => sum + n, 0);
  const decided = statusBreakdown.Selected + statusBreakdown.Rejected;

  const monthly = all(
    `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS applications,
       COUNT(CASE WHEN status = 'Selected' THEN 1 END) AS selected
     FROM applications WHERE created_at >= ? GROUP BY month ORDER BY month`,
    new Date(Date.now() - 180 * 86400000).toISOString(),
  );

  const domains = all(
    `SELECT i.domain, COUNT(DISTINCT i.id) AS internships, COUNT(CASE WHEN a.status != 'Withdrawn' THEN a.id END) AS applications
     FROM internships i LEFT JOIN applications a ON a.internship_id = i.id
     WHERE i.status IN ('open', 'closed') GROUP BY i.domain ORDER BY applications DESC`,
  );

  res.json({
    totals: {
      students: one(`SELECT COUNT(*) AS n FROM users WHERE role = 'student'`).n,
      recruiters: one(`SELECT COUNT(*) AS n FROM recruiter_profiles WHERE approval_status = 'approved'`).n,
      pendingRecruiters: one(`SELECT COUNT(*) AS n FROM recruiter_profiles WHERE approval_status = 'pending'`).n,
      internships: Object.values(internshipsByStatus).reduce((s, n) => s + n, 0),
      liveInternships: internshipsByStatus.open,
      pendingInternships: internshipsByStatus.pending,
      totalOpenings: one(`SELECT COALESCE(SUM(openings), 0) AS n FROM internships WHERE status IN ('open','closed')`).n,
      applications: activeApplications,
      selected: statusBreakdown.Selected,
      // Share of non-withdrawn applications that ended in selection.
      selectionRate: activeApplications ? +((statusBreakdown.Selected / activeApplications) * 100).toFixed(1) : 0,
      // Share of decided (selected or rejected) applications that were selections.
      offerRate: decided ? +((statusBreakdown.Selected / decided) * 100).toFixed(1) : 0,
    },
    statusBreakdown,
    internshipsByStatus,
    perInternship: perInternshipStats(15),
    departments: departmentStats(),
    domains,
    monthly,
  });
});

// ---------- CSV reports ----------

const reports = {
  internships: () => ({
    columns: [
      { label: 'ID', key: 'id' },
      { label: 'Title', key: 'title' },
      { label: 'Company', key: 'company' },
      { label: 'Domain', key: 'domain' },
      { label: 'Mode', key: 'mode' },
      { label: 'Location', key: 'location' },
      { label: 'Duration (weeks)', key: 'duration_weeks' },
      { label: 'Stipend / month', key: 'stipend' },
      { label: 'Openings', key: 'openings' },
      { label: 'Deadline', key: 'deadline' },
      { label: 'Status', key: 'status' },
      { label: 'Min CGPA', key: 'min_cgpa' },
      { label: 'Required Skills', value: (r) => parseJson(r.required_skills) },
      { label: 'Applications', key: 'applications' },
      { label: 'Shortlisted+', key: 'shortlisted' },
      { label: 'Selected', key: 'selected' },
      { label: 'Recruiter', key: 'recruiter_name' },
      { label: 'Created At', key: 'created_at' },
    ],
    rows: all(`
      SELECT i.*, u.name AS recruiter_name,
        COUNT(CASE WHEN a.status != 'Withdrawn' THEN 1 END) AS applications,
        COUNT(CASE WHEN a.status IN ('Shortlisted','Interview Scheduled','Selected') THEN 1 END) AS shortlisted,
        COUNT(CASE WHEN a.status = 'Selected' THEN 1 END) AS selected
      FROM internships i JOIN users u ON u.id = i.recruiter_id LEFT JOIN applications a ON a.internship_id = i.id
      GROUP BY i.id ORDER BY i.created_at DESC`),
  }),
  applications: () => ({
    columns: [
      { label: 'Application ID', key: 'id' },
      { label: 'Student', key: 'student_name' },
      { label: 'Email', key: 'email' },
      { label: 'Register Number', key: 'register_number' },
      { label: 'Department', key: 'department' },
      { label: 'Year', key: 'year' },
      { label: 'CGPA', key: 'cgpa' },
      { label: 'Internship', key: 'title' },
      { label: 'Company', key: 'company' },
      { label: 'Status', key: 'status' },
      { label: 'Remarks', key: 'remarks' },
      { label: 'Applied At', key: 'created_at' },
      { label: 'Last Updated', key: 'updated_at' },
    ],
    rows: all(`
      SELECT a.*, u.name AS student_name, u.email, sp.register_number, sp.department, sp.year, sp.cgpa, i.title, i.company
      FROM applications a JOIN users u ON u.id = a.student_id
      LEFT JOIN student_profiles sp ON sp.user_id = a.student_id
      JOIN internships i ON i.id = a.internship_id ORDER BY a.created_at DESC`),
  }),
  students: () => ({
    columns: [
      { label: 'ID', key: 'id' },
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Register Number', key: 'register_number' },
      { label: 'Department', key: 'department' },
      { label: 'Year', key: 'year' },
      { label: 'CGPA', key: 'cgpa' },
      { label: 'Skills', value: (r) => parseJson(r.skills) },
      { label: 'Resume Uploaded', value: (r) => (r.resume_file ? 'Yes' : 'No') },
      { label: 'Applications', key: 'applications' },
      { label: 'Selected', key: 'selected' },
      { label: 'Active', value: (r) => (r.is_active ? 'Yes' : 'No') },
      { label: 'Registered At', key: 'created_at' },
    ],
    rows: all(`
      SELECT u.*, sp.*,
        (SELECT COUNT(*) FROM applications a WHERE a.student_id = u.id AND a.status != 'Withdrawn') AS applications,
        (SELECT COUNT(*) FROM applications a WHERE a.student_id = u.id AND a.status = 'Selected') AS selected
      FROM users u JOIN student_profiles sp ON sp.user_id = u.id ORDER BY sp.department, u.name`),
  }),
  recruiters: () => ({
    columns: [
      { label: 'ID', key: 'id' },
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Company', key: 'company_name' },
      { label: 'Designation', key: 'designation' },
      { label: 'Website', key: 'website' },
      { label: 'Phone', key: 'phone' },
      { label: 'Approval', key: 'approval_status' },
      { label: 'Internships Posted', key: 'internships' },
      { label: 'Active', value: (r) => (r.is_active ? 'Yes' : 'No') },
      { label: 'Registered At', key: 'created_at' },
    ],
    rows: all(`
      SELECT u.*, rp.*, (SELECT COUNT(*) FROM internships i WHERE i.recruiter_id = u.id) AS internships
      FROM users u JOIN recruiter_profiles rp ON rp.user_id = u.id ORDER BY u.created_at DESC`),
  }),
  departments: () => ({
    columns: [
      { label: 'Department', key: 'department' },
      { label: 'Students', key: 'students' },
      { label: 'Students Applied', key: 'participants' },
      { label: 'Participation %', key: 'participationRate' },
      { label: 'Applications', key: 'applications' },
      { label: 'Selected', key: 'selected' },
    ],
    rows: departmentStats(),
  }),
  'internship-performance': () => ({
    columns: [
      { label: 'ID', key: 'id' },
      { label: 'Title', key: 'title' },
      { label: 'Company', key: 'company' },
      { label: 'Status', key: 'status' },
      { label: 'Openings', key: 'openings' },
      { label: 'Applications', key: 'applications' },
      { label: 'Shortlisted+', key: 'shortlisted' },
      { label: 'Selected', key: 'selected' },
      { label: 'Selection %', key: 'selectionRate' },
    ],
    rows: perInternshipStats(),
  }),
};

router.get('/reports/:type', (req, res) => {
  const report = Object.hasOwn(reports, req.params.type) && reports[req.params.type];
  if (!report) throw notFound(`Unknown report. Available: ${Object.keys(reports).join(', ')}`);
  const { columns, rows } = report();
  sendCsv(res, req.params.type, columns, rows);
});

export default router;
