<script lang="ts">
  import { page } from '$app/state';

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
  const board = $derived(segments[0] === 'b' ? segments[1] : null);
  const subjectSlug = $derived(segments[2] ?? null);

  function displayUsername(username: string) {
    return username.replace(/_\d+$/, '');
  }
</script>

<header>
  <nav class="breadcrumb">
    <a href="/">img-bjord</a>

    {#if board}
      <span> / </span>
      <a href={`/b/${board}`}>{board}</a>
    {/if}

    {#if subjectSlug}
      <span> / </span>
      <span>{subjectSlug}</span>
    {/if}

    {#if data.user}
      <span class="spacer"></span>
      <span class="user-meta">
        {#if data.user.tags.length > 0}
          <span class="user-tags">
            {#each data.user.tags as tag}
              <span class="tag-pill">{tag}</span>
            {/each}
          </span>
        {/if}

        <span class="user-pill">
        {displayUsername(data.user.username)}
        {#if data.user.is_admin}
          <span class="admin-icon" aria-label="admin" title="admin">♠</span>
        {/if}
        </span>
      </span>
    {/if}
  </nav>
</header>

<main>
  {@render children()}
</main>

<style>
  header {
    margin-bottom: 1.5rem;
  }

  .breadcrumb {
    font-size: 1.4rem;
    font-weight: bold;
    display: flex;
    align-items: center;
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

  .user-pill {
    font-size: 0.95rem;
    font-weight: 600;
    background: #f1f1f1;
    border-radius: 999px;
    padding: 0.15rem 0.55rem;
    white-space: nowrap;
  }

  .admin-icon {
    margin-left: 0.35rem;
  }

  .user-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-left: 0.5rem;
  }

  .user-tags {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .tag-pill {
    font-size: 0.72rem;
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
</style>