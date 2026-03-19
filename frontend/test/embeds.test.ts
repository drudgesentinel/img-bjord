import { describe, it, expect } from 'vitest';
import { getEmbeddableLinks, parseUrl, toEmbed } from '../src/lib/embeds';

const posttextUrl = 'https://posttext.pl/thread/single/669';

describe('getEmbeddableLinks', () => {
  it('should detect posttext.pl links in post body', () => {
    const links = getEmbeddableLinks(`Check this out: ${posttextUrl}`);
    expect(links).toContain(posttextUrl);
  });
});

describe('posttextEmbed', () => {
  it('should return a valid embed object for posttext.pl', () => {
    const url = parseUrl(posttextUrl);
    const embed = toEmbed(url!);
    expect(embed).toBeTruthy();
    expect(embed!.kind).toBe('posttext');
    expect(embed!.originalUrl).toBe(posttextUrl);
    expect(embed!.embedUrl).toBe(posttextUrl);
    expect(embed!.title).toBe('Posttext link');
  });
});
