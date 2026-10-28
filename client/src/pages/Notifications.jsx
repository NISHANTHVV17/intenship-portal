import { BellOff, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/Layout';
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { formatDateTime, timeAgo } from '../lib/format';
import { useAsync, useQueryState } from '../lib/hooks';

export default function Notifications() {
  const [query, setQuery] = useQueryState({ page: '1', unreadOnly: '' });
  const { data, error, loading, reload, setData } = useAsync(
    () => api.get('/notifications', { page: query.page, limit: 15, unreadOnly: query.unreadOnly }),
    [query.page, query.unreadOnly],
  );
  const navigate = useNavigate();
  const toast = useToast();

  const open = async (n) => {
    if (!n.isRead) {
      await api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)), unreadCount: d.unreadCount - 1 }));
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all');
      toast.success('All notifications marked as read');
      reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Page narrow>
      <PageHeader
        title="Notifications"
        subtitle={data ? `${data.unreadCount} unread` : undefined}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setQuery({ unreadOnly: query.unreadOnly ? '' : 'true' })}>
              {query.unreadOnly ? 'Show all' : 'Unread only'}
            </button>
            <button className="btn-secondary" onClick={markAll} disabled={!data?.unreadCount}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          </>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <PageLoader />
      ) : data.items.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications" message="Updates about your applications and postings will show up here." />
      ) : (
        <>
          <ul className="card divide-y divide-slate-100">
            {data.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => open(n)} className={`flex w-full gap-3 px-5 py-4 text-left hover:bg-slate-50 ${n.isRead ? '' : 'bg-brand-50/40'}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-brand-500'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-slate-900">{n.title}</p>
                      <time className="text-xs text-slate-400" title={formatDateTime(n.createdAt)}>
                        {timeAgo(n.createdAt)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <Pagination pagination={data.pagination} onPageChange={(page) => setQuery({ page })} />
        </>
      )}
    </Page>
  );
}
