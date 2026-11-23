import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Field, TextInput } from '../components/ui';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ delivered: boolean; transport: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api.auth.forgotPassword(email.trim());
      setSent(result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to send a reset link right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Reset your password</h1>
      <p className="muted">
        Enter the email address registered to your account and we will send a reset link.
      </p>

      {sent ? (
        <>
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            If an active account exists for <strong>{email}</strong>, a reset link has been issued.
          </div>

          {!sent.delivered && (
            <div className="alert alert-warn" style={{ marginBottom: 16 }}>
              Email delivery is not configured on this server, so nothing was sent. In
              development the reset link is written to the API log.
            </div>
          )}

          <Link to="/login">Back to sign in</Link>
        </>
      ) : (
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

          <Button variant="primary" className="btn-block" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}

      {!sent && (
        <div className="auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
      )}
    </AuthLayout>
  );
}
