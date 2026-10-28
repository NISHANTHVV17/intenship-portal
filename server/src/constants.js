export const ROLES = ['student', 'recruiter', 'admin'];

export const DEPARTMENTS = [
  'Computer Science and Engineering',
  'Information Technology',
  'Artificial Intelligence and Data Science',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biotechnology',
  'MCA',
  'MBA',
];

export const DOMAINS = [
  'Software Development',
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Machine Learning / AI',
  'Cloud & DevOps',
  'Cybersecurity',
  'Embedded Systems',
  'Core Engineering',
  'UI/UX Design',
  'Product Management',
  'Marketing',
  'Finance',
  'Human Resources',
  'Research',
  'Other',
];

export const MODES = ['onsite', 'remote', 'hybrid'];
export const YEARS = [1, 2, 3, 4, 5];

export const INTERNSHIP_STATUSES = ['pending', 'open', 'rejected', 'closed'];
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

// Ordered pipeline. Selected / Rejected are terminal; Withdrawn is the student's exit.
export const PIPELINE = ['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected'];
export const APPLICATION_STATUSES = [...PIPELINE, 'Rejected', 'Withdrawn'];
export const TERMINAL_STATUSES = ['Selected', 'Rejected', 'Withdrawn'];
export const WITHDRAWABLE_STATUSES = ['Applied', 'Under Review'];
