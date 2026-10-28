import { Router } from 'express';
import { all, isModerationEnabled, nowIso, one, run, tx } from '../db.js';
import { APPLICATION_STATUSES } from '../constants.js';
import {
  authenticate,
  optionalAuth,
  requireApprovedRecruiter,
  requireRole,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  applicantQuerySchema,
  applySchema,
  idParam,
  internshipQuerySchema,
  internshipSchema,
} from '../schemas.js';
import { sendCsv } from '../utils/csv.js';
import { today } from '../utils/dates.js';
import { eligibilityIssues } from '../utils/eligibility.js';
import { logStatus } from '../utils/history.js';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../utils/http.js';
import { notify, notifyAdmins, notifyMatchingStudents } from '../utils/notify.js';
import { likeTerm, paginate } from '../utils/pagination.js';
import { parseJson, serializeInternship } from '../utils/serialize.js';

const router = Router();
const byId = validate(idParam, 'params');

const getInternship = (id) => one('SELECT * FROM internships WHERE id = ?', id);

function loadManageable(req) {
  const internship = getInternship(req.valid.params.id);
  if (!internship) throw notFound('Internship not found');
  if (req.user.role !== 'admin' && internship.recruiter_id !== req.user.id) throw forbidden();
  return internship;
}

const acceptingApplications = (i) => i.status === 'open' && i.deadline >= today();

/** Puts a posting live (status open), notifying matching students the first time. */
function publish(id) {
  const before = getInternship(id);
  run(
    `UPDATE internships SET status = 'open', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?`,
    nowIso(),
    nowIso(),
    id,
  );
  if (!before.published_at) notifyMatchingStudents(getInternship(id));
}
export { publish as publishInternship };

// ---------- Public listing ----------

router.get('/', optionalAuth, validate(internshipQuerySchema, 'query'), (req, res) => {
  const f = req.valid.query;
  const where = [`i.status = 'open'`, 'i.deadline >= ?'];
  const params = [today()];
  const add = (clause, ...values) => {
    where.push(clause);
    params.push(...values);
  };

  if (f.q) {
    where.push(`(i.title LIKE ? ESCAPE '\\' OR i.company LIKE ? ESCAPE '\\' OR i.description LIKE ? ESCAPE '\\' OR i.required_skills LIKE ? ESCAPE '\\')`);
    params.push(...Array(4).fill(likeTerm(f.q)));
  }
  if (f.domain) add('i.domain = ?', f.domain);
  if (f.mode) add('i.mode = ?', f.mode);
  if (f.location) add(`i.location LIKE ? ESCAPE '\\'`, likeTerm(f.location));
  if (f.skill) add(`EXISTS (SELECT 1 FROM json_each(i.required_skills) WHERE lower(value) = lower(?))`, f.skill);
  if (f.minDuration !== undefined) add('i.duration_weeks >= ?', f.minDuration);
  if (f.maxDuration !== undefined) add('i.duration_weeks <= ?', f.maxDuration);
  if (f.minStipend !== undefined) add('i.stipend >= ?', f.minStipend);
  if (f.maxStipend !== undefined) add('i.stipend <= ?', f.maxStipend);
  if (f.deadlineBefore) add('i.deadline <= ?', f.deadlineBefore);
  if (f.deadlineAfter) add('i.deadline >= ?', f.deadlineAfter);

  const student = req.user?.role === 'student' ? req.user : null;
  if (student && f.eligibleOnly === 'true') {
    const p = one('SELECT * FROM student_profiles WHERE user_id = ?', student.id);
    where.push(
      'i.min_cgpa <= ?',
      `(i.eligible_departments = '[]' OR EXISTS (SELECT 1 FROM json_each(i.eligible_departments) WHERE value = ?))`,
      `(i.eligible_years = '[]' OR EXISTS (SELECT 1 FROM json_each(i.eligible_years) WHERE value = ?))`,
    );
    params.push(p?.cgpa ?? 0, p?.department ?? '', p?.year ?? 0);
  }

  const orderBy = {
    newest: 'i.published_at DESC, i.id DESC',
    deadline: 'i.deadline ASC, i.id DESC',
    stipend: 'i.stipend DESC, i.id DESC',
    duration: 'i.duration_weeks ASC, i.id DESC',
  }[f.sort];

  const result = paginate({
    select: `i.*, (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id AND a.status != 'Withdrawn') AS applicant_count
      ${student ? `, EXISTS(SELECT 1 FROM bookmarks b WHERE b.internship_id = i.id AND b.user_id = ?) AS bookmarked,
          (SELECT status FROM applications a2 WHERE a2.internship_id = i.id AND a2.student_id = ?) AS my_status` : ''}`,
    selectParams: student ? [student.id, student.id] : [],
    from: 'internships i',
    where,
    params,
    orderBy,
    page: f.page,
    limit: f.limit,
  });
  res.json({ items: result.items.map(serializeInternship), pagination: result.pagination });
});

router.get('/:id', optionalAuth, byId, (req, res) => {
  const row = one(
    `SELECT i.*, u.name AS recruiter_name,
       (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id AND a.status != 'Withdrawn') AS applicant_count,
       (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id AND a.status = 'Selected') AS selected_count
     FROM internships i JOIN users u ON u.id = i.recruiter_id WHERE i.id = ?`,
    req.valid.params.id,
  );
  const user = req.user;
  const isManager = user && (user.role === 'admin' || row?.recruiter_id === user.id);
  // Unpublished or rejected postings are only visible to their owner and admins.
  if (!row || (!isManager && !['open', 'closed'].includes(row.status))) throw notFound('Internship not found');

  const internship = { ...serializeInternship(row), acceptingApplications: acceptingApplications(row) };

  if (user?.role === 'student') {
    const profile = one('SELECT * FROM student_profiles WHERE user_id = ?', user.id);
    const application = one(
      'SELECT id, status, created_at FROM applications WHERE internship_id = ? AND student_id = ?',
      row.id,
      user.id,
    );
    const issues = eligibilityIssues(profile, row);
    internship.viewer = {
      eligible: issues.length === 0,
      eligibilityIssues: issues,
      hasResume: Boolean(profile?.resume_file),
      bookmarked: Boolean(one('SELECT 1 FROM bookmarks WHERE user_id = ? AND internship_id = ?', user.id, row.id)),
      application: application
        ? { id: application.id, status: application.status, appliedAt: application.created_at }
        : null,
    };
  }
  if (isManager) {
    internship.statusCounts = Object.fromEntries(
      all('SELECT status, COUNT(*) AS n FROM applications WHERE internship_id = ? GROUP BY status', row.id).map(
        (r) => [r.status, r.n],
      ),
    );
  }
  res.json(internship);
});

// ---------- Recruiter management ----------

const internshipColumns = (b) => [
  b.title,
  b.company,
  b.description,
  b.domain,
  JSON.stringify(b.requiredSkills),
  b.minCgpa,
  JSON.stringify(b.eligibleDepartments),
  JSON.stringify(b.eligibleYears),
  b.location,
  b.mode,
  b.durationWeeks,
  b.stipend,
  b.openings,
  b.deadline,
];

router.post(
  '/',
  authenticate,
  requireRole('recruiter'),
  requireApprovedRecruiter,
  validate(internshipSchema),
  (req, res) => {
    const moderated = isModerationEnabled();
    const { id } = run(
      `INSERT INTO internships (recruiter_id, title, company, description, domain, required_skills, min_cgpa,
         eligible_departments, eligible_years, location, mode, duration_weeks, stipend, openings, deadline, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      req.user.id,
      ...internshipColumns(req.body),
    );
    if (moderated) {
      notifyAdmins({
        type: 'internship_pending',
        title: 'Internship awaiting approval',
        message: `"${req.body.title}" by ${req.body.company} needs review.`,
        link: '/admin/internships?status=pending',
      });
    } else {
      publish(id);
    }
    res.status(201).json(serializeInternship(getInternship(id)));
  },
);

router.put(
  '/:id',
  authenticate,
  requireRole('recruiter'),
  requireApprovedRecruiter,
  byId,
  validate(internshipSchema),
  (req, res) => {
    const current = loadManageable(req);
    const moderated = isModerationEnabled();
    // With moderation on, any edit to a non-closed posting sends it back for review.
    const nextStatus = current.status === 'closed' ? 'closed' : moderated ? 'pending' : 'open';
    run(
      `UPDATE internships SET title = ?, company = ?, description = ?, domain = ?, required_skills = ?, min_cgpa = ?,
         eligible_departments = ?, eligible_years = ?, location = ?, mode = ?, duration_weeks = ?, stipend = ?,
         openings = ?, deadline = ?, status = ?, updated_at = ? WHERE id = ?`,
      ...internshipColumns(req.body),
      nextStatus === 'open' ? current.status : nextStatus,
      nowIso(),
      current.id,
    );
    if (nextStatus === 'open') publish(current.id);
    if (nextStatus === 'pending' && current.status !== 'pending') {
      notifyAdmins({
        type: 'internship_pending',
        title: 'Edited internship awaiting approval',
        message: `"${req.body.title}" was edited and needs review.`,
        link: '/admin/internships?status=pending',
      });
    }
    res.json(serializeInternship(getInternship(current.id)));
  },
);

router.post('/:id/close', authenticate, requireRole('recruiter', 'admin'), requireApprovedRecruiter, byId, (req, res) => {
  const current = loadManageable(req);
  if (current.status === 'closed') throw badRequest('Internship is already closed');
  run(`UPDATE internships SET status = 'closed', updated_at = ? WHERE id = ?`, nowIso(), current.id);
  res.json(serializeInternship(getInternship(current.id)));
});

router.post('/:id/reopen', authenticate, requireRole('recruiter'), requireApprovedRecruiter, byId, (req, res) => {
  const current = loadManageable(req);
  if (current.status !== 'closed') throw badRequest('Only closed internships can be reopened');
  if (current.deadline < today()) throw badRequest('Extend the deadline (edit the posting) before reopening');
  if (isModerationEnabled() && !current.published_at) {
    run(`UPDATE internships SET status = 'pending', updated_at = ? WHERE id = ?`, nowIso(), current.id);
  } else {
    publish(current.id);
  }
  res.json(serializeInternship(getInternship(current.id)));
});

router.delete('/:id', authenticate, requireRole('recruiter', 'admin'), requireApprovedRecruiter, byId, (req, res) => {
  const current = loadManageable(req);
  const applications = one('SELECT COUNT(*) AS n FROM applications WHERE internship_id = ?', current.id).n;
  if (applications > 0 && req.user.role !== 'admin') {
    throw conflict('This internship has applications - close it instead of deleting');
  }
  run('DELETE FROM internships WHERE id = ?', current.id);
  res.status(204).end();
});

// ---------- Student actions ----------

router.post('/:id/apply', authenticate, requireRole('student'), byId, validate(applySchema), (req, res) => {
  const internship = getInternship(req.valid.params.id);
  if (!internship || !['open', 'closed'].includes(internship.status)) throw notFound('Internship not found');
  if (internship.status !== 'open') throw badRequest('This internship is no longer accepting applications');
  if (internship.deadline < today()) throw badRequest('The application deadline has passed');

  const profile = one('SELECT * FROM student_profiles WHERE user_id = ?', req.user.id);
  if (!profile?.resume_file) throw badRequest('Upload your resume in your profile before applying');
  const issues = eligibilityIssues(profile, internship);
  if (issues.length) throw new HttpError(403, 'You are not eligible for this internship', issues.map((message) => ({ message })));

  const applicationId = tx(() => {
    if (one('SELECT 1 FROM applications WHERE internship_id = ? AND student_id = ?', internship.id, req.user.id)) {
      throw conflict('You have already applied to this internship');
    }
    const { id } = run(
      `INSERT INTO applications (internship_id, student_id, cover_note, resume_file, resume_name) VALUES (?, ?, ?, ?, ?)`,
      internship.id,
      req.user.id,
      req.body.coverNote,
      profile.resume_file,
      profile.resume_name,
    );
    logStatus(id, null, 'Applied', req.user);
    notify(internship.recruiter_id, {
      type: 'new_applicant',
      title: 'New applicant',
      message: `${req.user.name} applied for "${internship.title}".`,
      link: `/recruiter/internships/${internship.id}/applicants`,
    });
    return id;
  });
  res.status(201).json({ id: applicationId, status: 'Applied', message: 'Application submitted' });
});

router.post('/:id/bookmark', authenticate, requireRole('student'), byId, (req, res) => {
  const internship = getInternship(req.valid.params.id);
  if (!internship || !['open', 'closed'].includes(internship.status)) throw notFound('Internship not found');
  run('INSERT OR IGNORE INTO bookmarks (user_id, internship_id) VALUES (?, ?)', req.user.id, internship.id);
  res.status(201).json({ bookmarked: true });
});

router.delete('/:id/bookmark', authenticate, requireRole('student'), byId, (req, res) => {
  run('DELETE FROM bookmarks WHERE user_id = ? AND internship_id = ?', req.user.id, req.valid.params.id);
  res.json({ bookmarked: false });
});

// ---------- Applicants (recruiter owner / admin) ----------

function applicantFilters(internshipId, f) {
  const where = ['a.internship_id = ?'];
  const params = [internshipId];
  const add = (clause, ...values) => {
    where.push(clause);
    params.push(...values);
  };
  if (f.status) add('a.status = ?', f.status);
  if (f.department) add('sp.department = ?', f.department);
  if (f.year) add('sp.year = ?', f.year);
  if (f.minCgpa !== undefined) add('sp.cgpa >= ?', f.minCgpa);
  if (f.skill) {
    where.push(`EXISTS (SELECT 1 FROM json_each(sp.skills) WHERE lower(value) LIKE lower(?) ESCAPE '\\')`);
    params.push(likeTerm(f.skill));
  }
  if (f.q) {
    where.push(`(u.name LIKE ? ESCAPE '\\' OR sp.register_number LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')`);
    params.push(...Array(3).fill(likeTerm(f.q)));
  }
  const orderBy = { recent: 'a.created_at DESC', cgpa: 'sp.cgpa DESC, a.created_at ASC', name: 'u.name ASC' }[f.sort];
  return { where, params, orderBy };
}

const APPLICANT_SELECT = `a.*, u.name, u.email, sp.register_number, sp.department, sp.year, sp.cgpa, sp.skills, sp.phone`;
const APPLICANT_FROM = 'applications a JOIN users u ON u.id = a.student_id JOIN student_profiles sp ON sp.user_id = a.student_id';

const serializeApplicant = (r) => ({
  id: r.id,
  status: r.status,
  remarks: r.remarks,
  coverNote: r.cover_note,
  hasResume: Boolean(r.resume_file),
  appliedAt: r.created_at,
  updatedAt: r.updated_at,
  student: {
    id: r.student_id,
    name: r.name,
    email: r.email,
    registerNumber: r.register_number,
    department: r.department,
    year: r.year,
    cgpa: r.cgpa,
    skills: parseJson(r.skills),
    phone: r.phone,
  },
});

router.get(
  '/:id/applicants',
  authenticate,
  requireRole('recruiter', 'admin'),
  requireApprovedRecruiter,
  byId,
  validate(applicantQuerySchema, 'query'),
  (req, res) => {
    const internship = loadManageable(req);
    const f = req.valid.query;
    const { where, params, orderBy } = applicantFilters(internship.id, f);
    const result = paginate({ select: APPLICANT_SELECT, from: APPLICANT_FROM, where, params, orderBy, page: f.page, limit: f.limit });
    const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0]));
    all('SELECT status, COUNT(*) AS n FROM applications WHERE internship_id = ? GROUP BY status', internship.id).forEach(
      (r) => (counts[r.status] = r.n),
    );
    res.json({
      internship: serializeInternship(internship),
      statusCounts: counts,
      items: result.items.map(serializeApplicant),
      pagination: result.pagination,
    });
  },
);

router.get(
  '/:id/applicants/export',
  authenticate,
  requireRole('recruiter', 'admin'),
  requireApprovedRecruiter,
  byId,
  validate(applicantQuerySchema, 'query'),
  (req, res) => {
    const internship = loadManageable(req);
    const { where, params, orderBy } = applicantFilters(internship.id, req.valid.query);
    const rows = all(`SELECT ${APPLICANT_SELECT} FROM ${APPLICANT_FROM} WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`, ...params);
    sendCsv(res, `applicants-${internship.id}`, [
      { label: 'Application ID', key: 'id' },
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Register Number', key: 'register_number' },
      { label: 'Department', key: 'department' },
      { label: 'Year', key: 'year' },
      { label: 'CGPA', key: 'cgpa' },
      { label: 'Skills', value: (r) => parseJson(r.skills) },
      { label: 'Phone', key: 'phone' },
      { label: 'Status', key: 'status' },
      { label: 'Remarks', key: 'remarks' },
      { label: 'Applied At', key: 'created_at' },
    ], rows);
  },
);

export default router;
