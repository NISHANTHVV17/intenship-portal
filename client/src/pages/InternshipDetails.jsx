import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  IndianRupee,
  MapPin,
  Pencil,
  Users,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { InternshipStatusBadge, StatusBadge } from '../components/status';
import { Alert, Badge, ErrorState, Modal, PageLoader, Spinner, Textarea } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { deadlineLabel, formatDate, formatDuration, formatStipend, MODE_LABELS } from '../lib/format';
import { useAsync } from '../lib/hooks';

export default function InternshipDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: i, error, loading, reload, setData } = useAsync(() => api.get(`/internships/${id}`), [id, user?.id]);
  const [applyOpen, setApplyOpen] = useState(false);

  if (loading && !i) return <PageLoader />;
  if (error) {
    return (
      <Page narrow>
        <ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} />
        <Link to="/internships" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Back to internships
        </Link>
      </Page>
    );
  }

  const viewer = i.viewer;
  const isOwner = user?.role === 'recruiter' && user.id === i.recruiterId;
  const isAdmin = user?.role === 'admin';

  const toggleBookmark = async () => {
    const next = !viewer.bookmarked;
    try {
      if (next) await api.post(`/internships/${i.id}/bookmark`);
      else await api.del(`/internships/${i.id}/bookmark`);
      setData((d) => ({ ...d, viewer: { ...d.viewer, bookmarked: next } }));
      toast.success(next ? 'Saved to bookmarks' : 'Bookmark removed');
    } catch (err) {
      toast.error(err);
    }
  };

  const facts = [
    { icon: MapPin, label: 'Location', value: `${i.location} · ${MODE_LABELS[i.mode]}` },
    { icon: Clock, label: 'Duration', value: formatDuration(i.durationWeeks) },
    { icon: IndianRupee, label: 'Stipend', value: formatStipend(i.stipend) },
    { icon: Briefcase, label: 'Openings', value: i.openings },
    { icon: CalendarClock, label: 'Apply by', value: `${formatDate(i.deadline)} (${deadlineLabel(i.deadline)})` },
    { icon: Users, label: 'Applicants', value: i.applicantCount },
  ];

  return (
    <Page>
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-medium text-brand-600">{i.company}</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{i.title}</h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge color="brand">{i.domain}</Badge>
                  {(isOwner || isAdmin || i.status !== 'open') && <InternshipStatusBadge status={i.status} />}
                </div>
              </div>
              {viewer && (
                <button className="btn-secondary" onClick={toggleBookmark} aria-pressed={viewer.bookmarked}>
                  {viewer.bookmarked ? <BookmarkCheck className="h-4 w-4 text-brand-600" /> : <Bookmark className="h-4 w-4" />}
                  {viewer.bookmarked ? 'Saved' : 'Save'}
                </button>
              )}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-800">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900">About the internship</h2>
            <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{i.description}</div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900">Requirements</h2>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="mb-2 font-medium text-slate-700">Required skills</p>
                <div className="flex flex-wrap gap-2">
                  {i.requiredSkills.length ? i.requiredSkills.map((s) => <Badge key={s}>{s}</Badge>) : <span className="text-slate-500">No specific skills listed</span>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="font-medium text-slate-700">Minimum CGPA</p>
                  <p className="text-slate-600">{i.minCgpa > 0 ? i.minCgpa : 'No minimum'}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-700">Departments</p>
                  <p className="text-slate-600">{i.eligibleDepartments.length ? i.eligibleDepartments.join(', ') : 'All departments'}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-700">Year of study</p>
                  <p className="text-slate-600">{i.eligibleYears.length ? i.eligibleYears.map((y) => `Year ${y}`).join(', ') : 'All years'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <ActionPanel internship={i} user={user} isOwner={isOwner} isAdmin={isAdmin} onApply={() => setApplyOpen(true)} />
        </aside>
      </div>

      {viewer && (
        <ApplyModal
          open={applyOpen}
          internship={i}
          onClose={() => setApplyOpen(false)}
          onApplied={(application) => {
            setApplyOpen(false);
            setData((d) => ({ ...d, applicantCount: d.applicantCount + 1, viewer: { ...d.viewer, application } }));
          }}
        />
      )}
    </Page>
  );
}

function ActionPanel({ internship: i, user, isOwner, isAdmin, onApply }) {
  if (isOwner || isAdmin) {
    const counts = i.statusCounts || {};
    return (
      <div className="card space-y-4 p-6">
        <h2 className="font-semibold text-slate-900">Manage posting</h2>
        {i.status === 'rejected' && i.moderationRemarks && <Alert>Rejected: {i.moderationRemarks}</Alert>}
        <ul className="space-y-1 text-sm">
          {Object.entries(counts).map(([s, n]) => (
            <li key={s} className="flex justify-between">
              <StatusBadge status={s} /> <span className="font-medium">{n}</span>
            </li>
          ))}
          {!Object.keys(counts).length && <li className="text-slate-500">No applications yet.</li>}
        </ul>
        <Link to={`/${isAdmin ? 'admin' : 'recruiter'}/internships/${i.id}/applicants`} className="btn-primary w-full">
          <Users className="h-4 w-4" /> View applicants
        </Link>
        {isOwner && (
          <Link to={`/recruiter/internships/${i.id}/edit`} className="btn-secondary w-full">
            <Pencil className="h-4 w-4" /> Edit posting
          </Link>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <GraduationCap className="mx-auto h-8 w-8 text-brand-600" />
        <p className="font-semibold text-slate-900">Interested in this role?</p>
        <p className="text-sm text-slate-500">Log in with your college account to apply.</p>
        <Link to="/login" state={{ from: `/internships/${i.id}` }} className="btn-primary w-full">
          Log in to apply
        </Link>
        <Link to="/register" className="btn-secondary w-full">
          Create student account
        </Link>
      </div>
    );
  }

  if (user.role !== 'student') {
    return <div className="card p-6 text-sm text-slate-500">Only students can apply to internships.</div>;
  }

  const v = i.viewer;
  if (v.application) {
    return (
      <div className="card space-y-3 p-6">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-semibold">You have applied</p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Current status</span>
          <StatusBadge status={v.application.status} />
        </div>
        <p className="text-xs text-slate-500">Applied on {formatDate(v.application.appliedAt)}</p>
        <Link to={`/student/applications?highlight=${v.application.id}`} className="btn-secondary w-full">
          Track application
        </Link>
      </div>
    );
  }

  const blocked = !i.acceptingApplications ? 'This internship is no longer accepting applications.' : null;
  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-semibold text-slate-900">Apply</h2>
      {blocked && <Alert type="warning">{blocked}</Alert>}
      {!blocked && !v.eligible && (
        <Alert type="warning">
          <p className="font-medium">You are not eligible:</p>
          <ul className="mt-1 list-disc pl-4">
            {v.eligibilityIssues.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Alert>
      )}
      {!blocked && v.eligible && !v.hasResume && (
        <Alert type="info">
          Upload your resume before applying.{' '}
          <Link to="/student/profile" className="font-semibold underline">
            Go to profile
          </Link>
        </Alert>
      )}
      {!blocked && v.eligible && v.hasResume && (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> You meet all eligibility criteria
        </p>
      )}
      {!blocked && !v.eligible && (
        <p className="flex items-center gap-2 text-sm text-rose-600">
          <XCircle className="h-4 w-4" /> Update your profile if these details are out of date
        </p>
      )}
      <button className="btn-primary w-full py-2.5" disabled={Boolean(blocked) || !v.eligible || !v.hasResume} onClick={onApply}>
        Apply now
      </button>
    </div>
  );
}

function ApplyModal({ open, internship, onClose, onApplied }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [coverNote, setCoverNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post(`/internships/${internship.id}/apply`, { coverNote: coverNote.trim() || undefined });
      toast.success('Application submitted!');
      onApplied({ id: r.id, status: r.status, appliedAt: new Date().toISOString() });
      setCoverNote('');
    } catch (err) {
      setError(err.details?.length && !err.details[0].field ? `${err.message}: ${err.details.map((d) => d.message).join('; ')}` : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Apply to ${internship.title}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Spinner className="h-4 w-4 text-white" />} Submit application
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <FileText className="h-8 w-8 text-rose-500" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-slate-800">{profile?.resume?.name || 'Your saved resume'}</p>
            <p className="text-xs text-slate-500">Uploaded {formatDate(profile?.resume?.uploadedAt)} · attached automatically</p>
          </div>
        </div>
        <Textarea
          label="Cover note (optional)"
          rows={5}
          maxLength={2000}
          value={coverNote}
          onChange={(e) => setCoverNote(e.target.value)}
          placeholder={`Tell ${internship.company} why you're a great fit…`}
          hint={`${coverNote.length}/2000`}
        />
        <p className="text-xs text-slate-500">You can withdraw while the application is "Applied" or "Under Review".</p>
      </div>
    </Modal>
  );
}
