let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

function isUnsafeMethod(method: string | undefined) {
  const upper = String(method ?? 'GET').toUpperCase();
  return upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE';
}

export function clearCsrfTokenCache() {
  csrfToken = null;
  csrfTokenPromise = null;
}

export async function getCsrfToken(fetchFn: typeof fetch): Promise<string> {
  if (csrfToken) return csrfToken;
  if (csrfTokenPromise) return csrfTokenPromise;

  csrfTokenPromise = (async () => {
    const res = await fetchFn('/api/auth/csrf', {
      method: 'GET',
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error(`Failed to get CSRF token (${res.status})`);
    }

    const body = (await res.json()) as { csrfToken?: string };
    if (!body?.csrfToken) {
      throw new Error('Failed to get CSRF token');
    }

    csrfToken = body.csrfToken;
    return csrfToken;
  })().finally(() => {
    csrfTokenPromise = null;
  });

  return csrfTokenPromise;
}

export async function csrfFetch(
  fetchFn: typeof fetch,
  input: string,
  init?: RequestInit
): Promise<Response> {
  const method = String(init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers ?? undefined);

  if (isUnsafeMethod(method)) {
    const token = await getCsrfToken(fetchFn);
    headers.set('x-csrf-token', token);
  }

  const first = await fetchFn(input, {
    ...init,
    method,
    headers,
    credentials: init?.credentials ?? 'include'
  });

  if (!isUnsafeMethod(method) || first.status !== 403) {
    return first;
  }

  let shouldRetry = false;
  try {
    const text = await first.clone().text();
    shouldRetry = text.includes('csrf_invalid');
  } catch {
    shouldRetry = false;
  }

  if (!shouldRetry) {
    return first;
  }

  clearCsrfTokenCache();
  const refreshed = await getCsrfToken(fetchFn);
  headers.set('x-csrf-token', refreshed);

  return fetchFn(input, {
    ...init,
    method,
    headers,
    credentials: init?.credentials ?? 'include'
  });
}
