import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import EmbedTestComponent from './EmbedTestComponent.svelte';

const posttextUrl = 'https://posttext.pl/thread/single/669';
const posttextWwwUrl = 'https://www.posttext.pl/thread/single/669';
const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const redditUrl = 'https://www.reddit.com/comments/abc123/thread-title';

describe('Embed rendering', () => {
  it('should NOT render an iframe for posttext.pl', () => {
    const { container } = render(EmbedTestComponent, { props: { url: posttextUrl } });
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('.embed-card')).toBeTruthy();
  });

  it('should NOT render an iframe for www.posttext.pl', () => {
    const { container } = render(EmbedTestComponent, { props: { url: posttextWwwUrl } });
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('.embed-card')).toBeTruthy();
  });

  it('should render an iframe for youtube.com', () => {
    const { container } = render(EmbedTestComponent, { props: { url: youtubeUrl } });
    expect(container.querySelector('iframe')).toBeTruthy();
  });

  it('should render an iframe for reddit.com', () => {
    const { container } = render(EmbedTestComponent, { props: { url: redditUrl } });
    expect(container.querySelector('iframe')).toBeTruthy();
  });
});
