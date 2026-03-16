<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { api } from '$lib/api';
  import type { Post, ReplyResponse, Thread } from '$lib/types';

  let { data } = $props<{
    data: {
      board: string;
      thread: Thread;
      posts: Post[];
    };
  }>();

  let body = $state('');
  let replying = $state(false);
  let error = $state('');
  let imageFile = $state<File | null>(null);
  let imagePreviewUrl = $state('');

  function setImage(file: File | null) {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      imagePreviewUrl = '';
    }

    imageFile = file;
    if (file) {
      imagePreviewUrl = URL.createObjectURL(file);
    }
  }

  function handleImageChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    setImage(file);
  }

  function handleBodyPaste(event: ClipboardEvent) {
    if (!event.clipboardData) return;

    const imageItem = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    setImage(file);
  }

  function clearImage() {
    setImage(null);
  }

  async function submitReply() {
    error = '';
    if (!body.trim() && !imageFile) {
      error = 'Body or image is required';
      return;
    }
    replying = true;

    try {
      const init: RequestInit = imageFile
        ? {
            method: 'POST',
            body: (() => {
              const form = new FormData();
              form.append('body', body);
              form.append('image', imageFile);
              return form;
            })()
          }
        : {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: JSON.stringify({ body })
          };

      await api<ReplyResponse>(
        fetch,
        `/api/boards/${data.board}/${data.thread.subject_slug}/${data.thread.token}/replies`,
        init
      );

      body = '';
      clearImage();
      await invalidateAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to post reply';
    } finally {
      replying = false;
    }
  }
</script>

<h1>/{data.board}/ {data.thread.subject ?? '(untitled)'}</h1>

<p>
  <small>
    token: {data.thread.token} · created: {new Date(data.thread.created_at).toLocaleString()}
  </small>
</p>

<hr />

<section>
  <h2>Posts</h2>

  {#each data.posts as post}
    <article>
      <p>
        <strong>#{post.post_number}</strong>
        <small> · {new Date(post.created_at).toLocaleString()}</small>
      </p>
      <pre>{post.body}</pre>
      {#if post.image_url}
        <div>
          <img src={post.image_url} alt="Post attachment" style="max-width: 100%; max-height: 640px;" loading="lazy" />
        </div>
      {/if}
      <hr />
    </article>
  {/each}
</section>

<section>
  <h2>Reply</h2>

  <label>
    Body
    <textarea bind:value={body} maxlength="5000" rows="8" on:paste={handleBodyPaste}></textarea>
  </label>

  <div>
    <label>
      Image
      <input type="file" accept="image/*" on:change={handleImageChange} />
    </label>
    <p><small>Tip: you can also paste an image into the body field.</small></p>
  </div>

  {#if imagePreviewUrl}
    <div>
      <img src={imagePreviewUrl} alt="Selected image preview" style="max-width: 320px; max-height: 320px;" />
      <div>
        <button type="button" on:click={clearImage} disabled={replying}>Remove image</button>
      </div>
    </div>
  {/if}

  <div>
    <button on:click={submitReply} disabled={replying}>
      {replying ? 'Replying...' : 'Post reply'}
    </button>
  </div>

  {#if error}
    <p>{error}</p>
  {/if}
</section>