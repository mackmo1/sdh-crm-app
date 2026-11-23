import type { ReactNode } from 'react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            S3
          </div>
          <div>
            <div className="brand-name">Step360D</div>
            <div className="brand-sub">CRM &amp; Admin</div>
          </div>
        </div>

        <div>
          <h2>Property operations, in one place.</h2>
          <p>
            Manage sale and rental listings from first draft through publication, track
            availability and keep a complete archived history.
          </p>
        </div>

        <p style={{ fontSize: 12, color: '#6d7688' }}>
          Authorised staff access only. All activity is recorded against your account.
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
