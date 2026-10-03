'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {
  GlobeIcon as Globe,
  ShieldCheckIcon as ShieldCheck,
  FloppyDiskIcon as Save,
  TruckIcon as Truck,
  EnvelopeSimpleIcon as EnvelopeSimple,
  CardsIcon as Cards,
  StackIcon as Layers3,
  HeartIcon as Heart,
  SignOutIcon as SignOut,
  ArrowSquareOutIcon as ArrowSquareOut,
  CheckCircleIcon as CheckCircle,
  GearIcon as Gear,
  MagnifyingGlassIcon as Search,
  XIcon as XMark,
  MapPinIcon as MapPin,
} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {api, useAccount, type AccountState} from '@/lib/client';
import {authClient} from '@/lib/auth-client';
import {Picker} from './catalog';
import {AccountStatus} from './status';
import {MapPicker} from './map-picker';
import {TurnstileField,turnstileEnabled,turnstileHeaders} from './turnstile-field';
import {isBiteshipAreaId} from '@/lib/shipping/biteship-area';
import {IntroCardRail} from './intro-card-rail';
import {
  searchIndonesianAreas,
  getCities,
  getDistricts,
  getSubdistricts,
  type AreaSearchResult,
  INDONESIAN_REGIONS,
} from '@/lib/indonesia-areas';

type ShippingOrigin = {
  ownerId: string;
  label: string;
  recipientName: string | null;
  phone: string | null;
  addressLine: string;
  addressDetail: string;
  city: string;
  postalCode: string;
  areaId: string | null;
  latitude?: number | null;
  longitude?: number | null;
  shippingMethods?: string[];
  regionNames?:{province?:string;city?:string;district?:string;subdistrict?:string};
  updatedAt: string | null;
};
type RegionOption={id:string;name:string;postalCode?:string|null;latitude?:number|null;longitude?:number|null};
type GeocodeResult={label:string;latitude:number;longitude:number;postalCode:string;district:string;subdistrict:string;city:string;province:string;type:string};

function normalizeRegionName(value:string){
  const normalized=value.toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^(provinsi|province|kota administrasi|kabupaten administrasi|kabupaten|kota|kab\.?|kec\.?|kecamatan)\s+/,'').replace(/[^a-z0-9]+/g,' ').trim();
  if(normalized==='dki jakarta'||normalized==='daerah khusus ibukota jakarta')return 'jakarta';
  if(normalized==='di yogyakarta'||normalized==='daerah istimewa yogyakarta')return 'yogyakarta';
  return normalized;
}
function matchRegion(options:RegionOption[],name:string){
  const query=normalizeRegionName(name);
  if(!query)return undefined;
  return options.find(option=>normalizeRegionName(option.name)===query);
}
type RegionContext={province?:string;city?:string;district?:string};
function getLocalShippingRegions(level:'provinces'|'regencies'|'districts'|'villages',context:RegionContext={}):RegionOption[]{
  if(level==='provinces')return INDONESIAN_REGIONS.map(province=>({id:`local:province:${encodeURIComponent(province.name)}`,name:province.name,latitude:province.latitude,longitude:province.longitude}));
  const province=INDONESIAN_REGIONS.find(item=>normalizeRegionName(item.name)===normalizeRegionName(context.province??''));
  if(level==='regencies'&&province)return getCities(province.name).map(city=>({id:`local:city:${encodeURIComponent(province.name)}:${encodeURIComponent(city.name)}`,name:city.name,latitude:city.latitude,longitude:city.longitude}));
  const city=province?getCities(province.name).find(item=>normalizeRegionName(item.name)===normalizeRegionName(context.city??'')):undefined;
  if(level==='districts'&&province&&city)return getDistricts(province.name,city.name).map(district=>({id:`local:district:${encodeURIComponent(province.name)}:${encodeURIComponent(city.name)}:${encodeURIComponent(district.name)}`,name:district.name,latitude:district.latitude,longitude:district.longitude}));
  const district=province&&city?getDistricts(province.name,city.name).find(item=>normalizeRegionName(item.name)===normalizeRegionName(context.district??'')):undefined;
  if(level==='villages'&&province&&city&&district)return getSubdistricts(province.name,city.name,district.name).map(village=>({id:`local:village:${encodeURIComponent(province.name)}:${encodeURIComponent(city.name)}:${encodeURIComponent(district.name)}:${encodeURIComponent(village.name)}`,name:village.name,postalCode:village.postalCode,latitude:village.latitude,longitude:village.longitude}));
  return [];
}
async function loadShippingRegions(level:'provinces'|'regencies'|'districts'|'villages',parent?:string,context:RegionContext={}):Promise<RegionOption[]>{
  if(parent?.startsWith('local:')){
    const local=getLocalShippingRegions(level,context);
    if(local.length)return local;
  }
  const params=new URLSearchParams({level});
  if(parent)params.set('parent',parent);
  try{
    const response=await fetch(`/api/shipping/regions?${params}`);
    const payload=await response.json() as {items?:RegionOption[]};
    if(response.ok&&Array.isArray(payload.items)&&payload.items.length)return payload.items;
  }catch{/* Fall back to the public region feed from the browser. */}
  try{
    const url=new URL(`https://www.emsifa.com/api-wilayah-indonesia/v2/${level}.json`);
    if(parent)url.pathname=`/api-wilayah-indonesia/v2/${level}/${encodeURIComponent(parent)}.json`;
    const response=await fetch(url,{headers:{accept:'application/json'}});
    if(!response.ok)throw new Error('Public regions feed unavailable.');
    const payload=await response.json() as {data?:Array<{id?:string|number;name:string;postal_code?:string|number|null;lat?:number|null;lng?:number|null}>;items?:RegionOption[]};
    const rows=Array.isArray(payload.data)?payload.data:payload.items;
    if(Array.isArray(rows)&&rows.length)return rows.map(row=>('id'in row&&row.id!==undefined?{id:String(row.id),name:row.name,postalCode:'postal_code'in row&&row.postal_code?String(row.postal_code):null,latitude:'lat'in row?row.lat??null:null,longitude:'lng'in row?row.lng??null:null}:row as RegionOption));
  }catch{/* Continue with the bundled Indonesian area index. */}
  const local=getLocalShippingRegions(level,context);
  if(local.length)return local;
  throw new Error('Shipping regions are unavailable.');
}

async function searchShippingAddresses(query:string,language:'EN'|'ID',latitude:number|null,longitude:number|null):Promise<GeocodeResult[]>{
  const params=new URLSearchParams({q:query,lang:language.toLowerCase()});
  if(latitude!=null)params.set('lat',String(latitude));
  if(longitude!=null)params.set('lon',String(longitude));
  try{
    const response=await fetch(`/api/shipping/geocode?${params}`);
    const payload=await response.json() as {results?:GeocodeResult[]};
    if(response.ok&&Array.isArray(payload.results)&&payload.results.length)return payload.results;
  }catch{/* Use the public browser geocoder when Worker egress is unavailable. */}
  type Feature={properties?:{name?:string;street?:string;housenumber?:string;postcode?:string;district?:string;city_district?:string;county?:string;suburb?:string;neighbourhood?:string;locality?:string;city?:string;state?:string;country?:string;countrycode?:string;osm_value?:string;type?:string};geometry?:{coordinates?:[number,number]}};
  const photonSearch=async(searchQuery:string)=>{
    const url=new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q',searchQuery);url.searchParams.set('countrycode','ID');url.searchParams.set('lang',language.toLowerCase());url.searchParams.set('limit','8');
    if(latitude!=null)url.searchParams.set('lat',String(latitude));
    if(longitude!=null)url.searchParams.set('lon',String(longitude));
    const response=await fetch(url,{headers:{accept:'application/geo+json'}});
    if(!response.ok)throw new Error('Address search unavailable.');
    return (await response.json() as {features?:Feature[]}).features??[];
  };
  let features=await photonSearch(query);
  if(!features.length){
    const relaxed=query.replace(/\b(?:tower|block|blok|unit|lantai|floor|suite|room)\s*[a-z0-9-]+(?:\s+[a-z0-9-]+)?/i,'').replace(/^(?:apartemen|apartment)\s+/i,'').replace(/[\s,]+/g,' ').trim();
    if(relaxed&&relaxed.toLocaleLowerCase()!==query.toLocaleLowerCase())features=await photonSearch(relaxed);
  }
  return features.flatMap(feature=>{
    const p=feature.properties,coords=feature.geometry?.coordinates;
    if(!p||!coords||(p.countrycode&&p.countrycode.toLowerCase()!=='id')||(p.country&&!/indonesia/i.test(p.country)))return [];
    const district=p.district??p.city_district??p.county??'',subdistrict=p.suburb??p.neighbourhood??'';
    const locality=[subdistrict,district,p.city,p.state].filter((value,index,list):value is string=>Boolean(value)&&list.indexOf(value)===index);
    const street=[p.housenumber,p.street].filter(Boolean).join(' ');
    const label=[p.name,street,...locality,p.postcode,p.country].filter((value,index,list):value is string=>Boolean(value)&&list.indexOf(value)===index).join(', ');
    return [{label,latitude:coords[1],longitude:coords[0],postalCode:p.postcode??'',district,subdistrict,city:p.city??'',province:p.state??'',type:p.osm_value??p.type??''}];
  });
}

const COMMON_REGIONS = [
  { value: 'ID', label: 'Indonesia (ID)' },
  { value: 'JP', label: 'Japan (JP)' },
  { value: 'US', label: 'United States (US)' },
  { value: 'SG', label: 'Singapore (SG)' },
  { value: 'MY', label: 'Malaysia (MY)' },
  { value: 'PH', label: 'Philippines (PH)' },
  { value: 'TH', label: 'Thailand (TH)' },
  { value: 'GB', label: 'United Kingdom (GB)' },
  { value: 'AU', label: 'Australia (AU)' },
  { value: 'CA', label: 'Canada (CA)' },
  { value: 'DE', label: 'Germany (DE)' },
  { value: 'FR', label: 'France (FR)' },
];

const COMMON_TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB · UTC+7)' },
  { value: 'Asia/Makassar', label: 'Asia/Makassar (WITA · UTC+8)' },
  { value: 'Asia/Jayapura', label: 'Asia/Jayapura (WIT · UTC+9)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST · UTC+9)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT · UTC+8)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

export interface BiteshipCourierOption {
  id: string;
  name: string;
  badge: { en: string; id: string };
  desc: { en: string; id: string };
  category: 'instant' | 'regular';
}

export const BITESHIP_COURIERS: BiteshipCourierOption[] = [
  // Instant / Same Day
  {
    id: 'grab',
    name: 'GrabExpress',
    badge: { en: 'Instant / Same Day · Up to 40 km', id: 'Instan / Same Day · Maks 40 km' },
    desc: {
      en: 'Direct on-demand bike delivery for local orders within 40 km radius.',
      id: 'Pengiriman instan sepeda motor untuk pesanan lokal radius hingga 40 km.',
    },
    category: 'instant',
  },
  {
    id: 'gojek',
    name: 'GoSend (Gojek)',
    badge: { en: 'Instant / Same Day · Up to 40 km', id: 'Instan / Same Day · Maks 40 km' },
    desc: {
      en: 'Reliable on-demand door-to-door courier service across metropolitan areas.',
      id: 'Layanan kurir on-demand pintu-ke-pintu terpercaya di area metropolitan.',
    },
    category: 'instant',
  },
  // Regular / Express / Nationwide
  {
    id: 'jnt',
    name: 'J&T Express',
    badge: { en: 'Nationwide · Drop-off / Pick-up', id: 'Seluruh Indonesia · Drop-off / Pick-up' },
    desc: {
      en: 'Fast nationwide parcel delivery with 365 days pickup and drop point service.',
      id: 'Pengiriman paket cepat ke seluruh Indonesia tanpa hari libur dengan layanan pick-up & drop point.',
    },
    category: 'regular',
  },
  {
    id: 'jne',
    name: 'JNE Express',
    badge: { en: 'Nationwide · REG / YES', id: 'Seluruh Indonesia · REG / YES' },
    desc: {
      en: 'Most extensive shipping network in Indonesia with dependable tracking.',
      id: 'Jaringan kurir terluas di Indonesia dengan pelacakan paket akurat.',
    },
    category: 'regular',
  },
  {
    id: 'sicepat',
    name: 'SiCepat Ekspres',
    badge: { en: 'Nationwide · Best / Reguler', id: 'Seluruh Indonesia · Best / Reguler' },
    desc: {
      en: 'High-speed eCommerce logistics with fast transit times.',
      id: 'Logistik cepat untuk transaksi jual-beli kartu dengan durasi pengiriman singkat.',
    },
    category: 'regular',
  },
  {
    id: 'anteraja',
    name: 'Anteraja',
    badge: { en: 'Nationwide · Reguler / Next Day', id: 'Seluruh Indonesia · Reguler / Next Day' },
    desc: {
      en: 'Modern app-tracked courier service with scheduled doorstep pickup.',
      id: 'Layanan kurir modern dengan penjemputan paket terjadwal di alamat Anda.',
    },
    category: 'regular',
  },
  {
    id: 'tiki',
    name: 'TIKI',
    badge: { en: 'Nationwide · ONS / TDS / REG', id: 'Seluruh Indonesia · ONS / TDS / REG' },
    desc: {
      en: 'Established courier service with flexible delivery speed options.',
      id: 'Penyedia jasa pengiriman berpengalaman dengan opsi layanan reguler dan kilat.',
    },
    category: 'regular',
  },
  {
    id: 'pos',
    name: 'Pos Indonesia',
    badge: { en: 'All 38 Provinces · Pos Reguler', id: 'Seluruh 38 Provinsi · Pos Reguler' },
    desc: {
      en: 'Complete coverage reaching all districts and sub-districts throughout Indonesia.',
      id: 'Jangkauan terlengkap hingga ke kecamatan dan pelosok seluruh Indonesia.',
    },
    category: 'regular',
  },
  {
    id: 'lion',
    name: 'Lion Parcel',
    badge: { en: 'Air Cargo · REGPACK / ONEPACK', id: 'Kargo Udara · REGPACK / ONEPACK' },
    desc: {
      en: 'Air cargo-backed delivery connecting islands and remote regions rapidly.',
      id: 'Didukung armada kargo udara untuk pengiriman antarpulau yang efisien.',
    },
    category: 'regular',
  },
  {
    id: 'ninja',
    name: 'Ninja Xpress',
    badge: { en: 'Nationwide · Standard / COD', id: 'Seluruh Indonesia · Standard / COD' },
    desc: {
      en: 'Tech-enabled parcel delivery with high fulfillment success rates.',
      id: 'Pengiriman paket berbasis teknologi dengan tingkat keberhasilan antar tinggi.',
    },
    category: 'regular',
  },
  {
    id: 'wahana',
    name: 'Wahana Express',
    badge: { en: 'Economical · Express', id: 'Ekonomis · Express' },
    desc: {
      en: 'Cost-effective logistics solution for lightweight trading card shipments.',
      id: 'Solusi logistik hemat biaya untuk pengiriman paket kartu koleksi.',
    },
    category: 'regular',
  },
];

const POPULAR_COURIER_SELECTION = ['jnt', 'jne', 'sicepat', 'grab', 'gojek'];

function normalizeCourierMethods(rawMethods?: string[]): string[] {
  if (!rawMethods || rawMethods.length === 0) {
    return [];
  }
  const result: string[] = [];
  for (const m of rawMethods) {
    if (m === 'instant') {
      if (!result.includes('grab')) result.push('grab');
      if (!result.includes('gojek')) result.push('gojek');
    } else if (m === 'regular') {
      if (!result.includes('jnt')) result.push('jnt');
      if (!result.includes('jne')) result.push('jne');
      if (!result.includes('sicepat')) result.push('sicepat');
    } else if (BITESHIP_COURIERS.some(c => c.id === m)) {
      if (!result.includes(m)) result.push(m);
    }
  }
  return result;
}

export function Profile(){
  const {data,error,refresh}=useAccount();
  if(error)return <main className="page"><AccountStatus error={error} retry={refresh}/></main>;
  if(!data)return <ProfileSkeleton/>;
  return <ProfileForm profile={data.profile} data={data} refresh={refresh}/>;
}

function ProfileSkeleton(){
  return (
    <main className="page profile-page profile-skeleton-page" aria-busy="true" aria-label="Loading profile">
      <section className="library-intro profile-intro">
        <div className="library-intro-copy">
          <p className="kicker">PLAYER PROFILE</p>
          <h1>Player profile & settings.</h1>
          <p>Manage your collector identity, display preferences, and shipping address.</p>
        </div>
        <IntroCardRail/>
      </section>

      <div className="profile-layout">
        {/* Profile Card / Sidebar Skeleton */}
        <section className="profile-card profile-skeleton-card">
          <div className="profile-emblem profile-skeleton-shimmer profile-skeleton-avatar" />
          <div className="profile-skeleton-shimmer profile-skeleton-line profile-skeleton-name" />
          <div className="profile-skeleton-shimmer profile-skeleton-line profile-skeleton-handle" />
          <div className="profile-skeleton-shimmer profile-skeleton-badge" />

          <div className="profile-stats-grid">
            <div className="profile-stat-box profile-skeleton-stat">
              <div className="profile-skeleton-shimmer profile-skeleton-stat-num" />
              <div className="profile-skeleton-shimmer profile-skeleton-stat-label" />
            </div>
            <div className="profile-stat-box profile-skeleton-stat">
              <div className="profile-skeleton-shimmer profile-skeleton-stat-num" />
              <div className="profile-skeleton-shimmer profile-skeleton-stat-label" />
            </div>
            <div className="profile-stat-box profile-skeleton-stat">
              <div className="profile-skeleton-shimmer profile-skeleton-stat-num" />
              <div className="profile-skeleton-shimmer profile-skeleton-stat-label" />
            </div>
          </div>

          <div className="profile-facts profile-skeleton-facts">
            <div className="profile-skeleton-shimmer profile-skeleton-fact" />
            <div className="profile-skeleton-shimmer profile-skeleton-fact" />
            <div className="profile-skeleton-shimmer profile-skeleton-fact" />
          </div>

          <div className="profile-card-actions">
            <div className="profile-skeleton-shimmer profile-skeleton-btn" />
            <div className="profile-skeleton-shimmer profile-skeleton-btn" />
          </div>
        </section>

        {/* Main Settings Panel Skeleton */}
        <section className="settings-panel profile-skeleton-panel">
          <div className="profile-tab-bar">
            <div className="profile-skeleton-shimmer profile-skeleton-tab" />
            <div className="profile-skeleton-shimmer profile-skeleton-tab" />
          </div>

          <div className="profile-section-header">
            <div className="profile-skeleton-shimmer profile-skeleton-line profile-skeleton-section-title" />
            <div className="profile-skeleton-shimmer profile-skeleton-line profile-skeleton-section-desc" />
          </div>

          <div className="form-stack">
            <div className="form-row">
              <div className="profile-skeleton-input-group">
                <div className="profile-skeleton-shimmer profile-skeleton-label" />
                <div className="profile-skeleton-shimmer profile-skeleton-input" />
              </div>
              <div className="profile-skeleton-input-group">
                <div className="profile-skeleton-shimmer profile-skeleton-label" />
                <div className="profile-skeleton-shimmer profile-skeleton-input" />
              </div>
            </div>
            <div className="form-row">
              <div className="profile-skeleton-input-group">
                <div className="profile-skeleton-shimmer profile-skeleton-label" />
                <div className="profile-skeleton-shimmer profile-skeleton-input" />
              </div>
              <div className="profile-skeleton-input-group">
                <div className="profile-skeleton-shimmer profile-skeleton-label" />
                <div className="profile-skeleton-shimmer profile-skeleton-input" />
              </div>
            </div>
            <div className="form-row">
              <div className="profile-skeleton-input-group">
                <div className="profile-skeleton-shimmer profile-skeleton-label" />
                <div className="profile-skeleton-shimmer profile-skeleton-input" />
              </div>
              <div className="profile-skeleton-input-group">
                <div className="profile-skeleton-shimmer profile-skeleton-label" />
                <div className="profile-skeleton-shimmer profile-skeleton-input" />
              </div>
            </div>
            <div className="profile-skeleton-shimmer profile-skeleton-save-btn" />
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfileForm({
  profile,
  data,
  refresh,
}: {
  profile: Record<string, string>;
  data: AccountState;
  refresh: () => Promise<void>;
}){
  const router = useRouter();
  const searchParams = useSearchParams();
  const {data: session} = authClient.useSession();

  const [activeTab, setActiveTab] = useState<'general' | 'shipping'>(
    searchParams.get('tab') === 'shipping' ? 'shipping' : 'general'
  );

  const [currency, setCurrency] = useState(profile.currency || 'IDR');
  const [locale, setLocale] = useState(profile.locale || 'en');
  const [region, setRegion] = useState((profile.region || 'ID').toUpperCase());
  const [timezone, setTimezone] = useState(profile.timezone || 'Asia/Jakarta');
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'ID'>('EN');

  // Shipping origin / address state
  const [shippingOrigin, setShippingOrigin] = useState<ShippingOrigin | null>(null);
  const [shippingRecipient, setShippingRecipient] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingAddressDetail, setShippingAddressDetail] = useState('');
  const [shippingProvince, setShippingProvince] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingDistrict, setShippingDistrict] = useState('');
  const [shippingSubdistrict, setShippingSubdistrict] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [shippingAreaId, setShippingAreaId] = useState<string | null>(null);
  const [shippingLatitude, setShippingLatitude] = useState<number | null>(null);
  const [shippingLongitude, setShippingLongitude] = useState<number | null>(null);
  const [shippingMethods, setShippingMethods] = useState<string[]>([]);
  const [savingShipping, setSavingShipping] = useState(false);
  const [turnstileToken,setTurnstileToken]=useState('');
  const [turnstileResetKey,setTurnstileResetKey]=useState(0);
  const [provinces,setProvinces]=useState<RegionOption[]>([]);
  const [regionsLoading,setRegionsLoading]=useState(true);
  const [regionsError,setRegionsError]=useState(false);
  const [cities,setCities]=useState<RegionOption[]>([]);
  const [citiesLoading,setCitiesLoading]=useState(false);
  const [citiesError,setCitiesError]=useState(false);
  const [districts,setDistricts]=useState<RegionOption[]>([]);
  const [districtsLoading,setDistrictsLoading]=useState(false);
  const [districtsError,setDistrictsError]=useState(false);
  const [subdistricts,setSubdistricts]=useState<RegionOption[]>([]);
  const [subdistrictsLoading,setSubdistrictsLoading]=useState(false);
  const [subdistrictsError,setSubdistrictsError]=useState(false);
  const [geocodeResults,setGeocodeResults]=useState<GeocodeResult[]>([]);
  const [searchingAddress,setSearchingAddress]=useState(false);
  const [showAddressDropdown,setShowAddressDropdown]=useState(false);
  const [activeAddressResult,setActiveAddressResult]=useState(0);
  const [mapFocusRevision,setMapFocusRevision]=useState(0);
  const addressSelectionRevision=useRef(0);

  // Fast area search state
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [areaSearchResults, setAreaSearchResults] = useState<AreaSearchResult[]>([]);
  const [searchingArea, setSearchingArea] = useState(false);
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);

  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);

  const t=(en:string,idStr:string)=>language==='ID'?idStr:en;

  const loadProvinces=async()=>{
    setRegionsLoading(true);setRegionsError(false);
    try{
      const items=await loadShippingRegions('provinces');
      if(items.length===0)throw new Error('Province data unavailable');
      setProvinces(items);
    }catch{setProvinces([]);setRegionsError(true)}finally{setRegionsLoading(false)}
  };
  useEffect(()=>{void loadProvinces()},[]);

  useEffect(()=>{
    if(!shippingProvince)return;
    const selected=matchRegion(provinces,shippingProvince);
    if(!selected)return;
    let active=true;setCitiesLoading(true);setCitiesError(false);
    void loadShippingRegions('regencies',selected.id,{province:selected.name}).then(items=>{if(active){setCities(items);setCitiesError(items.length===0)}}).catch(()=>{if(active){setCities([]);setCitiesError(true)}}).finally(()=>{if(active)setCitiesLoading(false)});
    return()=>{active=false};
  },[shippingProvince,provinces]);
  useEffect(()=>{
    if(!shippingCity)return;
    const selected=matchRegion(cities,shippingCity);
    if(!selected)return;
    let active=true;setDistrictsLoading(true);setDistrictsError(false);
    void loadShippingRegions('districts',selected.id,{province:shippingProvince,city:selected.name}).then(items=>{if(active){setDistricts(items);setDistrictsError(items.length===0)}}).catch(()=>{if(active){setDistricts([]);setDistrictsError(true)}}).finally(()=>{if(active)setDistrictsLoading(false)});
    return()=>{active=false};
  },[shippingProvince,shippingCity,cities]);
  useEffect(()=>{
    if(!shippingDistrict)return;
    const selected=matchRegion(districts,shippingDistrict);
    if(!selected)return;
    let active=true;setSubdistrictsLoading(true);setSubdistrictsError(false);
    void loadShippingRegions('villages',selected.id,{province:shippingProvince,city:shippingCity,district:selected.name}).then(items=>{if(active){setSubdistricts(items);setSubdistrictsError(items.length===0)}}).catch(()=>{if(active){setSubdistricts([]);setSubdistrictsError(true)}}).finally(()=>{if(active)setSubdistrictsLoading(false)});
    return()=>{active=false};
  },[shippingProvince,shippingCity,shippingDistrict,districts]);

  useEffect(()=>{
    const query=shippingAddress.trim();
    if(query.length<4||!showAddressDropdown)return;
    let active=true;
    const timer=window.setTimeout(async()=>{
      try{const results=await searchShippingAddresses(query,language,shippingLatitude,shippingLongitude);if(active){setGeocodeResults(results);setActiveAddressResult(0)}}catch{if(active)setGeocodeResults([])}finally{if(active)setSearchingAddress(false)}
    },500);
    return()=>{active=false;clearTimeout(timer)};
  },[shippingAddress,showAddressDropdown,shippingLatitude,shippingLongitude,language]);

  const selectAddress=async(result:GeocodeResult)=>{
    const revision=++addressSelectionRevision.current;
    const typed=shippingAddress.trim();
    const locality=[result.subdistrict,result.district,result.city,result.province,result.postalCode].filter(Boolean);
    const additions=locality.filter(part=>!typed.toLowerCase().includes(part.toLowerCase()));
    setShippingAddress([typed,...additions].join(', ').slice(0,260));
    setShippingPostalCode(result.postalCode||'');
    setCities([]);setDistricts([]);setSubdistricts([]);
    setCitiesError(false);setDistrictsError(false);setSubdistrictsError(false);
    setShippingAreaId(null);
    setShippingLatitude(result.latitude);setShippingLongitude(result.longitude);setMapFocusRevision(value=>value+1);
    setShowAddressDropdown(false);setGeocodeResults([]);

    const province=matchRegion(provinces,result.province);
    try{
      if(province){
        setShippingProvince(province.name);
        const cityOptions=await loadShippingRegions('regencies',province.id,{province:province.name});
        if(revision!==addressSelectionRevision.current)return;
        setCities(cityOptions);
        const city=matchRegion(cityOptions,result.city);
        if(city){
          setShippingCity(city.name);
          const districtOptions=await loadShippingRegions('districts',city.id,{province:province.name,city:city.name});
          if(revision!==addressSelectionRevision.current)return;
          setDistricts(districtOptions);
          const district=matchRegion(districtOptions,result.district);
          if(district){
            setShippingDistrict(district.name);
            const villageOptions=await loadShippingRegions('villages',district.id,{province:province.name,city:city.name,district:district.name});
            if(revision!==addressSelectionRevision.current)return;
            setSubdistricts(villageOptions);
            const village=matchRegion(villageOptions,result.subdistrict);
            if(village)setShippingSubdistrict(village.name);
          }
        }
      }
    }catch{
      if(revision!==addressSelectionRevision.current)return;
      // Use the geocoder labels; the administrative selectors can still be adjusted manually.
      if(result.province)setShippingProvince(result.province);
      if(result.city)setShippingCity(result.city);
      if(result.district)setShippingDistrict(result.district);
      if(result.subdistrict)setShippingSubdistrict(result.subdistrict);
    }
    if(!province){
      if(result.province)setShippingProvince(result.province);
      if(result.city)setShippingCity(result.city);
      if(result.district)setShippingDistrict(result.district);
      if(result.subdistrict)setShippingSubdistrict(result.subdistrict);
    }

    const areaQuery=[result.subdistrict,result.district,result.city].filter(Boolean).join(', ');
    if(areaQuery){
      try{
        const response=await fetch(`/api/shipping/areas?query=${encodeURIComponent(areaQuery)}`);
        if(revision!==addressSelectionRevision.current)return;
        const payload=await response.json() as {areas?:AreaSearchResult[]};
        const areas=payload.areas??[];
        const matches=(candidate:string, expected:string)=>!expected||normalizeRegionName(candidate)===normalizeRegionName(expected);
        const recognizedProvince=matchRegion(provinces,result.province);
        const isGenericJakarta=result.city.trim().toLocaleLowerCase('id')==='jakarta';
        const area=areas.find(candidate=>candidate.source==='biteship'
          && matches(candidate.district,result.district)
          && matches(candidate.subdistrict,result.subdistrict)
          && (!recognizedProvince||matches(candidate.province,recognizedProvince.name))
          && (!result.city||isGenericJakarta||matches(candidate.city,result.city))
          && (!result.postalCode||matches(candidate.postalCode,result.postalCode)))
          ??areas.find(candidate=>candidate.source==='biteship'
            && matches(candidate.district,result.district)
            && matches(candidate.subdistrict,result.subdistrict)
            && (!recognizedProvince||matches(candidate.province,recognizedProvince.name))
            && (!result.city||isGenericJakarta||matches(candidate.city,result.city)));
        if(area){
          setShippingAreaId(area.id);
          setShippingProvince(area.province||province?.name||result.province);
          setShippingCity(area.city||result.city);
          setShippingDistrict(area.district||result.district);
          setShippingSubdistrict(area.subdistrict||result.subdistrict);
          setShippingPostalCode(area.postalCode||result.postalCode);
        }
      }catch{/* The searchable administrative selectors remain available as a fallback. */}
    }
  };

  const toggleShippingMethod = (methodId: string) => {
    setShippingMethods(prev => {
      if (prev.includes(methodId)) {
        if (prev.length <= 1) {
          toast.error(t('At least one shipping method must remain active.', 'Minimal satu metode pengiriman harus tetap aktif.'));
          return prev;
        }
        return prev.filter(m => m !== methodId);
      }
      return [...prev, methodId];
    });
  };

  // Load saved shipping origin
  useEffect(()=>{
    let active=true;
    api<{origin:ShippingOrigin|null}>('/api/shipping/origin',undefined,'GET')
      .then(res=>{
        if(!active||!res?.origin)return;
        setShippingOrigin(res.origin);
        setShippingRecipient(res.origin.recipientName||'');
        setShippingPhone(res.origin.phone||'');
        setShippingAddress(res.origin.addressLine||'');
        setShippingAddressDetail(res.origin.addressDetail||'');
        const c = res.origin.city||'';
        setShippingCity(res.origin.regionNames?.city||c);
        if(res.origin.regionNames?.province)setShippingProvince(res.origin.regionNames.province);
        if(res.origin.regionNames?.district)setShippingDistrict(res.origin.regionNames.district);
        if(res.origin.regionNames?.subdistrict)setShippingSubdistrict(res.origin.regionNames.subdistrict);
        setShippingPostalCode(res.origin.postalCode||'');
        if (typeof res.origin.latitude === 'number') setShippingLatitude(res.origin.latitude);
        if (typeof res.origin.longitude === 'number') setShippingLongitude(res.origin.longitude);
        if (res.origin.areaId) setShippingAreaId(res.origin.areaId);

        // Infer province and district if city matches known regions
        if (c&&!res.origin.regionNames?.province) {
          for (const prov of INDONESIAN_REGIONS) {
            const foundCity = prov.cities.find(ct => ct.name.toLowerCase() === c.toLowerCase());
            if (foundCity) {
              setShippingProvince(prov.name);
              break;
            }
          }
        }
        if(Array.isArray(res.origin.shippingMethods)){
          setShippingMethods(normalizeCourierMethods(res.origin.shippingMethods));
        }
      })
      .catch(()=>{/* no-op */});
    return()=>{active=false};
  },[]);

  // Fast area search effect
  useEffect(() => {
    const q = areaSearchQuery.trim();
    if (q.length < 3) return;
    let active = true;
    setSearchingArea(true);
    const timer = setTimeout(async () => {
      try {
        let areas:AreaSearchResult[]=[];
        try{
          const res=await fetch(`/api/shipping/areas?query=${encodeURIComponent(q)}`);
          if(res.ok){const data=await res.json() as {areas?:AreaSearchResult[]};if(Array.isArray(data.areas))areas=data.areas;}
        }catch{/* Use browser and bundled sources below when Worker egress is unavailable. */}
        const local=searchIndonesianAreas(q).map(area=>({...area,source:'local' as const}));
        areas=[...areas,...local];
        if(!areas.length){
          const geocoded=await searchShippingAddresses(q,language,null,null).catch(()=>[]);
          areas=geocoded.filter(item=>item.province||item.city||item.district).map((item,index)=>({
            id:`geocode:${item.latitude}:${item.longitude}:${index}`,name:item.label,province:item.province,city:item.city,district:item.district,subdistrict:item.subdistrict,postalCode:item.postalCode,latitude:item.latitude,longitude:item.longitude,source:'local' as const,
          }));
        }
        const seen=new Set<string>();
        const unique=areas.filter(area=>{const key=[area.subdistrict,area.district,area.city,area.province,area.postalCode].join('|').toLocaleLowerCase('id');if(seen.has(key))return false;seen.add(key);return true}).slice(0,10);
        if(active)setAreaSearchResults(unique);
      } catch {
        if(active)setAreaSearchResults(searchIndonesianAreas(q).map(area=>({...area,source:'local' as const})));
      } finally {
        if(active)setSearchingArea(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [areaSearchQuery,language]);

  const handleSelectArea = (item: AreaSearchResult) => {
    setShippingProvince(item.province);
    setShippingCity(item.city);
    setShippingDistrict(item.district);
    setShippingSubdistrict(item.subdistrict);
    setCities([]);setDistricts([]);setSubdistricts([]);
    setCitiesError(false);setDistrictsError(false);setSubdistrictsError(false);
    setShippingPostalCode(item.postalCode || '');
    setShippingAreaId(item.source==='biteship'?item.id:null);
    setShippingLatitude(typeof item.latitude==='number'&&Number.isFinite(item.latitude)?item.latitude:null);
    setShippingLongitude(typeof item.longitude==='number'&&Number.isFinite(item.longitude)?item.longitude:null);
    setShowAreaDropdown(false);
    setAreaSearchQuery('');
    toast.success(
      language === 'ID'
        ? `Wilayah dipilih: ${item.subdistrict}, ${item.district}, ${item.city}`
        : `Selected area: ${item.subdistrict}, ${item.district}, ${item.city}`
    );
  };

  const handleProvinceChange = (prov: string) => {
    setShippingProvince(prov);
    setShippingCity('');
    setShippingDistrict('');
    setShippingSubdistrict('');
    setCities([]);setDistricts([]);setSubdistricts([]);
    setCitiesError(false);setDistrictsError(false);setSubdistrictsError(false);
    setShippingAreaId(null);
    setShippingPostalCode('');
    const selected=provinces.find(item=>item.name===prov);
    setShippingLatitude(selected?.latitude??null);
    setShippingLongitude(selected?.longitude??null);
  };

  const handleCityChange = (c: string) => {
    setShippingCity(c);
    setShippingDistrict('');
    setShippingSubdistrict('');
    setDistricts([]);setSubdistricts([]);
    setDistrictsError(false);setSubdistrictsError(false);
    setShippingAreaId(null);
    setShippingPostalCode('');
    const selected=cities.find(item=>item.name===c);
    setShippingLatitude(selected?.latitude??null);
    setShippingLongitude(selected?.longitude??null);
  };

  const handleDistrictChange = (d: string) => {
    setShippingDistrict(d);
    setShippingSubdistrict('');
    setSubdistricts([]);
    setShippingAreaId(null);
    setShippingPostalCode('');
    const selected=districts.find(item=>item.name===d);
    if(selected?.postalCode)setShippingPostalCode(selected.postalCode);
    setShippingLatitude(selected?.latitude??null);
    setShippingLongitude(selected?.longitude??null);
  };

  const handleSubdistrictChange = (s: string) => {
    setShippingSubdistrict(s);
    setSubdistrictsError(false);
    setShippingAreaId(null);
    setShippingPostalCode('');
    const selected=subdistricts.find(item=>item.name===s);
    if(selected?.postalCode)setShippingPostalCode(selected.postalCode);
    setShippingLatitude(selected?.latitude??null);
    setShippingLongitude(selected?.longitude??null);
  };

  const handleLocaleChange=(newLocale:string)=>{
    setLocale(newLocale);
    const upper=newLocale.toUpperCase()==='ID'?'ID':'EN';
    window.localStorage.setItem('vivreplay-locale',upper);
    window.dispatchEvent(new CustomEvent('vivreplay:locale',{detail:upper}));
  };

  const signOut=async()=>{
    setBusy(true);
    await authClient.signOut();
    router.replace('/');
    router.refresh();
  };

  const totalVaultCards = useMemo(() => {
    return (data.collection ?? []).reduce((acc, it) => acc + (it.quantity || 1), 0);
  }, [data.collection]);

  const deckCount = data.decks?.length ?? 0;
  const wishlistCount = data.wishlist?.length ?? 0;

  const initial = (profile.display_name || profile.username || 'P').charAt(0).toUpperCase();

  const regionOptions = useMemo(() => {
    const list = [...COMMON_REGIONS];
    if (region && !list.some(item => item.value === region)) {
      list.unshift({ value: region, label: region });
    }
    return list;
  }, [region]);

  const timezoneOptions = useMemo(() => {
    const list = [...COMMON_TIMEZONES];
    if (timezone && !list.some(item => item.value === timezone)) {
      list.unshift({ value: timezone, label: timezone });
    }
    return list;
  }, [timezone]);

  const saveGeneral = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try{
      await api('/api/profile',{
        username: String(f.get('username')),
        displayName: String(f.get('displayName')),
        region: region.toUpperCase(),
        timezone,
        currency,
        locale,
      });
      await refresh();
      const upper=locale.toUpperCase()==='ID'?'ID':'EN';
      window.localStorage.setItem('vivreplay-locale',upper);
      window.dispatchEvent(new CustomEvent('vivreplay:locale',{detail:upper}));
      toast.success(t('Profile preferences saved!','Preferensi profil berhasil disimpan!'));
    }catch(err){
      toast.error((err as Error).message);
    }finally{
      setBusy(false);
    }
  };

  const saveShipping = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(turnstileEnabled&&!turnstileToken){toast.error(t('Complete the security check first.','Selesaikan pemeriksaan keamanan terlebih dahulu.'));return;}
    const hasValidPostalCode=/^\d{5}$/.test(shippingPostalCode.trim());
    const hasValidAreaId=isBiteshipAreaId(shippingAreaId);
    if (!hasValidPostalCode&&!hasValidAreaId) {
      toast.error(t('Choose a delivery area with a valid postal code.', 'Pilih wilayah pengiriman dengan kode pos yang valid.'));
      return;
    }
    const activeCourierIds = shippingMethods.filter(id => BITESHIP_COURIERS.some(c => c.id === id));
    setSavingShipping(true);
    try{
      const payloadMethods = [...activeCourierIds];
      const hasInstant = BITESHIP_COURIERS.filter(c => c.category === 'instant').some(c => activeCourierIds.includes(c.id));
      const hasRegular = BITESHIP_COURIERS.filter(c => c.category === 'regular').some(c => activeCourierIds.includes(c.id));
      if (hasInstant && !payloadMethods.includes('instant')) payloadMethods.push('instant');
      if (hasRegular && !payloadMethods.includes('regular')) payloadMethods.push('regular');

      const res = await api<{ok: boolean; shippingMethods?: string[]; error?: string}>('/api/shipping/origin', {
        recipientName: shippingRecipient.trim(),
        phone: shippingPhone.trim(),
        addressLine: shippingAddress.trim(),
        addressDetail: shippingAddressDetail.trim(),
        city: shippingCity.trim(),
        postalCode: shippingPostalCode.trim(),
        areaId: shippingAreaId || null,
        latitude: shippingLatitude,
        longitude: shippingLongitude,
        shippingMethods: payloadMethods,
        regions:{province:shippingProvince,city:shippingCity,district:shippingDistrict,subdistrict:shippingSubdistrict},
        label: 'Primary origin',
      }, 'POST',turnstileHeaders(turnstileToken));
      if (res.ok) {
        setShippingOrigin({
          ownerId: profile.id,
          label: 'Primary origin',
          recipientName: shippingRecipient.trim(),
          phone: shippingPhone.trim(),
          addressLine: shippingAddress.trim(),
          addressDetail: shippingAddressDetail.trim(),
          city: shippingCity.trim(),
          regionNames:{province:shippingProvince,city:shippingCity,district:shippingDistrict,subdistrict:shippingSubdistrict},
          postalCode: shippingPostalCode.trim(),
          shippingMethods: activeCourierIds,
          areaId: shippingAreaId || null,
          latitude: shippingLatitude,
          longitude: shippingLongitude,
          updatedAt: new Date().toISOString(),
        });
        toast.success(t('Shipping settings saved successfully!','Alamat & metode pengiriman berhasil disimpan!'));
      }
    }catch(err){
      toast.error((err as Error).message);
    }finally{
      setTurnstileToken('');setTurnstileResetKey(value=>value+1);
      setSavingShipping(false);
    }
  };

  return <main className="page profile-page">
    <section className="library-intro profile-intro">
      <div className="library-intro-copy">
        <p className="kicker">{t('PLAYER PROFILE','PROFIL PEMAIN')}</p>
        <h1>{t('Player profile & settings.','Profil pemain & pengaturan.')}</h1>
        <p>{t('Manage your collector identity, display preferences, and shipping address.','Atur identitas kolektor, preferensi tampilan, dan alamat pengiriman Anda.')}</p>
      </div>
      <IntroCardRail/>
    </section>

    <div className="profile-layout">
      {/* Profile Card / Sidebar */}
      <section className="profile-card">
        <div className="profile-emblem">
          <span>{initial}</span>
        </div>
        <h2>{profile.display_name}</h2>
        <p className="profile-handle">@{profile.username}</p>
        {session?.user?.email && (
          <span className="profile-email">
            <EnvelopeSimple size={13}/>
            {session.user.email}
          </span>
        )}
        <span className="badge">{t('COLLECTOR · EARLY ACCESS','KOLEKTOR · AKSES AWAL')}</span>

        {/* Vault & Activity Overview */}
        <div className="profile-stats-grid">
          <div className="profile-stat-box">
            <Cards size={16}/>
            <strong>{totalVaultCards}</strong>
            <small>{t('Cards','Kartu')}</small>
          </div>
          <div className="profile-stat-box">
            <Layers3 size={16}/>
            <strong>{deckCount}</strong>
            <small>{t('Decks','Deck')}</small>
          </div>
          <div className="profile-stat-box">
            <Heart size={16}/>
            <strong>{wishlistCount}</strong>
            <small>{t('Wishlist','Wishlist')}</small>
          </div>
        </div>

        <div className="profile-facts">
          <span><Globe size={15}/>{region} · {timezone.split('/')[1] || timezone}</span>
          <span><ShieldCheck size={15}/>{t('Collection private by default','Koleksi privat secara default')}</span>
          {shippingOrigin ? (
            <span className="profile-shipping-badge">
              <Truck size={15}/>
              <span>{shippingOrigin.city} ({shippingOrigin.postalCode})</span>
            </span>
          ) : (
            <button type="button" className="profile-fact-action-btn" onClick={() => setActiveTab('shipping')}>
              <Truck size={15}/>
              <span>{t('Set shipping address','Atur alamat pengiriman')}</span>
            </button>
          )}
        </div>

        <div className="profile-card-actions">
          {String(profile.tier??'free').toLowerCase()!=='pro'&&<Link className="button profile-pro-link" href="/checkout/pro">{t('Explore Pro','Lihat Pro')}</Link>}
          <Link className="button secondary profile-public-btn" href={`/players/${profile.username}`}>
            <ArrowSquareOut size={16}/>
            {t('View public profile','Lihat profil publik')}
          </Link>
          <button className="button secondary profile-signout-btn" type="button" disabled={busy} onClick={signOut}>
            <SignOut size={16}/>
            {t('Sign out','Keluar')}
          </button>
        </div>
      </section>

      {/* Main Settings Panel with Tabs */}
      <section className="settings-panel">
        <div className="profile-tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'general'}
            className={`profile-tab ${activeTab === 'general' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Gear size={16}/>
            <span>{t('Account & Preferences','Akun & Preferensi')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shipping'}
            className={`profile-tab ${activeTab === 'shipping' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('shipping')}
          >
            <Truck size={16}/>
            <span>{t('Shipping Address','Alamat Pengiriman')}</span>
            {shippingOrigin?.postalCode && <CheckCircle size={14} className="profile-tab-check"/>}
          </button>
        </div>

        {activeTab === 'general' ? (
          <form className="form-stack profile-tab-content" onSubmit={saveGeneral}>
            <div className="profile-section-header">
              <h2>{t('Personal details','Data pribadi')}</h2>
              <p>{t('Manage your public collector name and account regional defaults.','Atur nama kolektor publik dan setelan regional akun Anda.')}</p>
            </div>

            <div className="form-row">
              <label>
                {t('Display name','Nama tampilan')}
                <input name="displayName" defaultValue={profile.display_name} minLength={2} maxLength={50} required/>
              </label>
              <label>
                {t('Username','Nama pengguna')}
                <input name="username" defaultValue={profile.username} pattern="[a-z0-9_-]{3,30}" required/>
              </label>
            </div>

            <div className="form-row">
              <label>
                {t('Region / Country','Wilayah / Negara')}
                <Picker
                  label={t('Region / Country','Wilayah / Negara')}
                  value={region}
                  onChange={setRegion}
                  options={regionOptions}
                />
              </label>
              <label>
                {t('Timezone','Zona waktu')}
                <Picker
                  label={t('Timezone','Zona waktu')}
                  value={timezone}
                  onChange={setTimezone}
                  options={timezoneOptions}
                />
              </label>
            </div>

            <div className="profile-section-header" style={{marginTop: '12px'}}>
              <h2>{t('Regional & Currency Preferences','Preferensi Regional & Mata Uang')}</h2>
              <p>{t('Choose your preferred Market currency and website interface language.','Pilih mata uang transaksi Market dan bahasa antarmuka situs.')}</p>
            </div>

            <div className="form-row">
              <label>
                {t('Display currency','Mata uang tampilan')}
                <Picker
                  label={t('Display currency','Mata uang tampilan')}
                  value={currency}
                  onChange={setCurrency}
                  options={['IDR','USD','JPY']}
                />
              </label>
              <label>
                {t('Preferred UI language','Bahasa antarmuka')}
                <Picker
                  label={t('Preferred UI language','Bahasa antarmuka')}
                  value={locale}
                  onChange={handleLocaleChange}
                  options={[
                    {value:'en',label:'English (EN)'},
                    {value:'id',label:'Bahasa Indonesia (ID)'},
                  ]}
                />
              </label>
            </div>

            <div className="privacy-note">
              <ShieldCheck size={20}/>
              <div>
                <p>
                  {t(
                    'Vault details and purchase costs stay private unless you choose to share them.',
                    'Detail Vault dan biaya pembelian tetap privat kecuali Anda memilih untuk membagikannya.'
                  )}
                </p>
              </div>
            </div>

            <button className="button" disabled={busy} type="submit">
              <Save size={16}/>
              {busy ? t('Saving...','Menyimpan...') : t('Save preferences','Simpan preferensi')}
            </button>
          </form>
        ) : (
          <form className="form-stack profile-tab-content" onSubmit={saveShipping}>
            <div className="shipping-banner">
              <Truck size={22}/>
              <div>
                <strong>{t('Delivery & Shipping Address','Alamat Pengiriman')}</strong>
                <p>
                  {t(
                    'Saved address for calculating shipping rates at checkout and fulfilling Market orders.',
                    'Alamat tersimpan untuk menghitung ongkos kirim saat transaksi dan pengiriman kartu di Market.'
                  )}
                </p>
              </div>
            </div>

            <div className="form-row">
              <label>
                {t('Recipient name','Nama penerima')}
                <input
                  name="recipientName"
                  value={shippingRecipient}
                  onChange={e => setShippingRecipient(e.target.value)}
                  placeholder={profile.display_name || 'Budi Santoso'}
                  maxLength={100}
                />
              </label>
              <label>
                {t('Phone number','Nomor telepon / WhatsApp')}
                <input
                  name="phone"
                  value={shippingPhone}
                  onChange={e => setShippingPhone(e.target.value)}
                  placeholder="081234567890"
                  maxLength={30}
                />
              </label>
            </div>

            {/* Fast Administrative Area Search */}
            <div className="shipping-area-search-container">
              <label>
                {t('Administrative Area Lookup (Kelurahan / Kecamatan / Kota)','Pencarian Cepat Wilayah (Kelurahan / Kecamatan / Kota)')}
              </label>
              <div className="shipping-area-search-bar">
                <Search size={16} className="shipping-area-search-icon" />
                <input
                  type="text"
                  className="shipping-area-search-input"
                  value={areaSearchQuery}
                  onChange={e => {
                    const value=e.target.value;
                    setAreaSearchQuery(value);
                    setAreaSearchResults([]);
                    setSearchingArea(value.trim().length>=3);
                    setShowAreaDropdown(true);
                  }}
                  onFocus={() => {
                    if (areaSearchResults.length > 0) setShowAreaDropdown(true);
                  }}
                  placeholder={t(
                    'Search village, district, or city (e.g. Senayan, Dago, Kebayoran Baru)...',
                    'Ketik nama kelurahan, kecamatan, atau kota (contoh: Senayan, Dago, Kebayoran Baru)...'
                  )}
                  aria-label={t('Search Indonesian area','Cari wilayah Indonesia')}
                />
                {areaSearchQuery && (
                  <button
                    type="button"
                    className="shipping-area-search-clear"
                    onClick={() => {
                      setAreaSearchQuery('');
                      setAreaSearchResults([]);
                      setShowAreaDropdown(false);
                    }}
                    aria-label="Clear area search"
                  >
                    <XMark size={14} />
                  </button>
                )}
              </div>
              {showAreaDropdown && areaSearchResults.length > 0 && (
                <div className="shipping-area-dropdown" role="listbox">
                  {areaSearchResults.map(item => (
                    <div
                      key={item.id}
                      className="shipping-area-item"
                      onClick={() => handleSelectArea(item)}
                      role="option"
                      aria-selected={shippingSubdistrict === item.subdistrict && shippingDistrict === item.district}
                    >
                      <div className="shipping-area-item-title">{item.name}</div>
                      <div className="shipping-area-item-sub">
                        {t('Postal Code:','Kode Pos:')} {item.postalCode} | {item.city}, {item.province}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showAreaDropdown && areaSearchQuery.trim().length >= 3 && searchingArea && <p className="shipping-area-feedback" role="status">{t('Searching Indonesian regions…','Mencari wilayah Indonesia…')}</p>}
              {showAreaDropdown && areaSearchQuery.trim().length >= 3 && !searchingArea && areaSearchResults.length === 0 && <p className="shipping-area-feedback" role="status">{t('No matching area found. Try a village, district, or city name.','Wilayah tidak ditemukan. Coba nama kelurahan, kecamatan, atau kota.')}</p>}
            </div>

            {/* Cascading Administrative Dropdowns */}
            <div className="shipping-cascading-grid">
              <label>
                {t('Province','Provinsi')}
                <select
                  value={shippingProvince}
                  onChange={e => handleProvinceChange(e.target.value)}
                >
                  <option value="">{t('-- Select Province --','-- Pilih Provinsi --')}</option>
                  {provinces.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                  {shippingProvince && !provinces.some(p=>normalizeRegionName(p.name)===normalizeRegionName(shippingProvince)) && <option value={shippingProvince}>{shippingProvince}</option>}
                </select>
                {regionsError && <button type="button" className="shipping-region-retry" onClick={()=>void loadProvinces()}>{t('Could not load provinces · Retry','Provinsi gagal dimuat · Coba lagi')}</button>}
                {!regionsError && regionsLoading && <small className="shipping-region-note">{t('Loading provinces…','Memuat provinsi…')}</small>}
              </label>

              <label>
                {t('City / Regency','Kota / Kabupaten')}
                <select
                  value={shippingCity}
                  onChange={e => handleCityChange(e.target.value)}
                  required
                >
                  <option value="">{t('-- Select City / Regency --','-- Pilih Kota / Kabupaten --')}</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  {shippingCity && !cities.some(c => c.name === shippingCity) && (
                    <option value={shippingCity}>{shippingCity}</option>
                  )}
                </select>
                {citiesLoading&&<small className="shipping-region-note">{t('Loading cities…','Memuat kota…')}</small>}
                {citiesError&&<small className="shipping-region-note">{t('Could not load cities. Try the area search above.','Kota gagal dimuat. Coba pencarian wilayah di atas.')}</small>}
              </label>

              <label>
                {t('District (Kecamatan)','Kecamatan')}
                <select
                  value={shippingDistrict}
                  onChange={e => handleDistrictChange(e.target.value)}
                  disabled={!shippingCity}
                >
                  <option value="">{t('-- Select District --','-- Pilih Kecamatan --')}</option>
                  {districts.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                {shippingDistrict && !districts.some(d => d.name === shippingDistrict) && (
                  <option value={shippingDistrict}>{shippingDistrict}</option>
                )}
                </select>
                {districtsLoading&&<small className="shipping-region-note">{t('Loading districts…','Memuat kecamatan…')}</small>}
                {districtsError&&<small className="shipping-region-note">{t('Could not load districts. Try the area search above.','Kecamatan gagal dimuat. Coba pencarian wilayah di atas.')}</small>}
              </label>

              <label>
                {t('Sub-district (Kelurahan / Desa)','Kelurahan / Desa')}
                <select
                  value={shippingSubdistrict}
                  onChange={e => handleSubdistrictChange(e.target.value)}
                  disabled={!shippingDistrict}
                >
                  <option value="">{t('-- Select Kelurahan --','-- Pilih Kelurahan --')}</option>
                  {subdistricts.map(s => (
                    <option key={s.id} value={s.name}>{s.name}{s.postalCode?` (${s.postalCode})`:''}</option>
                  ))}
                {shippingSubdistrict && !subdistricts.some(s => s.name === shippingSubdistrict) && (
                  <option value={shippingSubdistrict}>{shippingSubdistrict}</option>
                )}
                </select>
                {subdistrictsLoading&&<small className="shipping-region-note">{t('Loading sub-districts…','Memuat kelurahan/desa…')}</small>}
                {subdistrictsError&&<small className="shipping-region-note">{t('Could not load sub-districts. Try the area search above.','Kelurahan/desa gagal dimuat. Coba pencarian wilayah di atas.')}</small>}
              </label>
            </div>

            <div className="form-row">
              <label>
                {t('Postal code','Kode pos')}
                <input
                  name="postalCode"
                  value={shippingPostalCode}
                  onChange={e => setShippingPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="12190"
                  inputMode="numeric"
                  maxLength={5}
                  required={!isBiteshipAreaId(shippingAreaId)}
                />
                {isBiteshipAreaId(shippingAreaId)&&!/^\d{5}$/.test(shippingPostalCode.trim())&&<small>{t('A verified delivery area is selected; postal code is optional.','Wilayah pengiriman terverifikasi; kode pos boleh dikosongkan.')}</small>}
              </label>
            </div>

            <label className="shipping-address-search">
              {t('Street address / Landmark / Building','Alamat jalan, gedung, RT/RW, dan patokan lengkap')}
              <input
                name="addressLine"
                value={shippingAddress}
                onChange={e => {const value=e.target.value;setShippingAddress(value);setShippingAreaId(null);setActiveAddressResult(0);setShowAddressDropdown(true);if(value.trim().length>=4)setSearchingAddress(true);else{setSearchingAddress(false);setGeocodeResults([])}}}
                onFocus={()=>{setShowAddressDropdown(true);if(shippingAddress.trim().length>=4)setSearchingAddress(true)}}
                onBlur={()=>window.setTimeout(()=>{setShowAddressDropdown(false);setSearchingAddress(false)},180)}
                onKeyDown={event=>{
                  if(!showAddressDropdown||!geocodeResults.length)return;
                  if(event.key==='ArrowDown'){event.preventDefault();setActiveAddressResult(index=>(index+1)%geocodeResults.length)}
                  else if(event.key==='ArrowUp'){event.preventDefault();setActiveAddressResult(index=>(index-1+geocodeResults.length)%geocodeResults.length)}
                  else if(event.key==='Enter'){event.preventDefault();void selectAddress(geocodeResults[activeAddressResult]??geocodeResults[0])}
                  else if(event.key==='Escape'){setShowAddressDropdown(false);setGeocodeResults([])}
                }}
                placeholder={t('Street, building, or landmark','Jalan, gedung, atau patokan')}
                maxLength={260}
                autoComplete="street-address"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showAddressDropdown&&geocodeResults.length>0}
                aria-controls="shipping-address-results"
                aria-activedescendant={geocodeResults.length?`shipping-address-result-${activeAddressResult}`:undefined}
                required
              />
              {showAddressDropdown&&shippingAddress.trim().length>=4&&<div id="shipping-address-results" className="shipping-address-results" role="listbox" aria-label={t('Address search results','Hasil pencarian alamat')}>
                {searchingAddress&&<div className="shipping-address-result-hint">{t('Searching addresses…','Mencari alamat…')}</div>}
                {!searchingAddress&&geocodeResults.length===0&&<div className="shipping-address-result-hint">{t('Not listed? Keep your address and place the pin on the map.','Alamat tidak muncul? Simpan teks alamat dan letakkan pin di peta.')}</div>}
                {geocodeResults.map((result,index)=><button id={`shipping-address-result-${index}`} type="button" key={`${result.latitude}:${result.longitude}:${index}`} className="shipping-address-result" role="option" aria-selected={activeAddressResult===index} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActiveAddressResult(index)} onClick={()=>void selectAddress(result)}><MapPin size={16}/><span>{result.label}</span></button>)}
              </div>}
            </label>

            <label className="shipping-address-detail">
              {t('Address details (optional)','Detail alamat (opsional)')}
              <textarea
                name="addressDetail"
                value={shippingAddressDetail}
                onChange={event=>setShippingAddressDetail(event.target.value)}
                placeholder={t('Tower B, Unit 15CA / No. 37, RT 09/RW 06','Tower B, Unit 15CA / No. 37, RT 09/RW 06')}
                autoComplete="address-line2"
                maxLength={180}
                rows={2}
                aria-describedby="shipping-address-detail-hint"
              />
              <small id="shipping-address-detail-hint">{t('Add a tower, unit, house number, RT/RW, or directions for the courier.','Tambahkan tower, nomor unit, nomor rumah, RT/RW, atau petunjuk untuk kurir.')}</small>
            </label>

            {/* Interactive Point on Map Picker */}
            <MapPicker
              latitude={shippingLatitude}
              longitude={shippingLongitude}
              onChange={coords => {
                setShippingLatitude(coords.lat);
                setShippingLongitude(coords.lng);
                setShippingAreaId(null);
              }}
              language={language}
              focusRevision={mapFocusRevision}
              cityHint={shippingCity ? `${shippingSubdistrict ? shippingSubdistrict + ', ' : ''}${shippingDistrict ? shippingDistrict + ', ' : ''}${shippingCity}` : undefined}
            />

            <div className="shipping-methods-container">
              <div className="shipping-methods-header">
                <strong>{t('Active Shipping Methods & Couriers','Metode & Pilihan Kurir Aktif')}</strong>
                <p>
                  {t(
                    'Select which couriers and fulfillment services you provide for buyers on Market. Couriers are integrated via Biteship.',
                    'Pilih kurir dan layanan pengiriman yang Anda sediakan untuk pembeli di Market. Kurir terintegrasi otomatis melalui Biteship.'
                  )}
                </p>
              </div>

              {/* Quick Presets Row */}
              <div className="shipping-presets-row" role="group" aria-label={t('Courier presets','Preset pilihan kurir')}>
                <button
                  type="button"
                  className="shipping-preset-btn"
                  onClick={() => setShippingMethods(BITESHIP_COURIERS.map(c => c.id))}
                >
                  {t('Select all (11)','Pilih semua (11)')}
                </button>
                <button
                  type="button"
                  className="shipping-preset-btn"
                  onClick={() => setShippingMethods(POPULAR_COURIER_SELECTION)}
                >
                  {t('Popular (5)','Populer (5)')}
                </button>
                <button
                  type="button"
                  className="shipping-preset-btn"
                  onClick={() => setShippingMethods(BITESHIP_COURIERS.filter(c => c.category === 'regular').map(c => c.id))}
                >
                  {t('Regular / Express only (9)','Hanya Reguler / Express (9)')}
                </button>
                <button
                  type="button"
                  className="shipping-preset-btn"
                  onClick={() => setShippingMethods(BITESHIP_COURIERS.filter(c => c.category === 'instant').map(c => c.id))}
                >
                  {t('Instant only (2)','Hanya Instan (2)')}
                </button>
              </div>

              <div className="shipping-methods-list">
                <div className="shipping-section-title">
                  {t('Instant & Same Day Couriers','Kurir Instan & Same Day')}
                </div>
                {BITESHIP_COURIERS.filter(c => c.category === 'instant').map(courier => {
                  const active = shippingMethods.includes(courier.id);
                  return (
                    <div
                      key={courier.id}
                      className={`shipping-method-item ${active ? 'is-active' : ''}`}
                      onClick={() => toggleShippingMethod(courier.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleShippingMethod(courier.id); } }}
                      aria-pressed={active}
                    >
                      <div className="shipping-method-main">
                        <div className="shipping-method-title-row">
                          <strong>{courier.name}</strong>
                          <span className="shipping-method-badge">{language === 'ID' ? courier.badge.id : courier.badge.en}</span>
                        </div>
                        <p>{language === 'ID' ? courier.desc.id : courier.desc.en}</p>
                      </div>
                      <div className={`shipping-method-toggle ${active ? 'is-on' : ''}`} aria-hidden="true">
                        <span className="shipping-toggle-thumb"/>
                      </div>
                    </div>
                  );
                })}

                <div className="shipping-section-title">
                  {t('Regular, Express & Cargo Couriers','Kurir Reguler, Express & Kargo')}
                </div>
                {BITESHIP_COURIERS.filter(c => c.category === 'regular').map(courier => {
                  const active = shippingMethods.includes(courier.id);
                  return (
                    <div
                      key={courier.id}
                      className={`shipping-method-item ${active ? 'is-active' : ''}`}
                      onClick={() => toggleShippingMethod(courier.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleShippingMethod(courier.id); } }}
                      aria-pressed={active}
                    >
                      <div className="shipping-method-main">
                        <div className="shipping-method-title-row">
                          <strong>{courier.name}</strong>
                          <span className="shipping-method-badge">{language === 'ID' ? courier.badge.id : courier.badge.en}</span>
                        </div>
                        <p>{language === 'ID' ? courier.desc.id : courier.desc.en}</p>
                      </div>
                      <div className={`shipping-method-toggle ${active ? 'is-on' : ''}`} aria-hidden="true">
                        <span className="shipping-toggle-thumb"/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <TurnstileField onToken={setTurnstileToken} resetKey={turnstileResetKey}/>
            <button className="button" disabled={savingShipping} type="submit">
              <Save size={16}/>
              {savingShipping ? t('Saving...','Menyimpan...') : t('Save delivery settings','Simpan pengaturan pengiriman')}
            </button>
          </form>
        )}
      </section>
    </div>
  </main>;
}
