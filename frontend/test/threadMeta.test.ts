import { describe, expect, it } from 'vitest';

import { buildThreadMeta } from '../src/lib/threadMeta';
import type { Post, Thread } from '../src/lib/types';

const baseThread: Thread = {
  id: 'thread-1',
  board_slug: 'tech',
  subject: 'Cool thread',
  subject_slug: 'cool-thread',
  token: 'alpha_beta',
  created_at: '2026-01-01T00:00:00.000Z',
  bumped_at: '2026-01-01T00:00:00.000Z'
};

const site = {
  siteName: 'krepost.net',
  siteUrl: 'https://krepost.net/',
  logoPath: '/krepostdotnetlogo.png'
};

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    thread_id: 'thread-1',
    post_number: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    body: '',
    ...overrides
  };
}

describe('buildThreadMeta', () => {
  it('builds summary meta for text OP posts', () => {
    const posts = [makePost({ body: '  hello   world  ' })];

    const meta = buildThreadMeta({
      thread: baseThread,
      posts,
      site
    });

    expect(meta.title).toBe('Cool thread - /tech/');
    expect(meta.description).toBe('hello world');
    expect(meta.url).toBe('https://krepost.net/boards/tech/cool-thread/alpha_beta');
    expect(meta.imageUrl).toBe('https://krepost.net/krepostdotnetlogo.png');
    expect(meta.twitterCard).toBe('summary');
  });

  it('uses OP image media and large twitter card when available', () => {
    const posts = [
      makePost({
        body: 'image post',
        media_type: 'image',
        media_url: '/uploads/op-image.webp'
      })
    ];

    const meta = buildThreadMeta({
      thread: baseThread,
      posts,
      site
    });

    expect(meta.imageUrl).toBe('https://krepost.net/uploads/op-image.webp');
    expect(meta.twitterCard).toBe('summary_large_image');
  });

  it('falls back to generic description and favicon when no text/logo exists', () => {
    const posts = [makePost({ body: '' })];

    const meta = buildThreadMeta({
      thread: { ...baseThread, subject: null },
      posts,
      site: {
        siteName: 'krepost.net',
        siteUrl: 'https://krepost.net',
        logoPath: null
      }
    });

    expect(meta.title).toBe('(untitled) - /tech/');
    expect(meta.description).toBe('Thread on /tech/ at krepost.net');
    expect(meta.imageUrl).toBe('https://krepost.net/favicon.png');
    expect(meta.twitterCard).toBe('summary');
  });

  it('truncates long OP body descriptions to 200 characters', () => {
    const longBody = 'a'.repeat(220);
    const posts = [makePost({ body: longBody })];

    const meta = buildThreadMeta({
      thread: baseThread,
      posts,
      site
    });

    expect(meta.description.length).toBe(200);
    expect(meta.description.endsWith('...')).toBe(true);
  });
});
