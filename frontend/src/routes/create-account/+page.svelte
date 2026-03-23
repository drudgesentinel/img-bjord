<script lang="ts">
  import { onMount } from 'svelte';
  import { csrfFetch } from '$lib/csrf';

  let registerPassword = $state('');
  let usernameOptions = $state<string[]>([]);
  let reversibleUsernameOptions = $state<string[]>([]);
  let selectedRegisterUsername = $state('');
  let candidateBusy = $state(false);
  let reverseBusyFor = $state<string | null>(null);
  let authBusy = $state(false);
  let authError = $state('');
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
    pendingApprovalModalOpen = false;

    try {
      const res = await csrfFetch(fetch, '/api/auth/register', {
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
      };

      registerPassword = '';
      registerActivationCode = '';
      usernameOptions = [];
      reversibleUsernameOptions = [];
      selectedRegisterUsername = '';
      pendingApprovalMessage = body.message ?? 'Account created and pending admin approval.';
      pendingApprovalModalOpen = true;
    } catch (e) {
      authError = e instanceof Error ? e.message : 'Registration failed';
    } finally {
      authBusy = false;
    }
  }
</script>

<h1>Create Account</h1>
<p><small>Username is auto-generated for you. Contact an admin if you want something more specific.</small></p>

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
            onchange={() => (selectedRegisterUsername = option)}
            disabled={authBusy || candidateBusy || reverseBusyFor === option}
          />
          {option}
        </span>
        <button
          type="button"
          class="reverse-button"
          onclick={() => reverseUsernameOption(option)}
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
    onclick={loadUsernameOptions}
    disabled={authBusy || candidateBusy}
  >
    {candidateBusy ? 'Loading...' : 'Regenerate usernames'}
  </button>
{/if}

{#if usernameOptions.length === 0}
  <button
    type="button"
    onclick={loadUsernameOptions}
    disabled={authBusy || candidateBusy}
  >
    {candidateBusy ? 'Loading...' : 'Load username suggestions'}
  </button>
{/if}

<label class="register-field">
  Password
  <input type="password" bind:value={registerPassword} minlength="8" maxlength="200" />
</label>
<label class="register-field">
  Activation message
  <input bind:value={registerActivationCode} maxlength="500" />
</label>
<div class="register-action-row">
  <a href="/">Back to Sign in</a>
</div>
<div class="register-action-row">
  <button
    type="button"
    onclick={register}
    disabled={
      authBusy ||
      registerPassword.length < 8 ||
      !selectedRegisterUsername
    }
  >
    Create account
  </button>
</div>

{#if authError}
  <p>{authError}</p>
{/if}

{#if pendingApprovalModalOpen}
  <div class="modal-backdrop" role="presentation" onclick={() => (pendingApprovalModalOpen = false)}>
    <div
      class="pending-approval-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-approval-title"
      onclick={(event) => event.stopPropagation()}
    >
      <h3 id="pending-approval-title">Account pending approval</h3>
      <p>{pendingApprovalMessage}</p>
      <button type="button" onclick={() => (pendingApprovalModalOpen = false)}>OK</button>
    </div>
  </div>
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

  .register-field {
    display: block;
    margin-top: 0.5rem;
  }

  .register-field input {
    display: block;
    width: min(24rem, 100%);
    margin-top: 0.2rem;
    box-sizing: border-box;
  }

  .register-action-row {
    margin-top: 0.5rem;
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
