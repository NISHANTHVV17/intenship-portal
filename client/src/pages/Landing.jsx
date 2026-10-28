import { ArrowRight, BarChart3, BellRing, Building2, FileCheck2, GraduationCap, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InternshipCard } from '../components/InternshipCard';
import { Spinner } from '../components/ui';
import { homeFor, useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';

const FEATURES = [
  { icon: Search, title: 'Smart discovery', text: 'Filter by domain, location, remote options, duration, stipend and deadline.' },
  { icon: FileCheck2, title: 'One-click apply', text: 'Apply with your saved resume and an optional cover note. Eligibility is checked for you.' },
  { icon: BellRing, title: 'Live updates', text: 'Get notified when your application moves forward or a matching internship is posted.' },
  { icon: ShieldCheck, title: 'Verified recruiters', text: 'Every recruiter and posting is approved by the placement cell before going live.' },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const latest = useAsync(() => api.get('/internships', { limit: 3, sort: 'newest' }), []);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-white">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm ring-1 ring-white/20">
              <GraduationCap className="h-4 w-4" /> University Placement Cell
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Find the internship that launches your career.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-brand-100">
              InternHub connects students, recruiters and the placement cell in one place - from discovering opportunities to
              tracking every application to an offer.
            </p>
            <form
              className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/internships${q ? `?q=${encodeURIComponent(q)}` : ''}`);
              }}
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search roles, companies or skills"
                  className="w-full rounded-lg border-0 py-3 pl-10 pr-3 text-slate-900 shadow-lg focus:ring-2 focus:ring-white"
                  aria-label="Search internships"
                />
              </div>
              <button className="btn rounded-lg bg-slate-900 px-6 py-3 text-white hover:bg-slate-800">Search</button>
            </form>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              {user ? (
                <Link to={homeFor(user)} className="inline-flex items-center gap-1 font-semibold text-white hover:underline">
                  Go to your dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="inline-flex items-center gap-1 font-semibold text-white hover:underline">
                    I'm a student <ArrowRight className="h-4 w-4" />
                  </Link>
                  <span className="text-brand-200">·</span>
                  <Link to="/register?role=recruiter" className="inline-flex items-center gap-1 font-semibold text-white hover:underline">
                    I'm hiring <Building2 className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-6">
              <div className="mb-4 inline-flex rounded-lg bg-brand-50 p-2.5 text-brand-600">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Latest opportunities</h2>
            <p className="text-sm text-slate-500">Freshly approved by the placement cell</p>
          </div>
          <Link to="/internships" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            Browse all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {latest.loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : latest.data?.items.length ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {latest.data.items.map((i) => (
              <InternshipCard key={i.id} internship={i} />
            ))}
          </div>
        ) : (
          <p className="card p-8 text-center text-sm text-slate-500">New internships will appear here soon.</p>
        )}
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            { icon: GraduationCap, title: 'Students', text: 'Build your profile once, apply in one click and track every status change.' },
            { icon: Building2, title: 'Recruiters', text: 'Post internships, filter applicants by CGPA, skills and department, and manage your pipeline.' },
            { icon: BarChart3, title: 'Placement cell', text: 'Approve recruiters and postings, and see participation and selection analytics.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <Icon className="h-8 w-8 shrink-0 text-brand-600" />
              <div>
                <h3 className="font-semibold text-slate-900">For {title.toLowerCase()}</h3>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
