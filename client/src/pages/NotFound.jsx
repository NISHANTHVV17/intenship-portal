import { Link } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you are looking for does not exist or has moved.</p>
      <Link to={homeFor(user)} className="btn-primary mt-6">
        Back to {user ? 'dashboard' : 'home'}
      </Link>
    </div>
  );
}
