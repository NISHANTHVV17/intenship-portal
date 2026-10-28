import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';

/** Guards nested routes: requires login, and optionally one of `roles`. */
export function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

/** For login/register: signed-in users go to the page they wanted, or their dashboard. */
export function GuestOnly() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  return user ? <Navigate to={location.state?.from || homeFor(user)} replace /> : <Outlet />;
}
