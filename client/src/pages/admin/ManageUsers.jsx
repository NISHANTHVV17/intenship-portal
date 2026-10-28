import { Ban, CheckCircle2, Eye, Trash2, UserCheck, UsersRound, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../../components/Layout';
import { ApprovalBadge, InternshipStatusBadge, StatusBadge } from '../../components/status';
import { Alert, Badge, ConfirmModal, EmptyState, ErrorState, Modal, PageHeader, PageLoader, Pagination, Spinner, Textarea } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAsync, useDebounced, useMeta, useQueryState } from '../../lib/hooks';

const DEFAULTS = { page: '1', role: 'student', q: '', approval: '', active: '', department: '' };
const ROLE_TABS = [
  ['student', 'Students'],
  ['recruiter', 'Recruiters'],
  ['admin', 'Admins'],
];

export default function ManageUsers() {
  const { user: me } = useAuth();
  const meta = useMeta();
  const toast = useToast();
  const [filters, setFilters] = useQueryState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebounced(search);
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const key = JSON.stringify(filters);
  const { data, error, loading, reload } = useAsync(() => api.get('/admin/users', { ...filters, limit: 15 }), [key]);

  const runConfirm = async () => {
    setBusy(true);
    const { action, user } = confirm;
    try {
      if (action === 'approve' || action === 'reject') {
        await api.patch(`/admin/recruiters/${user.id}/approval`, {
          status: action === 'approve' ? 'approved' : 'rejected',
          remarks: remarks.trim() || undefined,
        });
      } else if (action === 'deactivate' || action === 'activate') {
        await api.patch(`/admin/users/${user.id}/active`, { isActive: action === 'activate' });
      } else if (action === 'delete') {
        await api.del(`/admin/users/${user.id}`);
      }
      toast.success(
        { approve: 'Recruiter approved', reject: 'Recruiter rejected', activate: 'Account activated', deactivate: 'Account deactivated', delete: 'User deleted' }[action],
      );
      setConfirm(null);
      setRemarks('');
      reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const ask = (action, user) => {
    setRemarks('');
    setConfirm({ action, user });
  };

  const confirmCopy = confirm && {
    approve: ['Approve recruiter?', `${confirm.user.recruiter?.companyName} will be able to post internships.`, 'Approve', false],
    reject: ['Reject recruiter?', `${confirm.user.recruiter?.companyName} will not be able to post internships.`, 'Reject', true],
    deactivate: ['Deactivate account?', `${confirm.user.name} will be signed out and unable to log in.`, 'Deactivate', true],
    activate: ['Activate account?', `${confirm.user.name} will be able to log in again.`, 'Activate', false],
    delete: ['Delete user permanently?', `This deletes ${confirm.user.name} and all their data (applications, postings, files). This cannot be undone.`, 'Delete', true],
  }[confirm.action];

  return (
    <Page>
      <PageHeader title="Manage users" subtitle="Students, recruiters and placement-cell accounts" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {ROLE_TABS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilters({ role: value, approval: '', department: '' })}
              className={`rounded-md px-3 py-1.5 text-sm ${filters.role === value ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'}`}
            >
              {label}
              {data?.counts?.[value] !== undefined && <span className="ml-1 text-slate-400">({data.counts[value]})</span>}
            </button>
          ))}
        </div>
        {data?.counts?.pendingRecruiters > 0 && filters.role !== 'recruiter' && (
          <button onClick={() => setFilters({ role: 'recruiter', approval: 'pending' })} className="text-sm font-medium text-amber-700 hover:underline">
            {data.counts.pendingRecruiters} recruiter(s) awaiting approval →
          </button>
        )}
      </div>

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input sm:col-span-2" placeholder="Search name, email, register no. or company" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        {filters.role === 'recruiter' && (
          <select className="input" value={filters.approval} onChange={(e) => setFilters({ approval: e.target.value })} aria-label="Approval status">
            <option value="">Any approval status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
        {filters.role === 'student' && (
          <select className="input" value={filters.department} onChange={(e) => setFilters({ department: e.target.value })} aria-label="Department">
            <option value="">All departments</option>
            {meta?.departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        )}
        <select className="input" value={filters.active} onChange={(e) => setFilters({ active: e.target.value })} aria-label="Account status">
          <option value="">Active & inactive</option>
          <option value="true">Active only</option>
          <option value="false">Deactivated only</option>
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <PageLoader />
      ) : data.items.length === 0 ? (
        <EmptyState icon={UsersRound} title="No users found" message="Try a different search or filter." />
      ) : (
        <>
          <div className={`table-wrap ${loading ? 'opacity-60' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  {filters.role === 'student' && <th>Academic</th>}
                  {filters.role === 'recruiter' && <th>Company</th>}
                  <th>Status</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((u) => (
                  <tr key={u.id} className={u.isActive ? '' : 'bg-slate-50 text-slate-500'}>
                    <td>
                      <p className="font-medium text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    {u.student && (
                      <td className="min-w-[12rem] text-slate-600">
                        {u.student.registerNumber} · {u.student.department}
                        <p className="text-xs text-slate-400">
                          Year {u.student.year} · CGPA {u.student.cgpa ?? '—'} · {u.student.applicationCount} application(s){u.student.hasResume ? '' : ' · no resume'}
                        </p>
                      </td>
                    )}
                    {u.recruiter && (
                      <td className="min-w-[12rem]">
                        <p className="font-medium text-slate-700">{u.recruiter.companyName}</p>
                        <p className="text-xs text-slate-400">
                          {u.recruiter.designation || '—'} · {u.recruiter.internshipCount} posting(s)
                        </p>
                      </td>
                    )}
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {u.recruiter && <ApprovalBadge status={u.recruiter.approvalStatus} />}
                        {!u.isActive && <Badge color="red">Deactivated</Badge>}
                        {u.isActive && !u.recruiter && <Badge color="green">Active</Badge>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        {u.recruiter && u.recruiter.approvalStatus !== 'approved' && (
                          <button className="btn-primary btn-sm" onClick={() => ask('approve', u)}>
                            <UserCheck className="h-3.5 w-3.5" /> Approve
                          </button>
                        )}
                        {u.recruiter && u.recruiter.approvalStatus !== 'rejected' && (
                          <button className="btn-secondary btn-sm" onClick={() => ask('reject', u)}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                        )}
                        <IconButton label="View details" onClick={() => setViewing(u.id)} icon={Eye} />
                        {u.id !== me.id && (
                          <>
                            <IconButton label={u.isActive ? 'Deactivate' : 'Activate'} onClick={() => ask(u.isActive ? 'deactivate' : 'activate', u)} icon={u.isActive ? Ban : CheckCircle2} />
                            <IconButton label="Delete" onClick={() => ask('delete', u)} icon={Trash2} danger />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page }, { resetPage: false })} />
        </>
      )}

      {confirm && (
        <ConfirmModal
          open
          title={confirmCopy[0]}
          message={confirmCopy[1]}
          confirmLabel={confirmCopy[2]}
          danger={confirmCopy[3]}
          busy={busy}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        >
          {(confirm.action === 'approve' || confirm.action === 'reject') && (
            <Textarea className="mt-4" label="Remarks (sent to the recruiter)" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} />
          )}
        </ConfirmModal>
      )}

      <UserDetailModal userId={viewing} onClose={() => setViewing(null)} />
    </Page>
  );
}

function IconButton({ label, onClick, icon: Icon, danger }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`rounded p-1.5 ${danger ? 'text-rose-500 hover:bg-rose-50' : 'text-slate-500 hover:bg-slate-100'}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function UserDetailModal({ userId, onClose }) {
  const { data, error, loading } = useAsync(() => (userId ? api.get(`/admin/users/${userId}`) : Promise.resolve(null)), [userId]);
  return (
    <Modal open={Boolean(userId)} onClose={onClose} title="User details" size="lg">
      {error ? (
        <Alert>{error.message}</Alert>
      ) : loading || !data ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <div>
            <p className="text-lg font-semibold text-slate-900">{data.name}</p>
            <p className="text-slate-500">
              {data.email} · <span className="capitalize">{data.role}</span> · joined {formatDate(data.createdAt)}
            </p>
          </div>
          {data.role === 'student' && data.profile && (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Detail label="Register no." value={data.profile.registerNumber} />
                <Detail label="Department" value={data.profile.department} />
                <Detail label="Year / CGPA" value={`Year ${data.profile.year} · ${data.profile.cgpa ?? '—'}`} />
                <Detail label="Phone" value={data.profile.phone || '—'} />
                <Detail label="Resume" value={data.profile.resume ? data.profile.resume.name : 'Not uploaded'} />
                <Detail label="Skills" value={data.profile.skills.join(', ') || '—'} />
              </dl>
              <div>
                <p className="mb-2 font-medium text-slate-700">Applications ({data.applications.length})</p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {data.applications.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate">
                        {a.title} <span className="text-slate-400">· {a.company}</span>
                      </span>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                  {!data.applications.length && <li className="px-3 py-2 text-slate-500">No applications.</li>}
                </ul>
              </div>
            </>
          )}
          {data.role === 'recruiter' && data.profile && (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Detail label="Company" value={data.profile.companyName} />
                <Detail label="Designation" value={data.profile.designation || '—'} />
                <Detail label="Phone" value={data.profile.phone || '—'} />
                <Detail label="Website" value={data.profile.website ? <a className="text-brand-600 hover:underline" href={data.profile.website} target="_blank" rel="noreferrer noopener">{data.profile.website}</a> : '—'} />
                <Detail label="Approval" value={<ApprovalBadge status={data.profile.approvalStatus} />} />
                <Detail label="Remarks" value={data.profile.approvalRemarks || '—'} />
              </dl>
              {data.profile.about && <p className="rounded-lg bg-slate-50 p-3 text-slate-600">{data.profile.about}</p>}
              <div>
                <p className="mb-2 font-medium text-slate-700">Postings ({data.internships.length})</p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {data.internships.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <Link to={`/internships/${i.id}`} className="min-w-0 truncate hover:text-brand-700" onClick={onClose}>
                        {i.title}
                      </Link>
                      <InternshipStatusBadge status={i.status} />
                    </li>
                  ))}
                  {!data.internships.length && <li className="px-3 py-2 text-slate-500">No postings.</li>}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-800">{value}</dd>
    </div>
  );
}
