import { searchIndonesianAreas, AreaSearchResult } from '@/lib/indonesia-areas';

interface BiteshipAreaItem {
  id: string;
  name: string;
  country_name?: string;
  country_code?: string;
  administrative_division_level_1_name?: string;
  administrative_division_level_2_name?: string;
  administrative_division_level_3_name?: string;
  administrative_division_level_4_name?: string;
  postal_code?: number | string;
  latitude?: number;
  longitude?: number;
}

interface PhotonAreaFeature {
  properties?: {
    name?: string; postcode?: string; district?: string; city_district?: string;
    county?: string; suburb?: string; neighbourhood?: string; locality?: string;
    city?: string; state?: string; country?: string; countrycode?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

async function searchPhotonAreas(query: string): Promise<AreaSearchResult[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('countrycode', 'ID');
  url.searchParams.set('lang', 'id');
  url.searchParams.set('limit', '8');
  const response = await fetch(url, { headers: { accept: 'application/geo+json' }, cache: 'force-cache', next: { revalidate: 3600 } });
  if (!response.ok) return [];
  const payload = await response.json() as { features?: PhotonAreaFeature[] };
  return (payload.features ?? []).flatMap((feature, index) => {
    const p = feature.properties;
    const coords = feature.geometry?.coordinates;
    if (!p || !coords || (p.countrycode && p.countrycode.toLowerCase() !== 'id') || (p.country && !/indonesia/i.test(p.country))) return [];
    const district = p.district ?? p.city_district ?? p.county ?? '';
    const subdistrict = p.suburb ?? p.neighbourhood ?? p.locality ?? '';
    const city = p.city ?? '';
    const province = p.state ?? '';
    const name = p.name ?? subdistrict ?? district ?? city;
    if (!name || !province) return [];
    return [{ id: `photon:${coords[1]}:${coords[0]}:${index}`, name, province, city, district, subdistrict, postalCode: p.postcode ?? '', latitude: coords[1], longitude: coords[0], source: 'local' as const }];
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('query') || searchParams.get('input') || '').trim();

    if (query.length < 2) {
      return Response.json({ areas: [] });
    }

    const [photonResults, localResults] = await Promise.all([
      searchPhotonAreas(query).catch(() => []),
      Promise.resolve(searchIndonesianAreas(query).map(area=>({...area,source:'local' as const}))),
    ]);
    const seen = new Set<string>();
    const areas = [...localResults, ...photonResults].filter(area => {
      const key = [area.subdistrict, area.district, area.city, area.province].join('|').toLocaleLowerCase('id');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
    if (areas.some(area => area.postalCode)) {
      return Response.json({ areas }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' } });
    }

    // Paid provider lookup is a last resort; cache identical misses to conserve Maps quota.
    const key = process.env.BITESHIP_API_KEY;
    if (key) {
      try {
        const res = await fetch(
          `https://api.biteship.com/v1/maps/areas?countries=ID&input=${encodeURIComponent(query)}&type=single`,
          { headers: { authorization: key, 'content-type': 'application/json' }, next: { revalidate: 86400 } }
        );
        if (res.ok) {
          const data = (await res.json()) as { areas?: BiteshipAreaItem[] };
          const mapped: AreaSearchResult[] = (data.areas ?? []).map(item => ({
            id: item.id,
            name: item.name,
            province: item.administrative_division_level_1_name || '',
            city: item.administrative_division_level_2_name || '',
            district: item.administrative_division_level_3_name || '',
            subdistrict: item.administrative_division_level_4_name || '',
            postalCode: String(item.postal_code || ''),
            latitude: typeof item.latitude === 'number' && Number.isFinite(item.latitude) ? item.latitude : undefined,
            longitude: typeof item.longitude === 'number' && Number.isFinite(item.longitude) ? item.longitude : undefined,
            source: 'biteship',
          }));
          if (mapped.length) return Response.json({ areas: mapped }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800' } });
        }
      } catch { /* Keep address entry available when the provider is down. */ }
    }
    return Response.json({ areas }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch (error) {
    return Response.json({ error: (error as Error).message, areas: [] }, { status: 500 });
  }
}
