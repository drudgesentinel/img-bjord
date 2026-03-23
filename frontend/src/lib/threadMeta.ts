import type { SiteConfig } from '$lib/siteConfig';
import type { Post, Thread } from '$lib/types';

export type ThreadMeta = {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  twitterCard: 'summary' | 'summary_large_image';
};

type BuildThreadMetaInput = {
  thread: Thread;
  posts: Post[];
  site: Pick<SiteConfig, 'siteName' | 'siteUrl' | 'logoPath'>;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getOpPost(posts: Post[]): Post | null {
  return posts.find((post) => post.post_number === 1) ?? posts[0] ?? null;
}

function absoluteSiteUrl(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function buildDescription(thread: Thread, opPost: Post | null, siteName: string): string {
  const opBody = normalizeWhitespace(opPost?.body ?? '');
  if (opBody) {
    return opBody.length > 200 ? `${opBody.slice(0, 197)}...` : opBody;
  }

  return `Thread on /${thread.board_slug}/ at ${siteName}`;
}

function buildImageUrl(opPost: Post | null, site: Pick<SiteConfig, 'siteUrl' | 'logoPath'>): string {
  const mediaUrl = opPost?.media_type === 'image' ? opPost.media_url : null;

  if (mediaUrl?.startsWith('http://') || mediaUrl?.startsWith('https://')) {
    return mediaUrl;
  }

  if (mediaUrl?.startsWith('/')) {
    return absoluteSiteUrl(site.siteUrl, mediaUrl);
  }

  const fallbackLogoPath = site.logoPath ?? '/favicon.png';
  if (fallbackLogoPath.startsWith('http://') || fallbackLogoPath.startsWith('https://')) {
    return fallbackLogoPath;
  }

  return absoluteSiteUrl(site.siteUrl, fallbackLogoPath);
}

export function buildThreadMeta({ thread, posts, site }: BuildThreadMetaInput): ThreadMeta {
  const opPost = getOpPost(posts);
  const subject = thread.subject?.trim() || '(untitled)';

  return {
    title: `${subject} - /${thread.board_slug}/`,
    description: buildDescription(thread, opPost, site.siteName),
    url: absoluteSiteUrl(site.siteUrl, `/boards/${thread.board_slug}/${thread.subject_slug}/${thread.token}`),
    imageUrl: buildImageUrl(opPost, site),
    twitterCard: opPost?.media_type === 'image' ? 'summary_large_image' : 'summary'
  };
}
