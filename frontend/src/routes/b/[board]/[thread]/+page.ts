import { api } from '$lib/api';
import type { ThreadDetailResponse } from '$lib/types';

export async function load({ params, fetch }) {
  const data = await api<ThreadDetailResponse>(fetch, `/api/threads/${params.thread}`);

  return {
    board: params.board,
    threadId: params.thread,
    thread: data.thread,
    posts: data.posts
  };
}