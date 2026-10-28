import { all, run } from '../db.js';
import { serializeHistory } from './serialize.js';

/** Appends an entry to an application's status log. `actor` is req.user. */
export function logStatus(applicationId, fromStatus, toStatus, actor, remarks = null) {
  run(
    `INSERT INTO status_history (application_id, from_status, to_status, remarks, actor_id, actor_name, actor_role)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    applicationId,
    fromStatus,
    toStatus,
    remarks,
    actor.id,
    actor.name,
    actor.role,
  );
}

export function historyFor(applicationIds) {
  if (!applicationIds.length) return {};
  const rows = all(
    `SELECT * FROM status_history WHERE application_id IN (${applicationIds.map(() => '?').join(',')})
     ORDER BY changed_at ASC, id ASC`,
    ...applicationIds,
  );
  const map = Object.fromEntries(applicationIds.map((id) => [id, []]));
  rows.forEach((r) => map[r.application_id].push(serializeHistory(r)));
  return map;
}
