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
        is_admin: boolean;
        is_approved: boolean;
        created_at: string;
      } | null;
    };
  }>();

  let registerPassword = $state('');
  let usernameOptions = $state<string[]>([]);
  let reversibleUsernameOptions = $state<string[]>([]);
  let selectedRegisterUsername = $state('');
  let candidateBusy = $state(false);
  let reverseBusyFor = $state<string | null>(null);
  let loginUsername = $state('');
  let loginPassword = $state('');
  let authBusy = $state(false);
  let authError = $state('');
  let registerNotice = $state('');
  let registerActivationCode = $state('');
  let pendingApprovalModalOpen = $state(false);
  let pendingApprovalMessage = $state('Account created and pending admin approval.');

  async function loadUsernameOptions() {
    candidateBusy = true;
    authError = '';

    try {
      const res = await fetch('/api/auth/username-candidates');
      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to get username options');
      }

      const body = (await res.json()) as { usernames: string[]; reversibleUsernames?: string[] };
      usernameOptions = body.usernames;
      reversibleUsernameOptions = body.reversibleUsernames ?? [];
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

  function isReversibleOption(option: string) {
    return reversibleUsernameOptions.includes(option);
  }

  async function reverseUsernameOption(option: string) {
    if (!isReversibleOption(option)) return;

    reverseBusyFor = option;
    authError = '';

    try {
      const res = await fetch(`/api/auth/username-reverse?username=${encodeURIComponent(option)}`);
      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Failed to reverse username');
      }

      const body = (await res.json()) as { username: string | null };
      const reversed = body.username;
      if (!reversed || reversed === option) return;

      if (usernameOptions.includes(reversed)) {
        if (selectedRegisterUsername === option) {
          selectedRegisterUsername = reversed;
        }
        return;
      }

      usernameOptions = usernameOptions.map((name) => (name === option ? reversed : name));
      reversibleUsernameOptions = reversibleUsernameOptions.map((name) => (name === option ? reversed : name));
      if (selectedRegisterUsername === option) {
        selectedRegisterUsername = reversed;
      }
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Failed to reverse username';
    } finally {
      reverseBusyFor = null;
    }
  }

  async function register() {
    authBusy = true;
    authError = '';
    registerNotice = '';
    pendingApprovalModalOpen = false;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          password: registerPassword,
          activationCode: registerActivationCode.trim() ? registerActivationCode : undefined,
          username: selectedRegisterUsername || undefined
        })
      });

      if (!res.ok) {
        const details = await res.text();
        throw new Error(details || 'Registration failed');
      }

      const body = (await res.json()) as {
        pendingApproval?: boolean;
        message?: string;
        user: {
          username: string;
          activation_code?: string | null;
          is_approved?: boolean;
        };
      };

      registerPassword = '';
      registerActivationCode = '';
      loginUsername = body.user.username;
      usernameOptions = [];
      reversibleUsernameOptions = [];
      selectedRegisterUsername = '';

      if (body.pendingApproval) {
        pendingApprovalMessage = body.message ?? 'Account created and pending admin approval.';
        pendingApprovalModalOpen = true;
      } else {
        registerNotice = '';
        await invalidateAll();
      }
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Registration failed';
    } finally {
      authBusy = false;
    }
  }

  async function login() {
    authBusy = true;
    authError = '';
    registerNotice = '';
    pendingApprovalModalOpen = false;

    try {
      const res = await fetch('/api/auth/login', {
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
    pendingApprovalModalOpen = false;

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
            <label class="username-option">
              <span>
                <input
                  type="radio"
                  name="register-username"
                  value={option}
                  checked={selectedRegisterUsername === option}
                  on:change={() => (selectedRegisterUsername = option)}
                  disabled={authBusy || candidateBusy || reverseBusyFor === option}
                />
                {option}
              </span>
              <button
                type="button"
                class="reverse-button"
                on:click={() => reverseUsernameOption(option)}
                disabled={
                  authBusy ||
                  candidateBusy ||
                  reverseBusyFor !== null ||
                  !isReversibleOption(option)
                }
              >
                {reverseBusyFor === option ? 'Reversing...' : 'Reverse'}
              </button>
            </label>
          {/each}
        </fieldset>

        <button
          type="button"
          on:click={loadUsernameOptions}
          disabled={authBusy || candidateBusy}
        >
          {candidateBusy ? 'Loading...' : 'Regenerate usernames'}
        </button>
      {/if}

      {#if usernameOptions.length === 0}
        <button
          type="button"
          on:click={loadUsernameOptions}
          disabled={authBusy || candidateBusy}
        >
          {candidateBusy ? 'Loading...' : 'Load username suggestions'}
        </button>
      {/if}

      <label>
        Password
        <input type="password" bind:value={registerPassword} minlength="8" maxlength="200" />
      </label>
      <label>
        Activation message
        <input
          bind:value={registerActivationCode}
          maxlength="500"
        />
      </label>
      <div>
        <button
          type="button"
          on:click={register}
          disabled={
            authBusy ||
            registerPassword.length < 8 ||
            !selectedRegisterUsername
          }
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

  {#if registerNotice}
    <p>{registerNotice}</p>
  {/if}

</section>

{#if pendingApprovalModalOpen}
  <div class="modal-backdrop" role="presentation" on:click={() => (pendingApprovalModalOpen = false)}>
    <div
      class="pending-approval-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-approval-title"
      on:click={(event) => event.stopPropagation()}
    >
      <h3 id="pending-approval-title">Account pending approval</h3>
      <p>{pendingApprovalMessage}</p>
      <button type="button" on:click={() => (pendingApprovalModalOpen = false)}>OK</button>
    </div>
  </div>
{/if}

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

<style>
  .username-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .reverse-button {
    font-size: 0.8rem;
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

  .pending-approval-modal {
    background: #fff;
    color: #111;
    max-width: 28rem;
    width: 100%;
    border: 3px solid #1f4b99;
    border-radius: 0.5rem;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    padding: 1rem;
  }

  .pending-approval-modal h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }
</style>