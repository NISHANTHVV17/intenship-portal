import { Bell, BriefcaseBusiness, ChevronDown, LogOut, Menu, Settings, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { initials, timeAgo } from '../lib/format';

const NAV = {
  guest: [{ to: '/internships', label: 'Internships' }],
  student: [
    { to: '/student', label: 'Dashboard', end: true },
    { to: '/internships', label: 'Internships' },
    { to: '/student/applications', label: 'My Applications' },
    { to: '/student/bookmarks', label: 'Bookmarks' },
    { to: '/student/profile', label: 'Profile' },
  ],
  recruiter: [
    { to: '/recruiter', label: 'Dashboard', end: true },
    { to: '/recruiter/internships/new', label: 'Post Internship' },
    { to: '/recruiter/profile', label: 'Company Profile' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/internships', label: 'Postings' },
    { to: '/admin/users', label: 'Manage Users' },
    { to: '/admin/analytics', label: 'Analytics' },
  ],
};

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      api
        .get('/notifications/unread-count')
        .then((r) => alive && setCount(r.unreadCount))
        .catch(() => {});
    poll();
    const t = setInterval(poll, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const r = await api.get('/notifications', { limit: 6 }).catch(() => null);
      if (r) {
        setItems(r.items);
        setCount(r.unreadCount);
      }
    }
  };

  const openItem = async (n) => {
    setOpen(false);
    if (!n.isRead) {
      const r = await api.patch(`/notifications/${n.id}/read`).catch(() => null);
      if (r) setCount(r.unreadCount);
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    setCount(0);
    setItems((list) => list?.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Notifications${count ? ` (${count} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-16 z-50 rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-slate-900">Notifications</p>
            {count > 0 && (
              <button className="text-xs font-medium text-brand-600 hover:underline" onClick={markAll}>
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items === null && <li className="p-4 text-sm text-slate-500">Loading…</li>}
            {items?.length === 0 && <li className="p-6 text-center text-sm text-slate-500">You're all caught up.</li>}
            {items?.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${n.isRead ? '' : 'bg-brand-50/50'}`}>
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{n.title}</p>
                      <p className="line-clamp-2 text-xs text-slate-500">{n.message}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={close} className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-slate-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-slate-100" aria-expanded={open}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{initials(user.name)}</span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 md:block">{user.name}</span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <div className="border-b border-slate-100 px-4 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-1 text-xs capitalize text-brand-600">{user.role === 'admin' ? 'Placement cell' : user.role}</p>
          </div>
          <Link to="/account" onClick={close} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <Settings className="h-4 w-4" /> Account settings
          </Link>
          <button onClick={onLogout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const links = NAV[user?.role || 'guest'];

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to={homeFor(user)} className="flex items-center gap-2 font-bold text-slate-900">
            <span className="rounded-lg bg-brand-600 p-1.5 text-white">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            <span className="text-lg">InternHub</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <NotificationBell />
                <UserMenu user={user} onLogout={handleLogout} />
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">
                  Log in
                </Link>
                <Link to="/register" className="btn-primary">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
        {mobileOpen && (
          <nav className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={(s) => `block ${linkClass(s)}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} University Placement Cell · InternHub</p>
          <p>Connecting students with internship opportunities</p>
        </div>
      </footer>
    </div>
  );
}

/** Standard page width + padding wrapper. */
export function Page({ children, narrow = false }) {
  return <div className={`mx-auto px-4 py-8 sm:px-6 lg:px-8 ${narrow ? 'max-w-3xl' : 'max-w-7xl'}`}>{children}</div>;
}
