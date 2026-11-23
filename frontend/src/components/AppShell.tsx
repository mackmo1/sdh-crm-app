import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../lib/format';
import { Button } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/properties', label: 'Properties' },
  { to: '/leads', label: 'Leads' },
  { to: '/contacts', label: 'Contacts' },
  { to: '/follow-ups', label: 'Follow-ups' },
  { to: '/site-visits', label: 'Site visits' },
  { to: '/reports', label: 'Reports' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            S3
          </div>
          <div>
            <div className="brand-name">Step360D</div>
            <div className="brand-sub">CRM &amp; Admin</div>
          </div>
        </div>

        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/staff"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Staff
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="user-chip">
              <div className="avatar" aria-hidden="true">
                {initials(user.name)}
              </div>
              <div className="user-meta">
                <div className="user-name">{user.name}</div>
                <div className="user-role">
                  {user.role === 'admin' ? 'Administrator' : 'Data user'} · {user.module}
                </div>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="btn-block"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{ color: '#9aa4bb' }}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </aside>

      <main className="main">
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
