<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import type { CreateThreadResponse, Thread } from '$lib/types';

  let { data } = $props<{
    data: {
      board: string;
      threads: Thread[];
    };
  }>();

  let subject = $state('');
  let body = $state('');
  let creating = $state(false);
  let error = $state('');

  async function createThread() {
    error = '';
    creating = true;

    try {
      const payload = await api<CreateThreadResponse>(fetch, `/api/boards/${data.board}/threads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          subject: subject || undefined,
          body
        })
      });

      const canonicalPath =
        payload.canonicalPath ||
        `/api/boards/${payload.thread.board_slug}/${payload.thread.subject_slug}/${payload.thread.token}`;

      // backend returns /api/boards/:slug/:subjectSlug/:token
      // frontend route should be /b/:slug/:subjectSlug/:token
      const frontendPath = canonicalPath.replace('/api/boards/', '/b/');

      await goto(frontendPath);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create thread';
    } finally {
      creating = false;
    }
  }
</script>

<h1>/{data.board}/</h1>

<section>
  <h2>Create thread</h2>

  <div>
    <label>
      Subject
      <input bind:value={subject} maxlength="100" />
    </label>
  </div>

  <div>
    <label>
      Body
      <textarea bind:value={body} maxlength="5000" rows="8"></textarea>
    </label>
  </div>

  <button on:click={createThread} disabled={creating || !body.trim()}>
    {creating ? 'Posting...' : 'Create thread'}
  </button>

  {#if error}
    <p>{error}</p>
  {/if}
</section>

<hr />

<section>
  <h2>Threads</h2>

  {#if data.threads.length === 0}
    <p>No threads yet.</p>
  {:else}
    <ul>
      {#each data.threads as thread}
        <li>
          <a href={`/b/${thread.board_slug}/${thread.subject_slug}/${thread.token}`}>
            {thread.subject ?? '(untitled)'}
          </a>
          <div>
            <small>
              token: {thread.token} · bumped: {new Date(thread.bumped_at).toLocaleString()}
            </small>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>