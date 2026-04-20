<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { csrfFetch } from '$lib/csrf';

  type AdminUser = {
    id: string;
    username: string;
    activation_code: string | null;
    is_approved: boolean;
    is_admin: boolean;
    tags: string[];
    created_at: string;
  };

  type AdminBoard = {
    slug: string;
    name: string | null;
    visible_to_tags: string[];
    created_at: string;
  };

  type AdminSystem = {
    disk: {
      path: string;
      mediaStorageDriver: string;
      totalBytes: number;
      availableBytes: number;
      usedBytes: number;
      usedPercent: number;
    };
  };

  let { data } = $props<{ data: { users: AdminUser[]; boards: AdminBoard[]; system: AdminSystem } }>();
  let error = $state('');
  let busyUserId = $state<string | null>(null);
  let busyBoardSlug = $state<string | null>(null);
  let creatingBoard = $state(false);
  let newBoardSlug = $state('');
  let newBoardName = $state('');
  let newBoardVisibleToTags = $state('');
  let tagsDraft = $state<Record<string, string>>({});
  let boardVisibilityDraft = $state<Record<string, string>>({});
  let successModalOpen = $state(false);
  let successMessage = $state('');

  for (const user of data.users) {
    tagsDraft[user.id] = user.tags.join(', ');
  }

  for (const board of data.boards) {
    boardVisibilityDraft[board.slug] = (board.visible_to_tags ?? []).join(', ');
  }

  function showSuccessModal(message: string) {
    successMessage = message;
    successModalOpen = true;
  }

  function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    const rounded = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
    return `${rounded} ${units[idx]}`;
  }

  async function removeUser(user: AdminUser) {
    if (!confirm(`Delete user ${user.username}?`)) return;

    busyUserId = user.id;
    error = '';
    try {
      const res = await csrfFetch(fetch, `/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to remove user');
      }

      await invalidateAll();
      showSuccessModal(`User ${user.username} deleted.`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to remove user';
    } finally {
      busyUserId = null;
    }
  }

  async function saveTags(user: AdminUser) {
    busyUserId = user.id;
    error = '';

    try {
      const tags = (tagsDraft[user.id] ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await csrfFetch(fetch, `/api/admin/users/${user.id}/tags`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tags })
      });

      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to update tags');
      }

      await invalidateAll();
      showSuccessModal(`Tags saved for ${user.username}.`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update tags';
    } finally {
      busyUserId = null;
    }
  }

  async function approveUser(user: AdminUser) {
    busyUserId = user.id;
    error = '';

    try {
      const res = await csrfFetch(fetch, `/api/admin/users/${user.id}/approve`, { method: 'POST' });
      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to approve user');
      }

      await invalidateAll();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to approve user';
    } finally {
      busyUserId = null;
    }
  }

  async function createBoard() {
    const slug = newBoardSlug.trim().toLowerCase();
    const name = newBoardName.trim();
    const visibleToTags = newBoardVisibleToTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!slug || !name) {
      error = 'Board slug and name are required';
      return;
    }

    creatingBoard = true;
    error = '';

    try {
      const res = await csrfFetch(fetch, '/api/admin/boards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, name, visibleToTags })
      });

      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to create board');
      }

      newBoardSlug = '';
      newBoardName = '';
      newBoardVisibleToTags = '';
      await invalidateAll();
      showSuccessModal(`Board /${slug}/ created.`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create board';
    } finally {
      creatingBoard = false;
    }
  }

  async function removeBoard(board: AdminBoard) {
    if (!confirm(`Delete board /${board.slug}/?`)) return;

    busyBoardSlug = board.slug;
    error = '';

    try {
      const res = await csrfFetch(fetch, `/api/admin/boards/${board.slug}`, { method: 'DELETE' });
      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to remove board');
      }

      await invalidateAll();
      showSuccessModal(`Board /${board.slug}/ deleted.`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to remove board';
    } finally {
      busyBoardSlug = null;
    }
  }

  async function saveBoardVisibility(board: AdminBoard) {
    busyBoardSlug = board.slug;
    error = '';

    try {
      const visibleToTags = (boardVisibilityDraft[board.slug] ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const res = await csrfFetch(fetch, `/api/admin/boards/${board.slug}/visibility`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visibleToTags })
      });

      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to update board visibility');
      }

      await invalidateAll();
      showSuccessModal(`Visibility saved for /${board.slug}/.`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update board visibility';
    } finally {
      busyBoardSlug = null;
    }
  }
</script>

<h1>Admin</h1>

{#if error}
  <p>{error}</p>
{/if}

<section>
  <h2>System</h2>
  <table>
    <tbody>
      <tr>
        <th>Available disk</th>
        <td>{formatBytes(data.system.disk.availableBytes)}</td>
      </tr>
      <tr>
        <th>Disk path</th>
        <td><code>{data.system.disk.path}</code></td>
      </tr>
      <tr>
        <th>Storage driver</th>
        <td>{data.system.disk.mediaStorageDriver}</td>
      </tr>
      <tr>
        <th>Used / Total</th>
        <td>
          {formatBytes(data.system.disk.usedBytes)} / {formatBytes(data.system.disk.totalBytes)}
          ({data.system.disk.usedPercent.toFixed(1)}%)
        </td>
      </tr>
    </tbody>
  </table>
</section>

<hr />

{#if successModalOpen}
  <div class="modal-backdrop" role="presentation" onclick={() => (successModalOpen = false)}>
    <div
      class="success-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-success-title"
      onclick={(event) => event.stopPropagation()}
    >
      <h3 id="admin-success-title">Success</h3>
      <p>{successMessage}</p>
      <button type="button" onclick={() => (successModalOpen = false)}>OK</button>
    </div>
  </div>
{/if}

<section>
  <h2>Boards</h2>

  <div class="board-create-row">
    <input
      bind:value={newBoardSlug}
      placeholder="slug (e.g. tech)"
      maxlength="20"
      disabled={creatingBoard}
    />
    <input
      bind:value={newBoardName}
      placeholder="name (e.g. Technology)"
      maxlength="100"
      disabled={creatingBoard}
    />
    <input
      bind:value={newBoardVisibleToTags}
      placeholder="visible tags (optional, comma separated)"
      maxlength="600"
      disabled={creatingBoard}
    />
    <button type="button" onclick={createBoard} disabled={creatingBoard}>
      {creatingBoard ? 'Creating...' : 'Create board'}
    </button>
  </div>

  {#if data.boards.length === 0}
    <p>No boards found.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Slug</th>
          <th>Name</th>
          <th>Visible tags</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.boards as board}
          <tr>
            <td>/{board.slug}/</td>
            <td>{board.name ?? ''}</td>
            <td>
              <input
                value={boardVisibilityDraft[board.slug] ?? ''}
                oninput={(e) => {
                  boardVisibilityDraft = {
                    ...boardVisibilityDraft,
                    [board.slug]: (e.currentTarget as HTMLInputElement).value
                  };
                }}
                placeholder="public (blank) or tags"
                disabled={busyBoardSlug === board.slug}
              />
            </td>
            <td>{new Date(board.created_at).toLocaleString()}</td>
            <td>
              <button
                type="button"
                onclick={() => saveBoardVisibility(board)}
                disabled={busyBoardSlug === board.slug}
              >
                Save visibility
              </button>
              <button
                type="button"
                onclick={() => removeBoard(board)}
                disabled={busyBoardSlug === board.slug}
              >
                Delete board
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<hr />

{#if data.users.length === 0}
  <p>No users found.</p>
{:else}
  <table>
    <thead>
      <tr>
        <th>Username</th>
        <th>Activation code</th>
        <th>Approval</th>
        <th>Role</th>
        <th>Tags (comma separated)</th>
        <th>Created</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.users as user}
        <tr>
          <td>{user.username}</td>
          <td>{user.activation_code ?? ''}</td>
          <td>{user.is_approved ? 'approved' : 'pending'}</td>
          <td>{user.is_admin ? 'admin' : 'user'}</td>
          <td>
            <input
              value={tagsDraft[user.id] ?? ''}
              oninput={(e) => {
                tagsDraft = {
                  ...tagsDraft,
                  [user.id]: (e.currentTarget as HTMLInputElement).value
                };
              }}
              placeholder="e.g. mod, vip"
              disabled={busyUserId === user.id}
            />
          </td>
          <td>{new Date(user.created_at).toLocaleString()}</td>
          <td>
            {#if !user.is_approved}
              <button type="button" onclick={() => approveUser(user)} disabled={busyUserId === user.id}>
                Approve
              </button>
            {/if}
            <button type="button" onclick={() => saveTags(user)} disabled={busyUserId === user.id}>
              Save tags
            </button>
            <button type="button" onclick={() => removeUser(user)} disabled={busyUserId === user.id}>
              Delete user
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    border: 1px solid #ddd;
    padding: 0.5rem;
    vertical-align: top;
  }

  input {
    width: 100%;
    max-width: 24rem;
  }

  .board-create-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .board-create-row input {
    width: auto;
    min-width: 12rem;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .success-modal {
    background: #fff;
    color: #111;
    max-width: 24rem;
    width: 100%;
    border: 3px solid #1f4b99;
    border-radius: 0.5rem;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    padding: 1rem;
  }

  .success-modal h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }
</style>
