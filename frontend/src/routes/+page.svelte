<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { csrfFetch } from '$lib/csrf';
  import { siteConfig } from '$lib/siteConfig';

  let { data } = $props<{
    data: {
      boards: {
        slug: string;
        name: string | null;
        created_at: string;
      }[];
      user: {
        id: string;
        username: string;
        is_admin: boolean;
        is_approved: boolean;
        created_at: string;
      } | null;
    };
  }>();

  let loginUsername = $state('');
  let loginPassword = $state('');
  let authBusy = $state(false);
  let authError = $state('');

  async function login() {
    authBusy = true;
    authError = '';

    try {
      const res = await csrfFetch(fetch, '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      if (!res.ok) {
        let details = '';
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error === 'account_pending_approval') {
            throw new Error('Account is pending admin approval');
          }
          details = body.error ?? '';
        } catch {
          details = await res.text();
        }
        throw new Error(details || 'Login failed');
      }

      loginUsername = '';
      loginPassword = '';
      await invalidateAll();
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Login failed';
    } finally {
      authBusy = false;
    }
  }

  async function logout() {
    authBusy = true;
    authError = '';

    const currentUsername = data.user?.username ?? '';

    try {
      const res = await csrfFetch(fetch, '/api/auth/logout', { method: 'POST' });
      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Logout failed');
      }

      loginUsername = currentUsername;

      await invalidateAll();
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Logout failed';
    } finally {
      authBusy = false;
    }
  }
</script>

<h1>{siteConfig.siteName}</h1>

<section>
  <h2>Account</h2>

  {#if data.user}
    <p>Signed in as <strong>{data.user.username}</strong></p>
    
    {#if data.user.is_admin}
      <p><a href="/admin">Go to admin</a></p>
    {/if}
    <button type="button" on:click={logout} disabled={authBusy}>Sign out</button>
  {:else}
    <div>
      <h3>Sign in</h3>
      <p><small>Use your generated username exactly as shown.</small></p>
      <label>
        Username
        <input bind:value={loginUsername} maxlength="64" />
      </label>
      <label>
        Password
        <input type="password" bind:value={loginPassword} minlength="1" maxlength="200" />
      </label>
      <div>
        <button
          type="button"
          on:click={login}
          disabled={authBusy || !loginUsername.trim() || loginPassword.length === 0}
        >
          Sign in
        </button>
      </div>
      <p><a href="/create-account">Create Account</a></p>
    </div>
  {/if}

  {#if authError}
    <p>{authError}</p>
  {/if}

</section>

<hr />

{#if data.boards.length === 0}
  <p>No boards yet.</p>
{:else}
  <ul>
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
</style>