import { api } from '$lib/api';

type Board = {
  slug: string;
  name: string | null;
  created_at: string;
};

type BoardsResponse = {
  boards: Board[];
};

export async function load({ fetch }) {
  const data = await api<BoardsResponse>(fetch, '/api/boards');

  return {
    boards: data.boards,
  };
}