<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();

  const segments = $derived(page.url.pathname.split('/').filter(Boolean));
  const board = $derived(segments[0] === 'b' ? segments[1] : null);
  const subjectSlug = $derived(segments[2] ?? null);
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
  }

  .breadcrumb a {
    text-decoration: none;
    color: inherit;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  main {
    max-width: 800px;
    margin: auto;
  }
</style>