import { useEffect, useState } from 'react';
import { Page } from '../../components/Layout';
import { ApprovalBadge } from '../../components/status';
import { ErrorState, Input, PageHeader, PageLoader, Spinner, Textarea } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/hooks';

export default function RecruiterProfile() {
  const { data, error, loading, reload, setData } = useAsync(() => api.get('/recruiter/profile'), []);
  const { refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !form) {
      setForm({
        name: data.name,
        companyName: data.companyName,
        designation: data.designation || '',
        website: data.website || '',
        phone: data.phone || '',
        about: data.about || '',
      });
    }
  }, [data, form]);

  if (error) return <Page><ErrorState error={error} onRetry={reload} /></Page>;
  if (loading || !form) return <PageLoader />;

  const bind = (key) => ({ value: form[key], error: errors[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      setData(await api.put('/recruiter/profile', form));
      await refresh();
      toast.success('Profile saved');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page narrow>
      <PageHeader title="Company profile" actions={<ApprovalBadge status={data.approvalStatus} />} />
      <form onSubmit={save} className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Your name" required {...bind('name')} />
          <Input label="Email" value={data.email} disabled />
          <Input label="Company name" required {...bind('companyName')} />
          <Input label="Designation" {...bind('designation')} />
          <Input label="Website" type="url" placeholder="https://" {...bind('website')} />
          <Input label="Phone" type="tel" {...bind('phone')} />
        </div>
        <Textarea label="About the company" rows={5} {...bind('about')} />
        <div className="flex justify-end">
          <button className="btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4 text-white" />} Save
          </button>
        </div>
      </form>
    </Page>
  );
}
