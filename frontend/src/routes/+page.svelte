<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';

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
        created_at: string;
      } | null;
    };
  }>();

  let registerPassword = $state('');
  let usernameOptions = $state<string[]>([]);
  let selectedRegisterUsername = $state('');
  let candidateBusy = $state(false);
  let loginUsername = $state('');
  let loginPassword = $state('');
  let authBusy = $state(false);
  let authError = $state('');

  async function loadUsernameOptions() {
    candidateBusy = true;
    authError = '';

    try {
      const res = await fetch('/api/auth/username-candidates');
      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to get username options');
      }

      const body = (await res.json()) as { usernames: string[] };
      usernameOptions = body.usernames;
      if (body.usernames.length > 0) {
        selectedRegisterUsername = body.usernames[0];
      }
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Failed to get username options';
    } finally {
      candidateBusy = false;
    }
  }

  onMount(async () => {
    await loadUsernameOptions();
  });

  async function register() {
    authBusy = true;
    authError = '';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          password: registerPassword,
          username: selectedRegisterUsername || undefined
        })
      });

      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Registration failed');
      }

      const body = (await res.json()) as {
        user: {
          username: string;
        };
      };

      registerPassword = '';
      loginUsername = body.user.username;
      usernameOptions = [];
      selectedRegisterUsername = '';
      await invalidateAll();
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Registration failed';
    } finally {
      authBusy = false;
    }
  }

  async function login() {
    authBusy = true;
    authError = '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      if (!res.ok) {
        const details = await res.text();
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
      const res = await fetch('/api/auth/logout', { method: 'POST' });
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

<h1>img-bjord</h1>

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
      <h3>Create account</h3>
      <p><small>Username is auto-generated for you. 
      Contact an admin if you want something more specific.</small></p>

      {#if usernameOptions.length > 0}
        <fieldset>
          <legend>Choose a username</legend>
          {#each usernameOptions as option}
            <label>
              <input
                type="radio"
                name="register-username"
                value={option}
                checked={selectedRegisterUsername === option}
                on:change={() => (selectedRegisterUsername = option)}
                disabled={authBusy || candidateBusy}
              />
              {option}
            </label>
          {/each}
        </fieldset>
      {/if}

      <label>
        Password
        <input type="password" bind:value={registerPassword} minlength="8" maxlength="200" />
      </label>
      <div>
        <button
          type="button"
          on:click={register}
          disabled={authBusy || registerPassword.length < 8 || !selectedRegisterUsername}
        >
          Create account
        </button>
      </div>
    </div>

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
        <a href={`/b/${board.slug}`}>/{board.slug}/</a>
        {#if board.name}
          - {board.name}
        {/if}
      </li>
    {/each}
  </ul>
{/if}