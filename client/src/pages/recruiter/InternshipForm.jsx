import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page } from '../../components/Layout';
import { TagInput } from '../../components/TagInput';
import { Alert, ErrorState, Input, PageHeader, PageLoader, Select, Spinner, Textarea } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { MODE_LABELS, todayInput } from '../../lib/format';
import { useMeta } from '../../lib/hooks';

const EMPTY = {
  title: '',
  company: '',
  description: '',
  domain: '',
  requiredSkills: [],
  minCgpa: '0',
  eligibleDepartments: [],
  eligibleYears: [],
  location: '',
  mode: 'onsite',
  durationWeeks: '12',
  stipend: '0',
  openings: '1',
  deadline: '',
};

export default function InternshipForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user, profile } = useAuth();
  const meta = useMeta();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) {
      setForm({ ...EMPTY, company: profile?.companyName || '' });
      return;
    }
    api
      .get(`/internships/${id}`)
      .then((i) => {
        if (i.recruiterId !== user.id) throw new Error('You can only edit your own postings');
        setStatus(i.status);
        setForm({
          title: i.title,
          company: i.company,
          description: i.description,
          domain: i.domain,
          requiredSkills: i.requiredSkills,
          minCgpa: String(i.minCgpa),
          eligibleDepartments: i.eligibleDepartments,
          eligibleYears: i.eligibleYears,
          location: i.location,
          mode: i.mode,
          durationWeeks: String(i.durationWeeks),
          stipend: String(i.stipend),
          openings: String(i.openings),
          deadline: i.deadline,
        });
      })
      .catch(setLoadError);
  }, [editing, id, user.id, profile?.companyName]);

  if (profile?.approvalStatus !== 'approved') {
    return (
      <Page narrow>
        <Alert type="warning">Your recruiter account must be approved by the placement cell before you can post internships.</Alert>
      </Page>
    );
  }
  if (loadError) return <Page narrow><ErrorState error={loadError} /></Page>;
  if (!form || !meta) return <PageLoader />;

  const bind = (key) => ({ value: form[key], error: errors[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });
  const toggleIn = (key, value) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    const payload = {
      ...form,
      minCgpa: Number(form.minCgpa || 0),
      durationWeeks: Number(form.durationWeeks),
      stipend: Number(form.stipend || 0),
      openings: Number(form.openings),
    };
    try {
      const saved = editing ? await api.put(`/internships/${id}`, payload) : await api.post('/internships', payload);
      toast.success(
        saved.status === 'pending'
          ? 'Submitted - the placement cell will review it before it goes live'
          : editing
            ? 'Internship updated'
            : 'Internship published',
      );
      navigate('/recruiter');
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page narrow>
      <Link to="/recruiter" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <PageHeader
        title={editing ? 'Edit internship' : 'Post an internship'}
        subtitle={meta.moderationEnabled ? 'Postings are reviewed by the placement cell before going live.' : 'Postings go live immediately.'}
      />
      {editing && meta.moderationEnabled && status !== 'closed' && (
        <Alert type="info" className="mb-4">
          Saving changes will send this posting back to the placement cell for approval.
        </Alert>
      )}
      {error && <Alert className="mb-4">{error}</Alert>}

      <form onSubmit={submit} className="space-y-6">
        <section className="card space-y-4 p-6">
          <h2 className="font-semibold text-slate-900">Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Job title" required placeholder="e.g. Backend Developer Intern" {...bind('title')} className="sm:col-span-2" />
            <Input label="Company" required {...bind('company')} />
            <Select label="Domain" required placeholder="Select domain" options={meta.domains} {...bind('domain')} />
          </div>
          <Textarea
            label="Description"
            required
            rows={8}
            placeholder="Responsibilities, what the intern will learn, perks, selection process…"
            {...bind('description')}
            hint={`${form.description.length}/10000`}
          />
          <TagInput label="Required skills" value={form.requiredSkills} onChange={(requiredSkills) => setForm({ ...form, requiredSkills })} error={errors.requiredSkills} />
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-semibold text-slate-900">Logistics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Location" required placeholder="City or 'Remote'" {...bind('location')} />
            <Select label="Work mode" required options={meta.modes.map((m) => ({ value: m, label: MODE_LABELS[m] }))} {...bind('mode')} />
            <Input label="Duration (weeks)" type="number" min="1" max="52" required {...bind('durationWeeks')} />
            <Input label="Stipend (₹ per month)" type="number" min="0" step="500" required hint="Enter 0 for unpaid" {...bind('stipend')} />
            <Input label="Number of openings" type="number" min="1" max="1000" required {...bind('openings')} />
            <Input label="Application deadline" type="date" min={todayInput()} required {...bind('deadline')} />
          </div>
        </section>

        <section className="card space-y-5 p-6">
          <h2 className="font-semibold text-slate-900">Eligibility</h2>
          <Input label="Minimum CGPA" type="number" min="0" max="10" step="0.1" {...bind('minCgpa')} hint="0 means no minimum" className="sm:w-48" />
          <fieldset>
            <legend className="label">Eligible departments</legend>
            <p className="mb-2 text-xs text-slate-500">Leave all unchecked to allow every department.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {meta.departments.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={form.eligibleDepartments.includes(d)} onChange={() => toggleIn('eligibleDepartments', d)} />
                  {d}
                </label>
              ))}
            </div>
            {errors.eligibleDepartments && <p className="mt-1 text-xs text-rose-600">{errors.eligibleDepartments}</p>}
          </fieldset>
          <fieldset>
            <legend className="label">Eligible years</legend>
            <p className="mb-2 text-xs text-slate-500">Leave all unchecked to allow every year.</p>
            <div className="flex flex-wrap gap-2">
              {meta.years.map((y) => (
                <button
                  type="button"
                  key={y}
                  onClick={() => toggleIn('eligibleYears', y)}
                  aria-pressed={form.eligibleYears.includes(y)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ring-1 ${
                    form.eligibleYears.includes(y) ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Year {y}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <div className="flex justify-end gap-2">
          <Link to="/recruiter" className="btn-secondary">
            Cancel
          </Link>
          <button className="btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4 text-white" />} {editing ? 'Save changes' : meta.moderationEnabled ? 'Submit for approval' : 'Publish'}
          </button>
        </div>
      </form>
    </Page>
  );
}
