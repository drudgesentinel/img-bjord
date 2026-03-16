import { api } from '$lib/api';

type Board = {
  slug: string;
  name: string | null;
  created_at: string;
};

type BoardsResponse = {
  boards: Board[];
};

type SessionUser = {
  id: string;
  username: string;
  is_admin: boolean;
  tags: string[];
  created_at: string;
};

export async function load({ fetch }) {
  const data = await api<BoardsResponse>(fetch, '/api/boards');

  let user: SessionUser | null = null;
  const meRes = await fetch('/api/auth/me');
  if (meRes.ok) {
    const body = (await meRes.json()) as { user: SessionUser };
    user = body.user;
  }

  return {
    boards: data.boards,
    user,
  };
}