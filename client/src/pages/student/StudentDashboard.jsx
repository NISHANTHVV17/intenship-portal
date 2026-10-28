import { ArrowRight, Award, Bell, Bookmark, CalendarClock, FileText, Send, Sparkles, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InternshipCard } from '../../components/InternshipCard';
import { Page } from '../../components/Layout';
import { StatusBadge, StatusProgress } from '../../components/status';
import { Alert, EmptyState, ErrorState, PageHeader, PageLoader, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { deadlineLabel, formatDate, timeAgo } from '../../lib/format';
import { useAsync } from '../../lib/hooks';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.get('/students/me/dashboard'), []);

  if (loading && !data) return <PageLoader />;
  if (error) return <Page><ErrorState error={error} onRetry={reload} /></Page>;

  const { stats } = data;
  return (
    <Page>
      <PageHeader
        title={`Hi, ${user.name.split(' ')[0]} 👋`}
        subtitle="Here's what's happening with your internship search"
        actions={
          <Link to="/internships" className="btn-primary">
            Browse internships <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {!data.profileComplete && (
        <Alert type={data.hasResume ? 'info' : 'warning'} className="mb-6">
          {data.hasResume
            ? 'Add your CGPA and skills to get better recommendations.'
            : 'Upload your resume to start applying - it is attached automatically to every application.'}{' '}
          <Link to="/student/profile" className="font-semibold underline">
            Complete profile
          </Link>
        </Alert>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Applications" value={stats.totalApplications} icon={Send} />
        <StatCard label="In progress" value={stats.active} icon={FileText} tone="blue" />
        <StatCard label="Shortlisted" value={stats.shortlisted} icon={Star} tone="amber" />
        <StatCard label="Selected" value={stats.selected} icon={Award} tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent applications</h2>
            <Link to="/student/applications" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {data.recentApplications.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">You haven't applied anywhere yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentApplications.map((a) => (
                <li key={a.id} className="py-3">
                  <Link to={`/student/applications?highlight=${a.id}`} className="block rounded-lg hover:bg-slate-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{a.internship.title}</p>
                        <p className="text-xs text-slate-500">
                          {a.internship.company} · updated {timeAgo(a.updatedAt)}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-2">
                      <StatusProgress status={a.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
              <CalendarClock className="h-4 w-4 text-rose-500" /> Bookmarked deadlines
            </h2>
            {data.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-slate-500">
                Bookmark internships to keep track of their deadlines.{' '}
                <Link to="/student/bookmarks" className="text-brand-600 hover:underline">
                  Bookmarks
                </Link>
              </p>
            ) : (
              <ul className="space-y-3">
                {data.upcomingDeadlines.map((i) => (
                  <li key={i.id}>
                    <Link to={`/internships/${i.id}`} className="block hover:text-brand-700">
                      <p className="truncate text-sm font-medium">{i.title}</p>
                      <p className="text-xs text-slate-500">
                        {i.company} · {formatDate(i.deadline)} · <span className="text-rose-600">{deadlineLabel(i.deadline)}</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card grid grid-cols-2 divide-x divide-slate-100 p-0 text-center">
            <Link to="/student/bookmarks" className="p-4 hover:bg-slate-50">
              <Bookmark className="mx-auto h-5 w-5 text-brand-600" />
              <p className="mt-1 text-xl font-bold">{stats.bookmarks}</p>
              <p className="text-xs text-slate-500">Bookmarks</p>
            </Link>
            <Link to="/notifications" className="p-4 hover:bg-slate-50">
              <Bell className="mx-auto h-5 w-5 text-brand-600" />
              <p className="mt-1 text-xl font-bold">{stats.unreadNotifications}</p>
              <p className="text-xs text-slate-500">Unread alerts</p>
            </Link>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Sparkles className="h-5 w-5 text-amber-500" /> Recommended for you
        </h2>
        {data.recommended.length === 0 ? (
          <EmptyState
            title="No recommendations right now"
            message="We match open internships to your department, year, CGPA and skills. Check back soon or browse all internships."
            action={<Link to="/internships" className="btn-secondary">Browse internships</Link>}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.recommended.map((i) => (
              <InternshipCard key={i.id} internship={i} />
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
