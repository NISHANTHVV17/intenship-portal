import { ChevronDown, FileX2, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../../components/Layout';
import { StatusBadge, StatusProgress, StatusTimeline } from '../../components/status';
import { ConfirmModal, EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDate, formatStipend, MODE_LABELS, timeAgo } from '../../lib/format';
import { useAsync, useQueryState } from '../../lib/hooks';

const FILTERS = ['', 'Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected', 'Withdrawn'];

export default function MyApplications() {
  const [query, setQuery] = useQueryState({ page: '1', status: '', highlight: '' });
  const { data, error, loading, reload } = useAsync(
    () => api.get('/applications/me', { page: query.page, status: query.status, limit: 10 }),
    [query.page, query.status],
  );
  const [expanded, setExpanded] = useState(() => new Set(query.highlight ? [Number(query.highlight)] : []));
  const [withdrawing, setWithdrawing] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!query.highlight || !data) return;
    document.getElementById(`application-${query.highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [query.highlight, data]);

  const toggle = (id) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const withdraw = async () => {
    setBusy(true);
    try {
      await api.post(`/applications/${withdrawing.id}/withdraw`);
      toast.success('Application withdrawn');
      setWithdrawing(null);
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title="My applications" subtitle="Track every application and its full status history" />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setQuery({ status: s, highlight: '' })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              query.status === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <PageLoader />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={FileX2}
          title={query.status ? `No ${query.status.toLowerCase()} applications` : 'No applications yet'}
          message="Browse open internships and apply in one click."
          action={<Link to="/internships" className="btn-primary">Browse internships</Link>}
        />
      ) : (
        <>
          <ul className="space-y-4">
            {data.items.map((a) => {
              const open = expanded.has(a.id);
              const highlighted = String(a.id) === query.highlight;
              return (
                <li key={a.id} id={`application-${a.id}`} className={`card overflow-hidden ${highlighted ? 'ring-2 ring-brand-400' : ''}`}>
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/internships/${a.internship.id}`} className="text-lg font-semibold text-slate-900 hover:text-brand-700">
                          {a.internship.title}
                        </Link>
                        <p className="text-sm text-slate-500">
                          {a.internship.company} · <MapPin className="inline h-3.5 w-3.5" /> {a.internship.location} ({MODE_LABELS[a.internship.mode]}) ·{' '}
                          {formatStipend(a.internship.stipend)}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-4">
                      <StatusProgress status={a.status} />
                      <div className="mt-1 hidden justify-between text-[11px] text-slate-400 sm:flex">
                        <span>Applied</span>
                        <span>Under Review</span>
                        <span>Shortlisted</span>
                        <span>Interview</span>
                        <span>Selected</span>
                      </div>
                    </div>
                    {a.remarks && (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span className="font-medium">Recruiter note:</span> {a.remarks}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <span>
                        Applied {formatDate(a.appliedAt)} · last update {timeAgo(a.updatedAt)}
                      </span>
                      <div className="flex gap-2">
                        {a.canWithdraw && (
                          <button className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50" onClick={() => setWithdrawing(a)}>
                            Withdraw
                          </button>
                        )}
                        <button className="btn-secondary btn-sm" onClick={() => toggle(a.id)} aria-expanded={open}>
                          History <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {open && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-8">
                      {a.coverNote && (
                        <div className="mb-4 text-sm">
                          <p className="font-medium text-slate-700">Your cover note</p>
                          <p className="mt-1 whitespace-pre-line text-slate-600">{a.coverNote}</p>
                        </div>
                      )}
                      <StatusTimeline history={a.history} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination pagination={data.pagination} onPageChange={(page) => setQuery({ page }, { resetPage: false })} />
        </>
      )}

      <ConfirmModal
        open={Boolean(withdrawing)}
        title="Withdraw application?"
        message={`Your application for "${withdrawing?.internship.title}" will be withdrawn. You will not be able to apply to this internship again.`}
        confirmLabel="Withdraw"
        danger
        busy={busy}
        onConfirm={withdraw}
        onClose={() => setWithdrawing(null)}
      />
    </Page>
  );
}
