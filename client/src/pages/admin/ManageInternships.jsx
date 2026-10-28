import { Check, ClipboardList, Eye, Lock, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../../components/Layout';
import { InternshipStatusBadge } from '../../components/status';
import { ConfirmModal, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, Textarea } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDate, formatStipend, timeAgo } from '../../lib/format';
import { useAsync, useDebounced, useQueryState } from '../../lib/hooks';

const TABS = [
  ['', 'All'],
  ['pending', 'Pending'],
  ['open', 'Live'],
  ['closed', 'Closed'],
  ['rejected', 'Rejected'],
];

const COPY = {
  approve: ['Approve posting?', 'It will go live and matching students will be notified.', 'Approve', false],
  reject: ['Reject posting?', 'The recruiter will be notified and can edit and resubmit it.', 'Reject', true],
  close: ['Close posting?', 'Students will no longer be able to apply.', 'Close', true],
  delete: ['Delete posting?', 'This permanently deletes the posting and all of its applications.', 'Delete', true],
};

export default function ManageInternships() {
  const toast = useToast();
  const [filters, setFilters] = useQueryState({ page: '1', status: '', q: '' });
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebounced(search);
  const [confirm, setConfirm] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const key = JSON.stringify(filters);
  const { data, error, loading, reload } = useAsync(() => api.get('/admin/internships', { ...filters, limit: 15 }), [key]);

  const run = async () => {
    const { action, internship: i } = confirm;
    setBusy(true);
    try {
      if (action === 'approve' || action === 'reject') {
        await api.patch(`/admin/internships/${i.id}/moderation`, { decision: action, remarks: remarks.trim() || undefined });
      } else if (action === 'close') {
        await api.post(`/internships/${i.id}/close`);
      } else {
        await api.del(`/internships/${i.id}`);
      }
      toast.success({ approve: 'Posting approved', reject: 'Posting rejected', close: 'Posting closed', delete: 'Posting deleted' }[action]);
      setConfirm(null);
      reload();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const ask = (action, internship) => {
    setRemarks('');
    setConfirm({ action, internship });
  };

  return (
    <Page>
      <PageHeader title="Internship postings" subtitle="Moderate, close or remove postings from all recruiters" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
          {TABS.map(([value, label]) => (
            <button
              key={label}
              onClick={() => setFilters({ status: value })}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm ${filters.status === value ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'}`}
            >
              {label}
              {value && data?.counts && <span className="ml-1 text-slate-400">({data.counts[value]})</span>}
            </button>
          ))}
        </div>
        <input className="input sm:w-72" placeholder="Search title or company" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search postings" />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <PageLoader />
      ) : data.items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No postings found" />
      ) : (
        <>
          <div className={`table-wrap ${loading ? 'opacity-60' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th>Internship</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th className="text-right">Applicants</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td className="min-w-[14rem]">
                      <Link to={`/internships/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {i.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {i.company} · by {i.recruiterName} · {timeAgo(i.createdAt)}
                      </p>
                      {i.moderationRemarks && <p className="mt-1 text-xs text-slate-500">Remarks: {i.moderationRemarks}</p>}
                    </td>
                    <td className="min-w-[12rem] text-xs text-slate-600">
                      {i.domain}
                      <br />
                      {formatStipend(i.stipend)} · deadline {formatDate(i.deadline)}
                    </td>
                    <td><InternshipStatusBadge status={i.status} /></td>
                    <td className="text-right">
                      <Link to={`/admin/internships/${i.id}/applicants`} className="font-semibold text-brand-600 hover:underline">
                        {i.applicantCount}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        {(i.status === 'pending' || i.status === 'rejected') && (
                          <button className="btn-primary btn-sm" onClick={() => ask('approve', i)}>
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                        )}
                        {i.status === 'pending' && (
                          <button className="btn-secondary btn-sm" onClick={() => ask('reject', i)}>
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        )}
                        <Link to={`/internships/${i.id}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="View" aria-label="View">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link to={`/admin/internships/${i.id}/applicants`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Applicants" aria-label="Applicants">
                          <Users className="h-4 w-4" />
                        </Link>
                        {i.status === 'open' && (
                          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => ask('close', i)} title="Close" aria-label="Close">
                            <Lock className="h-4 w-4" />
                          </button>
                        )}
                        <button className="rounded p-1.5 text-rose-500 hover:bg-rose-50" onClick={() => ask('delete', i)} title="Delete" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
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
          title={COPY[confirm.action][0]}
          message={`"${confirm.internship.title}" - ${COPY[confirm.action][1]}`}
          confirmLabel={COPY[confirm.action][2]}
          danger={COPY[confirm.action][3]}
          busy={busy}
          onConfirm={run}
          onClose={() => setConfirm(null)}
        >
          {(confirm.action === 'approve' || confirm.action === 'reject') && (
            <Textarea className="mt-4" label="Remarks for the recruiter (optional)" rows={3} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          )}
        </ConfirmModal>
      )}
    </Page>
  );
}
