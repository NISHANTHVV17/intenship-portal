import { Bookmark, BookmarkCheck, Briefcase, CalendarClock, Clock, IndianRupee, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { daysLeft, deadlineLabel, formatDuration, formatStipend, MODE_LABELS } from '../lib/format';
import { StatusBadge } from './status';
import { Badge } from './ui';

export function InternshipCard({ internship: i, onToggleBookmark, showBookmark = false }) {
  const left = daysLeft(i.deadline);
  return (
    <article className="card group relative flex h-full flex-col p-5 transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-600">{i.company}</p>
          <h3 className="mt-0.5 text-lg font-semibold leading-snug text-slate-900">
            <Link to={`/internships/${i.id}`} className="after:absolute after:inset-0 focus:outline-none">
              <span className="relative">{i.title}</span>
            </Link>
          </h3>
        </div>
        {showBookmark && (
          <button
            type="button"
            onClick={() => onToggleBookmark?.(i)}
            className="relative z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
            aria-label={i.bookmarked ? 'Remove bookmark' : 'Bookmark internship'}
            aria-pressed={Boolean(i.bookmarked)}
          >
            {i.bookmarked ? <BookmarkCheck className="h-5 w-5 text-brand-600" /> : <Bookmark className="h-5 w-5" />}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge color="brand">{i.domain}</Badge>
        <Badge color={i.mode === 'remote' ? 'green' : i.mode === 'hybrid' ? 'purple' : 'slate'}>{MODE_LABELS[i.mode]}</Badge>
        {i.myApplicationStatus && <StatusBadge status={i.myApplicationStatus} />}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-slate-600">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">{i.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 shrink-0 text-slate-400" />
          <span>{formatDuration(i.durationWeeks)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <IndianRupee className="h-4 w-4 shrink-0 text-slate-400" />
          <span>{formatStipend(i.stipend)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Briefcase className="h-4 w-4 shrink-0 text-slate-400" />
          <span>
            {i.openings} opening{i.openings > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {i.requiredSkills?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {i.requiredSkills.slice(0, 5).map((s) => (
            <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {s}
            </span>
          ))}
          {i.requiredSkills.length > 5 && <span className="text-xs text-slate-400">+{i.requiredSkills.length - 5}</span>}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-4 text-xs">
        <span className={`flex items-center gap-1 font-medium ${left <= 3 ? 'text-rose-600' : 'text-slate-500'}`}>
          <CalendarClock className="h-4 w-4" />
          {deadlineLabel(i.deadline)}
        </span>
        {i.applicantCount !== undefined && <span className="text-slate-400">{i.applicantCount} applied</span>}
      </div>
    </article>
  );
}
