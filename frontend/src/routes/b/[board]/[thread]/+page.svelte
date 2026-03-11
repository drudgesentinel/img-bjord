<script lang="ts">
  let { data } = $props();
</script>

<h1>Thread</h1>

{#each data.thread.posts as post}
  <article>
    <p>#{post.post_number}</p>
    <div>{post.body}</div>
  </article>
{/each}