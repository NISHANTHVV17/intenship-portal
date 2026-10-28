import { Check, Circle, X } from 'lucide-react';
import { formatDateTime } from '../lib/format';
import { Badge } from './ui';

const APPLICATION_COLORS = {
  Applied: 'blue',
  'Under Review': 'amber',
  Shortlisted: 'purple',
  'Interview Scheduled': 'brand',
  Selected: 'green',
  Rejected: 'red',
  Withdrawn: 'slate',
};

export function StatusBadge({ status }) {
  return <Badge color={APPLICATION_COLORS[status] || 'slate'}>{status}</Badge>;
}

const INTERNSHIP_STATUS = {
  open: ['Live', 'green'],
  pending: ['Pending approval', 'amber'],
  rejected: ['Rejected', 'red'],
  closed: ['Closed', 'slate'],
};

export function InternshipStatusBadge({ status }) {
  const [label, color] = INTERNSHIP_STATUS[status] || [status, 'slate'];
  return <Badge color={color}>{label}</Badge>;
}

const APPROVAL = { pending: ['Pending', 'amber'], approved: ['Approved', 'green'], rejected: ['Rejected', 'red'] };

export function ApprovalBadge({ status }) {
  const [label, color] = APPROVAL[status] || [status, 'slate'];
  return <Badge color={color}>{label}</Badge>;
}

const PIPELINE = ['Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected'];

/** Compact horizontal progress through the pipeline. */
export function StatusProgress({ status }) {
  const failed = status === 'Rejected' || status === 'Withdrawn';
  const reached = failed ? -1 : PIPELINE.indexOf(status);
  return (
    <div className="flex items-center gap-1" aria-label={`Status: ${status}`}>
      {PIPELINE.map((step, i) => (
        <div
          key={step}
          title={step}
          className={`h-1.5 flex-1 rounded-full ${
            failed ? 'bg-slate-200' : i <= reached ? (status === 'Selected' ? 'bg-emerald-500' : 'bg-brand-500') : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

/** Vertical log of status changes with actor and timestamp. */
export function StatusTimeline({ history = [] }) {
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-6">
      {history.map((h, i) => {
        const last = i === history.length - 1;
        const Icon = h.toStatus === 'Rejected' || h.toStatus === 'Withdrawn' ? X : last ? Circle : Check;
        const tone =
          h.toStatus === 'Rejected'
            ? 'bg-rose-100 text-rose-600'
            : h.toStatus === 'Selected'
              ? 'bg-emerald-100 text-emerald-600'
              : last
                ? 'bg-brand-100 text-brand-600'
                : 'bg-slate-100 text-slate-500';
        return (
          <li key={h.id} className="relative">
            <span className={`absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white ${tone}`}>
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={h.toStatus} />
              <time className="text-xs text-slate-500">{formatDateTime(h.changedAt)}</time>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              by {h.actor?.name || 'system'}
              {h.actor?.role && <span className="capitalize"> ({h.actor.role})</span>}
            </p>
            {h.remarks && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-700">{h.remarks}</p>}
          </li>
        );
      })}
    </ol>
  );
}
