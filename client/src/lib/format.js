const parse = (s) => (s && s.length === 10 ? new Date(`${s}T00:00:00`) : new Date(s));

export const formatDate = (s) =>
  s ? parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (s) =>
  s
    ? parse(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

export function timeAgo(s) {
  const diff = (Date.now() - parse(s).getTime()) / 1000;
  if (diff < 60) return 'just now';
  const units = [
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ];
  for (const [secs, unit] of units) {
    if (diff >= secs) {
      const n = Math.floor(diff / secs);
      return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

/** Whole days until the deadline (end of that day); negative once passed. */
export function daysLeft(deadline) {
  const end = parse(deadline);
  end.setHours(23, 59, 59, 999);
  return Math.floor((end - Date.now()) / 86400000);
}

export function deadlineLabel(deadline) {
  const d = daysLeft(deadline);
  if (d < 0) return 'Deadline passed';
  if (d === 0) return 'Closes today';
  if (d === 1) return 'Closes tomorrow';
  return `${d} days left`;
}

export const formatStipend = (n) => (n > 0 ? `₹${Number(n).toLocaleString('en-IN')}/mo` : 'Unpaid');

export const formatDuration = (weeks) =>
  weeks % 4 === 0 && weeks >= 8 ? `${weeks / 4} months` : `${weeks} week${weeks === 1 ? '' : 's'}`;

export const MODE_LABELS = { onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid' };

export const todayInput = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
