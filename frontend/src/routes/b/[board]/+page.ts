import { api } from '$lib/api';
import type { ThreadListResponse } from '$lib/types';

export async function load({ params, fetch }) {
  const data = await api<ThreadListResponse>(
    fetch,
    `/api/boards/${params.board}/threads`
  );

  return {
    board: params.board,
    threads: data.threads
  };
}