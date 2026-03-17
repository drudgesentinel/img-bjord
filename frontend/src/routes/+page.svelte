<script lang="ts">
  import { siteConfig } from '$lib/siteConfig';

  let { data } = $props<{
    data: {
      boards: {
        slug: string;
        name: string | null;
        created_at: string;
      }[];
    };
  }>();
</script>

{#if siteConfig.logoPath}
  <p class="homepage-logo">
    <img src={siteConfig.logoPath} alt={`${siteConfig.siteName} logo`} style="max-width: 320px; height: auto;" />
  </p>
{/if}

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
  .homepage-logo {
    text-align: center;
  }

  .board-list {
    text-transform: uppercase;
  }
</style>