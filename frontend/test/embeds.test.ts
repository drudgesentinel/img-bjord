import { describe, it, expect } from 'vitest';
import { getEmbeddableLinks } from '../src/lib/embeds';

const posttextUrl = 'https://posttext.pl/thread/single/669';
const testBody = `Check this out: ${posttextUrl}`;

describe('getEmbeddableLinks', () => {
  it('should detect posttext.pl links in post body', () => {
    const links = getEmbeddableLinks(testBody);
    expect(links).toContain(posttextUrl);
  });
});
