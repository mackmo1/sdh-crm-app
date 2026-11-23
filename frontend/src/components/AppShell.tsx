import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../lib/format';
import {
  IconBell,
  IconBuilding,
  IconCalendar,
  IconChart,
  IconChevron,
  IconContact,
  IconDashboard,
  IconData,
  IconHome,
  IconPipeline,
  IconSearch,
  IconStaff,
  IconTask,
  IconUsers,
} from './icons';

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/properties', label: 'Properties', icon: IconHome },
  { to: '/projects', label: 'Projects', icon: IconBuilding },
  { to: '/leads', label: 'Leads', icon: IconUsers },
  { to: '/pipeline', label: 'Pipeline', icon: IconPipeline },
  { to: '/contacts', label: 'Contacts', icon: IconContact },
  { to: '/follow-ups', label: 'Follow-ups', icon: IconTask },
  { to: '/site-visits', label: 'Site visits', icon: IconCalendar },
  { to: '/reports', label: 'Reports', icon: IconChart },
  { to: '/data', label: 'Import / export', icon: IconData, adminOnly: true },
  { to: '/staff', label: 'Staff', icon: IconStaff, adminOnly: true },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [overdue, setOverdue] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.tasks
      .list({ view: 'overdue', pageSize: 1 })
      .then((result) => setOverdue(result.meta.total))
      .catch(() => setOverdue(0));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/leads?search=${encodeURIComponent(term)}` : '/leads');
  }

  const items = NAV.filter((item) => !item.adminOnly || user?.role === 'admin');

  return (
    <div className="shell">
      <header className="app-header">
        <div className="header-inner">
          <NavLink to="/" className="header-brand">
            <span className="brand-mark" aria-hidden="true">
              S3
            </span>
            <span>
              <span className="brand-name">Step360D</span>
              <span className="brand-sub">CRM &amp; Admin</span>
            </span>
          </NavLink>

          <form className="header-search" onSubmit={submitSearch} role="search">
            <span className="search-icon">
              <IconSearch size={15} />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search leads by name, phone, email or location"
              aria-label="Search leads"
            />
          </form>

          <div className="header-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => navigate('/follow-ups?view=overdue')}
              title={overdue > 0 ? `${overdue} overdue follow-ups` : 'No overdue follow-ups'}
              aria-label="Overdue follow-ups"
            >
              <IconBell size={17} />
              {overdue > 0 && <span className="chip" style={{ background: '#FFB700', borderColor: '#FFB700', color: '#1A1A1A', fontWeight: 700 }}>{overdue}</span>}
            </button>

            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="header-user"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="avatar" aria-hidden="true">
                  {user ? initials(user.name) : '·'}
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>{user?.name ?? 'Account'}</span>
                <IconChevron size={14} />
              </button>

              {menuOpen && (
                <div className="user-pop" role="menu">
                  <div className="user-pop-head">
                    <div className="user-pop-name">{user?.name}</div>
                    <div className="user-pop-meta">{user?.email}</div>
                    <div className="user-pop-meta">
                      {user?.role === 'admin' ? 'Administrator' : 'Data user'} · {user?.module}
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <button type="button" onClick={() => { setMenuOpen(false); navigate('/staff'); }}>
                      Manage staff
                    </button>
                  )}
                  <button type="button" onClick={() => { setMenuOpen(false); navigate('/reports'); }}>
                    Reports
                  </button>
                  <button type="button" onClick={() => void handleSignOut()}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="app-nav" aria-label="Main">
        <div className="nav-inner">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <main className="main">
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
