import { Briefcase, FileText, Percent, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Page } from '../../components/Layout';
import { InternshipStatusBadge } from '../../components/status';
import { BarList, ErrorState, PageHeader, PageLoader, StatCard } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/hooks';
import { ReportButtons } from './AdminDashboard';

const STATUS_COLORS = {
  Applied: 'bg-sky-500',
  'Under Review': 'bg-amber-500',
  Shortlisted: 'bg-violet-500',
  'Interview Scheduled': 'bg-brand-500',
  Selected: 'bg-emerald-500',
  Rejected: 'bg-rose-500',
  Withdrawn: 'bg-slate-400',
};

const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

export default function Analytics() {
  const { data, error, loading, reload } = useAsync(() => api.get('/admin/analytics'), []);
  if (loading && !data) return <PageLoader />;
  if (error) return <Page><ErrorState error={error} onRetry={reload} /></Page>;

  const { totals: t, statusBreakdown, perInternship, departments, domains, monthly } = data;
  const statusTotal = Object.values(statusBreakdown).reduce((s, n) => s + n, 0);
  const monthlyMax = Math.max(1, ...monthly.map((m) => m.applications));

  return (
    <Page>
      <PageHeader title="Analytics" subtitle="Internship activity, selection outcomes and department participation" />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Internships" value={t.internships} icon={Briefcase} hint={`${t.liveInternships} live · ${t.totalOpenings} openings`} />
        <StatCard label="Applications" value={t.applications} icon={FileText} tone="blue" hint="excluding withdrawn" />
        <StatCard label="Selected" value={t.selected} icon={Trophy} tone="green" />
        <StatCard label="Selection rate" value={`${t.selectionRate}%`} icon={Percent} tone="amber" hint="selected ÷ applications" />
        <StatCard label="Offer rate" value={`${t.offerRate}%`} icon={Users} tone="red" hint="selected ÷ decided" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Application pipeline</h2>
          {statusTotal === 0 ? (
            <p className="text-sm text-slate-500">No applications yet.</p>
          ) : (
            <>
              <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Application status distribution">
                {Object.entries(statusBreakdown)
                  .filter(([, n]) => n > 0)
                  .map(([s, n]) => (
                    <div key={s} className={STATUS_COLORS[s]} style={{ width: `${(n / statusTotal) * 100}%` }} title={`${s}: ${n}`} />
                  ))}
              </div>
              <BarList items={Object.entries(statusBreakdown).map(([s, n]) => ({ label: s, value: n, color: STATUS_COLORS[s] }))} />
            </>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Applications over the last 6 months</h2>
          {monthly.length === 0 ? (
            <p className="text-sm text-slate-500">No recent applications.</p>
          ) : (
            <div className="flex h-48 items-end gap-3">
              {monthly.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium text-slate-700">{m.applications}</span>
                  <div className="flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-t-md bg-brand-200" style={{ height: `${(m.applications / monthlyMax) * 140 + 4}px` }}>
                    <div className="bg-emerald-500" style={{ height: `${m.applications ? (m.selected / m.applications) * 100 : 0}%` }} title={`${m.selected} selected`} />
                  </div>
                  <span className="text-xs text-slate-500">{monthLabel(m.month)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand-200" /> Applications</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Selected</span>
          </p>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Department-wise participation</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="text-right">Students</th>
                  <th className="text-right">Applied</th>
                  <th className="min-w-[10rem]">Participation</th>
                  <th className="text-right">Applications</th>
                  <th className="text-right">Selected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d) => (
                  <tr key={d.department}>
                    <td className="font-medium text-slate-800">{d.department}</td>
                    <td className="text-right">{d.students}</td>
                    <td className="text-right">{d.participants}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${d.participationRate}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs text-slate-600">{d.participationRate}%</span>
                      </div>
                    </td>
                    <td className="text-right">{d.applications}</td>
                    <td className="text-right font-semibold text-emerald-600">{d.selected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Applications per internship (top 15)</h2>
          {perInternship.length === 0 ? (
            <p className="text-sm text-slate-500">No published internships yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Internship</th>
                    <th>Status</th>
                    <th className="text-right">Openings</th>
                    <th className="text-right">Applications</th>
                    <th className="text-right">Shortlisted+</th>
                    <th className="text-right">Selected</th>
                    <th className="text-right">Selection %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perInternship.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <Link to={`/admin/internships/${i.id}/applicants`} className="font-medium text-slate-800 hover:text-brand-700">
                          {i.title}
                        </Link>
                        <p className="text-xs text-slate-500">{i.company}</p>
                      </td>
                      <td><InternshipStatusBadge status={i.status} /></td>
                      <td className="text-right">{i.openings}</td>
                      <td className="text-right font-semibold">{i.applications}</td>
                      <td className="text-right">{i.shortlisted}</td>
                      <td className="text-right text-emerald-600">{i.selected}</td>
                      <td className="text-right">{i.selectionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Demand by domain</h2>
          {domains.length === 0 ? (
            <p className="text-sm text-slate-500">No data yet.</p>
          ) : (
            <BarList items={domains.map((d) => ({ label: d.domain, value: d.applications, extra: `· ${d.internships} posting${d.internships > 1 ? 's' : ''}` }))} />
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Export reports</h2>
          <p className="mb-4 text-sm text-slate-500">CSV files for further analysis.</p>
          <ReportButtons />
        </section>
      </div>
    </Page>
  );
}
