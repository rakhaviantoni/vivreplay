import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'VivrePlay Admin', template: '%s | VivrePlay Admin' },
  manifest: '/admin.webmanifest?v=1',
  appleWebApp: {
    capable: true,
    title: 'VP Admin',
    statusBarStyle: 'black-translucent',
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
