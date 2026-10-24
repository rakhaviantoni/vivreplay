import Link from '@/components/ui/localized-link';

type RouteNotFoundProps = {
  href: string;
  label: string;
  description?: string;
  title?: string;
  indonesian?: boolean;
};

export function RouteNotFound({href, label, description, title, indonesian = false}: RouteNotFoundProps) {
  return <main className="page"><div className="empty-state">
    <h1>{title ?? (indonesian ? 'Halaman tidak tersedia' : 'Page not available')}</h1>
    <p>{description ?? (indonesian ? 'Halaman ini mungkin sudah dipindahkan, dihapus, atau tautannya salah.' : 'This page may have moved, been removed, or the link may be incorrect.')}</p>
    <Link href={indonesian ? `/id${href}` : href} className="button">{label}</Link>
  </div></main>;
}
