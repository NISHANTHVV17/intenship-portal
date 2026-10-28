import { z } from 'zod';
import { config } from './config.js';
import { APPLICATION_STATUSES, DEPARTMENTS, DOMAINS, MODES } from './constants.js';
import { isValidDateString, today } from './utils/dates.js';
import { paginationShape } from './utils/pagination.js';

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const name = z.string().trim().min(2, 'Name is too short').max(100);
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(150);
const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{6,19}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal('').transform(() => undefined));
const optionalText = (max) =>
  z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));
const url = z
  .string()
  .trim()
  .url('Enter a valid URL (https://...)')
  .max(200)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const department = z.enum(DEPARTMENTS, { errorMap: () => ({ message: 'Select a valid department' }) });
const year = z.coerce.number({ invalid_type_error: 'Select a year of study' }).int().min(1).max(5);
const cgpa = z.coerce.number({ invalid_type_error: 'CGPA must be a number' }).min(0, 'CGPA must be between 0 and 10').max(10, 'CGPA must be between 0 and 10');

export const skills = z
  .array(z.string().trim().min(1).max(40))
  .max(30, 'At most 30 skills')
  .default([])
  .transform((list) => {
    const seen = new Set();
    return list.filter((s) => !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  });

export const isCollegeEmail = (e) => {
  const domain = e.split('@')[1] || '';
  return domain === config.studentEmailDomain || domain.endsWith(`.${config.studentEmailDomain}`);
};

const registerNumber = z
  .string()
  .trim()
  .min(3, 'Register number is too short')
  .max(30)
  .regex(/^[A-Za-z0-9/-]+$/, 'Register number may only contain letters, digits, - and /');

export const registerStudentSchema = z
  .object({
    name,
    email,
    password,
    registerNumber,
    department,
    year,
    cgpa: cgpa.optional(),
  })
  .refine((d) => isCollegeEmail(d.email), {
    message: `Use your college email address (@${config.studentEmailDomain})`,
    path: ['email'],
  });

export const registerRecruiterSchema = z.object({
  name,
  email,
  password,
  companyName: z.string().trim().min(2).max(150),
  website: url,
  phone,
  designation: optionalText(100),
});

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') });

export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

export const studentProfileSchema = z.object({
  name,
  registerNumber,
  department,
  year,
  cgpa: cgpa.nullable().optional(),
  skills,
  phone,
});

export const recruiterProfileSchema = z.object({
  name,
  companyName: z.string().trim().min(2).max(150),
  website: url,
  phone,
  designation: optionalText(100),
  about: optionalText(2000),
});

const deadline = z
  .string()
  .refine(isValidDateString, 'Deadline must be a valid date (YYYY-MM-DD)')
  .refine((d) => d >= today(), 'Deadline cannot be in the past');

export const internshipSchema = z.object({
  title: z.string().trim().min(3).max(150),
  company: z.string().trim().min(2).max(150),
  description: z.string().trim().min(20, 'Description should be at least 20 characters').max(10000),
  domain: z.enum(DOMAINS, { errorMap: () => ({ message: 'Select a valid domain' }) }),
  requiredSkills: skills,
  minCgpa: cgpa.default(0),
  eligibleDepartments: z.array(department).default([]).transform((a) => [...new Set(a)]),
  eligibleYears: z.array(year).default([]).transform((a) => [...new Set(a)].sort()),
  location: z.string().trim().min(2).max(120),
  mode: z.enum(MODES),
  durationWeeks: z.coerce.number().int().min(1).max(52),
  stipend: z.coerce.number().int().min(0).max(10_000_000),
  openings: z.coerce.number().int().min(1).max(1000),
  deadline,
});

const optionalNumber = z.coerce.number().min(0).optional();
const emptyToUndefined = (v) => (v === '' ? undefined : v);

export const internshipQuerySchema = z.preprocess(
  (q) => Object.fromEntries(Object.entries(q || {}).map(([k, v]) => [k, emptyToUndefined(v)])),
  z.object({
    ...paginationShape,
    q: z.string().trim().max(100).optional(),
    domain: z.enum(DOMAINS).optional(),
    mode: z.enum(MODES).optional(),
    location: z.string().trim().max(100).optional(),
    skill: z.string().trim().max(40).optional(),
    minDuration: optionalNumber,
    maxDuration: optionalNumber,
    minStipend: optionalNumber,
    maxStipend: optionalNumber,
    deadlineBefore: z.string().refine(isValidDateString).optional(),
    deadlineAfter: z.string().refine(isValidDateString).optional(),
    eligibleOnly: z.enum(['true', 'false']).optional(),
    sort: z.enum(['newest', 'deadline', 'stipend', 'duration']).default('newest'),
  }),
);

export const applySchema = z.object({ coverNote: optionalText(2000) });

export const statusUpdateSchema = z.object({
  status: z.enum(APPLICATION_STATUSES.filter((s) => s !== 'Withdrawn' && s !== 'Applied')),
  remarks: optionalText(1000),
});

export const applicantQuerySchema = z.preprocess(
  (q) => Object.fromEntries(Object.entries(q || {}).map(([k, v]) => [k, emptyToUndefined(v)])),
  z.object({
    ...paginationShape,
    q: z.string().trim().max(100).optional(),
    status: z.enum(APPLICATION_STATUSES).optional(),
    department: department.optional(),
    year: year.optional(),
    minCgpa: cgpa.optional(),
    skill: z.string().trim().max(40).optional(),
    sort: z.enum(['recent', 'cgpa', 'name']).default('recent'),
  }),
);
