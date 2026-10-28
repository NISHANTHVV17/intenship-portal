import { Download, FileText, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Page } from '../../components/Layout';
import { TagInput } from '../../components/TagInput';
import { Alert, ErrorState, Input, PageHeader, PageLoader, Select, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, download } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useAsync, useMeta } from '../../lib/hooks';

const MAX_MB = 5;

export default function Profile() {
  const meta = useMeta();
  const toast = useToast();
  const { refresh } = useAuth();
  const { data, error, loading, reload, setData } = useAsync(() => api.get('/students/me/profile'), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (data && !form) {
      setForm({
        name: data.name,
        registerNumber: data.registerNumber,
        department: data.department,
        year: String(data.year),
        cgpa: data.cgpa ?? '',
        phone: data.phone || '',
        skills: data.skills,
      });
    }
  }, [data, form]);

  if (error) return <Page><ErrorState error={error} onRetry={reload} /></Page>;
  if (loading || !form) return <PageLoader />;

  const bind = (key) => ({ value: form[key], error: errors[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const updated = await api.put('/students/me/profile', {
        ...form,
        year: Number(form.year),
        cgpa: form.cgpa === '' ? null : Number(form.cgpa),
      });
      setData(updated);
      await refresh();
      toast.success('Profile saved');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file) => {
    setUploadError(null);
    if (!file) return;
    if (!['application/pdf', ''].includes(file.type) || !file.name.toLowerCase().endsWith('.pdf')) {
      return setUploadError('Only PDF files are allowed.');
    }
    if (file.size > MAX_MB * 1024 * 1024) return setUploadError(`Resume must be ${MAX_MB} MB or smaller.`);
    const fd = new FormData();
    fd.append('resume', file);
    setUploading(true);
    try {
      const updated = await api.upload('/students/me/resume', fd);
      setData(updated);
      await refresh();
      toast.success('Resume uploaded');
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Page>
      <PageHeader title="My profile" subtitle="Recruiters see these details when you apply" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={save} className="card space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" required {...bind('name')} />
            <Input label="College email" value={data.email} disabled hint="Contact the placement cell to change your email" />
            <Input label="Register number" required {...bind('registerNumber')} />
            <Select label="Department" required options={meta?.departments || [form.department]} {...bind('department')} />
            <Select
              label="Year of study"
              required
              options={(meta?.years || [1, 2, 3, 4, 5]).map((y) => ({ value: String(y), label: `Year ${y}` }))}
              {...bind('year')}
            />
            <Input label="CGPA" type="number" step="0.01" min="0" max="10" placeholder="Out of 10" {...bind('cgpa')} />
            <Input label="Phone" type="tel" {...bind('phone')} className="sm:col-span-2" />
          </div>
          <TagInput
            label="Skills"
            value={form.skills}
            onChange={(skills) => setForm({ ...form, skills })}
            error={errors.skills}
            hint="Used to match you with internships and shown to recruiters"
          />
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving}>
              {saving && <Spinner className="h-4 w-4 text-white" />} Save profile
            </button>
          </div>
        </form>

        <aside className="card h-fit space-y-4 p-6">
          <h2 className="font-semibold text-slate-900">Resume</h2>
          {data.resume ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <FileText className="h-9 w-9 shrink-0 text-rose-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{data.resume.name}</p>
                <p className="text-xs text-slate-500">Uploaded {formatDateTime(data.resume.uploadedAt)}</p>
              </div>
              <button
                type="button"
                className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-brand-600"
                onClick={() => download('/students/me/resume', data.resume.name).catch((e) => toast.error(e))}
                aria-label="Download resume"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Alert type="warning">No resume uploaded yet. You need one to apply.</Alert>
          )}
          {uploadError && <Alert>{uploadError}</Alert>}
          <label
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:border-brand-400 hover:bg-brand-50/40 ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              upload(e.dataTransfer.files?.[0]);
            }}
          >
            {uploading ? <Spinner className="h-6 w-6" /> : <Upload className="h-6 w-6 text-slate-400" />}
            <span className="text-sm font-medium text-slate-700">{data.resume ? 'Replace resume' : 'Upload resume'}</span>
            <span className="text-xs text-slate-500">PDF only, up to {MAX_MB} MB. Click or drag & drop.</span>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <p className="text-xs text-slate-500">Applications you've already submitted keep the resume that was attached at the time.</p>
        </aside>
      </div>
    </Page>
  );
}
