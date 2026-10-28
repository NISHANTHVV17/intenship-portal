import { ArrowLeft, Download, FileDown, FileText, Mail, Phone, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Page } from '../../components/Layout';
import { InternshipStatusBadge, StatusBadge, StatusTimeline } from '../../components/status';
import { Alert, EmptyState, ErrorState, Modal, PageHeader, PageLoader, Pagination, Select, Spinner, Textarea } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, download } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { useAsync, useDebounced, useMeta, useQueryState } from '../../lib/hooks';

const FILTER_DEFAULTS = { page: '1', q: '', status: '', department: '', year: '', minCgpa: '', skill: '', sort: 'recent' };

export default function Applicants() {
  const { id } = useParams();
  const { user } = useAuth();
  const meta = useMeta();
  const toast = useToast();
  const [filters, setFilters] = useQueryState(FILTER_DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const [skill, setSkill] = useState(filters.skill);
  const debouncedSearch = useDebounced(search);
  const debouncedSkill = useDebounced(skill);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (debouncedSearch !== filters.q || debouncedSkill !== filters.skill) setFilters({ q: debouncedSearch, skill: debouncedSkill });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedSkill]);

  const key = JSON.stringify(filters);
  const { data, error, loading, reload } = useAsync(() => api.get(`/internships/${id}/applicants`, { ...filters, limit: 15 }), [id, key]);

  const exportCsv = () => {
    const { page: _page, ...rest } = filters;
    download(`/internships/${id}/applicants/export`, 'applicants.csv', rest).catch((e) => toast.error(e));
  };

  const downloadResume = (a) =>
    download(`/applications/${a.id}/resume`, `${a.student.name}_resume.pdf`).catch((e) => toast.error(e));

  if (error) return <Page><ErrorState error={error} onRetry={reload} /></Page>;
  if (!data) return <PageLoader />;

  const { internship, statusCounts } = data;
  const total = Object.values(statusCounts).reduce((s, n) => s + n, 0);

  return (
    <Page>
      <Link to={user.role === 'admin' ? '/admin/internships' : '/recruiter'} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader
        title={`Applicants · ${internship.title}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {internship.company} · deadline {formatDate(internship.deadline)} · {internship.openings} opening(s)
            <InternshipStatusBadge status={internship.status} />
          </span>
        }
        actions={
          <button className="btn-secondary" onClick={exportCsv} disabled={!total}>
            <FileDown className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[['', 'All', total], ...Object.entries(statusCounts).map(([s, n]) => [s, s, n])].map(([value, label, n]) => (
          <button
            key={label}
            onClick={() => setFilters({ status: value })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              filters.status === value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {label} <span className="opacity-70">({n})</span>
          </button>
        ))}
      </div>

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input className="input lg:col-span-2" placeholder="Search name, email or register no." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search applicants" />
        <select className="input" value={filters.department} onChange={(e) => setFilters({ department: e.target.value })} aria-label="Department">
          <option value="">All departments</option>
          {meta?.departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="input" value={filters.year} onChange={(e) => setFilters({ year: e.target.value })} aria-label="Year">
          <option value="">All years</option>
          {meta?.years.map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <input className="input" type="number" min="0" max="10" step="0.1" placeholder="Min CGPA" value={filters.minCgpa} onChange={(e) => setFilters({ minCgpa: e.target.value })} aria-label="Minimum CGPA" />
        <input className="input" placeholder="Has skill…" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill" />
        <div className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2 lg:col-span-6">
          <span>Sort by</span>
          <select className="input w-auto py-1.5" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
            <option value="recent">Most recent</option>
            <option value="cgpa">Highest CGPA</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={UsersRound} title={total ? 'No applicants match these filters' : 'No applicants yet'} message={total ? 'Try relaxing the filters.' : 'Applications will appear here as students apply.'} />
      ) : (
        <>
          <div className={`table-wrap ${loading ? 'opacity-60' : ''}`}>
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Department</th>
                  <th className="text-right">CGPA</th>
                  <th className="hidden md:table-cell">Skills</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button className="text-left font-medium text-slate-900 hover:text-brand-700" onClick={() => setSelected(a.id)}>
                        {a.student.name}
                      </button>
                      <p className="text-xs text-slate-500">{a.student.registerNumber}</p>
                    </td>
                    <td className="min-w-[10rem] text-slate-600">
                      {a.student.department}
                      <p className="text-xs text-slate-400">Year {a.student.year}</p>
                    </td>
                    <td className="text-right font-semibold">{a.student.cgpa ?? '—'}</td>
                    <td className="hidden max-w-xs md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {a.student.skills.slice(0, 4).map((s) => (
                          <span key={s} className={`rounded px-1.5 py-0.5 text-xs ${internship.requiredSkills.some((r) => r.toLowerCase() === s.toLowerCase()) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {s}
                          </span>
                        ))}
                        {a.student.skills.length > 4 && <span className="text-xs text-slate-400">+{a.student.skills.length - 4}</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{formatDate(a.appliedAt)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600" onClick={() => downloadResume(a)} disabled={!a.hasResume} title="Download resume" aria-label="Download resume">
                        <Download className="h-4 w-4" />
                      </button>
                      <button className="btn-secondary btn-sm ml-1" onClick={() => setSelected(a.id)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onPageChange={(page) => setFilters({ page }, { resetPage: false })} />
        </>
      )}

      <ApplicationModal
        applicationId={selected}
        requiredSkills={internship.requiredSkills}
        onClose={() => setSelected(null)}
        onChanged={reload}
        onDownload={downloadResume}
      />
    </Page>
  );
}

function ApplicationModal({ applicationId, requiredSkills, onClose, onChanged, onDownload }) {
  const toast = useToast();
  const [app, setApp] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!applicationId) return;
    setApp(null);
    setLoadError(null);
    setError(null);
    setRemarks('');
    api
      .get(`/applications/${applicationId}`)
      .then((a) => {
        setApp(a);
        setStatus(a.nextStatuses[0] || '');
      })
      .catch(setLoadError);
  }, [applicationId]);

  const update = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch(`/applications/${app.id}/status`, { status, remarks: remarks.trim() || undefined });
      setApp(updated);
      setStatus(updated.nextStatuses[0] || '');
      setRemarks('');
      toast.success(`Status updated to "${updated.status}" - the student has been notified`);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const s = app?.student;
  return (
    <Modal open={Boolean(applicationId)} onClose={onClose} title="Application details" size="lg">
      {loadError ? (
        <Alert>{loadError.message}</Alert>
      ) : !app ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{s.name}</h3>
              <p className="text-sm text-slate-500">
                {s.registerNumber} · {s.department} · Year {s.year}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                  <Mail className="h-4 w-4" /> {s.email}
                </a>
                {s.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-4 w-4" /> {s.phone}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-slate-400">CGPA</p>
              <p className="text-2xl font-bold text-slate-900">{s.cgpa ?? '—'}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {s.skills.length ? (
                s.skills.map((k) => (
                  <span key={k} className={`rounded-md px-2 py-0.5 text-xs ${requiredSkills.some((r) => r.toLowerCase() === k.toLowerCase()) ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                    {k}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No skills listed</span>
              )}
            </div>
          </div>

          {app.hasResume && (
            <button className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50" onClick={() => onDownload(app)}>
              <FileText className="h-8 w-8 text-rose-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{app.resumeName || 'Resume.pdf'}</p>
                <p className="text-xs text-slate-500">Submitted {formatDateTime(app.appliedAt)}</p>
              </div>
              <Download className="h-4 w-4 text-slate-400" />
            </button>
          )}

          {app.coverNote && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Cover note</p>
              <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{app.coverNote}</p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">Status history</p>
              <StatusTimeline history={app.history} />
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">Update status</p>
              {app.nextStatuses.length === 0 ? (
                <Alert type="info">
                  This application is <strong>{app.status}</strong> - no further changes are possible.
                </Alert>
              ) : (
                <form onSubmit={update} className="space-y-3">
                  {error && <Alert>{error}</Alert>}
                  <Select label="Move to" value={status} onChange={(e) => setStatus(e.target.value)} options={app.nextStatuses} />
                  <Textarea
                    label="Remarks (shared with the student)"
                    rows={3}
                    maxLength={1000}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={status === 'Interview Scheduled' ? 'e.g. Interview on 12 Nov, 10 AM via Google Meet' : 'Optional'}
                  />
                  <button className={status === 'Rejected' ? 'btn-danger w-full' : 'btn-primary w-full'} disabled={busy || !status}>
                    {busy && <Spinner className="h-4 w-4 text-white" />} Update to "{status}"
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
