import { Router } from 'express';
import { z } from 'zod';
import { INTERNSHIP_STATUSES } from '../constants.js';
import { all, one, run, tx } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recruiterProfileSchema } from '../schemas.js';
import { likeTerm, paginate, paginationShape } from '../utils/pagination.js';
import { serializeInternship, serializeRecruiterProfile } from '../utils/serialize.js';

const router = Router();
router.use(authenticate, requireRole('recruiter'));

function profileResponse(userId) {
  const user = one('SELECT name, email FROM users WHERE id = ?', userId);
  return { ...user, ...serializeRecruiterProfile(one('SELECT * FROM recruiter_profiles WHERE user_id = ?', userId)) };
}

router.get('/profile', (req, res) => res.json(profileResponse(req.user.id)));

router.put('/profile', validate(recruiterProfileSchema), (req, res) => {
  const b = req.body;
  tx(() => {
    run('UPDATE users SET name = ? WHERE id = ?', b.name, req.user.id);
    run(
      'UPDATE recruiter_profiles SET company_name = ?, website = ?, phone = ?, designation = ?, about = ? WHERE user_id = ?',
      b.companyName,
      b.website,
      b.phone,
      b.designation,
      b.about,
      req.user.id,
    );
  });
  res.json(profileResponse(req.user.id));
});

router.get('/dashboard', (req, res) => {
  const id = req.user.id;
  const byStatus = Object.fromEntries(INTERNSHIP_STATUSES.map((s) => [s, 0]));
  all('SELECT status, COUNT(*) AS n FROM internships WHERE recruiter_id = ? GROUP BY status', id).forEach(
    (r) => (byStatus[r.status] = r.n),
  );
  const applicationsByStatus = Object.fromEntries(
    all(
      `SELECT a.status, COUNT(*) AS n FROM applications a JOIN internships i ON i.id = a.internship_id
       WHERE i.recruiter_id = ? GROUP BY a.status`,
      id,
    ).map((r) => [r.status, r.n]),
  );
  const recentApplicants = all(
    `SELECT a.id, a.status, a.created_at, u.name, sp.department, sp.cgpa, i.id AS internship_id, i.title
     FROM applications a JOIN internships i ON i.id = a.internship_id
     JOIN users u ON u.id = a.student_id LEFT JOIN student_profiles sp ON sp.user_id = a.student_id
     WHERE i.recruiter_id = ? ORDER BY a.created_at DESC LIMIT 8`,
    id,
  ).map((r) => ({
    id: r.id,
    status: r.status,
    appliedAt: r.created_at,
    student: { name: r.name, department: r.department, cgpa: r.cgpa },
    internship: { id: r.internship_id, title: r.title },
  }));
  const totalApplications = Object.entries(applicationsByStatus)
    .filter(([s]) => s !== 'Withdrawn')
    .reduce((sum, [, n]) => sum + n, 0);
  res.json({
    profile: profileResponse(id),
    internshipsByStatus: byStatus,
    applicationsByStatus,
    totalInternships: Object.values(byStatus).reduce((s, n) => s + n, 0),
    totalApplications,
    recentApplicants,
  });
});

const listQuery = z.preprocess(
  (q) => Object.fromEntries(Object.entries(q || {}).filter(([, v]) => v !== '')),
  z.object({ ...paginationShape, status: z.enum(INTERNSHIP_STATUSES).optional(), q: z.string().trim().max(100).optional() }),
);

router.get('/internships', validate(listQuery, 'query'), (req, res) => {
  const { page, limit, status, q } = req.valid.query;
  const where = ['i.recruiter_id = ?'];
  const params = [req.user.id];
  if (status) {
    where.push('i.status = ?');
    params.push(status);
  }
  if (q) {
    where.push(`i.title LIKE ? ESCAPE '\\'`);
    params.push(likeTerm(q));
  }
  const result = paginate({
    select: `i.*,
      (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id AND a.status != 'Withdrawn') AS applicant_count,
      (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id AND a.status = 'Selected') AS selected_count`,
    from: 'internships i',
    where,
    params,
    orderBy: 'i.created_at DESC',
    page,
    limit,
  });
  res.json({ items: result.items.map(serializeInternship), pagination: result.pagination });
});

export default router;
