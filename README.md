# InternHub: University Internship Opportunity Portal

InternHub connects **students**, **recruiters** and the **placement cell (admin)** for internship postings and applications. It replaces the old Flask placement system; that code is still in this folder (`app.py`, `templates/`, and so on), and its instructions are in [README.legacy.md](README.legacy.md).

| Layer | Tech |
|---|---|
| Frontend | React 18, React Router 6, Tailwind CSS 4, Vite (`client/`) |
| Backend | Node.js 22.13+ and Express 5 (`server/`) |
| Database | SQLite via Node's built-in `node:sqlite` (a single file: no DB server, no native build step) |
| Auth | JWT bearer tokens, bcrypt password hashing, role-based access on both client and server |
| Files | Resumes stored on local disk in `server/uploads/resumes`, downloadable only through authorised endpoints |

## Quick start

You need **Node.js 22.13 or newer** (LTS recommended). Download it from <https://nodejs.org> or run `winget install OpenJS.NodeJS.LTS`.

```powershell
# 1. API server (terminal 1)
cd server
copy .env.example .env      # then edit JWT_SECRET and STUDENT_EMAIL_DOMAIN
npm install
npm run seed                # optional: loads demo data (wipes existing data)
npm run dev                 # http://localhost:5000/api

# 2. Web client (terminal 2)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Vite proxies `/api` to port 5000, so the client needs no extra configuration.

### Demo accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin (placement cell) | `admin@college.edu` | `Admin@123` |
| Recruiter (approved) | `priya@technova.com` | `Password@123` |
| Recruiter (pending approval) | `rahul@finedge.com` | `Password@123` |
| Student | `ananya.21cs001@college.edu` | `Password@123` |
| Student | `vikram.22ad003@college.edu` | `Password@123` |

The seed prints every account it creates. If there is no seed data, the server creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on first start. **Change that password before you deploy.**

### Tests

```powershell
cd server
npm test
```

The test suite runs end-to-end API flows against an in-memory database. It covers registration rules, RBAC, recruiter approval, moderation, resume validation, apply/duplicate/deadline rules, the status workflow and history, analytics, CSV export and deactivation.

### Production build

```powershell
cd client; npm run build              # creates client/dist
cd ../server; $env:NODE_ENV="production"; $env:JWT_SECRET="<long random string>"; npm start
```

When `client/dist` exists, the Express server also serves the React app, so the whole portal runs on one port.

## Features

**Students**
- Register with a college email (domain set by `STUDENT_EMAIL_DOMAIN`). Profile includes register number, department, year, CGPA, skills, phone and a PDF resume (max 5 MB).
- Browse and search internships. Filters: keyword, domain, work mode, location, duration, stipend range, deadline, skill, and "only internships I'm eligible for". Results are paginated and the filters live in the URL.
- See eligibility checks on the details page and apply in one click with the saved resume and an optional cover note.
- Cannot apply twice, after the deadline, to a closed posting, without a resume, or when ineligible. Every rule is enforced on the server.
- The dashboard shows stats, recent applications with pipeline progress, recommendations ranked by skill match, and bookmarked deadlines.
- My Applications shows each status with its full timeline (who changed it, when, and remarks). Students can withdraw while an application is *Applied* or *Under Review*.
- Bookmarks, plus notifications in the navbar bell and on a full page. Students are notified when a status changes and when a new matching internship is posted.

**Recruiters**
- Register, then wait for placement-cell approval (the dashboard shows the pending or rejected state).
- Post, edit, close, reopen and delete internships. Each posting has title, company, description, domain, skills, eligibility (minimum CGPA, departments, years), location and mode, duration, stipend, openings and deadline.
- Applicants view per internship: filter by name or register number, status, department, year, minimum CGPA and skill, and sort by recency, CGPA or name. Matching skills are highlighted. Recruiters can download resumes, export CSV, and update status with remarks; the student is notified of each change.

**Admin (placement cell)**
- Approve or reject recruiters with remarks. Activate, deactivate or delete any user, and view their details.
- Moderate postings (approve or reject with remarks), close or delete any posting, and turn moderation on or off globally.
- Analytics: totals, selection rate and offer rate, the application pipeline, a 6-month trend, department-wise participation, applications per internship, and demand by domain.
- CSV reports: internships, applications, students, recruiters, department participation and internship performance.

## Security and non-functional requirements

- **Passwords and tokens:** passwords are hashed with bcrypt (12 rounds), and login timing is the same whether or not the email exists. JWTs are signed with `JWT_SECRET`, which is required in production.
- **Access control:** RBAC is enforced on every API route (`authenticate`, `requireRole`, `requireApprovedRecruiter`). The server re-reads the user on every request, so deactivation takes effect immediately. The client mirrors this with `ProtectedRoute`.
- **Validation:** every body and query is validated with zod, and validation errors come back with per-field details.
- **Uploads:** resumes must be PDFs (extension and MIME type check, then a `%PDF-` signature check after upload) of at most 5 MB. They are stored under random filenames outside any static folder, and only the owning student, that internship's recruiter or an admin can download them.
- **Hardening:** Helmet security headers, CORS restricted to `CLIENT_URL`, rate limiting on register and login, parameterised SQL everywhere, escaped `LIKE` patterns, and CSV formula-injection protection.
- **Layout and performance:** the layout is responsive (mobile nav, stacked filters, scrollable tables, bottom-sheet modals on phones), and listings, applicants, users and notifications are paginated on the server.

## Project structure

```
server/
  src/
    app.js              Express app (routes, middleware, serves client/dist in production)
    index.js            Entry point
    config.js           Env config (.env)
    constants.js        Departments, domains, statuses, pipeline
    db.js               SQLite schema and query helpers
    schemas.js          zod validation schemas
    seed.js             Demo data
    middleware/         auth (JWT + RBAC), validate, upload (multer PDF), error
    routes/             auth, students, internships, applications, notifications, recruiter, admin
    utils/              pagination, csv, eligibility, workflow, history, notify, serialize
  test/api.test.js      End-to-end API tests (node:test)
  API.md                REST API reference
client/
  src/
    App.jsx             Routes
    context/            AuthContext, ToastContext
    lib/                api client, hooks, formatters
    components/         Layout, ProtectedRoute, ui kit, status badges/timeline, InternshipCard, TagInput
    pages/              Landing, Login, Register, Internships, InternshipDetails, Notifications, Account
      student/          StudentDashboard, MyApplications, Profile, Bookmarks
      recruiter/        RecruiterDashboard, InternshipForm, Applicants, RecruiterProfile
      admin/            AdminDashboard, Analytics, ManageUsers, ManageInternships
```

## Data model

`users` (id, name, email, password_hash, role, is_active) → `student_profiles` / `recruiter_profiles` (1:1) → `internships` (posted by a recruiter) → `applications` (unique per student and internship, with a snapshot of the resume submitted) → `status_history` (every transition, with actor and remarks). Also `notifications`, `bookmarks`, and `settings` (the moderation toggle).

See [server/API.md](server/API.md) for the full endpoint reference.

## Configuration (`server/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | API port |
| `JWT_SECRET` | dev fallback | **Required in production** |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `DB_FILE` | `data/portal.db` | SQLite file (`:memory:` for tests) |
| `UPLOAD_DIR` | `uploads` | Resume storage root |
| `STUDENT_EMAIL_DOMAIN` | `college.edu` | Required domain for student emails (subdomains allowed) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Placement Cell / `admin@college.edu` / `Admin@123` | Bootstrap admin, created if no admin exists |

To use cloud storage for resumes, replace `server/src/middleware/upload.js` with an S3 or Azure storage engine. The rest of the code only uses the stored filename through `resumePath()`.
