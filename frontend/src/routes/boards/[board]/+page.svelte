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

  function handleMediaChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
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

  async function createThread() {
    error = '';
    if (!body.trim() && !mediaFile) {
      error = 'Body or media is required';
      return;
    }
    creating = true;

    try {
      const init: RequestInit = mediaFile
        ? {
            method: 'POST',
            body: (() => {
              const form = new FormData();
              if (subject.trim()) form.append('subject', subject.trim());
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
            body: JSON.stringify({
              subject: subject || undefined,
              body
            })
          };

      const payload = await api<CreateThreadResponse>(fetch, `/api/boards/${data.board}/threads`, init);

      const canonicalPath =
        payload.canonicalPath ||
        `/api/boards/${payload.thread.board_slug}/${payload.thread.subject_slug}/${payload.thread.token}`;

      // backend returns /api/boards/:slug/:subjectSlug/:token
      // frontend route should be /boards/:slug/:subjectSlug/:token
      const frontendPath = canonicalPath.replace('/api/boards/', '/boards/');

      clearMedia();
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

  <div class="form-row">
    <label class="field-label" for="thread-subject">Subject</label>
    <input id="thread-subject" bind:value={subject} maxlength="100" />
  </div>

  <div class="form-row">
    <label class="field-label" for="thread-body">Body</label>
    <textarea
      id="thread-body"
      class="post-editor"
      bind:value={body}
      maxlength="5000"
      rows="8"
      on:paste={handleBodyPaste}
    ></textarea>
  </div>

  <div>
    <label>
      Media
      <input type="file" accept="image/*,video/mp4,video/webm" on:change={handleMediaChange} />
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
        <button type="button" on:click={clearMedia} disabled={creating}>Remove media</button>
      </div>
    </div>
  {/if}

  <button on:click={createThread} disabled={creating}>
    {creating ? 'Posting...' : 'Create thread'}
  </button>

  {#if error}
    <p>{error}</p>
  {/if}
</section>

<style>
  .form-row {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 42rem);
    align-items: start;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .field-label {
    padding-top: 0.4rem;
  }

  input,
  textarea {
    width: 100%;
    box-sizing: border-box;
  }
</style>

<hr />

<section>
  <h2>Threads</h2>

  {#if data.threads.length === 0}
    <p>No threads yet.</p>
  {:else}
    <ul>
      {#each data.threads as thread}
        <li>
          <a href={`/boards/${thread.board_slug}/${thread.subject_slug}/${thread.token}`}>
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

<svelte:head>
  <meta property="og:type" content="website" />
  <meta property="og:title" content={data.board + ' Board'} />
  <meta property="og:description" content={'Threads and posts for the ' + data.board + ' board.'} />
  <meta property="og:url" content={'https://krepost.net/boards/' + data.board} />
  <meta property="og:site_name" content="Krepost" />
  <meta property="og:image" content="https://krepost.net/static/logo.png" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="1200" />
  <meta property="og:image:alt" content="Krepost logo" />

  <meta name="twitter:title" content={data.board + ' Board'} />
  <meta name="twitter:description" content={'Threads and posts for the ' + data.board + ' board.'} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@krepost" />
  <meta name="twitter:image" content="https://krepost.net/static/logo.png" />
  <meta name="twitter:image:alt" content="Krepost logo" />
</svelte:head>
