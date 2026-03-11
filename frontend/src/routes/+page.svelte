export async function load({ fetch }) {
  const res = await fetch('/api/boards');

  if (!res.ok) {
    throw new Error('Failed to load boards');
  }

  return {
    boards: await res.json()
  };
}