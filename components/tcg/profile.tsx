'use client';
import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {
  UserIcon as UserRound,
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
} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {api, useAccount, type AccountState} from '@/lib/client';
import {authClient} from '@/lib/auth-client';
import {Picker} from './catalog';
import {AccountStatus} from './status';

type ShippingOrigin = {
  ownerId: string;
  label: string;
  recipientName: string | null;
  phone: string | null;
  addressLine: string;
  city: string;
  postalCode: string;
  areaId: string | null;
  shippingMethods?: string[];
  updatedAt: string | null;
};

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

export function Profile(){
  const {data,error,refresh}=useAccount();
  if(!data)return <main className="page"><AccountStatus error={error} retry={refresh}/></main>;
  return <ProfileForm profile={data.profile} data={data} refresh={refresh}/>;
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
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [shippingMethods, setShippingMethods] = useState<string[]>(['instant', 'regular']);
  const [savingShipping, setSavingShipping] = useState(false);

  useEffect(()=>{
    const sync=()=>setLanguage(window.localStorage.getItem('vivreplay-locale')==='ID'?'ID':'EN');
    const onLocale=(event:Event)=>setLanguage((event as CustomEvent<'EN'|'ID'>).detail==='ID'?'ID':'EN');
    sync();
    window.addEventListener('vivreplay:locale',onLocale);
    return()=>window.removeEventListener('vivreplay:locale',onLocale);
  },[]);

  const t=(en:string,idStr:string)=>language==='ID'?idStr:en;

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
        setShippingCity(res.origin.city||'');
        setShippingPostalCode(res.origin.postalCode||'');
        if(Array.isArray(res.origin.shippingMethods)&&res.origin.shippingMethods.length>0){
          setShippingMethods(res.origin.shippingMethods);
        }
      })
      .catch(()=>{/* no-op */});
    return()=>{active=false};
  },[]);

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
    setSavingShipping(true);
    try{
      const res = await api<{ok: boolean; shippingMethods?: string[]; error?: string}>('/api/shipping/origin', {
        recipientName: shippingRecipient.trim(),
        phone: shippingPhone.trim(),
        addressLine: shippingAddress.trim(),
        city: shippingCity.trim(),
        postalCode: shippingPostalCode.trim(),
        shippingMethods,
        label: 'Primary origin',
      }, 'POST');
      if (res.ok) {
        setShippingOrigin({
          ownerId: profile.id,
          label: 'Primary origin',
          recipientName: shippingRecipient.trim(),
          phone: shippingPhone.trim(),
          addressLine: shippingAddress.trim(),
          city: shippingCity.trim(),
          postalCode: shippingPostalCode.trim(),
          shippingMethods,
          areaId: null,
          updatedAt: new Date().toISOString(),
        });
        toast.success(t('Shipping settings saved successfully!','Alamat & metode pengiriman berhasil disimpan!'));
      }
    }catch(err){
      toast.error((err as Error).message);
    }finally{
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
          <Link className="button secondary" href={`/players/${profile.username}`}>
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
              <p>{t('Choose your preferred marketplace currency and website interface language.','Pilih mata uang transaksi pasar dan bahasa antarmuka situs.')}</p>
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

            <p className="notice">
              {t(
                'Language preference is saved across your browser and profile. Original seller prices remain visible; FX conversion awaits a verified rate source.',
                'Preferensi bahasa disimpan di peramban dan profil Anda. Harga asli penjual tetap ditampilkan; konversi valuta akan segera hadir.'
              )}
            </p>

            <div className="privacy-note">
              <ShieldCheck size={20}/>
              <div>
                <strong>{t('Your collection, your choice.','Koleksi Anda, kendali Anda.')}</strong>
                <p>
                  {t(
                    'Set each collectible’s visibility in Vault. Your purchase costs and portfolio value are never published automatically.',
                    'Atur privasi tiap koleksi di Vault. Biaya pembelian dan nilai portofolio Anda tidak pernah dipublikasikan otomatis.'
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
                    'Saved address for calculating shipping rates at checkout and fulfilling marketplace orders.',
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

            <label>
              {t('Street address / Landmark','Alamat lengkap / Patokan')}
              <input
                name="addressLine"
                value={shippingAddress}
                onChange={e => setShippingAddress(e.target.value)}
                placeholder={t('Jl. Sudirman No. 12, RT 01 / RW 02','Jl. Sudirman No. 12, RT 01 / RW 02')}
                maxLength={260}
                required
              />
            </label>

            <div className="form-row">
              <label>
                {t('City / Regency','Kota / Kabupaten')}
                <input
                  name="city"
                  value={shippingCity}
                  onChange={e => setShippingCity(e.target.value)}
                  placeholder="Jakarta Selatan"
                  maxLength={80}
                  required
                />
              </label>
              <label>
                {t('Postal code','Kode pos')}
                <input
                  name="postalCode"
                  value={shippingPostalCode}
                  onChange={e => setShippingPostalCode(e.target.value)}
                  placeholder="12190"
                  maxLength={12}
                  required
                />
              </label>
            </div>

            <div className="shipping-methods-container">
              <div className="shipping-methods-header">
                <strong>{t('Active Shipping Methods','Metode Pengiriman Aktif')}</strong>
                <p>
                  {t(
                    'Select which fulfillment methods you accept for orders on Market. At least one method must be enabled.',
                    'Pilih metode pengiriman yang Anda terima untuk pesanan di Market. Minimal satu metode harus aktif.'
                  )}
                </p>
              </div>

              <div className="shipping-methods-list">
                {/* Instant Couriers */}
                <div
                  className={`shipping-method-item ${shippingMethods.includes('instant') ? 'is-active' : ''}`}
                  onClick={() => toggleShippingMethod('instant')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleShippingMethod('instant'); } }}
                  aria-pressed={shippingMethods.includes('instant')}
                >
                  <div className="shipping-method-main">
                    <div className="shipping-method-title-row">
                      <strong>{t('Instant Couriers (Grab / Gojek)','Kurir Instan (Grab / Gojek)')}</strong>
                      <span className="shipping-method-badge">{t('Local · Up to 40 km','Lokal · Maks 40 km')}</span>
                    </div>
                    <p>
                      {t(
                        'Direct on-demand delivery for buyers within 40 km from your origin location.',
                        'Pengiriman langsung untuk pembeli dalam radius hingga 40 km dari lokasi asal Anda.'
                      )}
                    </p>
                  </div>
                  <div className={`shipping-method-toggle ${shippingMethods.includes('instant') ? 'is-on' : ''}`} aria-hidden="true">
                    <span className="shipping-toggle-thumb"/>
                  </div>
                </div>

                {/* Regular Couriers */}
                <div
                  className={`shipping-method-item ${shippingMethods.includes('regular') ? 'is-active' : ''}`}
                  onClick={() => toggleShippingMethod('regular')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleShippingMethod('regular'); } }}
                  aria-pressed={shippingMethods.includes('regular')}
                >
                  <div className="shipping-method-main">
                    <div className="shipping-method-title-row">
                      <strong>{t('J&T Express & Regular Couriers','J&T Express & Kurir Reguler')}</strong>
                      <span className="shipping-method-badge">{t('Nationwide','Seluruh Indonesia')}</span>
                    </div>
                    <p>
                      {t(
                        'Standard tracked parcel delivery with nationwide coverage across Indonesia.',
                        'Pengiriman paket standar terlacak dengan jangkauan ke seluruh Indonesia.'
                      )}
                    </p>
                  </div>
                  <div className={`shipping-method-toggle ${shippingMethods.includes('regular') ? 'is-on' : ''}`} aria-hidden="true">
                    <span className="shipping-toggle-thumb"/>
                  </div>
                </div>
              </div>
            </div>

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

