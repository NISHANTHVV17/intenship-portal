import { all, run, tx } from '../db.js';
import { eligibilityIssues, skillOverlap } from './eligibility.js';
import { parseJson } from './serialize.js';

export function notify(userId, { type, title, message, link = null }) {
  run(
    'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
    userId,
    type,
    title,
    message,
    link,
  );
}

export function notifyAdmins(payload) {
  const admins = all(`SELECT id FROM users WHERE role = 'admin' AND is_active = 1`);
  tx(() => admins.forEach((a) => notify(a.id, payload)));
}

/**
 * Called when an internship goes live: alerts eligible students whose skills
 * overlap with the requirements. When either side lists no skills, eligibility alone decides.
 */
export function notifyMatchingStudents(internship) {
  const requiresSkills = parseJson(internship.required_skills).length > 0;
  const students = all(
    `SELECT sp.* FROM student_profiles sp JOIN users u ON u.id = sp.user_id WHERE u.is_active = 1`,
  );
  const matches = students.filter(
    (p) =>
      eligibilityIssues(p, internship).length === 0 &&
      (!requiresSkills || parseJson(p.skills).length === 0 || skillOverlap(p, internship) > 0),
  );
  tx(() =>
    matches.forEach((p) =>
      notify(p.user_id, {
        type: 'new_internship',
        title: 'New internship matches your profile',
        message: `${internship.company} posted "${internship.title}". Apply before ${internship.deadline}.`,
        link: `/internships/${internship.id}`,
      }),
    ),
  );
  return matches.length;
}
