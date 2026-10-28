import { BookmarkX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InternshipCard } from '../../components/InternshipCard';
import { Page } from '../../components/Layout';
import { EmptyState, ErrorState, PageHeader, PageLoader, Pagination } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useAsync, useQueryState } from '../../lib/hooks';

export default function Bookmarks() {
  const [query, setQuery] = useQueryState({ page: '1' });
  const { data, error, loading, reload } = useAsync(() => api.get('/students/me/bookmarks', { page: query.page, limit: 12 }), [query.page]);
  const toast = useToast();

  const remove = async (i) => {
    try {
      await api.del(`/internships/${i.id}/bookmark`);
      toast.success('Bookmark removed');
      reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Page>
      <PageHeader title="Bookmarks" subtitle="Internships you saved for later" />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <PageLoader />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={BookmarkX}
          title="No bookmarks yet"
          message="Tap the bookmark icon on any internship to save it here."
          action={<Link to="/internships" className="btn-primary">Browse internships</Link>}
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((i) => (
              <div key={i.id} className={i.acceptingApplications ? '' : 'opacity-70'}>
                <InternshipCard internship={i} showBookmark onToggleBookmark={remove} />
              </div>
            ))}
          </div>
          <Pagination pagination={data.pagination} onPageChange={(page) => setQuery({ page })} />
        </>
      )}
    </Page>
  );
}
