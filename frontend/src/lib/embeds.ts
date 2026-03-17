export type EmbedKind = 'youtube' | 'reddit' | 'streamable' | 'vimeo' | 'directVideo';

export type EmbeddableLink = {
  kind: EmbedKind;
  originalUrl: string;
  embedUrl: string;
  title: string;
};

const MAX_EMBEDS_PER_POST = 3;
const DIRECT_VIDEO_EXT_RE = /\.(mp4|webm|ogv)(?:$|[?#])/i;
const URL_RE = /https?:\/\/[^\s<>()]+/gi;

function cleanCandidateUrl(raw: string): string {
  return raw.replace(/[),.;!?]+$/g, '');
}

function parseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

function youtubeEmbed(url: URL): EmbeddableLink | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else if (url.pathname.startsWith('/shorts/')) {
      id = url.pathname.split('/').filter(Boolean)[1] ?? null;
    } else if (url.pathname.startsWith('/embed/')) {
      id = url.pathname.split('/').filter(Boolean)[1] ?? null;
    }
  }

  if (!id) return null;

  return {
    kind: 'youtube',
    originalUrl: url.toString(),
    embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`,
    title: 'YouTube embed'
  };
}

function redditEmbed(url: URL): EmbeddableLink | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'reddit.com' && host !== 'old.reddit.com') return null;

  if (!url.pathname.includes('/comments/')) return null;

  return {
    kind: 'reddit',
    originalUrl: url.toString(),
    embedUrl: `https://www.redditmedia.com${url.pathname}?ref_source=embed&ref=share&embed=true`,
    title: 'Reddit embed'
  };
}

function streamableEmbed(url: URL): EmbeddableLink | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'streamable.com') return null;

  const id = url.pathname.split('/').filter(Boolean)[0];
  if (!id) return null;

  return {
    kind: 'streamable',
    originalUrl: url.toString(),
    embedUrl: `https://streamable.com/e/${encodeURIComponent(id)}`,
    title: 'Streamable embed'
  };
}

function vimeoEmbed(url: URL): EmbeddableLink | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'vimeo.com') return null;

  const id = url.pathname.split('/').filter(Boolean)[0];
  if (!id || !/^\d+$/.test(id)) return null;

  return {
    kind: 'vimeo',
    originalUrl: url.toString(),
    embedUrl: `https://player.vimeo.com/video/${encodeURIComponent(id)}`,
    title: 'Vimeo embed'
  };
}

function directVideoEmbed(url: URL): EmbeddableLink | null {
  if (!DIRECT_VIDEO_EXT_RE.test(url.toString())) return null;

  return {
    kind: 'directVideo',
    originalUrl: url.toString(),
    embedUrl: url.toString(),
    title: 'Video embed'
  };
}

function toEmbed(url: URL): EmbeddableLink | null {
  return (
    youtubeEmbed(url) ||
    redditEmbed(url) ||
    streamableEmbed(url) ||
    vimeoEmbed(url) ||
    directVideoEmbed(url)
  );
}

export function getEmbeddableLinks(text: string): EmbeddableLink[] {
  const matches = text.match(URL_RE);
  if (!matches || matches.length === 0) return [];

  const seen = new Set<string>();
  const embeds: EmbeddableLink[] = [];

  for (const match of matches) {
    if (embeds.length >= MAX_EMBEDS_PER_POST) break;

    const cleaned = cleanCandidateUrl(match);
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);

    const parsed = parseUrl(cleaned);
    if (!parsed) continue;

    const embed = toEmbed(parsed);
    if (embed) embeds.push(embed);
  }

  return embeds;
}
