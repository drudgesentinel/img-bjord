<script lang="ts">
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

<h1>img-bjord</h1>

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