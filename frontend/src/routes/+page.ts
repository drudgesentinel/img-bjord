import { api } from '$lib/api';
import type { BoardAnnouncementResponse } from '$lib/types';

const HOMEPAGE_ANNOUNCEMENT_BOARD = 'general';

type Board = {
  slug: string;
  name: string | null;
  created_at: string;
};

type BoardsResponse = {
  boards: Board[];
};

export async function load({ fetch }) {
  const [boardsData, announcementData] = await Promise.all([
    api<BoardsResponse>(fetch, '/api/boards'),
    api<BoardAnnouncementResponse>(
      fetch,
      `/api/boards/${HOMEPAGE_ANNOUNCEMENT_BOARD}/announcement`
    )
  ]);

  return {
    boards: boardsData.boards,
    announcement: announcementData.announcement,
  };
}