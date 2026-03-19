<script lang="ts">
  import { toEmbed, parseUrl } from '../src/lib/embeds';
  export let url: string;
  const embed = toEmbed(parseUrl(url)!);
</script>

{#if embed.kind === 'directVideo'}
  <video src={embed.embedUrl} controls preload="metadata"></video>
{:else if embed.kind === 'posttext'}
  <div class="embed-card">
    <a href={embed.originalUrl} target="_blank" rel="noopener noreferrer">
      <strong>{embed.title}</strong><br />
      <span>{embed.originalUrl}</span>
    </a>
  </div>
{:else}
  <iframe
    src={embed.embedUrl}
    title={embed.title}
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen
  ></iframe>
{/if}
