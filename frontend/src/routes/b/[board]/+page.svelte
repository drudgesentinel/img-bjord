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

  async function createThread() {
    error = '';
    if (!body.trim() && !imageFile) {
      error = 'Body or image is required';
      return;
    }
    creating = true;

    try {
      const init: RequestInit = imageFile
        ? {
            method: 'POST',
            body: (() => {
              const form = new FormData();
              if (subject.trim()) form.append('subject', subject.trim());
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
      // frontend route should be /b/:slug/:subjectSlug/:token
      const frontendPath = canonicalPath.replace('/api/boards/', '/b/');

      alert(`Save this deletion key now. It is required to delete this thread:\n\n${payload.deleteKey}`);

      clearImage();
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
      <textarea bind:value={body} maxlength="5000" rows="8" on:paste={handleBodyPaste}></textarea>
    </label>
  </div>

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
        <button type="button" on:click={clearImage} disabled={creating}>Remove image</button>
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