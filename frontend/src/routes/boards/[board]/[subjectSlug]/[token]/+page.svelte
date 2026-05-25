<svelte:head>
  <title>{threadMeta.title}</title>
  <meta name="description" content={threadMeta.description} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content={threadMeta.title} />
  <meta property="og:description" content={threadMeta.description} />
  <meta property="og:url" content={threadMeta.url} />
  <meta property="og:site_name" content="Krepost" />
  <meta property="og:image" content={threadMeta.imageUrl} />
  <meta property="og:image:alt" content={threadMeta.title} />

  <meta name="twitter:title" content={threadMeta.title} />
  <meta name="twitter:description" content={threadMeta.description} />
  <meta name="twitter:card" content={threadMeta.twitterCard} />
  <meta name="twitter:site" content="@krepost" />
  <meta name="twitter:image" content={threadMeta.imageUrl} />
  <meta name="twitter:image:alt" content={threadMeta.title} />
</svelte:head>

<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { csrfFetch } from '$lib/csrf';
  import { adminShowPostUsernames } from '$lib/postIdentityPrefs';
  import { siteConfig } from '$lib/siteConfig';
  import { buildThreadMeta } from '$lib/threadMeta';
  import {
    getLinkifiedSegments,
    parseUrl,
    toEmbed,
    type EmbeddableLink
  } from '$lib/embeds';
  import type { Post, ReplyResponse, Thread } from '$lib/types';

  type PostBodySegment =
    | { type: 'text'; value: string }
    | { type: 'url'; value: string; href: string }
    | { type: 'reply_ref'; value: string; postNumber: number };

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
  let deletingReplyIds = $state<Record<string, boolean>>({});
  let replyMenuOpenPostIds = $state<Record<string, boolean>>({});
  let opMenuOpen = $state(false);
  let error = $state('');
  let unauthorizedModalOpen = $state(false);
  let expandedImageUrl = $state<string | null>(null);
  let controlsVisiblePostIds = $state<Record<string, boolean>>({});
  let mediaFile = $state<File | null>(null);
  let mediaPreviewUrl = $state('');
  let mediaPreviewIsVideo = $state(false);
  let replyEditor: HTMLTextAreaElement | null = null;

  const MAX_MEDIA_UPLOAD_BYTES = 100 * 1024 * 1024;
  const ALLOWED_MEDIA_TYPES = new Set(['video/mp4', 'video/webm']);
  const MAX_EMBEDS_PER_POST = 3;
  const URL_RE = /https?:\/\/[^\s<>()]+/gi;

  const currentUserIsAdmin = $derived(Boolean(page.data.user?.is_admin));
  const currentUserId = $derived(page.data.user?.id ?? null);
  const postsByNumber = $derived(new Map(data.posts.map((post) => [post.post_number, post])));
  const threadMeta = $derived(buildThreadMeta({ thread: data.thread, posts: data.posts, site: siteConfig }));

  function cleanCandidateUrl(raw: string): string {
    return raw.replace(/[),.;!?]+$/g, '');
  }

  function getPostEmbeds(text: string): EmbeddableLink[] {
    const matches = text.match(URL_RE) || [];
    const embeds: EmbeddableLink[] = [];

    for (const raw of matches) {
      const cleaned = cleanCandidateUrl(raw);
      const parsed = parseUrl(cleaned);
      if (!parsed) continue;

      const embed = toEmbed(parsed);
      if (!embed) continue;

      embeds.push(embed);

      if (embeds.length >= MAX_EMBEDS_PER_POST) {
        break;
      }
    }

    return embeds;
  }

  function requireEmbedUrl(embed: EmbeddableLink): string {
    if (!embed.embedUrl) {
      throw new Error(`Missing embedUrl for embed kind "${embed.kind}"`);
    }
    return embed.embedUrl;
  }

  function setMedia(file: File | null) {
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
      mediaPreviewUrl = '';
    }

    mediaFile = file;
    mediaPreviewIsVideo = Boolean(file?.type?.startsWith('video/'));
    if (file) {
      mediaPreviewUrl = URL.createObjectURL(file);
    }
  }

  function startReplyToPost(postNumber: number) {
    opMenuOpen = false;

    const marker = `>>${postNumber}`;
    const markerPattern = new RegExp(`(^|\\n)${marker}(\\n|$)`);
    if (!markerPattern.test(body)) {
      body = body.trim().length > 0 ? `${body}\n${marker}` : `${marker}\n`;
    }

    queueMicrotask(() => {
      replyEditor?.focus();
      const end = replyEditor?.value.length ?? 0;
      replyEditor?.setSelectionRange(end, end);
      replyEditor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function handleMediaChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (file) {
      if (!file.type.startsWith('image/') && !ALLOWED_MEDIA_TYPES.has(file.type)) {
        error = 'Media must be an image, MP4, or WebM video';
        input.value = '';
        setMedia(null);
        return;
      }

      if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
        error = 'Media exceeds 100MB upload limit';
        input.value = '';
        setMedia(null);
        return;
      }
    }

    error = '';
    setMedia(file);
  }

  function handleBodyPaste(event: ClipboardEvent) {
    if (!event.clipboardData) return;

    const mediaItem = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'));
    if (!mediaItem) return;

    const file = mediaItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    setMedia(file);
  }

  function clearMedia() {
    setMedia(null);
  }

  function openImage(url: string) {
    expandedImageUrl = url;
  }

  function closeImage() {
    expandedImageUrl = null;
  }

  function showVideoControls(postId: string) {
    if (controlsVisiblePostIds[postId]) return;
    controlsVisiblePostIds = {
      ...controlsVisiblePostIds,
      [postId]: true
    };
  }

  function displayUsername(username?: string | null) {
    if (!(currentUserIsAdmin && $adminShowPostUsernames)) {
      return 'anonymous';
    }
    if (!username) return 'anonymous';
    return username.replace(/_\d+$/, '');
  }

  function isUnauthorizedApiError(err: unknown): boolean {
    return err instanceof Error && /^API error 401\b/.test(err.message);
  }

  function appendLinkifiedSegments(text: string, into: PostBodySegment[]) {
    const linkified = getLinkifiedSegments(text);
    for (const segment of linkified) {
      if (segment.type === 'link') {
        into.push({
          type: 'url',
          value: segment.value,
          href: segment.href
        });
        continue;
      }

      into.push({
        type: 'text',
        value: segment.value
      });
    }
  }

  function getPostBodySegments(text: string): PostBodySegment[] {
    if (!text.length) return [];

    const segments: PostBodySegment[] = [];
    const replyRefRegex = />>(\d+)/g;
    let cursor = 0;

    for (const match of text.matchAll(replyRefRegex)) {
      const index = match.index ?? -1;
      if (index < 0) continue;

      appendLinkifiedSegments(text.slice(cursor, index), segments);

      segments.push({
        type: 'reply_ref',
        value: match[0],
        postNumber: Number(match[1])
      });

      cursor = index + match[0].length;
    }

    appendLinkifiedSegments(text.slice(cursor), segments);
    return segments;
  }

  function getPostPreviewText(post: Post): string {
    const compact = post.body.replace(/\s+/g, ' ').trim();
    if (!compact.length) return '';
    return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
  }

  function getDirectReplyTarget(post: Post): Post | null {
    if (post.post_number <= 1) return null;
    const match = post.body.match(/>>(\d+)/);
    if (!match) return null;

    const targetNumber = Number(match[1]);
    if (!Number.isFinite(targetNumber) || targetNumber <= 0 || targetNumber === post.post_number) {
      return null;
    }

    return postsByNumber.get(targetNumber) ?? null;
  }

  function getReplyIndentLevel(post: Post): number {
    if (post.post_number <= 1) return 0;

    let level = 1;
    const seen = new Set<number>([post.post_number]);
    let cursor: Post | null = post;

    while (cursor) {
      const target = getDirectReplyTarget(cursor);
      if (!target || target.post_number <= 1) break;
      if (seen.has(target.post_number)) break;

      seen.add(target.post_number);
      level += 1;
      cursor = target;
    }

    return level;
  }

  async function deleteThread() {
    opMenuOpen = false;
    if (!confirm('Delete this thread permanently?')) return;

    deleting = true;
    error = '';

    try {
      const res = await csrfFetch(
        fetch,
        `/api/boards/${data.board}/${data.thread.subject_slug}/${data.thread.token}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to delete thread');
      }

      await goto(`/boards/${data.board}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete thread';
    } finally {
      deleting = false;
    }
  }

  async function submitReply() {
    error = '';
    if (!body.trim() && !mediaFile) {
      error = 'Body or media is required';
      return;
    }
    replying = true;

    try {
      const init: RequestInit = mediaFile
        ? {
            method: 'POST',
            body: (() => {
              const form = new FormData();
              form.append('body', body);
              form.append('image', mediaFile);
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
      clearMedia();
      await invalidateAll();
    } catch (e) {
      if (isUnauthorizedApiError(e)) {
        unauthorizedModalOpen = true;
        return;
      }
      const message = e instanceof Error ? e.message : 'Failed to post reply';
      if (mediaFile && /NetworkError|Failed to fetch/i.test(message)) {
        error = `${message}. If this happens only for videos, check reverse proxy upload size (e.g. nginx client_max_body_size) and MAX_IMAGE_UPLOAD_BYTES.`;
      } else {
        error = message;
      }
    } finally {
      replying = false;
    }
  }

  function canDeleteReply(post: Post) {
    if (post.post_number <= 1) return false;
    if (!currentUserId && !currentUserIsAdmin) return false;
    return currentUserIsAdmin || post.author_user_id === currentUserId;
  }

  function toggleReplyMenu(postId: string) {
    replyMenuOpenPostIds = {
      ...replyMenuOpenPostIds,
      [postId]: !replyMenuOpenPostIds[postId]
    };
  }

  function closeReplyMenu(postId: string) {
    if (!replyMenuOpenPostIds[postId]) return;
    replyMenuOpenPostIds = {
      ...replyMenuOpenPostIds,
      [postId]: false
    };
  }

  async function deleteReply(post: Post) {
    if (!canDeleteReply(post)) return;
    closeReplyMenu(post.id);
    if (!confirm('Delete this reply permanently? This also deletes attached media.')) return;

    deletingReplyIds = {
      ...deletingReplyIds,
      [post.id]: true
    };
    error = '';

    try {
      const res = await csrfFetch(
        fetch,
        `/api/boards/${data.board}/${data.thread.subject_slug}/${data.thread.token}/replies/${post.id}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to delete reply');
      }

      await invalidateAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete reply';
    } finally {
      deletingReplyIds = {
        ...deletingReplyIds,
        [post.id]: false
      };
    }
  }
</script>

<h1>/{data.board}/ {data.thread.subject ?? '(untitled)'}</h1>

<p>
  <small>
    {#if data.posts.length > 0}
      bumped_by: {displayUsername(data.posts[data.posts.length - 1].author_username)} ·
    {/if}
    created: {new Date(data.thread.created_at).toLocaleString()}
  </small>
</p>

<hr />

<section>
  <h2>Posts</h2>

  {#each data.posts as post}
    {@const embeds = getPostEmbeds(post.body)}
    {@const replyIndentLevel = getReplyIndentLevel(post)}

    <article
      class:reply={post.post_number > 1}
      id={`post-${post.post_number}`}
      style={`--reply-level: ${replyIndentLevel};`}
    >
      <p>
        <a href={`#post-${post.post_number}`}><strong>#{post.post_number}</strong></a>
        <strong class="author-name">
          {displayUsername(post.author_username)}
          {#if currentUserIsAdmin && $adminShowPostUsernames && post.author_is_admin}
            <span class="admin-icon" aria-label="admin" title="admin">♠</span>
          {/if}
        </strong>
        {#if post.post_number === 1 && currentUserIsAdmin}
          <span class="op-menu">
            <button
              type="button"
              class="op-menu-trigger"
              aria-label="Thread options"
              title="Thread options"
              onclick={() => (opMenuOpen = !opMenuOpen)}
              disabled={deleting || replying}
            >
              ⋯
            </button>
            {#if opMenuOpen}
              <span class="op-menu-panel">
                <button type="button" onclick={deleteThread} disabled={deleting || replying}>
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
        {#if canDeleteReply(post)}
          <span class="op-menu">
            <button
              type="button"
              class="op-menu-trigger"
              aria-label="Reply options"
              title="Reply options"
              onclick={() => toggleReplyMenu(post.id)}
              disabled={deleting || replying || Boolean(deletingReplyIds[post.id])}
            >
              ⋯
            </button>
            {#if replyMenuOpenPostIds[post.id]}
              <span class="op-menu-panel">
                <button
                  type="button"
                  onclick={() => deleteReply(post)}
                  disabled={deleting || replying || Boolean(deletingReplyIds[post.id])}
                >
                  {deletingReplyIds[post.id] ? 'Deleting…' : 'Delete'}
                </button>
              </span>
            {/if}
          </span>
        {/if}
        <button
          type="button"
          class="op-reply-button"
          aria-label={`Reply to post #${post.post_number}`}
          title={`Reply to post #${post.post_number}`}
          onclick={() => startReplyToPost(post.post_number)}
          disabled={deleting || replying}
        >
          ↩
        </button>
        <small> · {new Date(post.created_at).toLocaleString()}</small>
      </p>

      <div class="post-body">
        {#each getPostBodySegments(post.body) as segment, i (i)}
          {#if segment.type === 'url'}
            <a href={segment.href} target="_blank" rel="noopener noreferrer nofollow">{segment.value}</a>
          {:else if segment.type === 'reply_ref'}
            {@const targetPost = postsByNumber.get(segment.postNumber)}
            {#if targetPost}
              {@const previewText = getPostPreviewText(targetPost)}
              <span class="reply-ref">
                <a
                  href={`#post-${segment.postNumber}`}
                  class="reply-ref-link"
                  aria-label={`Go to post #${segment.postNumber}`}
                >
                  {`>> #${segment.postNumber}`}
                </a>
                <span class="reply-ref-preview" role="tooltip">
                  <strong>#{segment.postNumber} · {displayUsername(targetPost.author_username)}</strong>
                  {#if targetPost.media_url && targetPost.media_type === 'video'}
                    <video
                      class="reply-ref-preview-media"
                      src={targetPost.media_url}
                      muted
                      loop
                      autoplay
                      playsinline
                      preload="metadata"
                    ></video>
                  {:else if targetPost.media_url || targetPost.image_url}
                    <img
                      class="reply-ref-preview-media"
                      src={targetPost.media_url ?? targetPost.image_url!}
                      alt={`Preview for post #${segment.postNumber}`}
                      loading="lazy"
                      decoding="async"
                    />
                  {/if}
                  {#if previewText}
                    <span>{previewText}</span>
                  {/if}
                </span>
              </span>
            {:else}
              <span class="reply-ref-missing">{`>> #${segment.postNumber}`}</span>
            {/if}
          {:else}
            {segment.value}
          {/if}
        {/each}
      </div>

      {#if embeds.length > 0}
        <div class="post-embeds">
          {#each embeds as embed}
            {#if embed.renderAs === 'video'}
              <video src={requireEmbedUrl(embed)} controls preload="metadata"></video>
            {:else if embed.renderAs === 'card'}
              <div class="embed-card">
                <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer">
                  <strong>{embed.title}</strong><br />
                  <span>{embed.originalUrl}</span>
                </a>
              </div>
            {:else}
              <iframe
                class:reddit-embed={embed.kind === 'reddit'}
                src={requireEmbedUrl(embed)}
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

      {#if post.media_url && post.media_type === 'video'}
        <figure class="post-image">
          <video
            src={post.media_url}
            controls={Boolean(controlsVisiblePostIds[post.id])}
            autoplay
            muted
            loop
            playsinline
            preload="metadata"
            width={post.media_width ?? undefined}
            height={post.media_height ?? undefined}
            onclick={() => showVideoControls(post.id)}
          ></video>
        </figure>
      {:else if post.image_url || (post.media_url && post.media_type === 'image')}
        {@const imageUrl = post.media_url ?? post.image_url}
        <figure class="post-image">
          <button type="button" class="image-button" onclick={() => openImage(imageUrl!)}>
            <img
              src={imageUrl}
              alt="Post image"
              loading="lazy"
              decoding="async"
              width={post.media_width ?? post.image_width ?? undefined}
              height={post.media_height ?? post.image_height ?? undefined}
            />
          </button>
        </figure>
      {/if}

      <hr />
    </article>
  {/each}
</section>

{#if expandedImageUrl}
  <div class="lightbox" onclick={closeImage}>
    <img src={expandedImageUrl} alt="Expanded post image" class="lightbox-image" />
  </div>
{/if}

{#if unauthorizedModalOpen}
  <div
    class="auth-modal-backdrop"
    role="presentation"
    onclick={() => (unauthorizedModalOpen = false)}
  >
    <div
      class="auth-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reply-auth-required-title"
      onclick={(event) => event.stopPropagation()}
    >
      <h3 id="reply-auth-required-title">Post failed</h3>
      <p>are you even logged in?</p>
      <button type="button" onclick={() => (unauthorizedModalOpen = false)}>OK</button>
    </div>
  </div>
{/if}

<section>
  <h2>Reply</h2>

  <label>
    Body
    <textarea
      class="post-editor"
      bind:this={replyEditor}
      bind:value={body}
      maxlength="5000"
      rows="8"
      onpaste={handleBodyPaste}
    ></textarea>
  </label>

  <div>
    <label>
      Media
      <input type="file" accept="image/*,video/mp4,video/webm" onchange={handleMediaChange} />
    </label>
    <p><small>Tip: you can also paste an image into the body field.</small></p>
  </div>

  {#if mediaPreviewUrl}
    <div>
      {#if mediaPreviewIsVideo}
        <video src={mediaPreviewUrl} controls preload="metadata" style="max-width: 320px; max-height: 320px;"></video>
      {:else}
        <img src={mediaPreviewUrl} alt="Selected media preview" style="max-width: 320px; max-height: 320px;" />
      {/if}
      <div>
        <button type="button" onclick={clearMedia} disabled={replying}>Remove media</button>
      </div>
    </div>
  {/if}

  <div>
    <button onclick={submitReply} disabled={replying}>
      {replying ? 'Replying...' : 'Post reply'}
    </button>
  </div>

  {#if error}
    <p>{error}</p>
  {/if}
</section>

<style>
  article.reply {
    --reply-indent-step: clamp(0.5rem, 2vw, 1.25rem);
    margin-left: calc(var(--reply-level, 1) * var(--reply-indent-step));
    padding-left: calc(var(--reply-level, 1) * 0.75rem);
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

  .post-embeds iframe.reddit-embed {
    aspect-ratio: auto;
    height: clamp(22rem, 70vh, 42rem);
  }

  .embed-card {
    width: min(100%, 560px);
    max-width: 560px;
    border: 1px solid #d7d7d7;
    border-radius: 8px;
    padding: 0.75rem;
    background: #fafafa;
  }

  .embed-card a {
    color: inherit;
    text-decoration: none;
    display: block;
    overflow-wrap: anywhere;
  }

  .embed-card a:hover {
    text-decoration: underline;
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

  .post-image video {
    display: block;
    width: auto;
    max-width: min(100%, 560px);
    height: auto;
    border-radius: 8px;
    background: #111;
  }

  .post-body a {
    color: #1d4ed8;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .reply-ref {
    position: relative;
    display: inline-block;
  }

  .post-body .reply-ref-link {
    font-weight: 600;
    text-decoration: none;
    text-underline-offset: 0;
  }

  .reply-ref-preview {
    display: none;
    position: absolute;
    top: calc(100% + 0.2rem);
    left: 0;
    z-index: 8;
    width: min(28rem, 80vw);
    padding: 0.45rem 0.55rem;
    border: 1px solid #d7d7d7;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
    white-space: normal;
    line-height: 1.3;
    pointer-events: none;
  }

  .reply-ref-preview-media {
    width: min(100%, 18rem);
    max-height: 12rem;
    object-fit: contain;
    border-radius: 6px;
    background: #111;
  }

  .reply-ref:hover .reply-ref-preview,
  .reply-ref:focus-within .reply-ref-preview {
    display: grid;
    gap: 0.2rem;
  }

  .reply-ref-missing {
    opacity: 0.75;
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

  .auth-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1rem;
  }

  .auth-modal {
    width: min(28rem, 92vw);
    border: 1px solid #ddd;
    border-radius: 10px;
    background: #fff;
    padding: 1rem;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.25);
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

  .op-reply-button {
    margin-left: 0.05rem;
  }
</style>