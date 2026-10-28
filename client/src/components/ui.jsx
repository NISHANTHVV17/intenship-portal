import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { useEffect, useId } from 'react';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Alert({ type = 'error', children, className = '' }) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-brand-200 bg-brand-50 text-brand-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[type];
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${styles} ${className}`} role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <Alert className="my-6">
      {error?.message || 'Something went wrong.'}{' '}
      {onRetry && (
        <button className="font-semibold underline" onClick={onRetry}>
          Try again
        </button>
      )}
    </Alert>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children, className = '', required }) {
  const id = useId();
  const child = typeof children === 'function' ? children(id) : children;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      {child}
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function Input({ label, error, hint, className, required, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className} required={required}>
      {(id) => <input id={id} className={`input ${error ? 'border-rose-400' : ''}`} required={required} {...props} />}
    </Field>
  );
}

export function Textarea({ label, error, hint, className, required, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className} required={required}>
      {(id) => <textarea id={id} className={`input ${error ? 'border-rose-400' : ''}`} required={required} {...props} />}
    </Field>
  );
}

export function Select({ label, error, hint, className, options = [], placeholder, required, ...props }) {
  return (
    <Field label={label} error={error} hint={hint} className={className} required={required}>
      {(id) => (
        <select id={id} className={`input ${error ? 'border-rose-400' : ''}`} required={required} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const { value, label: text } = typeof o === 'object' ? o : { value: o, label: o };
            return (
              <option key={value} value={value}>
                {text}
              </option>
            );
          })}
        </select>
      )}
    </Field>
  );
}

export function Badge({ children, color = 'slate', className = '' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
    purple: 'bg-violet-50 text-violet-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
    blue: 'bg-sky-50 text-sky-600',
  };
  return (
    <div className="card flex items-center gap-4 p-5">
      {Icon && (
        <div className={`rounded-lg p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

export function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-slate-600 sm:flex-row" aria-label="Pagination">
      <p>
        Showing <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span> of{' '}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <span className="px-2">
          Page {page} of {totalPages}
        </span>
        <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full ${width} overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy && <Spinner className="h-4 w-4 text-white" />} {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
      {children}
    </Modal>
  );
}

/** Horizontal bar list used on analytics pages. */
export function BarList({ items, valueSuffix = '', color = 'bg-brand-500' }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate text-slate-700" title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 font-medium text-slate-900">
              {i.value}
              {valueSuffix}
              {i.extra && <span className="ml-1 font-normal text-slate-400">{i.extra}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${i.color || color}`} style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
