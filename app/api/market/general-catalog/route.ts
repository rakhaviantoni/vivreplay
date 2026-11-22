import { NextRequest, NextResponse } from 'next/server';
import presets from '@/packages/card-data/general-catalog-presets.json';

type PresetItem = {
  id: string;
  category: string;
  brand: string;
  model: string;
  attributes: Record<string, string>;
};

const allPresets = presets as unknown as PresetItem[];

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category')?.trim().toUpperCase() || '';
  const query = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() || '';
  const terms = query.split(/\s+/).filter(Boolean);

  const filtered = allPresets
    .filter((item) => {
      if (category && item.category !== category) return false;
      if (terms.length === 0) return true;
      const haystack = `${item.brand} ${item.model} ${Object.values(item.attributes).join(' ')}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    })
    .slice(0, 18);

  return NextResponse.json(
    { presets: filtered },
    { headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
}
