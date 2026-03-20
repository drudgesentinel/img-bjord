<script lang="ts">
  import { page } from '$app/state';
  import { csrfFetch } from '$lib/csrf';
  import { siteConfig } from '$lib/siteConfig';

  const HOMEPAGE_ANNOUNCEMENT_BOARD = 'general';

  let { data } = $props<{
    data: {
      boards: {
        slug: string;
        name: string | null;
        created_at: string;
      }[];
      announcement: string;
    };
  }>();

  let announcementDraft = $state(data.announcement ?? '');
  let editingAnnouncement = $state(false);
  let announcementSaving = $state(false);
  let announcementError = $state('');
  const currentUserIsAdmin = $derived(Boolean(page.data.user?.is_admin));

  function startEditingAnnouncement() {
    announcementError = '';
    announcementDraft = data.announcement ?? '';
    editingAnnouncement = true;
  }

  function cancelEditingAnnouncement() {
    if (announcementSaving) return;
    announcementError = '';
    announcementDraft = data.announcement ?? '';
    editingAnnouncement = false;
  }

  async function saveAnnouncement() {
    announcementSaving = true;
    announcementError = '';

    try {
      const res = await csrfFetch(fetch, `/api/boards/${HOMEPAGE_ANNOUNCEMENT_BOARD}/announcement`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ announcement: announcementDraft })
      });

      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to save announcement');
      }

      const payload = (await res.json()) as { announcement: string };
      data = {
        ...data,
        announcement: payload.announcement ?? ''
      };
      announcementDraft = payload.announcement ?? '';
      editingAnnouncement = false;
    } catch (e) {
      announcementError = e instanceof Error ? e.message : 'Failed to save announcement';
    } finally {
      announcementSaving = false;
    }
  }
</script>

{#if siteConfig.logoPath}
  <p class="homepage-logo">
    <img src={siteConfig.logoPath} alt={`${siteConfig.siteName} logo`} style="max-width: 320px; height: auto;" />
  </p>
{/if}

<section class="announcement-panel">
  <h2>Announcements</h2>

  {#if currentUserIsAdmin && editingAnnouncement}
    <textarea
      bind:value={announcementDraft}
      maxlength="5000"
      rows="6"
      class="announcement-editor"
      placeholder="Write announcements here"
    ></textarea>

    {#if announcementError}
      <p>{announcementError}</p>
    {/if}

    <div class="announcement-actions">
      <button type="button" on:click={saveAnnouncement} disabled={announcementSaving}>
        {announcementSaving ? 'Saving...' : 'Save announcement'}
      </button>
      <button type="button" on:click={cancelEditingAnnouncement} disabled={announcementSaving}>Cancel</button>
    </div>
  {:else}
    <div class="announcement-view">{data.announcement?.trim() ? data.announcement : 'No announcements yet.'}</div>

    {#if currentUserIsAdmin}
      <div class="announcement-actions">
        <button type="button" on:click={startEditingAnnouncement}>Edit announcement</button>
      </div>
    {/if}
  {/if}
</section>

{#if data.boards.length === 0}
  <p>No boards yet.</p>
{:else}
  <ul class="board-list">
    {#each data.boards as board}
      <li>
        <a href={`/boards/${board.slug}`}>/{board.slug}/</a>
        {#if board.name}
          - {board.name}
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .announcement-panel {
    width: min(50rem, 100%);
    margin: 0 auto 1.25rem auto;
    padding: 0.25rem 0;
  }

  .announcement-panel h2 {
    text-align: center;
  }

  .announcement-editor {
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 0.5rem;
  }

  .announcement-view {
    width: 100%;
    box-sizing: border-box;
    min-height: 8rem;
    padding: 0.5rem;
    white-space: pre-wrap;
    pointer-events: none;
    user-select: text;
    opacity: 0.95;
    cursor: default;
  }

  .announcement-actions {
    display: flex;
    justify-content: flex-end;
  }

  .homepage-logo {
    text-align: center;
  }

  .board-list {
    text-transform: uppercase;
  }
</style>