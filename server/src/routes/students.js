import { Router } from 'express';
import { z } from 'zod';
import { all, nowIso, one, run, tx } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { removeResumeFile, resumePath, uploadResume } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { studentProfileSchema } from '../schemas.js';
import { today } from '../utils/dates.js';
import { eligibilityIssues, skillOverlap } from '../utils/eligibility.js';
import { conflict, notFound } from '../utils/http.js';
import { paginate, paginationShape } from '../utils/pagination.js';
import { parseJson, serializeInternship, serializeStudentProfile } from '../utils/serialize.js';

const router = Router();
router.use(authenticate, requireRole('student'));

const getProfile = (userId) => one('SELECT * FROM student_profiles WHERE user_id = ?', userId);

function profileResponse(userId) {
  const user = one('SELECT name, email FROM users WHERE id = ?', userId);
  return { ...user, ...serializeStudentProfile(getProfile(userId)) };
}

router.get('/me/profile', (req, res) => res.json(profileResponse(req.user.id)));

router.put('/me/profile', validate(studentProfileSchema), (req, res) => {
  const b = req.body;
  tx(() => {
    const clash = one(
      'SELECT 1 FROM student_profiles WHERE register_number = ? AND user_id != ?',
      b.registerNumber,
      req.user.id,
    );
    if (clash) throw conflict('This register number belongs to another student');
    run('UPDATE users SET name = ? WHERE id = ?', b.name, req.user.id);
    run(
      `UPDATE student_profiles
       SET register_number = ?, department = ?, year = ?, cgpa = ?, skills = ?, phone = ?, updated_at = ?
       WHERE user_id = ?`,
      b.registerNumber,
      b.department,
      b.year,
      b.cgpa ?? null,
      JSON.stringify(b.skills),
      b.phone,
      nowIso(),
      req.user.id,
    );
  });
  res.json(profileResponse(req.user.id));
});

router.post('/me/resume', uploadResume, (req, res) => {
  const previous = getProfile(req.user.id)?.resume_file;
  run(
    'UPDATE student_profiles SET resume_file = ?, resume_name = ?, resume_uploaded_at = ?, updated_at = ? WHERE user_id = ?',
    req.file.filename,
    req.file.originalname.slice(0, 200),
    nowIso(),
    nowIso(),
    req.user.id,
  );
  // Applications keep a reference to the resume submitted with them; only drop unreferenced files.
  if (previous && !one('SELECT 1 FROM applications WHERE resume_file = ?', previous)) {
    removeResumeFile(previous);
  }
  res.status(201).json(profileResponse(req.user.id));
});

router.get('/me/resume', (req, res) => {
  const profile = getProfile(req.user.id);
  const file = resumePath(profile?.resume_file);
  if (!file) throw notFound('No resume uploaded yet');
  res.download(file, profile.resume_name || 'resume.pdf');
});

router.get('/me/dashboard', (req, res) => {
  const userId = req.user.id;
  const profile = getProfile(userId);

  const statusCounts = Object.fromEntries(
    all('SELECT status, COUNT(*) AS n FROM applications WHERE student_id = ? GROUP BY status', userId).map(
      (r) => [r.status, r.n],
    ),
  );

  const recentApplications = all(
    `SELECT a.id, a.status, a.created_at, a.updated_at, i.id AS internship_id, i.title, i.company
     FROM applications a JOIN internships i ON i.id = a.internship_id
     WHERE a.student_id = ? ORDER BY a.updated_at DESC LIMIT 5`,
    userId,
  ).map((r) => ({
    id: r.id,
    status: r.status,
    appliedAt: r.created_at,
    updatedAt: r.updated_at,
    internship: { id: r.internship_id, title: r.title, company: r.company },
  }));

  // Recommendations: open, eligible, not yet applied, ranked by skill overlap then deadline.
  const candidates = all(
    `SELECT i.*, EXISTS(SELECT 1 FROM bookmarks b WHERE b.internship_id = i.id AND b.user_id = ?) AS bookmarked
     FROM internships i
     WHERE i.status = 'open' AND i.deadline >= ?
       AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.internship_id = i.id AND a.student_id = ?)`,
    userId,
    today(),
    userId,
  );
  const recommended = candidates
    .filter((i) => eligibilityIssues(profile, i).length === 0)
    .map((i) => ({ row: i, score: skillOverlap(profile, i) }))
    .sort((a, b) => b.score - a.score || a.row.deadline.localeCompare(b.row.deadline))
    .slice(0, 6)
    .map(({ row, score }) => ({ ...serializeInternship(row), matchedSkills: score }));

  const upcomingDeadlines = all(
    `SELECT i.* FROM bookmarks b JOIN internships i ON i.id = b.internship_id
     WHERE b.user_id = ? AND i.status = 'open' AND i.deadline >= ?
       AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.internship_id = i.id AND a.student_id = ?)
     ORDER BY i.deadline ASC LIMIT 5`,
    userId,
    today(),
    userId,
  ).map(serializeInternship);

  const total = Object.values(statusCounts).reduce((s, n) => s + n, 0);
  res.json({
    profileComplete: Boolean(profile?.resume_file && profile?.cgpa != null && parseJson(profile?.skills).length),
    hasResume: Boolean(profile?.resume_file),
    stats: {
      totalApplications: total,
      active: total - (statusCounts.Selected || 0) - (statusCounts.Rejected || 0) - (statusCounts.Withdrawn || 0),
      shortlisted: (statusCounts.Shortlisted || 0) + (statusCounts['Interview Scheduled'] || 0),
      selected: statusCounts.Selected || 0,
      bookmarks: one('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?', userId).n,
      unreadNotifications: one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', userId).n,
    },
    statusCounts,
    recentApplications,
    recommended,
    upcomingDeadlines,
  });
});

router.get('/me/bookmarks', validate(z.object(paginationShape), 'query'), (req, res) => {
  const { page, limit } = req.valid.query;
  const result = paginate({
    select: `i.*, 1 AS bookmarked, b.created_at AS bookmarked_at,
             (SELECT status FROM applications a WHERE a.internship_id = i.id AND a.student_id = ?) AS my_status`,
    selectParams: [req.user.id],
    from: 'bookmarks b JOIN internships i ON i.id = b.internship_id',
    where: ['b.user_id = ?', `i.status IN ('open', 'closed')`],
    params: [req.user.id],
    orderBy: 'b.created_at DESC',
    page,
    limit,
  });
  res.json({
    items: result.items.map((r) => ({
      ...serializeInternship(r),
      bookmarkedAt: r.bookmarked_at,
      acceptingApplications: r.status === 'open' && r.deadline >= today(),
    })),
    pagination: result.pagination,
  });
});

export default router;
