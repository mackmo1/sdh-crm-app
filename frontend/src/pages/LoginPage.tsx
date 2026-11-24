import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../components/ui';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const notice = (location.state as { notice?: string } | null)?.notice;
  const from = (location.state as { from?: string } | null)?.from;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from ?? '/properties', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to sign in right now.');
    } finally {
      setBusy(false);
    }
  }

  if (!loading && user) {
    return <Navigate to="/properties" replace />;
  }

  return (
    <AuthLayout>
      <h1>Sign in</h1>
      <p className="muted">Use your Step360D staff account to continue.</p>

      {notice && <div className="alert alert-success" style={{ marginBottom: 16 }}>{notice}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}

        <Field label="Email address" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@step360d.com"
            required
            autoFocus
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>

        <Button variant="primary" className="btn-block" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="auth-links">
        <Link to="/forgot-password">Forgot your password?</Link>
      </div>
    </AuthLayout>
  );
}
