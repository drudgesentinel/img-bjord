<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { api } from '$lib/api';
  import { csrfFetch } from '$lib/csrf';
  import { getEmbeddableLinks, toEmbed, parseUrl } from '$lib/embeds';
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
  let deleting = $state(false);
  let opMenuOpen = $state(false);
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

  function displayUsername(username?: string | null) {
    if (!username) return 'anonymous';
    return username.replace(/_\d+$/, '');
  }

  async function deleteThread() {
    opMenuOpen = false;
    if (!confirm('Delete this thread permanently?')) return;
    const key = prompt('Enter deletion key');
    if (!key?.trim()) return;

    deleting = true;
    error = '';

    try {
      const res = await csrfFetch(fetch, `/api/threads/${data.threadId}?key=${encodeURIComponent(key.trim())}`, {
        method: 'DELETE'
      });

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

      await api<ReplyResponse>(fetch, `/api/threads/${data.threadId}/replies`, init);

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
  <button type="button" on:click={deleteThread} disabled={deleting || replying}>
    {deleting ? 'Deleting...' : 'Delete thread'}
  </button>
</p>

<section>
  <h2>Posts</h2>

  {#each data.posts as post}
    <article class:reply={post.post_number > 1}>
      <p>
        <strong>#{post.post_number}</strong>
        <strong class="author-name">
          {displayUsername(post.author_username)}
          {#if post.author_is_admin}
            <span class="admin-icon" aria-label="admin" title="admin">♠</span>
          {/if}
        </strong>
        {#if post.post_number === 1}
          <span class="op-menu">
            <button
              type="button"
              class="op-menu-trigger"
              aria-label="Thread options"
              title="Thread options"
              on:click={() => (opMenuOpen = !opMenuOpen)}
              disabled={deleting || replying}
            >
              ⋯
            </button>
            {#if opMenuOpen}
              <span class="op-menu-panel">
                <button type="button" on:click={deleteThread} disabled={deleting || replying}>
                  {deleting ? 'Deleting...' : 'Delete thread'}
                </button>
              </span>
            {/if}
          </span>
        {/if}
        {#if post.author_tags && post.author_tags.length > 0}
          <span class="post-tags">
            {#each post.author_tags as tag}
              <span class="tag-pill">{tag}</span>
            {/each}
          </span>
        {/if}
        <small> · {new Date(post.created_at).toLocaleString()}</small>
      </p>
      <div class="post-body">{post.body}</div>
      {#if getEmbeddableLinks(post.body).length > 0}
        <div class="post-embeds">
          {#each getEmbeddableLinks(post.body)
            .map(url => toEmbed(parseUrl(url)))
            .filter(Boolean) as embed}
            {#if embed.kind === 'directVideo'}
              <video src={embed.embedUrl} controls preload="metadata"></video>
            {:else if embed.kind === 'posttext'}
              <div class="embed-card">
                <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer">
                  <strong>{embed.title}</strong><br />
                  <span>{embed.originalUrl}</span>
                </a>
              </div>
            {:else}
              <iframe
                src={embed.embedUrl}
                title={embed.title}
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
              ></iframe>
            {/if}
          {/each}
        </div>
      {/if}
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
    <textarea class="post-editor" bind:value={body} maxlength="5000" rows="8" on:paste={handleBodyPaste}></textarea>
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

  .post-embeds {
    margin-top: 0.5rem;
    display: grid;
    gap: 0.5rem;
  }

  .post-embeds iframe,
  .post-embeds video {
    width: min(100%, 560px);
    max-width: 560px;
    aspect-ratio: 16 / 9;
    border: 0;
    border-radius: 8px;
    background: #111;
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

  .author-name {
    margin-left: 0.45rem;
  }

  .admin-icon {
    margin-left: 0.2rem;
  }

  .post-tags {
    margin-left: 0.35rem;
    display: inline-flex;
    gap: 0.25rem;
    vertical-align: middle;
  }

  .tag-pill {
    font-size: 0.7rem;
    font-weight: 600;
    background: #e6eef8;
    border: 1px solid #c7d8ef;
    border-radius: 999px;
    padding: 0.05rem 0.4rem;
  }

  .op-menu {
    display: inline-block;
    position: relative;
    margin-left: 0.4rem;
  }

  .op-menu-trigger {
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 6px;
    line-height: 1;
    padding: 0.05rem 0.35rem 0.2rem;
  }

  .op-menu-panel {
    position: absolute;
    top: 1.4rem;
    right: 0;
    z-index: 5;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 0.35rem;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
    white-space: nowrap;
  }
</style>