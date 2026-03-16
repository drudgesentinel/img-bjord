<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { api } from '$lib/api';
  import type { Post, ReplyResponse, Thread } from '$lib/types';

  let { data } = $props<{
    data: {
      board: string;
      threadId: string;
      thread: Thread;
      posts: Post[];
    };
  }>();

  let body = $state('');
  let replying = $state(false);
  let error = $state('');

  async function submitReply() {
    error = '';
    if (!body.trim()) {
      error = 'Body is required';
      return;
    }
    replying = true;

    try {
      await api<ReplyResponse>(fetch, `/api/threads/${data.threadId}/replies`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ body })
      });

      body = '';
      await invalidateAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to post reply';
    } finally {
      replying = false;
    }
  }
</script>

<h1>/{data.board}/ {data.thread.subject ?? '(untitled)'}</h1>

<section>
  <h2>Posts</h2>

  {#each data.posts as post}
    <article>
      <p>
        <strong>#{post.post_number}</strong>
        <small> · {new Date(post.created_at).toLocaleString()}</small>
      </p>
      <pre>{post.body}</pre>
      <hr />
    </article>
  {/each}
</section>

<section>
  <h2>Reply</h2>

  <label>
    Body
    <textarea bind:value={body} maxlength="5000" rows="8"></textarea>
  </label>

  <div>
    <button on:click={submitReply} disabled={replying}>
      {replying ? 'Replying...' : 'Post reply'}
    </button>
  </div>

  {#if error}
    <p>{error}</p>
  {/if}
</section>