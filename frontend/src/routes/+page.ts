import { api } from '$lib/api';
import type { BoardAnnouncementResponse, LatestPostListResponse } from '$lib/types';

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
  const [boardsData, announcementData, latestPostsData] = await Promise.all([
    api<BoardsResponse>(fetch, '/api/boards'),
    api<BoardAnnouncementResponse>(
      fetch,
      `/api/boards/${HOMEPAGE_ANNOUNCEMENT_BOARD}/announcement`
    ),
    api<LatestPostListResponse>(fetch, '/api/boards/latest-posts?limit=5')
  ]);

  return {
    boards: boardsData.boards,
    announcement: announcementData.announcement,
    latestPosts: latestPostsData.posts,
  };
}