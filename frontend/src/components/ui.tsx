import { useEffect, useId, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { PaginationMeta } from '../api/types';
import type { BadgeTone } from '../lib/status';
import { IconEye, IconEyeOff } from './icons';

/* ------------------------------------------------------------------ field */

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={className ? `field ${className}` : 'field'}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function TextInput({ invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} className={`input${invalid ? ' invalid' : ''}`} />;
}

export function Select({
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select {...props} className={`select${invalid ? ' invalid' : ''}`}>
      {children}
    </select>
  );
}

export function TextArea({
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...props} className={`textarea${invalid ? ' invalid' : ''}`} />;
}

/**
 * Password field with a show/hide control. The toggle is a real button so it
 * is reachable by keyboard and announced correctly to assistive technology.
 */
export function PasswordInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`input password-input${className ? ` ${className}` : ''}`}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ badge */

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ state */

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function LoadingBlock() {
  return (
    <div className="loading-block">
      <Spinner />
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-row" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      <p className="empty-text">{text}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------- pagination */

export function Pagination({
  meta,
  onPageChange,
  disabled,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const { page, totalPages, total, pageSize } = meta;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const pages: (number | '…')[] = [];
  for (let index = 1; index <= totalPages; index += 1) {
    if (index === 1 || index === totalPages || Math.abs(index - page) <= 1) {
      pages.push(index);
    } else if (pages.at(-1) !== '…') {
      pages.push('…');
    }
  }

  return (
    <div className="table-footer">
      <span className="result-count">
        {total === 0 ? 'No results' : `Showing ${first}–${last} of ${total}`}
      </span>
      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="page-btn"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Previous page"
          >
            ‹
          </button>
          {pages.map((entry, index) =>
            entry === '…' ? (
              <span key={`gap-${index}`} className="subtle" style={{ padding: '0 4px' }}>
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                className={`page-btn${entry === page ? ' current' : ''}`}
                onClick={() => onPageChange(entry)}
                disabled={disabled}
                aria-current={entry === page ? 'page' : undefined}
              >
                {entry}
              </button>
            ),
          )}
          <button
            type="button"
            className="page-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= totalPages}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- dialog */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  tone = 'primary',
  busy,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title" id={titleId}>
          {title}
        </h2>
        <p className="dialog-text">{text}</p>
        {children}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ icons */

export function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  variant = 'secondary',
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
  size?: 'sm';
}) {
  const classes = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type="button" {...props} className={classes} />;
}
