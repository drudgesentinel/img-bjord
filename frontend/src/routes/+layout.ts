type SessionUser = {
  id: string;
  username: string;
  is_admin: boolean;
  tags: string[];
  created_at: string;
};

export async function load({ fetch }) {
  let user: SessionUser | null = null;

  const meRes = await fetch('/api/auth/me');
  if (meRes.ok) {
    const body = (await meRes.json()) as { user: SessionUser };
    user = body.user;
  }

  return {
    user,
  };
}
