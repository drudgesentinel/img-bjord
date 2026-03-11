import { api } from '$lib/api';
import type { ThreadDetailResponse } from '$lib/types';

export async function load({ params, fetch }) {
  const data = await api<ThreadDetailResponse>(
    fetch,
    `/api/boards/${params.board}/${params.subjectSlug}/${params.token}`
  );

  return {
    board: params.board,
    thread: data.thread,
    posts: data.posts
  };
}