import { api } from '$lib/api';
import type { ThreadListResponse } from '$lib/types';

const THREADS_PER_PAGE = 20;

export async function load({ params, fetch, url }) {
  const rawPage = Number(url.searchParams.get('page') ?? '1');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const data = await api<ThreadListResponse>(
    fetch,
    `/api/boards/${params.board}/threads?limit=${THREADS_PER_PAGE}&page=${page}`
  );

  return {
    board: params.board,
    threads: data.threads,
    page,
    hasPreviousPage: page > 1,
    hasNextPage: data.threads.length === THREADS_PER_PAGE
  };
}
