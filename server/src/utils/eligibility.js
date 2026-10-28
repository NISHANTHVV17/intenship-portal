import { parseJson } from './serialize.js';

/**
 * Checks a student profile row against an internship row.
 * Returns the list of unmet requirements (empty = eligible).
 */
export function eligibilityIssues(profile, internship) {
  const issues = [];
  if (!profile) return ['Complete your student profile first'];
  const depts = parseJson(internship.eligible_departments);
  const years = parseJson(internship.eligible_years);
  if (internship.min_cgpa > 0 && (profile.cgpa ?? 0) < internship.min_cgpa) {
    issues.push(`Minimum CGPA of ${internship.min_cgpa} required`);
  }
  if (depts.length && !depts.includes(profile.department)) {
    issues.push('Your department is not eligible');
  }
  if (years.length && !years.includes(profile.year)) {
    issues.push(`Open to year ${years.join(', ')} students only`);
  }
  return issues;
}

/** Number of required skills the student has (case-insensitive). */
export function skillOverlap(profile, internship) {
  const mine = new Set(parseJson(profile?.skills).map((s) => s.toLowerCase()));
  return parseJson(internship.required_skills).filter((s) => mine.has(s.toLowerCase())).length;
}
