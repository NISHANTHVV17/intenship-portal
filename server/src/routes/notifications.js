import { Router } from 'express';
import { z } from 'zod';
import { one, run } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../schemas.js';
import { notFound } from '../utils/http.js';
import { paginate, paginationShape } from '../utils/pagination.js';

const router = Router();
router.use(authenticate);

const listQuery = z.object({ ...paginationShape, unreadOnly: z.enum(['true', 'false']).optional() });

const serialize = (n) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  message: n.message,
  link: n.link,
  isRead: Boolean(n.is_read),
  createdAt: n.created_at,
});

const unreadCount = (userId) =>
  one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', userId).n;

router.get('/', validate(listQuery, 'query'), (req, res) => {
  const { page, limit, unreadOnly } = req.valid.query;
  const where = ['user_id = ?'];
  if (unreadOnly === 'true') where.push('is_read = 0');
  const result = paginate({
    select: '*',
    from: 'notifications',
    where,
    params: [req.user.id],
    orderBy: 'created_at DESC, id DESC',
    page,
    limit,
  });
  res.json({ items: result.items.map(serialize), pagination: result.pagination, unreadCount: unreadCount(req.user.id) });
});

router.get('/unread-count', (req, res) => res.json({ unreadCount: unreadCount(req.user.id) }));

router.patch('/:id/read', validate(idParam, 'params'), (req, res) => {
  const { changes } = run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', req.valid.params.id, req.user.id);
  if (!changes) throw notFound('Notification not found');
  res.json({ unreadCount: unreadCount(req.user.id) });
});

router.post('/read-all', (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', req.user.id);
  res.json({ unreadCount: 0 });
});

export default router;
