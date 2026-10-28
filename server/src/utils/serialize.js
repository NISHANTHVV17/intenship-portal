export const parseJson = (s, fallback = []) => {
  try {
    return JSON.parse(s) ?? fallback;
  } catch {
    return fallback;
  }
};

export function serializeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    ...(row.role === 'recruiter' && row.approval_status !== undefined
      ? { approvalStatus: row.approval_status }
      : {}),
  };
}

export function serializeStudentProfile(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    registerNumber: row.register_number,
    department: row.department,
    year: row.year,
    cgpa: row.cgpa,
    skills: parseJson(row.skills),
    phone: row.phone,
    resume: row.resume_file ? { name: row.resume_name, uploadedAt: row.resume_uploaded_at } : null,
    updatedAt: row.updated_at,
  };
}

export function serializeRecruiterProfile(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    companyName: row.company_name,
    website: row.website,
    phone: row.phone,
    designation: row.designation,
    about: row.about,
    approvalStatus: row.approval_status,
    approvalRemarks: row.approval_remarks,
    reviewedAt: row.reviewed_at,
  };
}

export function serializeInternship(row) {
  if (!row) return null;
  const out = {
    id: row.id,
    recruiterId: row.recruiter_id,
    title: row.title,
    company: row.company,
    description: row.description,
    domain: row.domain,
    requiredSkills: parseJson(row.required_skills),
    minCgpa: row.min_cgpa,
    eligibleDepartments: parseJson(row.eligible_departments),
    eligibleYears: parseJson(row.eligible_years),
    location: row.location,
    mode: row.mode,
    durationWeeks: row.duration_weeks,
    stipend: row.stipend,
    openings: row.openings,
    deadline: row.deadline,
    status: row.status,
    moderationRemarks: row.moderation_remarks,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.applicant_count !== undefined) out.applicantCount = row.applicant_count;
  if (row.selected_count !== undefined) out.selectedCount = row.selected_count;
  if (row.bookmarked !== undefined) out.bookmarked = Boolean(row.bookmarked);
  if (row.my_status !== undefined) out.myApplicationStatus = row.my_status;
  if (row.recruiter_name !== undefined) out.recruiterName = row.recruiter_name;
  return out;
}

export function serializeHistory(row) {
  return {
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    remarks: row.remarks,
    actor: { id: row.actor_id, name: row.actor_name, role: row.actor_role },
    changedAt: row.changed_at,
  };
}
