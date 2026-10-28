/**
 * Wipes the database and loads demo data.  Usage: npm run seed
 * All demo accounts use the password "Password@123" (admin uses ADMIN_PASSWORD).
 */
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db, run, tx } from './db.js';
import { ensureAdmin } from './app.js';
import { resumeDir } from './middleware/upload.js';
import { logStatus } from './utils/history.js';
import { PIPELINE } from './constants.js';

const PASSWORD = 'Password@123';
const hash = bcrypt.hashSync(PASSWORD, 10);
const domain = config.studentEmailDomain;

const daysFromNow = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
};
const isoDaysAgo = (n, hourOffset = 0) => new Date(Date.now() - n * 86400000 + hourOffset * 3600000).toISOString();

function minimalPdf(text) {
  const content = `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((obj, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

console.log('Resetting database...');
db.exec(`
  DELETE FROM notifications; DELETE FROM bookmarks; DELETE FROM status_history; DELETE FROM applications;
  DELETE FROM internships; DELETE FROM student_profiles; DELETE FROM recruiter_profiles; DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);
for (const f of fs.readdirSync(resumeDir)) fs.rmSync(path.join(resumeDir, f), { force: true });

ensureAdmin();
const admin = db.prepare(`SELECT id, name, role FROM users WHERE role = 'admin'`).get();

const recruiters = [
  { name: 'Priya Raman', email: 'priya@technova.com', company: 'TechNova Solutions', designation: 'Talent Lead', website: 'https://technova.example.com', status: 'approved' },
  { name: 'Arjun Mehta', email: 'arjun@greengrid.in', company: 'GreenGrid Energy', designation: 'HR Manager', website: 'https://greengrid.example.com', status: 'approved' },
  { name: 'Sara Thomas', email: 'sara@pixelcraft.io', company: 'PixelCraft Studios', designation: 'Design Director', website: 'https://pixelcraft.example.com', status: 'approved' },
  { name: 'Rahul Verma', email: 'rahul@finedge.com', company: 'FinEdge Analytics', designation: 'Recruiter', website: 'https://finedge.example.com', status: 'pending' },
];

const students = [
  { name: 'Ananya Iyer', reg: '21CS001', dept: 'Computer Science and Engineering', year: 4, cgpa: 9.1, skills: ['React', 'Node.js', 'JavaScript', 'SQL'] },
  { name: 'Karthik Subramanian', reg: '21CS014', dept: 'Computer Science and Engineering', year: 4, cgpa: 8.2, skills: ['Python', 'Machine Learning', 'SQL'] },
  { name: 'Meera Nair', reg: '22IT007', dept: 'Information Technology', year: 3, cgpa: 8.7, skills: ['Java', 'Spring Boot', 'AWS'] },
  { name: 'Vikram Rao', reg: '22AD003', dept: 'Artificial Intelligence and Data Science', year: 3, cgpa: 9.4, skills: ['Python', 'TensorFlow', 'Machine Learning', 'Data Analysis'] },
  { name: 'Divya Krishnan', reg: '21EC011', dept: 'Electronics and Communication Engineering', year: 4, cgpa: 7.9, skills: ['Embedded C', 'IoT', 'MATLAB'] },
  { name: 'Rohan Das', reg: '22ME020', dept: 'Mechanical Engineering', year: 3, cgpa: 7.2, skills: ['AutoCAD', 'SolidWorks'] },
  { name: 'Fatima Sheikh', reg: '23CS045', dept: 'Computer Science and Engineering', year: 2, cgpa: 8.9, skills: ['Figma', 'JavaScript', 'React'] },
  { name: 'Aditya Kumar', reg: '21EE008', dept: 'Electrical and Electronics Engineering', year: 4, cgpa: 6.8, skills: ['MATLAB', 'Power Systems'] },
];

const ids = { recruiters: [], students: [] };

tx(() => {
  for (const r of recruiters) {
    const { id } = run(
      `INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'recruiter', ?)`,
      r.name, r.email, hash, isoDaysAgo(40),
    );
    run(
      `INSERT INTO recruiter_profiles (user_id, company_name, website, designation, approval_status, reviewed_by, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, r.company, r.website, r.designation, r.status,
      r.status === 'approved' ? admin.id : null, r.status === 'approved' ? isoDaysAgo(38) : null,
    );
    ids.recruiters.push({ id, ...r });
  }

  for (const s of students) {
    const email = `${s.name.split(' ')[0].toLowerCase()}.${s.reg.toLowerCase()}@${domain}`;
    const { id } = run(
      `INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'student', ?)`,
      s.name, email, hash, isoDaysAgo(35),
    );
    const file = `${id}-seed-resume.pdf`;
    fs.writeFileSync(path.join(resumeDir, file), minimalPdf(`${s.name} - ${s.reg} - Resume`));
    run(
      `INSERT INTO student_profiles (user_id, register_number, department, year, cgpa, skills, phone, resume_file, resume_name, resume_uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, s.reg, s.dept, s.year, s.cgpa, JSON.stringify(s.skills), '+91 98765 4' + String(id).padStart(4, '0'),
      file, `${s.name.replace(/\s+/g, '_')}_Resume.pdf`, isoDaysAgo(30),
    );
    ids.students.push({ id, email, ...s, file });
  }
});

const [technova, greengrid, pixelcraft] = ids.recruiters;
const internships = [
  { r: technova, title: 'Full Stack Developer Intern', domain: 'Web Development', skills: ['React', 'Node.js', 'SQL'], minCgpa: 7.5, depts: ['Computer Science and Engineering', 'Information Technology'], years: [3, 4], location: 'Bengaluru', mode: 'hybrid', weeks: 24, stipend: 30000, openings: 3, deadline: daysFromNow(20), status: 'open', ago: 12 },
  { r: technova, title: 'Machine Learning Intern', domain: 'Machine Learning / AI', skills: ['Python', 'Machine Learning', 'TensorFlow'], minCgpa: 8, depts: [], years: [3, 4], location: 'Remote', mode: 'remote', weeks: 12, stipend: 25000, openings: 2, deadline: daysFromNow(10), status: 'open', ago: 10 },
  { r: technova, title: 'Cloud Engineering Intern', domain: 'Cloud & DevOps', skills: ['AWS', 'Docker', 'Linux'], minCgpa: 7, depts: [], years: [], location: 'Hyderabad', mode: 'onsite', weeks: 16, stipend: 20000, openings: 2, deadline: daysFromNow(30), status: 'pending', ago: 1 },
  { r: greengrid, title: 'Embedded Systems Intern', domain: 'Embedded Systems', skills: ['Embedded C', 'IoT'], minCgpa: 7, depts: ['Electronics and Communication Engineering', 'Electrical and Electronics Engineering'], years: [3, 4], location: 'Chennai', mode: 'onsite', weeks: 8, stipend: 15000, openings: 4, deadline: daysFromNow(15), status: 'open', ago: 8 },
  { r: greengrid, title: 'Data Analyst Intern', domain: 'Data Science', skills: ['Python', 'SQL', 'Data Analysis'], minCgpa: 7.5, depts: [], years: [], location: 'Remote', mode: 'remote', weeks: 10, stipend: 18000, openings: 2, deadline: daysFromNow(5), status: 'open', ago: 15 },
  { r: greengrid, title: 'Design Engineering Intern', domain: 'Core Engineering', skills: ['AutoCAD', 'SolidWorks'], minCgpa: 6.5, depts: ['Mechanical Engineering', 'Civil Engineering'], years: [], location: 'Coimbatore', mode: 'onsite', weeks: 6, stipend: 10000, openings: 3, deadline: daysFromNow(-3), status: 'closed', ago: 30 },
  { r: pixelcraft, title: 'UI/UX Design Intern', domain: 'UI/UX Design', skills: ['Figma', 'User Research'], minCgpa: 0, depts: [], years: [2, 3, 4], location: 'Kochi', mode: 'hybrid', weeks: 12, stipend: 12000, openings: 2, deadline: daysFromNow(25), status: 'open', ago: 6 },
  { r: pixelcraft, title: 'Frontend Developer Intern', domain: 'Web Development', skills: ['JavaScript', 'React', 'CSS'], minCgpa: 7, depts: [], years: [], location: 'Remote', mode: 'remote', weeks: 8, stipend: 15000, openings: 1, deadline: daysFromNow(2), status: 'open', ago: 20 },
];

const description = (i) =>
  `${i.r.company} is looking for a motivated ${i.title} to join our team for ${i.weeks} weeks.\n\n` +
  `What you will do:\n- Work on real projects alongside experienced engineers\n- Participate in code/design reviews and team rituals\n- Present your work to stakeholders at the end of the internship\n\n` +
  `What we look for:\n- Familiarity with ${i.skills.join(', ')}\n- Curiosity, ownership and good communication\n\n` +
  `Perks: certificate, letter of recommendation and a pre-placement offer opportunity for top performers.`;

const internshipIds = [];
tx(() => {
  for (const i of internships) {
    const created = isoDaysAgo(i.ago);
    const { id } = run(
      `INSERT INTO internships (recruiter_id, title, company, description, domain, required_skills, min_cgpa, eligible_departments,
         eligible_years, location, mode, duration_weeks, stipend, openings, deadline, status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      i.r.id, i.title, i.r.company, description(i), i.domain, JSON.stringify(i.skills), i.minCgpa,
      JSON.stringify(i.depts), JSON.stringify(i.years), i.location, i.mode, i.weeks, i.stipend, i.openings,
      i.deadline, i.status, i.status === 'pending' ? null : created, created, created,
    );
    internshipIds.push(id);
  }
});

// [studentIndex, internshipIndex, finalStatus]
const applications = [
  [0, 0, 'Interview Scheduled'], [2, 0, 'Under Review'], [6, 0, 'Applied'],
  [1, 1, 'Shortlisted'], [3, 1, 'Selected'],
  [4, 3, 'Under Review'], [7, 3, 'Rejected'],
  [1, 4, 'Applied'], [3, 4, 'Interview Scheduled'], [0, 4, 'Withdrawn'],
  [5, 5, 'Selected'],
  [6, 6, 'Shortlisted'], [0, 7, 'Applied'],
];

tx(() => {
  applications.forEach(([si, ii, finalStatus], n) => {
    const s = ids.students[si];
    const internshipId = internshipIds[ii];
    const internship = internships[ii];
    const start = internship.ago - 1;
    const { id } = run(
      `INSERT INTO applications (internship_id, student_id, cover_note, resume_file, resume_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      internshipId, s.id,
      n % 2 === 0 ? `I am excited about this role at ${internship.r.company} and would love to contribute.` : null,
      s.file, `${s.name.replace(/\s+/g, '_')}_Resume.pdf`, finalStatus, isoDaysAgo(start), isoDaysAgo(Math.max(0, start - 3)),
    );
    const student = { id: s.id, name: s.name, role: 'student' };
    const recruiter = { id: internship.r.id, name: internship.r.name, role: 'recruiter' };
    logStatus(id, null, 'Applied', student);
    const steps = finalStatus === 'Withdrawn'
      ? ['Withdrawn']
      : finalStatus === 'Rejected'
        ? ['Under Review', 'Rejected']
        : PIPELINE.slice(1, PIPELINE.indexOf(finalStatus) + 1);
    let prev = 'Applied';
    steps.forEach((to) => {
      logStatus(id, prev, to, to === 'Withdrawn' ? student : recruiter,
        to === 'Interview Scheduled' ? 'Technical interview via Google Meet' : to === 'Rejected' ? 'Profile does not match current needs' : null);
      prev = to;
    });
    // Spread history timestamps out so the timeline looks realistic.
    const rows = db.prepare('SELECT id FROM status_history WHERE application_id = ? ORDER BY id').all(id);
    rows.forEach((r, k) => run('UPDATE status_history SET changed_at = ? WHERE id = ?', isoDaysAgo(start - k, k), r.id));
  });

  run('INSERT INTO bookmarks (user_id, internship_id) VALUES (?, ?)', ids.students[0].id, internshipIds[1]);
  run('INSERT INTO bookmarks (user_id, internship_id) VALUES (?, ?)', ids.students[0].id, internshipIds[6]);
  run(
    `INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'status_changed', ?, ?, ?)`,
    ids.students[0].id, 'Application updated',
    'Your application for "Full Stack Developer Intern" at TechNova Solutions is now "Interview Scheduled".',
    '/student/applications',
  );
  run(
    `INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'recruiter_registered', ?, ?, ?)`,
    admin.id, 'Recruiter awaiting approval', 'Rahul Verma from FinEdge Analytics registered and needs approval.',
    '/admin/users?role=recruiter&approval=pending',
  );
});

console.log('\nSeed complete. Demo logins (password for all non-admin accounts: %s)', PASSWORD);
console.log(`  Admin:     ${config.admin.email} / ${config.admin.password}`);
ids.recruiters.forEach((r) => console.log(`  Recruiter: ${r.email}${r.status === 'pending' ? '  (pending approval)' : ''}`));
ids.students.slice(0, 3).forEach((s) => console.log(`  Student:   ${s.email}`));
console.log(`  ...and ${ids.students.length - 3} more students.`);
