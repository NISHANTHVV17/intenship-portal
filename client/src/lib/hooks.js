import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from './api';

/** Runs an async loader whenever deps change; exposes { data, error, loading, reload, setData }. */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, error, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: load, setData };
}

let metaCache = null;

/** Shared lookup lists (departments, domains, statuses...) fetched once per session. */
export function useMeta() {
  const [meta, setMeta] = useState(metaCache?.value ?? null);
  useEffect(() => {
    if (!metaCache) {
      metaCache = { promise: api.get('/meta').then((v) => (metaCache.value = v)) };
      metaCache.promise.catch(() => (metaCache = null));
    }
    metaCache.promise.then(setMeta).catch(() => {});
  }, []);
  return meta;
}

/** Filters stored in the URL query string so they survive reloads and are shareable. */
export function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();
  const values = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const v = params.get(key);
    if (v !== null) values[key] = v;
  }
  const update = useCallback(
    (patch, { resetPage = true } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries({ ...(resetPage && !('page' in patch) ? { page: '' } : {}), ...patch }).forEach(([k, v]) => {
            if (v === '' || v === undefined || v === null || String(v) === String(defaults[k] ?? '')) next.delete(k);
            else next.set(k, v);
          });
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );
  return [values, update];
}

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
