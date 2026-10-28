import { BarChart3, Briefcase, Building2, CheckCircle2, ClipboardList, FileDown, GraduationCap, ShieldCheck, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../../components/Layout';
import { ErrorState, PageHeader, PageLoader, Spinner, StatCard } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api, download } from '../../lib/api';
import { formatDate, timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/hooks';

export const REPORTS = [
  ['internships', 'All internships'],
  ['applications', 'All applications'],
  ['students', 'Students'],
  ['recruiters', 'Recruiters'],
  ['departments', 'Department participation'],
  ['internship-performance', 'Internship performance'],
];

export function ReportButtons({ compact = false }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const run = async (type) => {
    setBusy(type);
    try {
      await download(`/admin/reports/${type}`, `${type}.csv`);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'grid gap-2 sm:grid-cols-2'}>
      {REPORTS.map(([type, label]) => (
        <button key={type} className="btn-secondary justify-start" onClick={() => run(type)} disabled={busy === type}>
          {busy === type ? <Spinner className="h-4 w-4" /> : <FileDown className="h-4 w-4" />} {label}
        </button>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const toast = useToast();
  const analytics = useAsync(() => api.get('/admin/analytics'), []);
  const pendingRecruiters = useAsync(() => api.get('/admin/users', { role: 'recruiter', approval: 'pending', limit: 5 }), []);
  const pendingPostings = useAsync(() => api.get('/admin/internships', { status: 'pending', limit: 5 }), []);
  const settings = useAsync(() => api.get('/admin/settings'), []);
  const [acting, setActing] = useState(null);

  if (analytics.loading && !analytics.data) return <PageLoader />;
  if (analytics.error) return <Page><ErrorState error={analytics.error} onRetry={analytics.reload} /></Page>;
  const t = analytics.data.totals;

  const act = async (key, fn, message) => {
    setActing(key);
    try {
      await fn();
      toast.success(message);
      pendingRecruiters.reload();
      pendingPostings.reload();
      analytics.reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setActing(null);
    }
  };

  const toggleModeration = async () => {
    try {
      const next = await api.put('/admin/settings', { moderationEnabled: !settings.data.moderationEnabled });
      settings.setData(next);
      toast.success(next.moderationEnabled ? 'Posting moderation enabled' : 'Postings now go live without review');
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Placement cell dashboard"
        subtitle="Overview of internships, recruiters and student participation"
        actions={
          <Link to="/admin/analytics" className="btn-primary">
            <BarChart3 className="h-4 w-4" /> Full analytics
          </Link>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={t.students} icon={GraduationCap} />
        <StatCard label="Approved recruiters" value={t.recruiters} icon={Building2} tone="blue" hint={t.pendingRecruiters ? `${t.pendingRecruiters} pending` : undefined} />
        <StatCard label="Live internships" value={t.liveInternships} icon={Briefcase} tone="amber" hint={`${t.internships} total`} />
        <StatCard label="Selection rate" value={`${t.selectionRate}%`} icon={Trophy} tone="green" hint={`${t.selected} selected of ${t.applications}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-amber-500" /> Recruiters awaiting approval
            </h2>
            <Link to="/admin/users?role=recruiter&approval=pending" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {!pendingRecruiters.data ? (
            <Spinner />
          ) : pendingRecruiters.data.items.length === 0 ? (
            <p className="flex items-center gap-2 py-4 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No pending recruiter approvals.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingRecruiters.data.items.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{r.recruiter.companyName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.name} · {r.email} · registered {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary btn-sm"
                      disabled={acting === `r${r.id}`}
                      onClick={() => act(`r${r.id}`, () => api.patch(`/admin/recruiters/${r.id}/approval`, { status: 'approved' }), `${r.recruiter.companyName} approved`)}
                    >
                      Approve
                    </button>
                    <Link to="/admin/users?role=recruiter&approval=pending" className="btn-secondary btn-sm">
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <ClipboardList className="h-4 w-4 text-amber-500" /> Postings awaiting approval
            </h2>
            <Link to="/admin/internships?status=pending" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {!pendingPostings.data ? (
            <Spinner />
          ) : pendingPostings.data.items.length === 0 ? (
            <p className="flex items-center gap-2 py-4 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No postings waiting for review.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingPostings.data.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link to={`/internships/${i.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {i.title}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {i.company} · deadline {formatDate(i.deadline)}
                    </p>
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    disabled={acting === `i${i.id}`}
                    onClick={() => act(`i${i.id}`, () => api.patch(`/admin/internships/${i.id}/moderation`, { decision: 'approve' }), `"${i.title}" is now live`)}
                  >
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Posting moderation</h2>
          <p className="mb-4 text-sm text-slate-500">When enabled, new and edited internship postings must be approved before students can see them.</p>
          {settings.data && (
            <label className="flex cursor-pointer items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={settings.data.moderationEnabled}
                onClick={toggleModeration}
                className={`relative h-6 w-11 rounded-full transition ${settings.data.moderationEnabled ? 'bg-brand-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${settings.data.moderationEnabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
              <span className="text-sm font-medium text-slate-700">{settings.data.moderationEnabled ? 'Moderation on' : 'Moderation off'}</span>
            </label>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Export reports</h2>
          <p className="mb-4 text-sm text-slate-500">Download CSV files that open in Excel or Google Sheets.</p>
          <ReportButtons />
        </section>
      </div>
    </Page>
  );
}
