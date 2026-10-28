import { PIPELINE, TERMINAL_STATUSES } from '../constants.js';

/**
 * Recruiters/admins move applications forward through the pipeline
 * (skipping stages is allowed) or reject them at any non-terminal stage.
 */
export function canTransition(from, to) {
  if (from === to || TERMINAL_STATUSES.includes(from)) return false;
  if (to === 'Rejected') return true;
  const a = PIPELINE.indexOf(from);
  const b = PIPELINE.indexOf(to);
  return a !== -1 && b > a;
}

export function allowedNextStatuses(from) {
  return [...PIPELINE, 'Rejected'].filter((to) => canTransition(from, to));
}
