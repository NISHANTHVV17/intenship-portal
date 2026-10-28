import { Briefcase, Clock3, Eye, FilePlus2, Lock, MoreHorizontal, Pencil, RotateCcw, Trash2, Trophy, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { InternshipStatusBadge, StatusBadge } from '../../components/status';
import { Alert, ConfirmModal, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, StatCard } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { daysLeft, formatDate, timeAgo } from '../../lib/format';
import { useAsync, useQueryState } from '../../lib/hooks';

const TABS = [
  ['', 'All'],
  ['open', 'Live'],
  ['pending', 'Pending'],
  ['closed', 'Closed'],
  ['rejected', 'Rejected'],
];

export default function RecruiterDashboard() {
  const dash = useAsync(() => api.get('/recruiter/dashboard'), []);
  const [query, setQuery] = useQueryState({ page: '1', status: '' });
  const list = useAsync(() => api.get('/recruiter/internships', { page: query.page, status: query.status, limit: 10 }), [query.page, query.status]);
  const toast = useToast();
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const { profile, refresh } = useAuth();

  // Approval may have changed since login (e.g. admin approved meanwhile) - resync the session copy.
  const freshApproval = dash.data?.profile.approvalStatus;
  useEffect(() => {
    if (freshApproval && profile && freshApproval !== profile.approvalStatus) refresh();
  }, [freshApproval, profile, refresh]);

  if (dash.loading && !dash.data) return <PageLoader />;
  if (dash.error) return <Page><ErrorState error={dash.error} onRetry={dash.reload} /></Page>;

  const d = dash.data;
  const approval = d.profile.approvalStatus;

  const runAction = async () => {
    setBusy(true);
    try {
      const { action, internship } = confirm;
      if (action === 'delete') await api.del(`/internships/${internship.id}`);
      else await api.post(`/internships/${internship.id}/${action}`);
      toast.success({ close: 'Internship closed', reopen: 'Internship reopened', delete: 'Internship deleted' }[action]);
      setConfirm(null);
      list.reload();
      dash.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title={d.profile.companyName}
        subtitle="Manage your internship postings and applicants"
        actions={
          approval === 'approved' && (
            <Link to="/recruiter/internships/new" className="btn-primary">
              <FilePlus2 className="h-4 w-4" /> Post internship
            </Link>
          )
        }
      />

      {approval === 'pending' && (
        <Alert type="warning" className="mb-6">
          <p className="font-semibold">Your account is awaiting approval</p>
          The placement cell is reviewing your registration. You'll be notified once approved and can then post internships.
        </Alert>
      )}
      {approval === 'rejected' && (
        <Alert className="mb-6">
          <p className="font-semibold">Your recruiter account was not approved</p>
          {d.profile.approvalRemarks ? `Reason: ${d.profile.approvalRemarks}. ` : ''}Contact the placement cell for details.
        </Alert>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Live postings" value={d.internshipsByStatus.open} icon={Briefcase} />
        <StatCard label="Pending approval" value={d.internshipsByStatus.pending} icon={Clock3} tone="amber" />
        <StatCard label="Total applicants" value={d.totalApplications} icon={Users} tone="blue" />
        <StatCard label="Selected" value={d.applicationsByStatus.Selected || 0} icon={Trophy} tone="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">My internships</h2>
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
              {TABS.map(([value, label]) => (
                <button
                  key={label}
                  onClick={() => setQuery({ status: value })}
                  className={`shrink-0 rounded-md px-3 py-1 text-sm ${query.status === value ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : !list.data ? (
            <PageLoader />
          ) : list.data.items.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No internships here"
              message={approval === 'approved' ? 'Post your first internship to start receiving applications.' : 'You can post internships once approved.'}
              action={approval === 'approved' && <Link to="/recruiter/internships/new" className="btn-primary">Post internship</Link>}
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Internship</th>
                      <th>Status</th>
                      <th>Deadline</th>
                      <th className="text-right">Applicants</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.data.items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <Link to={`/internships/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                            {i.title}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {i.domain} · {i.openings} opening{i.openings > 1 ? 's' : ''} · posted {timeAgo(i.createdAt)}
                          </p>
                          {i.status === 'rejected' && i.moderationRemarks && <p className="mt-1 text-xs text-rose-600">Reason: {i.moderationRemarks}</p>}
                        </td>
                        <td>
                          <InternshipStatusBadge status={i.status} />
                        </td>
                        <td className={`whitespace-nowrap ${daysLeft(i.deadline) < 0 ? 'text-rose-600' : ''}`}>{formatDate(i.deadline)}</td>
                        <td className="text-right">
                          <Link to={`/recruiter/internships/${i.id}/applicants`} className="font-semibold text-brand-600 hover:underline">
                            {i.applicantCount}
                          </Link>
                          {i.selectedCount > 0 && <p className="text-xs text-emerald-600">{i.selectedCount} selected</p>}
                        </td>
                        <td>
                          <RowMenu internship={i} disabled={approval !== 'approved'} onAction={(action) => setConfirm({ action, internship: i })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={list.data.pagination} onPageChange={(page) => setQuery({ page }, { resetPage: false })} />
            </>
          )}
        </section>

        <section className="card h-fit p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Recent applicants</h2>
          {d.recentApplicants.length === 0 ? (
            <p className="text-sm text-slate-500">No applications yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.recentApplicants.map((a) => (
                <li key={a.id} className="py-3">
                  <Link to={`/recruiter/internships/${a.internship.id}/applicants`} className="block hover:text-brand-700">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{a.student.name}</p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {a.internship.title} · CGPA {a.student.cgpa ?? '—'} · {timeAgo(a.appliedAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm && { close: 'Close internship?', reopen: 'Reopen internship?', delete: 'Delete internship?' }[confirm.action]}
        message={
          confirm &&
          {
            close: 'Students will no longer be able to apply. You can still manage existing applicants.',
            reopen: 'The posting will accept applications again until its deadline.',
            delete: 'This permanently removes the posting. Only postings without applications can be deleted.',
          }[confirm.action]
        }
        confirmLabel={confirm && { close: 'Close', reopen: 'Reopen', delete: 'Delete' }[confirm.action]}
        danger={confirm?.action !== 'reopen'}
        busy={busy}
        onConfirm={runAction}
        onClose={() => setConfirm(null)}
      />
    </Page>
  );
}

function RowMenu({ internship: i, onAction, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50';
  return (
    <div className="relative" ref={ref} onBlur={(e) => !ref.current.contains(e.relatedTarget) && setOpen(false)}>
      <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setOpen((o) => !o)} aria-label="Actions" disabled={disabled}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <Link to={`/internships/${i.id}`} className={item}>
            <Eye className="h-4 w-4" /> View
          </Link>
          <Link to={`/recruiter/internships/${i.id}/edit`} className={item}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <Link to={`/recruiter/internships/${i.id}/applicants`} className={item}>
            <Users className="h-4 w-4" /> Applicants
          </Link>
          {i.status === 'closed' ? (
            <button className={item} onClick={() => { setOpen(false); onAction('reopen'); }}>
              <RotateCcw className="h-4 w-4" /> Reopen
            </button>
          ) : (
            <button className={item} onClick={() => { setOpen(false); onAction('close'); }}>
              <Lock className="h-4 w-4" /> Close
            </button>
          )}
          {i.applicantCount === 0 && (
            <button className={`${item} text-rose-600`} onClick={() => { setOpen(false); onAction('delete'); }}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
