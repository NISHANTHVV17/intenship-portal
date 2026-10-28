import { useState } from 'react';
import { Page } from '../components/Layout';
import { Alert, Input, PageHeader, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

export default function Account() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) return setErrors({ confirm: 'Passwords do not match' });
    setErrors({});
    setBusy(true);
    try {
      await api.put('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page narrow>
      <PageHeader title="Account settings" />
      <div className="card mb-6 p-6">
        <h2 className="font-semibold text-slate-900">Account</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="break-all font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Member since</dt>
            <dd className="font-medium">{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </div>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <h2 className="font-semibold text-slate-900">Change password</h2>
        {error && <Alert>{error}</Alert>}
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters with a letter and a number"
          error={errors.newPassword}
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          error={errors.confirm}
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        />
        <button className="btn-primary" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />} Update password
        </button>
      </form>
    </Page>
  );
}
