# InternHub REST API

Base URL: `http://localhost:5000/api`. All request and response bodies are JSON unless noted.

## Conventions

- **Auth:** send `Authorization: Bearer <token>`. You get a token from `/auth/login` or `/auth/register/*`. Tokens expire after 7 days by default (`JWT_EXPIRES_IN`).
- **Roles:** `student`, `recruiter`, `admin`. A role-restricted endpoint returns `403` for other roles.
- **Recruiter approval:** recruiter write actions (posting, editing, closing, viewing applicants, changing status) return `403` until the placement cell approves the account.
- **Errors:** `{ "error": "message", "details": [{ "field": "email", "message": "..." }] }`. Status codes used: `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict (duplicate), `429` rate limited, `500` server error.
- **Pagination:** list endpoints take `?page=1&limit=10` (`limit` max 100) and return:
  ```json
  { "items": [...], "pagination": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
  ```
- **Dates:** timestamps are ISO-8601 UTC strings. Deadlines are `YYYY-MM-DD`; applications are accepted through the end of the deadline day.

## Application status workflow

```
Applied → Under Review → Shortlisted → Interview Scheduled → Selected
   └──────────┴──────────────┴──────────────┴──────────→ Rejected
Applied / Under Review ──(student)──→ Withdrawn
```

Recruiters and admins can only move an application **forward** (skipping stages is allowed) or to `Rejected`. `Selected`, `Rejected` and `Withdrawn` are final. Every change is written to `status_history` with the actor's id, name and role, the remarks, and a timestamp, and the student is notified.

---

## Public

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/meta` | Departments, domains, modes, years, statuses, student email domain, moderation flag |
| GET | `/internships` | Paginated live internships (open and deadline not passed). Auth optional; when a student is logged in, each item also has `bookmarked` and `myApplicationStatus` |
| GET | `/internships/:id` | Internship details. Pending/rejected postings are visible only to their owner and admins. Students get a `viewer` block (eligibility, bookmark, application); owners and admins get `statusCounts` |

**`GET /internships` query parameters**

| Param | Example | Notes |
|---|---|---|
| `q` | `react` | Searches title, company, description and skills |
| `domain` | `Web Development` | One of `/meta` domains |
| `mode` | `remote` | `onsite` \| `remote` \| `hybrid` |
| `location` | `Chennai` | Partial match |
| `skill` | `Python` | Exact match, case-insensitive |
| `minDuration`, `maxDuration` | `4`, `12` | Weeks |
| `minStipend`, `maxStipend` | `10000` | ₹ per month |
| `deadlineBefore`, `deadlineAfter` | `2026-12-31` | Inclusive |
| `eligibleOnly` | `true` | Students only: filter by their CGPA, department and year |
| `sort` | `newest` | `newest` \| `deadline` \| `stipend` \| `duration` |

## Auth — `/auth`

Register and login are limited to 30 requests per 15 minutes per IP.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register/student` | `name, email, password, registerNumber, department, year, cgpa?` | Email must be on `STUDENT_EMAIL_DOMAIN`. Returns `{ token, user }` |
| POST | `/auth/register/recruiter` | `name, email, password, companyName, website?, phone?, designation?` | Account starts as `pending`; admins are notified |
| POST | `/auth/login` | `email, password` | `{ token, user }`. Returns `403` if the account is deactivated |
| GET | `/auth/me` | — | `{ user, profile }` |
| PUT | `/auth/password` | `currentPassword, newPassword` | |

Passwords must be at least 8 characters and include a letter and a digit. They are hashed with bcrypt (12 rounds).

## Student — `/students` (role: student)

| Method | Path | Description |
|---|---|---|
| GET | `/students/me/profile` | Profile including `resume: { name, uploadedAt } \| null` |
| PUT | `/students/me/profile` | `name, registerNumber, department, year, cgpa, skills[], phone` |
| POST | `/students/me/resume` | `multipart/form-data` with field `resume`: PDF only, max 5 MB, `%PDF-` signature checked |
| GET | `/students/me/resume` | Download your current resume |
| GET | `/students/me/dashboard` | Stats, status counts, recent applications, recommendations, upcoming bookmarked deadlines |
| GET | `/students/me/bookmarks` | Paginated bookmarked internships |

## Internship actions — `/internships`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/internships` | approved recruiter | Create a posting (body below). Status is `pending` when moderation is on, otherwise `open` |
| PUT | `/internships/:id` | owner | Replace a posting. With moderation on, a non-closed posting goes back to `pending` |
| POST | `/internships/:id/close` | owner, admin | Stop accepting applications |
| POST | `/internships/:id/reopen` | owner | Reopen a closed posting (deadline must not have passed) |
| DELETE | `/internships/:id` | owner (no applications), admin | Delete |
| POST | `/internships/:id/apply` | student | `{ coverNote? }`. Attaches the saved resume. Errors: `400` closed, past deadline or no resume; `403` not eligible; `409` already applied |
| POST | `/internships/:id/bookmark` | student | Add bookmark |
| DELETE | `/internships/:id/bookmark` | student | Remove bookmark |
| GET | `/internships/:id/applicants` | owner, admin | Paginated applicants plus `statusCounts` |
| GET | `/internships/:id/applicants/export` | owner, admin | CSV with the same filters |

**Internship body**

```json
{
  "title": "Backend Intern", "company": "Acme", "description": "≥ 20 chars",
  "domain": "Software Development", "requiredSkills": ["Node.js", "SQL"],
  "minCgpa": 7, "eligibleDepartments": ["Computer Science and Engineering"], "eligibleYears": [3, 4],
  "location": "Chennai", "mode": "hybrid", "durationWeeks": 12, "stipend": 20000,
  "openings": 2, "deadline": "2026-12-15"
}
```
An empty `eligibleDepartments` or `eligibleYears` array means all departments or years are eligible.

**Applicants query parameters:** `q` (name, email or register number), `status`, `department`, `year`, `minCgpa`, `skill` (partial match), `sort` = `recent` \| `cgpa` \| `name`, `page`, `limit`.

## Applications — `/applications`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/applications/me` | student | Paginated own applications with full `history[]`. Filter `?status=` |
| GET | `/applications/:id` | the student, the internship's recruiter, admin | Detail with `history`, `nextStatuses`, `canWithdraw` |
| POST | `/applications/:id/withdraw` | student | Only while `Applied` or `Under Review` |
| PATCH | `/applications/:id/status` | owner recruiter, admin | `{ status, remarks? }`. `400` if the transition is not allowed |
| GET | `/applications/:id/resume` | the student, the internship's recruiter, admin | Download the resume submitted with the application |

## Notifications — `/notifications` (any role)

| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | Paginated, newest first. `?unreadOnly=true`. Also returns `unreadCount` |
| GET | `/notifications/unread-count` | `{ unreadCount }` |
| PATCH | `/notifications/:id/read` | Mark one as read |
| POST | `/notifications/read-all` | Mark all as read |

Notifications are created for these events:
- **Students:** an application's status changes; a new posting goes live that matches their eligibility and at least one of their skills (students with no skills listed are matched on eligibility alone).
- **Recruiters:** a new applicant; an applicant withdraws; their account is approved or rejected; a posting is approved or rejected.
- **Admins:** a recruiter registers; a posting needs review.

## Recruiter — `/recruiter` (role: recruiter)

| Method | Path | Description |
|---|---|---|
| GET | `/recruiter/profile` | Company profile and approval status |
| PUT | `/recruiter/profile` | `name, companyName, website?, phone?, designation?, about?` |
| GET | `/recruiter/dashboard` | Counts by status, total applicants, recent applicants |
| GET | `/recruiter/internships` | Own postings (all statuses) with `applicantCount` and `selectedCount`. `?status=&q=` |

## Admin — `/admin` (role: admin)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | `?role=&approval=&active=&department=&q=` plus pagination. Also returns `counts` |
| GET | `/admin/users/:id` | Detail with profile and that user's applications or postings |
| PATCH | `/admin/users/:id/active` | `{ isActive: boolean }` (not allowed on yourself) |
| DELETE | `/admin/users/:id` | Delete a user and cascade their data, including resume files |
| PATCH | `/admin/recruiters/:id/approval` | `{ status: "approved" \| "rejected", remarks? }` |
| GET | `/admin/internships` | All postings, pending first. `?status=&q=` |
| PATCH | `/admin/internships/:id/moderation` | `{ decision: "approve" \| "reject", remarks? }` |
| GET | `/admin/settings` | `{ moderationEnabled }` |
| PUT | `/admin/settings` | `{ moderationEnabled: boolean }` |
| GET | `/admin/analytics` | Totals, selection rate, status breakdown, applications per internship, department participation, domains, monthly trend |
| GET | `/admin/reports/:type` | CSV download. `type` = `internships` \| `applications` \| `students` \| `recruiters` \| `departments` \| `internship-performance` |

`selectionRate` is selected applications divided by all non-withdrawn applications. `offerRate` is selected divided by decided (selected plus rejected). In CSV exports, text cells that start with `= + - @` are prefixed with `'` so spreadsheets don't run them as formulas.
