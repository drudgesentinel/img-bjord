<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { csrfFetch } from '$lib/csrf';

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
            authError = 'Your account isn\'t activated. Contact an admin.';
            return;
          }
          details = body.error ?? '';
        } catch {
          details = await res.text();
        }
        throw new Error(details || 'Login failed');
      }

      await invalidateAll();
      await goto('/');
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Login failed';
    } finally {
      authBusy = false;
    }
  }
</script>

<h1>Login</h1>
<p><small>Use your generated username exactly as shown.</small></p>

<section class="login-card">
  <label class="field">
    <span>Username</span>
    <input bind:value={loginUsername} maxlength="64" />
  </label>

  <label class="field">
    <span>Password</span>
    <input type="password" bind:value={loginPassword} minlength="1" maxlength="200" />
  </label>

  <div>
    <button
      type="button"
      onclick={login}
      disabled={authBusy || !loginUsername.trim() || loginPassword.length === 0}
    >
      {authBusy ? 'Signing in...' : 'Sign in'}
    </button>
  </div>

  <p><a href="/create-account">Create Account</a></p>
</section>

{#if authError}
  <p>{authError}</p>
{/if}

<style>
  .login-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fafafa;
    padding: 0.9rem;
    max-width: 22rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }

  .field input {
    max-width: 100%;
  }
</style>
