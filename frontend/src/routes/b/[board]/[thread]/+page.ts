export async function load({ params, fetch }) {
  const res = await fetch(`/api/threads/${params.thread}`);

  if (!res.ok) {
    throw new Error('Failed to load thread');
  }

  return {
    board: params.board,
    thread: await res.json()
  };
}