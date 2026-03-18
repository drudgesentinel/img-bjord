import { redirect } from '@sveltejs/kit';

export function load({ params, url }) {
  const segments = params.segments ? params.segments.split('/') : [];
  const targetPath = segments.length > 0 ? `/boards/${segments.join('/')}` : '/';
  const targetUrl = `${targetPath}${url.search}`;

  throw redirect(308, targetUrl);
}