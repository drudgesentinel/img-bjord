export type EmbedKind = 'youtube' | 'reddit' | 'streamable' | 'directVideo' | 'posttext';

export type EmbeddableLink = {
  kind: EmbedKind;
  originalUrl: string;
  embedUrl: string;
  title: string;
};

export type LinkifiedSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

const MAX_EMBEDS_PER_POST = 3;
const DIRECT_VIDEO_EXT_RE = /\.(mp4|webm|ogv)(?:$|[?#])/i;
const URL_RE = /https?:\/\/[^\s<>()]+/gi;

export function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function cleanCandidateUrl(raw: string): string {
  return raw.replace(/[),.;!?]+$/g, '');
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

function directVideoEmbed(url: URL): EmbeddableLink | null {
  if (!DIRECT_VIDEO_EXT_RE.test(url.toString())) return null;

  return {
    kind: 'directVideo',
    originalUrl: url.toString(),
    embedUrl: url.toString(),
    title: 'Video embed'
  };
}

function posttextEmbed(url: URL): EmbeddableLink | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'posttext.pl') return null;
  return {
    kind: 'posttext',
    originalUrl: url.toString(),
    embedUrl: url.toString(),
    title: 'Posttext link'
  };
}

export function toEmbed(url: URL): EmbeddableLink | null {
  return (
    youtubeEmbed(url) ||
    redditEmbed(url) ||
    streamableEmbed(url) ||
    directVideoEmbed(url) ||
    posttextEmbed(url)
  );
}

const allowedDomains = ['reddit.com', 'youtube.com', 'youtu.be', 'posttext.pl'];

export function getEmbeddableLinks(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const links = text.match(urlRegex) || [];
  return links.filter(url =>
    allowedDomains.some(domain => url.includes(domain))
  );
}

export function getLinkifiedSegments(text: string): LinkifiedSegment[] {
  if (!text) return [{ type: 'text', value: '' }];

  const segments: LinkifiedSegment[] = [];
  let lastIndex = 0;
  const matches = text.matchAll(URL_RE);

  for (const match of matches) {
    const full = match[0] ?? '';
    const start = match.index ?? 0;
    const cleaned = cleanCandidateUrl(full);
    const cleanedLength = cleaned.length;

    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }

    const parsed = parseUrl(cleaned);
    if (parsed) {
      segments.push({
        type: 'link',
        value: cleaned,
        href: parsed.toString(),
      });
    } else {
      segments.push({ type: 'text', value: cleaned });
    }

    if (cleanedLength < full.length) {
      segments.push({ type: 'text', value: full.slice(cleanedLength) });
    }

    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: 'text', value: text }];
  }

  return segments;
}
