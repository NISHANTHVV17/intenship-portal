import { Building2, GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Input, Select, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../lib/hooks';
import { AuthShell } from './Login';

const PASSWORD_HINT = 'At least 8 characters with a letter and a number';

function validatePasswords(form) {
  const errors = {};
  if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) errors.password = PASSWORD_HINT;
  if (form.password !== form.confirm) errors.confirm = 'Passwords do not match';
  return errors;
}

export default function Register() {
  const [params, setParams] = useSearchParams();
  const role = params.get('role') === 'recruiter' ? 'recruiter' : 'student';
  const setRole = (r) => setParams(r === 'student' ? {} : { role: r }, { replace: true });

  return (
    <AuthShell title="Create your account" subtitle="Join the university internship portal" wide>
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="tablist">
        {[
          ['student', 'Student', GraduationCap],
          ['recruiter', 'Recruiter', Building2],
        ].map(([value, label, Icon]) => (
          <button
            key={value}
            role="tab"
            aria-selected={role === value}
            onClick={() => setRole(value)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              role === value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {role === 'student' ? <StudentForm /> : <RecruiterForm />}
      <p className="mt-6 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

function useRegisterForm(initial, submitFn, extraValidate) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const bind = (key) => ({
    value: form[key],
    error: errors[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });
  const submit = async (e) => {
    e.preventDefault();
    const clientErrors = { ...validatePasswords(form), ...(extraValidate?.(form) || {}) };
    setErrors(clientErrors);
    setError(null);
    if (Object.keys(clientErrors).length) return;
    setBusy(true);
    try {
      const { confirm: _confirm, ...payload } = form;
      await submitFn(payload);
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setError(err.message);
      setBusy(false);
    }
  };
  return { form, bind, submit, error, busy };
}

function StudentForm() {
  const { registerStudent } = useAuth();
  const meta = useMeta();
  const domain = meta?.studentEmailDomain;
  const { bind, submit, error, busy } = useRegisterForm(
    { name: '', email: '', registerNumber: '', department: '', year: '', cgpa: '', password: '', confirm: '' },
    (p) => registerStudent({ ...p, year: Number(p.year), cgpa: p.cgpa === '' ? undefined : Number(p.cgpa) }),
    (f) => (domain && !f.email.toLowerCase().endsWith(`@${domain}`) && !f.email.toLowerCase().endsWith(`.${domain}`)
      ? { email: `Use your college email (@${domain})` }
      : {}),
  );

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      {error && <Alert className="sm:col-span-2">{error}</Alert>}
      <Input label="Full name" required autoComplete="name" {...bind('name')} />
      <Input label="College email" type="email" required autoComplete="email" placeholder={domain ? `you@${domain}` : ''} {...bind('email')} />
      <Input label="Register number" required placeholder="e.g. 21CS001" {...bind('registerNumber')} />
      <Select label="Department" required placeholder="Select department" options={meta?.departments || []} {...bind('department')} />
      <Select label="Year of study" required placeholder="Select year" options={(meta?.years || [1, 2, 3, 4, 5]).map((y) => ({ value: y, label: `Year ${y}` }))} {...bind('year')} />
      <Input label="CGPA" type="number" step="0.01" min="0" max="10" placeholder="Optional - out of 10" {...bind('cgpa')} />
      <Input label="Password" type="password" required autoComplete="new-password" hint={PASSWORD_HINT} {...bind('password')} />
      <Input label="Confirm password" type="password" required autoComplete="new-password" {...bind('confirm')} />
      <button className="btn-primary py-2.5 sm:col-span-2" disabled={busy}>
        {busy && <Spinner className="h-4 w-4 text-white" />} Create student account
      </button>
    </form>
  );
}

function RecruiterForm() {
  const { registerRecruiter } = useAuth();
  const { bind, submit, error, busy } = useRegisterForm(
    { name: '', email: '', companyName: '', designation: '', website: '', phone: '', password: '', confirm: '' },
    registerRecruiter,
  );
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Alert type="info" className="sm:col-span-2">
        Recruiter accounts are reviewed by the placement cell. You can post internships once approved.
      </Alert>
      {error && <Alert className="sm:col-span-2">{error}</Alert>}
      <Input label="Your name" required autoComplete="name" {...bind('name')} />
      <Input label="Work email" type="email" required autoComplete="email" {...bind('email')} />
      <Input label="Company name" required autoComplete="organization" {...bind('companyName')} />
      <Input label="Designation" placeholder="e.g. HR Manager" {...bind('designation')} />
      <Input label="Company website" type="url" placeholder="https://" {...bind('website')} />
      <Input label="Phone" type="tel" autoComplete="tel" {...bind('phone')} />
      <Input label="Password" type="password" required autoComplete="new-password" hint={PASSWORD_HINT} {...bind('password')} />
      <Input label="Confirm password" type="password" required autoComplete="new-password" {...bind('confirm')} />
      <button className="btn-primary py-2.5 sm:col-span-2" disabled={busy}>
        {busy && <Spinner className="h-4 w-4 text-white" />} Register as recruiter
      </button>
    </form>
  );
}
