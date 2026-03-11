export async function api<T>(fetchFn: typeof fetch, path: string, init?: RequestInit): Promise<T> {
  const res = await fetchFn(path, init);

  if (!res.ok) {
    let details = '';
    try {
      details = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`API error ${res.status}: ${details || res.statusText}`);
  }

  return res.json() as Promise<T>;
}