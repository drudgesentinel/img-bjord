import { error } from '@sveltejs/kit';

type AdminUser = {
  id: string;
  username: string;
  activation_code: string | null;
  is_approved: boolean;
  is_admin: boolean;
  tags: string[];
  created_at: string;
};

type AdminBoard = {
  slug: string;
  name: string | null;
  visible_to_tags: string[];
  created_at: string;
};

export async function load({ fetch }) {
  const [usersRes, boardsRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/admin/boards')]);

  if (usersRes.status === 401 || boardsRes.status === 401) {
    throw error(401, 'Sign in required');
  }

  if (usersRes.status === 403 || boardsRes.status === 403) {
    throw error(403, 'Admin access required');
  }

  if (!usersRes.ok) {
    const details = await usersRes.text();
    throw error(usersRes.status, details || 'Failed to load admin users');
  }

  if (!boardsRes.ok) {
    const details = await boardsRes.text();
    throw error(boardsRes.status, details || 'Failed to load admin boards');
  }

  const usersBody = (await usersRes.json()) as { users: AdminUser[] };
  const boardsBody = (await boardsRes.json()) as { boards: AdminBoard[] };

  return {
    users: usersBody.users,
    boards: boardsBody.boards,
  };
}
