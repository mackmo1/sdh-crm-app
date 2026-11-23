import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../lib/format';
import { Button } from './ui';

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
          <span className="nav-label">Workspace</span>
          <NavLink
            to="/properties"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            Properties
          </NavLink>
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
