import { z } from 'zod';
import { all, one } from '../db.js';

export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

/**
 * Runs `SELECT <select> FROM <from> [WHERE ...] ORDER BY <orderBy>` with LIMIT/OFFSET
 * and a matching COUNT(*) query. Returns `{ items, pagination }`.
 */
export function paginate({ select, from, where = [], params = [], orderBy, page, limit, selectParams = [] }) {
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = one(`SELECT COUNT(*) AS n FROM ${from} ${whereSql}`, ...params).n;
  const items = all(
    `SELECT ${select} FROM ${from} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    ...selectParams,
    ...params,
    limit,
    (page - 1) * limit,
  );
  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Escapes LIKE wildcards; use with `LIKE ? ESCAPE '\\'`. */
export const likeTerm = (s) => `%${String(s).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
