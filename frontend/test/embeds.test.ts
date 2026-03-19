import { describe, it, expect } from 'vitest';
import { getEmbeddableLinks, parseUrl, toEmbed } from '../src/lib/embeds';

const posttextUrl = 'https://posttext.pl/thread/single/669';
const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const redditUrl = 'https://www.reddit.com/comments/abc123/thread-title';

describe('getEmbeddableLinks', () => {
  it('should detect posttext.pl links in post body', () => {
    const links = getEmbeddableLinks(`Check this out: ${posttextUrl}`);
    expect(links).toContain(posttextUrl);
  });
  it('should detect youtube.com links in post body', () => {
    const links = getEmbeddableLinks(`Watch this: ${youtubeUrl}`);
    expect(links).toContain(youtubeUrl);
  });
  it('should detect reddit.com links in post body', () => {
    const links = getEmbeddableLinks(`Read this: ${redditUrl}`);
    expect(links).toContain(redditUrl);
  });
});

describe('embed object mapping', () => {
  it('should return a valid embed object for posttext.pl', () => {
    const url = parseUrl(posttextUrl);
    const embed = toEmbed(url!);
    expect(embed).toBeTruthy();
    expect(embed!.kind).toBe('posttext');
    expect(embed!.originalUrl).toBe(posttextUrl);
    expect(embed!.embedUrl).toBe(posttextUrl);
    expect(embed!.title).toBe('Posttext link');
  });
  it('should return a valid embed object for youtube.com', () => {
    const url = parseUrl(youtubeUrl);
    const embed = toEmbed(url!);
    expect(embed).toBeTruthy();
    expect(embed!.kind).toBe('youtube');
    expect(embed!.originalUrl).toBe(youtubeUrl);
    expect(embed!.embedUrl).toContain('youtube-nocookie.com/embed');
    expect(embed!.title).toBe('YouTube embed');
  });
  it('should return a valid embed object for reddit.com', () => {
    const url = parseUrl(redditUrl);
    const embed = toEmbed(url!);
    expect(embed).toBeTruthy();
    expect(embed!.kind).toBe('reddit');
    expect(embed!.originalUrl).toBe(redditUrl);
    expect(embed!.embedUrl).toContain('redditmedia.com');
    expect(embed!.title).toBe('Reddit embed');
  });
});
