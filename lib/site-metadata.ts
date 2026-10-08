import type { Metadata } from 'next';

const siteName = 'VivrePlay';
const defaultImage = '/brand/vivreplay-og.png';

export function pageMetadata({
  title,
  description,
  path,
  image = defaultImage,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const socialTitle = `${title} | ${siteName}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName,
      title: socialTitle,
      description,
      url: path,
      images: [{ url: image, width: 1200, height: 630, alt: socialTitle }],
    },
    twitter: { card: 'summary_large_image', title: socialTitle, description, images: [image] },
  };
}

export function privateMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
  };
}
