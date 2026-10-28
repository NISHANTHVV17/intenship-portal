import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-test-'));
Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_FILE: ':memory:',
  UPLOAD_DIR: uploadDir,
  STUDENT_EMAIL_DOMAIN: 'college.edu',
  ADMIN_EMAIL: 'admin@college.edu',
  ADMIN_PASSWORD: 'Admin@123',
  JWT_SECRET: 'test-secret',
});

const { createApp } = await import('../src/app.js');

let server;
let base;

async function api(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${url}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

const pdfForm = (content = '%PDF-1.4\n% test resume\n%%EOF', name = 'resume.pdf', type = 'application/pdf') => {
  const form = new FormData();
  form.append('resume', new Blob([content], { type }), name);
  return form;
};

const deadline = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const internshipBody = {
  title: 'Backend Intern',
  company: 'Acme Corp',
  description: 'Build REST APIs with Node.js and SQL for internal tools.',
  domain: 'Software Development',
  requiredSkills: ['Node.js', 'SQL'],
  minCgpa: 7,
  eligibleDepartments: ['Computer Science and Engineering'],
  eligibleYears: [3, 4],
  location: 'Chennai',
  mode: 'hybrid',
  durationWeeks: 12,
  stipend: 20000,
  openings: 2,
  deadline,
};

before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  server.close();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

describe('internship portal API', () => {
  const t = {};

  it('rejects student registration with a non-college email', async () => {
    const r = await api('POST', '/auth/register/student', {
      body: { name: 'Eve', email: 'eve@gmail.com', password: 'Passw0rd!', registerNumber: '21CS999', department: 'Computer Science and Engineering', year: 3 },
    });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /college email/);
  });

  it('registers a student and a recruiter', async () => {
    const s = await api('POST', '/auth/register/student', {
      body: { name: 'Asha', email: 'asha@college.edu', password: 'Passw0rd1', registerNumber: '21CS100', department: 'Computer Science and Engineering', year: 3, cgpa: 8.5 },
    });
    assert.equal(s.status, 201);
    t.student = s.data.token;

    const dup = await api('POST', '/auth/register/student', {
      body: { name: 'Asha 2', email: 'asha@college.edu', password: 'Passw0rd1', registerNumber: '21CS101', department: 'Computer Science and Engineering', year: 3 },
    });
    assert.equal(dup.status, 409);

    const rc = await api('POST', '/auth/register/recruiter', {
      body: { name: 'Ravi', email: 'ravi@acme.com', password: 'Passw0rd1', companyName: 'Acme Corp' },
    });
    assert.equal(rc.status, 201);
    assert.equal(rc.data.user.approvalStatus, 'pending');
    t.recruiter = rc.data.token;
    t.recruiterId = rc.data.user.id;

    const admin = await api('POST', '/auth/login', { body: { email: 'admin@college.edu', password: 'Admin@123' } });
    assert.equal(admin.status, 200);
    t.admin = admin.data.token;
  });

  it('enforces role-based access', async () => {
    assert.equal((await api('GET', '/admin/analytics', { token: t.student })).status, 403);
    assert.equal((await api('GET', '/students/me/profile')).status, 401);
  });

  it('blocks unapproved recruiters from posting', async () => {
    const r = await api('POST', '/internships', { token: t.recruiter, body: internshipBody });
    assert.equal(r.status, 403);
  });

  it('lets admin approve the recruiter and moderates postings', async () => {
    const ok = await api('PATCH', `/admin/recruiters/${t.recruiterId}/approval`, { token: t.admin, body: { status: 'approved' } });
    assert.equal(ok.status, 200);

    const created = await api('POST', '/internships', { token: t.recruiter, body: internshipBody });
    assert.equal(created.status, 201);
    assert.equal(created.data.status, 'pending');
    t.internshipId = created.data.id;

    const list = await api('GET', '/internships');
    assert.equal(list.data.pagination.total, 0, 'pending postings are hidden');

    const approved = await api('PATCH', `/admin/internships/${t.internshipId}/moderation`, { token: t.admin, body: { decision: 'approve' } });
    assert.equal(approved.data.status, 'open');

    const filtered = await api('GET', '/internships?mode=hybrid&minStipend=15000&skill=sql');
    assert.equal(filtered.data.pagination.total, 1);
    const none = await api('GET', '/internships?mode=remote');
    assert.equal(none.data.pagination.total, 0);
  });

  it('notifies matching students when a posting goes live', async () => {
    const r = await api('GET', '/notifications', { token: t.student });
    assert.ok(r.data.items.some((n) => n.type === 'new_internship'));
  });

  it('validates resume uploads', async () => {
    const notPdf = await api('POST', '/students/me/resume', { token: t.student, form: pdfForm('hello', 'resume.txt', 'text/plain') });
    assert.equal(notPdf.status, 400);
    const fakePdf = await api('POST', '/students/me/resume', { token: t.student, form: pdfForm('not really a pdf') });
    assert.equal(fakePdf.status, 400);
    const big = await api('POST', '/students/me/resume', { token: t.student, form: pdfForm(`%PDF-${'x'.repeat(5 * 1024 * 1024 + 10)}`) });
    assert.equal(big.status, 400);
    assert.match(big.data.error, /5 MB/);
  });

  it('requires a resume, then applies once', async () => {
    const noResume = await api('POST', `/internships/${t.internshipId}/apply`, { token: t.student, body: {} });
    assert.equal(noResume.status, 400);

    const up = await api('POST', '/students/me/resume', { token: t.student, form: pdfForm() });
    assert.equal(up.status, 201);
    assert.ok(up.data.resume);

    const applied = await api('POST', `/internships/${t.internshipId}/apply`, { token: t.student, body: { coverNote: 'Keen to learn!' } });
    assert.equal(applied.status, 201);
    t.applicationId = applied.data.id;

    const again = await api('POST', `/internships/${t.internshipId}/apply`, { token: t.student, body: {} });
    assert.equal(again.status, 409);
  });

  it('lets the recruiter filter applicants and download the resume', async () => {
    const r = await api('GET', `/internships/${t.internshipId}/applicants?minCgpa=8&skill=`, { token: t.recruiter });
    assert.equal(r.status, 200);
    assert.equal(r.data.items.length, 1);
    const high = await api('GET', `/internships/${t.internshipId}/applicants?minCgpa=9`, { token: t.recruiter });
    assert.equal(high.data.items.length, 0);

    const resume = await api('GET', `/applications/${t.applicationId}/resume`, { token: t.recruiter });
    assert.equal(resume.status, 200);
    assert.match(resume.headers.get('content-disposition'), /attachment/);
  });

  it('follows the status workflow and logs history', async () => {
    const bad = await api('PATCH', `/applications/${t.applicationId}/status`, { token: t.recruiter, body: { status: 'Applied' } });
    assert.equal(bad.status, 400);

    const review = await api('PATCH', `/applications/${t.applicationId}/status`, { token: t.recruiter, body: { status: 'Under Review' } });
    assert.equal(review.data.status, 'Under Review');
    const shortlisted = await api('PATCH', `/applications/${t.applicationId}/status`, {
      token: t.recruiter,
      body: { status: 'Shortlisted', remarks: 'Strong profile' },
    });
    assert.equal(shortlisted.data.status, 'Shortlisted');

    const back = await api('PATCH', `/applications/${t.applicationId}/status`, { token: t.recruiter, body: { status: 'Under Review' } });
    assert.equal(back.status, 400, 'cannot move backwards');

    const withdraw = await api('POST', `/applications/${t.applicationId}/withdraw`, { token: t.student });
    assert.equal(withdraw.status, 400, 'cannot withdraw after shortlisting');

    const mine = await api('GET', '/applications/me', { token: t.student });
    const history = mine.data.items[0].history;
    assert.deepEqual(history.map((h) => h.toStatus), ['Applied', 'Under Review', 'Shortlisted']);
    assert.equal(history[2].actor.role, 'recruiter');
    assert.equal(history[2].remarks, 'Strong profile');
  });

  it('produces analytics and CSV reports for admin', async () => {
    const a = await api('GET', '/admin/analytics', { token: t.admin });
    assert.equal(a.status, 200);
    assert.equal(a.data.totals.applications, 1);
    const cse = a.data.departments.find((d) => d.department === 'Computer Science and Engineering');
    assert.equal(cse.participants, 1);

    const csv = await api('GET', '/admin/reports/applications', { token: t.admin });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.data, /Asha/);

    assert.equal((await api('GET', '/admin/reports/constructor', { token: t.admin })).status, 404);
  });

  it('blocks deactivated users', async () => {
    const users = await api('GET', '/admin/users?role=student', { token: t.admin });
    const id = users.data.items[0].id;
    await api('PATCH', `/admin/users/${id}/active`, { token: t.admin, body: { isActive: false } });
    assert.equal((await api('GET', '/auth/me', { token: t.student })).status, 403);
  });
});
