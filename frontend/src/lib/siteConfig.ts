export type SiteConfig = {
  siteName: string;
  faviconPath: string;
  siteLabelImagePath: string | null;
  siteFontCssPath: string | null;
  siteFontTtfPath: string | null;
  siteFontFamily: string;
  siteFontFallback: string;
  postFontCssPath: string | null;
  postFontFamily: string;
  postFontFallback: string;
  logoPath: string | null;
  wallpaperPath: string | null;
  siteUrl: string;
};

export const siteConfig: SiteConfig = {
  siteName: 'krepost.net',
  faviconPath: '/favicon.png',
  siteLabelImagePath: '/krepostdotnettext.png',
  siteFontCssPath: '/fonts/site-vhs.css',
  siteFontTtfPath: null,
  siteFontFamily: 'site-vhs',
  siteFontFallback: 'Courier New, Courier, monospace',
  postFontCssPath: null,
  postFontFamily: 'site-vhs',
  postFontFallback: 'Courier New, Courier, monospace',
  logoPath: '/krepostdotnetlogo.png',
  wallpaperPath: null,
  siteUrl: 'https://krepost.net'
};
