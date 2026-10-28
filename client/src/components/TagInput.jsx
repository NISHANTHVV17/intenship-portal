import { X } from 'lucide-react';
import { useState } from 'react';
import { Field } from './ui';

const SUGGESTIONS = [
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'SQL', 'MongoDB', 'AWS', 'Docker',
  'Machine Learning', 'Data Analysis', 'TensorFlow', 'Figma', 'Embedded C', 'IoT', 'MATLAB', 'AutoCAD', 'Communication',
];

/** Free-text tag entry: Enter or comma adds a tag, Backspace removes the last one. */
export function TagInput({ label, value = [], onChange, error, hint, placeholder = 'Type a skill and press Enter', max = 30 }) {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const tag = raw.trim().replace(/,$/, '');
    if (!tag || value.length >= max || value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag.slice(0, 40)]);
  };

  const suggestions = draft
    ? SUGGESTIONS.filter((s) => s.toLowerCase().includes(draft.toLowerCase()) && !value.includes(s)).slice(0, 6)
    : [];

  return (
    <Field label={label} error={error} hint={hint}>
      {(id) => (
        <div className="relative">
          <div className={`input flex min-h-[42px] flex-wrap items-center gap-1.5 ${error ? 'border-rose-400' : ''}`}>
            {value.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                {tag}
                <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              id={id}
              value={draft}
              onChange={(e) => {
                const v = e.target.value;
                if (v.endsWith(',')) {
                  add(v);
                  setDraft('');
                } else setDraft(v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add(draft);
                  setDraft('');
                } else if (e.key === 'Backspace' && !draft && value.length) {
                  onChange(value.slice(0, -1));
                }
              }}
              onBlur={() => {
                add(draft);
                setDraft('');
              }}
              placeholder={value.length ? '' : placeholder}
              className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0"
            />
          </div>
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(s);
                      setDraft('');
                    }}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}
