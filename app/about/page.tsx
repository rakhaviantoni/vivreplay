import type {Metadata} from 'next';
import {AboutExperience} from '@/components/tcg/about-experience';

export const metadata: Metadata = {
  title: 'About VivrePlay · One Piece TCG Companion',
  description:
    'Learn about VivrePlay: our mission, the Vivre Card inspiration, dual-language card archives from OP-01 to OP-17, deck builder, arena practice, and collector marketplace.',
  openGraph: {
    title: 'About VivrePlay · One Piece TCG Companion',
    description:
      'A dedicated table for the One Piece Card Game community. Card archives, deck building, market pricing, and tabletop practice in one reliable place.',
  },
};

export default function AboutPage() {
  return <AboutExperience />;
}
