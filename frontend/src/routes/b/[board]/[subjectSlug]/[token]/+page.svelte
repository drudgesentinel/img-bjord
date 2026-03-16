<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
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
  let deleting = $state(false);
  let error = $state('');
  let expandedImageUrl = $state<string | null>(null);
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

  function openImage(url: string) {
    expandedImageUrl = url;
  }

  function closeImage() {
    expandedImageUrl = null;
  }

  async function deleteThread() {
    if (!confirm('Delete this thread permanently?')) return;
    const key = prompt('Enter deletion key');
    if (!key?.trim()) return;

    deleting = true;
    error = '';

    try {
      const res = await fetch(
        `/api/boards/${data.board}/${data.thread.subject_slug}/${data.thread.token}?key=${encodeURIComponent(key.trim())}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to delete thread');
      }

      await goto(`/b/${data.board}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete thread';
    } finally {
      deleting = false;
    }
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

<p>
  <button type="button" on:click={deleteThread} disabled={deleting || replying}>
    {deleting ? 'Deleting...' : 'Delete thread'}
  </button>
</p>

<hr />

<section>
  <h2>Posts</h2>

  {#each data.posts as post}
    <article class:reply={post.post_number > 1}>
      <p>
        <strong>#{post.post_number}</strong>
        <small> · {new Date(post.created_at).toLocaleString()}</small>
      </p>
      <pre>{post.body}</pre>
      {#if post.image_url}
        <figure class="post-image">
          <button type="button" class="image-button" on:click={() => openImage(post.image_url!)}>
            <img
              src={post.image_url}
              alt="Post image"
              loading="lazy"
              decoding="async"
              width={post.image_width ?? undefined}
              height={post.image_height ?? undefined}
            />
          </button>
        </figure>
      {/if}
      <hr />
    </article>
  {/each}
</section>

{#if expandedImageUrl}
  <div class="lightbox" on:click={closeImage}>
    <img src={expandedImageUrl} alt="Expanded post image" class="lightbox-image" />
  </div>
{/if}

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

<style>
  article.reply {
    margin-left: clamp(0.5rem, 2vw, 1.25rem);
    padding-left: 0.75rem;
    border-left: 2px solid #d7d7d7;
  }

  .post-image {
    margin: 0.5rem 0 0;
  }

  .post-image img {
    display: block;
    width: auto;
    max-width: min(100%, 560px);
    height: auto;
    object-fit: contain;
    border-radius: 8px;
    background: #111;
    cursor: zoom-in;
  }

  .image-button {
    border: 0;
    padding: 0;
    background: transparent;
  }

  .lightbox {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 1000;
    cursor: zoom-out;
  }

  .lightbox-image {
    max-width: min(95vw, 1400px);
    max-height: 95vh;
    width: auto;
    height: auto;
    object-fit: contain;
  }
</style>