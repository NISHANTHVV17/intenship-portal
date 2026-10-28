import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { InternshipCard } from '../components/InternshipCard';
import { Page } from '../components/Layout';
import { EmptyState, ErrorState, Input, PageHeader, PageLoader, Pagination, Select } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { MODE_LABELS } from '../lib/format';
import { useAsync, useDebounced, useMeta, useQueryState } from '../lib/hooks';

const DEFAULTS = {
  page: '1',
  q: '',
  domain: '',
  mode: '',
  location: '',
  skill: '',
  minDuration: '',
  maxDuration: '',
  minStipend: '',
  maxStipend: '',
  deadlineBefore: '',
  eligibleOnly: '',
  sort: 'newest',
};

const DURATIONS = [
  { value: '', label: 'Any duration' },
  { value: '0-4', label: 'Up to 1 month' },
  { value: '5-12', label: '1 – 3 months' },
  { value: '13-26', label: '3 – 6 months' },
  { value: '27-52', label: '6+ months' },
];

export default function Internships() {
  const { user } = useAuth();
  const meta = useMeta();
  const toast = useToast();
  const [filters, setFilters] = useQueryState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const [location, setLocation] = useState(filters.location);
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounced(search);
  const debouncedLocation = useDebounced(location);
  const isStudent = user?.role === 'student';

  useEffect(() => {
    if (debouncedSearch !== filters.q || debouncedLocation !== filters.location) {
      setFilters({ q: debouncedSearch, location: debouncedLocation });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedLocation]);

  const key = JSON.stringify(filters);
  const { data, error, loading, reload, setData } = useAsync(() => api.get('/internships', { ...filters, limit: 12 }), [key]);

  const durationValue = filters.minDuration || filters.maxDuration ? `${filters.minDuration || 0}-${filters.maxDuration || 52}` : '';
  const activeCount = ['domain', 'mode', 'skill', 'minStipend', 'maxStipend', 'deadlineBefore', 'eligibleOnly', 'location'].filter((k) => filters[k]).length + (durationValue ? 1 : 0);

  const toggleBookmark = async (i) => {
    const next = !i.bookmarked;
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === i.id ? { ...x, bookmarked: next } : x)) }));
    try {
      if (next) await api.post(`/internships/${i.id}/bookmark`);
      else await api.del(`/internships/${i.id}/bookmark`);
      toast.success(next ? 'Bookmarked' : 'Bookmark removed');
    } catch (err) {
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === i.id ? { ...x, bookmarked: !next } : x)) }));
      toast.error(err);
    }
  };

  const clearAll = () => {
    setSearch('');
    setLocation('');
    setFilters(Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, ''])));
  };

  const filterPanel = (
    <div className="space-y-4">
      <Select label="Domain" value={filters.domain} onChange={(e) => setFilters({ domain: e.target.value })} placeholder="All domains" options={meta?.domains || []} />
      <Select
        label="Work mode"
        value={filters.mode}
        onChange={(e) => setFilters({ mode: e.target.value })}
        placeholder="Any mode"
        options={(meta?.modes || []).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
      />
      <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, e.g. Chennai" />
      <Select
        label="Duration"
        value={durationValue}
        onChange={(e) => {
          const [min, max] = e.target.value ? e.target.value.split('-') : ['', ''];
          setFilters({ minDuration: min === '0' ? '' : min, maxDuration: max === '52' ? '' : max });
        }}
        options={DURATIONS}
      />
      <div>
        <span className="label">Stipend (₹/month)</span>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" min="0" step="1000" placeholder="Min" value={filters.minStipend} onChange={(e) => setFilters({ minStipend: e.target.value })} aria-label="Minimum stipend" />
          <input className="input" type="number" min="0" step="1000" placeholder="Max" value={filters.maxStipend} onChange={(e) => setFilters({ maxStipend: e.target.value })} aria-label="Maximum stipend" />
        </div>
      </div>
      <Input label="Apply by (deadline on or before)" type="date" value={filters.deadlineBefore} onChange={(e) => setFilters({ deadlineBefore: e.target.value })} />
      <Input label="Skill" value={filters.skill} onChange={(e) => setFilters({ skill: e.target.value })} placeholder="e.g. React" />
      {isStudent && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
            checked={filters.eligibleOnly === 'true'}
            onChange={(e) => setFilters({ eligibleOnly: e.target.checked ? 'true' : '' })}
          />
          Only show internships I'm eligible for
        </label>
      )}
      {activeCount > 0 && (
        <button className="btn-ghost w-full" onClick={clearAll}>
          <X className="h-4 w-4" /> Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <Page>
      <PageHeader title="Browse internships" subtitle="All postings are verified by the placement cell" />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1 py-2.5"
          placeholder="Search by title, company, skill or keyword"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search internships"
        />
        <div className="flex gap-2">
          <select className="input py-2.5 sm:w-48" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })} aria-label="Sort by">
            <option value="newest">Newest first</option>
            <option value="deadline">Deadline soonest</option>
            <option value="stipend">Highest stipend</option>
            <option value="duration">Shortest duration</option>
          </select>
          <button className="btn-secondary lg:hidden" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount ? ` (${activeCount})` : ''}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} card h-fit p-5 lg:sticky lg:top-24 lg:block`}>{filterPanel}</aside>
        <section>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading && !data ? (
            <PageLoader />
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No internships match your filters"
              message="Try widening your search or clearing a few filters."
              action={activeCount || filters.q ? <button className="btn-secondary" onClick={clearAll}>Clear filters</button> : null}
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-500">
                {data.pagination.total} internship{data.pagination.total === 1 ? '' : 's'} found
              </p>
              <div className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
                {data.items.map((i) => (
                  <InternshipCard key={i.id} internship={i} showBookmark={isStudent} onToggleBookmark={toggleBookmark} />
                ))}
              </div>
              <Pagination pagination={data.pagination} onPageChange={(page) => { setFilters({ page }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </>
          )}
        </section>
      </div>
    </Page>
  );
}
