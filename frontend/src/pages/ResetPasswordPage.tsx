import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Field, PasswordInput } from '../components/ui';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await api.auth.resetPassword(token, password);
      navigate('/login', {
        replace: true,
        state: { notice: 'Your password has been changed. Please sign in.' },
      });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'This reset link is invalid or has expired. Request a new one.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <h1>Invalid link</h1>
        <p className="muted">This password reset link is missing its token.</p>
        <Link to="/forgot-password">Request a new reset link</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Choose a new password</h1>
      <p className="muted">Your reset link can only be used once.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}

        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
        </Field>

        <Field label="Confirm new password" htmlFor="confirm">
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </Field>

        <Button variant="primary" className="btn-block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Set new password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
