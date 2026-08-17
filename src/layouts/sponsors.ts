/** Playground right-rail ads & sponsors. Edit this file to update listings. */

export interface PlaygroundAd {
  id: string;
  href: string;
  title: string;
  description: string;
  /** Optional banner image URL; falls back to text card when omitted. */
  image?: string;
}

export interface PlaygroundSponsor {
  id: string;
  name: string;
  href: string;
  slogan: string;
  /** Optional logo URL; falls back to monogram from `name`. */
  logo?: string;
}

export const SPONSOR_INQUIRY_URL =
  'https://github.com/zehuichan/workbench/issues/new?labels=sponsor&title=%5BSponsor%5D%20';

/** Featured ad slots (top of right rail). */
export const playgroundAds: readonly PlaygroundAd[] = [
  {
    id: 'workbench-star',
    href: 'https://github.com/zehuichan/workbench',
    title: 'Workbench',
    description: '复杂业务录入与字段联动的工程演练场。Star 一下支持开源。',
  },
];

/**
 * Sponsor list. Add entries here when partners come on board.
 * Empty list still shows the “成为赞助商” CTA in the aside.
 */
export const playgroundSponsors: readonly PlaygroundSponsor[] = [];
