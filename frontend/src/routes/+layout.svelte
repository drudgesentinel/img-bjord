<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { csrfFetch } from '$lib/csrf';
  import { adminShowPostUsernames } from '$lib/postIdentityPrefs';
  import { siteConfig } from '$lib/siteConfig';

  let { children, data } = $props<{
    children: import('svelte').Snippet;
    data: {
      user: {
        id: string;
        username: string;
        is_admin: boolean;
        tags: string[];
        created_at: string;
      } | null;
    };
  }>();

  const segments = $derived(page.url.pathname.split('/').filter(Boolean));
  const board = $derived(segments[0] === 'boards' ? segments[1] : null);
  const subjectSlug = $derived(segments[2] ?? null);
  const currentUserIsAdmin = $derived(Boolean(data.user?.is_admin));

  $effect(() => {
    if (!currentUserIsAdmin && $adminShowPostUsernames) {
      adminShowPostUsernames.set(false);
    }
  });

  function displayUsername(username: string) {
    return username.replace(/_\d+$/, '');
  }

  function handleShowPostUsernamesChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    adminShowPostUsernames.set(input.checked);
  }

  async function logout() {
    const res = await csrfFetch(fetch, '/api/auth/logout', { method: 'POST' });
    if (!res.ok) {
      return;
    }

    await invalidateAll();
  }
</script>

<svelte:head>
  <link rel="icon" href={siteConfig.faviconPath} />
  {#if siteConfig.siteFontCssPath}
    <link rel="stylesheet" href={siteConfig.siteFontCssPath} />
  {/if}
  {#if siteConfig.siteFontTtfPath}
    <style>
      {`@font-face {
        font-family: '${siteConfig.siteFontFamily}';
        src: url('${siteConfig.siteFontTtfPath}') format('truetype');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }`}
    </style>
  {/if}
  {#if siteConfig.postFontCssPath}
    <link rel="stylesheet" href={siteConfig.postFontCssPath} />
  {/if}
</svelte:head>

<div
  class="app-shell"
  style={`font-family: ${siteConfig.siteFontFamily}, ${siteConfig.siteFontFallback}; font-size: 16px; --post-font-family: ${siteConfig.postFontFamily}, ${siteConfig.postFontFallback};`}
>
  <header>
    <nav class="breadcrumb">
      <div class="brand-stack">
        <a href="/">
          {#if siteConfig.siteLabelImagePath}
            <img class="site-label-image" src={siteConfig.siteLabelImagePath} alt={siteConfig.siteName} />
          {:else}
            {siteConfig.siteName}
          {/if}
        </a>

        {#if board}
          <div class="board-path">
            <a href={`/boards/${board}`}>{board}</a>
            {#if subjectSlug}
              <span> =&gt; </span>
              <span>{subjectSlug}</span>
            {/if}
          </div>
        {/if}
      </div>

      <span class="spacer"></span>

      {#if data.user}
        <details class="user-menu">
          <summary class="user-pill">
            {displayUsername(data.user.username)}
            {#if data.user.is_admin}
              <span class="admin-icon" aria-label="admin" title="admin">♠</span>
            {/if}
          </summary>

          <div class="menu-panel">
            {#if data.user.tags.length > 0}
              <div class="user-tags">
                {#each data.user.tags as tag}
                  <span class="tag-pill">{tag}</span>
                {/each}
              </div>
            {/if}

            {#if data.user.is_admin}
              <a href="/admin">Admin</a>
            {/if}
            <button type="button" onclick={logout}>Sign out</button>

            {#if data.user.is_admin}
              <label class="menu-toggle-row">
                <input
                  type="checkbox"
                  checked={$adminShowPostUsernames}
                  onchange={handleShowPostUsernamesChange}
                />
                Show post usernames
              </label>
            {/if}
          </div>
        </details>
      {:else}
        <a class="login-link" href="/login">login</a>
      {/if}
    </nav>
  </header>

  <main>
    {@render children()}
  </main>
</div>

<style>
  header {
    margin-bottom: 1.5rem;
  }

  .breadcrumb {
    display: flex;
    align-items: flex-start;
  }

  .brand-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .board-path {
    font-size: 16px;
    font-weight: 600;
  }

  .breadcrumb a {
    text-decoration: none;
    color: inherit;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .spacer {
    flex: 1;
  }

  .site-label-image {
    display: block;
    max-height: 24px;
    width: auto;
  }

  .user-pill {
    font-size: 16px;
    font-weight: 600;
    background: #f1f1f1;
    border: 1px solid #ddd;
    border-radius: 999px;
    padding: 0.15rem 0.55rem;
    white-space: nowrap;
    cursor: pointer;
    list-style: none;
  }

  .user-pill::-webkit-details-marker {
    display: none;
  }

  .admin-icon {
    margin-left: 0.35rem;
    text-decoration: none;
  }

  .user-menu {
    position: relative;
    margin-left: 0.5rem;
  }

  .menu-panel {
    position: absolute;
    top: calc(100% + 0.3rem);
    right: 0;
    min-width: 9rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    padding: 0.45rem;
    z-index: 20;
  }

  .user-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }

  .menu-panel button {
    text-align: left;
  }

  .menu-toggle-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.9rem;
    border-top: 1px solid #eee;
    padding-top: 0.45rem;
    margin-top: 0.15rem;
  }

  .login-link {
    font-size: 16px;
    font-weight: 600;
  }

  .tag-pill {
    font-size: 16px;
    font-weight: 600;
    background: #e6eef8;
    border: 1px solid #c7d8ef;
    border-radius: 999px;
    padding: 0.1rem 0.45rem;
    white-space: nowrap;
  }

  main {
    max-width: 800px;
    margin: auto;
  }

  :global(.post-body),
  :global(.post-editor) {
    font-family: var(--post-font-family);
  }

  :global(.post-body) {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    max-width: 100%;
    margin: 0;
  }
</style>