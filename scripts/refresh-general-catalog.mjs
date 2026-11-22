import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json';
const OUTPUT_PATH = path.resolve(process.cwd(), 'packages/card-data/general-catalog-presets.json');

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function extractBrand(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  if (/^(AMD|Intel|NVIDIA|ASUS|MSI|Gigabyte|EVGA|ZOTAC|Sapphire|XFX|PowerColor|ASRock|Corsair|G\.Skill|Kingston|Crucial|Team|Samsung|WD|Western|Seagate|Sabrent|SK|Seasonic|be|Cooler|Thermaltake|NZXT|Lian|Noctua|DeepCool|Fractal|PNY|Galax|Colorful|Inno3D|Palit)$/i.test(first)) {
    if (first.toLowerCase() === 'western') return 'WD';
    if (first.toLowerCase() === 'be') return 'be quiet!';
    if (first.toLowerCase() === 'cooler') return 'Cooler Master';
    if (first.toLowerCase() === 'lian') return 'Lian Li';
    if (first.toLowerCase() === 'sk') return 'SK hynix';
    return first;
  }
  return first || 'Generic';
}

const CURATED_PRESETS = [
  // CONSOLE
  { category: 'CONSOLE', brand: 'Sony', model: 'PlayStation 5 Slim (Disc Edition)', attributes: { platform: 'PlayStation 5', storage: '1 TB', region: 'Asia / Global' } },
  { category: 'CONSOLE', brand: 'Sony', model: 'PlayStation 5 Slim Digital Edition', attributes: { platform: 'PlayStation 5', storage: '1 TB', region: 'Asia / Global' } },
  { category: 'CONSOLE', brand: 'Sony', model: 'PlayStation 5 Pro', attributes: { platform: 'PlayStation 5', storage: '2 TB', region: 'Asia / Global' } },
  { category: 'CONSOLE', brand: 'Sony', model: 'PlayStation Portal Remote Player', attributes: { platform: 'PlayStation 5', storage: 'N/A', region: 'Asia / Global' } },
  { category: 'CONSOLE', brand: 'Nintendo', model: 'Switch OLED Model', attributes: { platform: 'Nintendo Switch', storage: '64 GB', region: 'Asia / Japan / US' } },
  { category: 'CONSOLE', brand: 'Nintendo', model: 'Switch V2', attributes: { platform: 'Nintendo Switch', storage: '32 GB', region: 'Asia / Global' } },
  { category: 'CONSOLE', brand: 'Nintendo', model: 'Switch Lite', attributes: { platform: 'Nintendo Switch', storage: '32 GB', region: 'Asia / Global' } },
  { category: 'CONSOLE', brand: 'Nintendo', model: 'Switch 2', attributes: { platform: 'Nintendo Switch 2', storage: '256 GB', region: 'Asia / Japan / US' } },
  { category: 'CONSOLE', brand: 'Valve', model: 'Steam Deck OLED', attributes: { platform: 'SteamOS', storage: '512 GB / 1 TB', region: 'Global' } },
  { category: 'CONSOLE', brand: 'ASUS', model: 'ROG Ally X', attributes: { platform: 'Windows 11 Handheld', storage: '1 TB', region: 'Indonesia / Global' } },
  { category: 'CONSOLE', brand: 'Lenovo', model: 'Legion Go', attributes: { platform: 'Windows 11 Handheld', storage: '512 GB / 1 TB', region: 'Indonesia / Global' } },
  { category: 'CONSOLE', brand: 'Microsoft', model: 'Xbox Series X', attributes: { platform: 'Xbox Series X|S', storage: '1 TB', region: 'Global' } },
  { category: 'CONSOLE', brand: 'Microsoft', model: 'Xbox Series S', attributes: { platform: 'Xbox Series X|S', storage: '512 GB / 1 TB', region: 'Global' } },

  // COMPUTER
  { category: 'COMPUTER', brand: 'Apple', model: 'MacBook Air M3 13"', attributes: { processor: 'Apple M3', graphics: '8/10-Core GPU', memory: '16 GB', storage: '256 GB / 512 GB SSD' } },
  { category: 'COMPUTER', brand: 'Apple', model: 'MacBook Pro M4 14"', attributes: { processor: 'Apple M4', graphics: '10-Core GPU', memory: '16 GB', storage: '512 GB / 1 TB SSD' } },
  { category: 'COMPUTER', brand: 'Apple', model: 'Mac Mini M4', attributes: { processor: 'Apple M4', graphics: '10-Core GPU', memory: '16 GB', storage: '256 GB / 512 GB SSD' } },
  { category: 'COMPUTER', brand: 'ASUS', model: 'ROG Zephyrus G14', attributes: { processor: 'Ryzen 9 8945HS', graphics: 'RTX 4060 / 4070', memory: '16 GB / 32 GB', storage: '1 TB SSD' } },
  { category: 'COMPUTER', brand: 'Lenovo', model: 'Legion 5 / Pro 5', attributes: { processor: 'Core i7-14700HX / Ryzen 7', graphics: 'RTX 4060 / 4070', memory: '16 GB / 32 GB', storage: '1 TB SSD' } },
  { category: 'COMPUTER', brand: 'Acer', model: 'Nitro V 15', attributes: { processor: 'Core i5-13420H', graphics: 'RTX 4050', memory: '16 GB', storage: '512 GB SSD' } },

  // HOBBY: Gunpla, Figures, Diecast, LEGO, Designer Toys
  { category: 'HOBBY', brand: 'Bandai', model: 'RG 1/144 RX-78-2 Gundam Ver. 2.0', attributes: { series: 'Mobile Suit Gundam (Real Grade)' } },
  { category: 'HOBBY', brand: 'Bandai', model: 'MG 1/100 Freedom Gundam Ver. 2.0', attributes: { series: 'Gundam SEED (Master Grade)' } },
  { category: 'HOBBY', brand: 'Bandai', model: 'PG Unleashed 1/60 RX-78-2 Gundam', attributes: { series: 'Mobile Suit Gundam (Perfect Grade)' } },
  { category: 'HOBBY', brand: 'Bandai', model: 'HG 1/144 Gundam Aerial', attributes: { series: 'The Witch from Mercury (High Grade)' } },
  { category: 'HOBBY', brand: 'Bandai Spirits', model: 'S.H.Figuarts Monkey D. Luffy -Gear 5-', attributes: { series: 'One Piece' } },
  { category: 'HOBBY', brand: 'Bandai Spirits', model: 'S.H.Figuarts Roronoa Zoro -The Raid on Onigashima-', attributes: { series: 'One Piece' } },
  { category: 'HOBBY', brand: 'Bandai Spirits', model: 'Ichiban Kuji Masterlise Prize Figure', attributes: { series: 'One Piece / Dragon Ball / Demon Slayer' } },
  { category: 'HOBBY', brand: 'Good Smile Company', model: 'Nendoroid', attributes: { series: 'Anime / Game Figure' } },
  { category: 'HOBBY', brand: 'Good Smile Company', model: 'POP UP PARADE', attributes: { series: 'Anime / Game Figure' } },
  { category: 'HOBBY', brand: 'Kotobukiya', model: 'ARTFX J', attributes: { series: '1/8 Scale Figure' } },
  { category: 'HOBBY', brand: 'Pop Mart', model: 'The Monsters Labubu (Exciting Macaron / Have a Seat)', attributes: { series: 'Designer Art Toy / Blind Box' } },
  { category: 'HOBBY', brand: 'Pop Mart', model: 'Skullpanda / Hirono / Crybaby', attributes: { series: 'Designer Art Toy / Blind Box' } },
  { category: 'HOBBY', brand: 'Medicom Toy', model: 'BE@RBRICK 400% + 100% Set', attributes: { series: 'Designer Art Toy' } },
  // Diecast
  { category: 'HOBBY', brand: 'Hot Wheels', model: 'Car Culture Premium (1:64)', attributes: { series: 'Mattel Diecast' } },
  { category: 'HOBBY', brand: 'Hot Wheels', model: 'RLC Exclusive (Red Line Club)', attributes: { series: 'Mattel Diecast Collector' } },
  { category: 'HOBBY', brand: 'Hot Wheels', model: 'Team Transport (1:64)', attributes: { series: 'Mattel Diecast' } },
  { category: 'HOBBY', brand: 'Hot Wheels', model: 'Super Treasure Hunt (STH)', attributes: { series: 'Mattel Diecast' } },
  { category: 'HOBBY', brand: 'Tomica', model: 'Tomica Premium / Limited Vintage Neo (TLV-N)', attributes: { series: 'Takara Tomy 1:64 Diecast' } },
  { category: 'HOBBY', brand: 'Mini GT', model: '1:64 Scale Diecast Model', attributes: { series: 'TSM Model Diecast' } },
  { category: 'HOBBY', brand: 'Kaido House', model: 'Mini GT x Kaido House 1:64', attributes: { series: 'Jun Imai Diecast' } },
  { category: 'HOBBY', brand: 'Inno64', model: '1:64 Scale Diecast Model', attributes: { series: 'INNO Models Diecast' } },
  { category: 'HOBBY', brand: 'Tarmac Works', model: 'GLOBAL64 / HOBBY64 (1:64)', attributes: { series: 'Tarmac Works Diecast' } },
  // LEGO
  { category: 'HOBBY', brand: 'LEGO', model: 'Speed Champions (76917 / 76924 / 77242)', attributes: { series: 'LEGO Speed Champions' } },
  { category: 'HOBBY', brand: 'LEGO', model: 'Star Wars UCS Millennium Falcon (75192)', attributes: { series: 'LEGO Star Wars' } },
  { category: 'HOBBY', brand: 'LEGO', model: 'Technic 1:8 Supercar (42172 / 42143 / 42115)', attributes: { series: 'LEGO Technic' } },
  { category: 'HOBBY', brand: 'LEGO', model: 'Icons / Modular Building / Botanicals', attributes: { series: 'LEGO Icons' } },
  { category: 'HOBBY', brand: 'LEGO', model: 'One Piece Going Merry / Baratie', attributes: { series: 'LEGO One Piece' } },

  // CONSOLE (extra retro & modern)
  { category: 'CONSOLE', brand: 'Nintendo', model: 'New Nintendo 3DS XL / 2DS XL', attributes: { platform: 'Nintendo 3DS', storage: 'SD Card', region: 'Japan / US' } },
  { category: 'CONSOLE', brand: 'Sony', model: 'PlayStation Vita Slim (PCH-2000)', attributes: { platform: 'PS Vita', storage: '1 GB + Memory', region: 'Japan / Global' } },

  // PHYSICAL_GAME
  { category: 'PHYSICAL_GAME', brand: 'Nintendo', model: 'Pokemon Legends: Z-A', attributes: { platform: 'Nintendo Switch / Switch 2', format: 'Cartridge', language: 'English / Japanese' } },
  { category: 'PHYSICAL_GAME', brand: 'Nintendo', model: 'Pokemon Scarlet / Violet', attributes: { platform: 'Nintendo Switch', format: 'Cartridge', language: 'English / Japanese' } },
  { category: 'PHYSICAL_GAME', brand: 'Nintendo', model: 'The Legend of Zelda: Tears of the Kingdom', attributes: { platform: 'Nintendo Switch', format: 'Cartridge', language: 'English / Japanese' } },
  { category: 'PHYSICAL_GAME', brand: 'Nintendo', model: 'Super Smash Bros. Ultimate', attributes: { platform: 'Nintendo Switch', format: 'Cartridge', language: 'English / Japanese' } },
  { category: 'PHYSICAL_GAME', brand: 'Nintendo', model: 'Mario Kart 8 Deluxe', attributes: { platform: 'Nintendo Switch', format: 'Cartridge', language: 'English / Japanese' } },
  { category: 'PHYSICAL_GAME', brand: 'Sony', model: 'Ghost of Yotei', attributes: { platform: 'PlayStation 5', format: 'Disc', language: 'English / Asia' } },
  { category: 'PHYSICAL_GAME', brand: 'Capcom', model: 'Monster Hunter Wilds', attributes: { platform: 'PlayStation 5', format: 'Disc', language: 'English / Asia' } },
  { category: 'PHYSICAL_GAME', brand: 'Bandai Namco', model: 'Elden Ring Shadow of the Erdtree Edition', attributes: { platform: 'PlayStation 5', format: 'Disc', language: 'English / Asia' } },
  { category: 'PHYSICAL_GAME', brand: 'Square Enix', model: 'Final Fantasy VII Rebirth', attributes: { platform: 'PlayStation 5', format: 'Disc', language: 'English / Asia' } },

  // ACCESSORY: Gaming, Keyboards, Audio, TCG Supplies
  { category: 'ACCESSORY', brand: 'Sony', model: 'DualSense Wireless Controller', attributes: { compatibleWith: 'PlayStation 5 / PC', model: 'CFI-ZCT1W' } },
  { category: 'ACCESSORY', brand: 'Nintendo', model: 'Switch Pro Controller', attributes: { compatibleWith: 'Nintendo Switch', model: 'HAC-013' } },
  { category: 'ACCESSORY', brand: '8BitDo', model: 'Ultimate 2C / Ultimate Bluetooth Controller', attributes: { compatibleWith: 'PC / Nintendo Switch / Android', model: 'Ultimate Wireless' } },
  { category: 'ACCESSORY', brand: 'Wooting', model: '60HE+ / 80HE Rapid Trigger Keyboard', attributes: { compatibleWith: 'Windows / macOS', model: 'Hall Effect Mechanical' } },
  { category: 'ACCESSORY', brand: 'Keychron', model: 'Q1 Pro / V1 Max Mechanical Keyboard', attributes: { compatibleWith: 'Windows / macOS', model: 'Custom Mechanical' } },
  { category: 'ACCESSORY', brand: 'Artisan', model: 'FX Zero / Hien / Hayate Otsu Mousepad (XL)', attributes: { compatibleWith: 'Gaming Mouse', model: 'Japanese Cloth Pad' } },
  { category: 'ACCESSORY', brand: 'Logitech', model: 'G Pro X Superlight 2', attributes: { compatibleWith: 'PC / macOS', model: 'Wireless Gaming Mouse' } },
  { category: 'ACCESSORY', brand: 'Razer', model: 'Viper V3 Pro', attributes: { compatibleWith: 'PC', model: 'Wireless Gaming Mouse' } },
  { category: 'ACCESSORY', brand: 'Moondrop', model: 'Blessing 3 / Aria 2 / Chu II IEM', attributes: { compatibleWith: '3.5mm / 4.4mm / USB-C Audio', model: 'In-Ear Monitor' } },
  { category: 'ACCESSORY', brand: 'Dragon Shield', model: 'Matte / Dual Matte Card Sleeves (100ct)', attributes: { compatibleWith: 'Standard Size TCG (One Piece / Pokémon / MTG)', model: '66x91mm Sleeves' } },
  { category: 'ACCESSORY', brand: 'Ultimate Guard', model: 'Boulder 100+ / Sidewinder 100+ Deck Case', attributes: { compatibleWith: 'Standard Size TCG Decks', model: 'Xenoskin / Solid Case' } },
  { category: 'ACCESSORY', brand: 'Ultra PRO', model: '35pt Magnetic One-Touch / 3x4 Toploaders (25ct)', attributes: { compatibleWith: 'Standard TCG Cards', model: 'Card Protection' } },
  { category: 'ACCESSORY', brand: 'KMC', model: 'Perfect Size Inner Sleeves (100ct)', attributes: { compatibleWith: 'Standard TCG Cards (64x89mm)', model: 'Inner Sleeves' } },
  { category: 'ACCESSORY', brand: 'Vault X', model: '9-Pocket / 12-Pocket Zippered Exo-Tec Binder', attributes: { compatibleWith: 'Standard TCG Cards', model: 'Side-Loading Binder' } },
];

async function buildPcParts() {
  const presets = [];
  const seen = new Set();

  const add = (brand, model, partType, compatibility) => {
    const key = `${partType}:${model.toLowerCase()}`;
    if (seen.has(key) || !model) return;
    seen.add(key);
    presets.push({
      category: 'COMPUTER_PART',
      brand,
      model,
      attributes: { partType, model, compatibility },
    });
  };

  // GPUs
  const gpus = await fetchJson(`${BASE}/video-card.json`);
  for (const g of gpus.filter((x) => x.price > 0 && x.chipset && /(RTX\s*(30|40|50)|RX\s*(6|7|9)\d{3}|Arc\s*[AB]\d+)/i.test(x.chipset)).slice(0, 260)) {
    const model = g.name.includes(g.chipset) ? g.name : `${g.name} (${g.chipset})`;
    add(extractBrand(g.name), model, 'Graphics card (GPU)', `${g.memory ? `${g.memory}GB VRAM, ` : ''}PCIe x16${g.length ? `, ${g.length}mm` : ''}`);
  }

  // CPUs
  const cpus = await fetchJson(`${BASE}/cpu.json`);
  for (const c of cpus.filter((x) => x.price > 0 && /(Ryzen\s*[579]\s*[5789]\d{3}|Core\s*i[3579]-1[234]\d{3}|Core\s*Ultra\s*[579])/i.test(x.name)).slice(0, 180)) {
    add(extractBrand(c.name), c.name, 'Processor (CPU)', `${c.core_count || '?'} cores, ${c.boost_clock ? `${c.boost_clock}GHz boost` : ''}${c.tdp ? `, ${c.tdp}W TDP` : ''}`);
  }

  // Motherboards
  const mobos = await fetchJson(`${BASE}/motherboard.json`);
  for (const m of mobos.filter((x) => x.price > 0 && /^(AM4|AM5|LGA1700|LGA1851)$/i.test(x.socket || '')).slice(0, 220)) {
    add(extractBrand(m.name), m.name, 'Motherboard', `${m.socket}, ${m.form_factor || 'ATX'}${m.memory_type ? `, ${m.memory_type}` : ''}`);
  }

  // Memory
  const ram = await fetchJson(`${BASE}/memory.json`);
  for (const r of ram.filter((x) => x.price > 0 && Array.isArray(x.speed) && x.speed[0] >= 4).slice(0, 180)) {
    const modules = Array.isArray(r.modules) ? `${r.modules[0]}x${r.modules[1]}GB` : '';
    const ddr = r.speed[0] >= 5 ? `DDR5-${r.speed[1]}` : `DDR4-${r.speed[1]}`;
    add(extractBrand(r.name), `${r.name} ${modules} ${ddr}`.trim(), 'Memory (RAM)', `${ddr}${r.cas_latency ? ` CL${r.cas_latency}` : ''}`);
  }

  // SSDs
  const drives = await fetchJson(`${BASE}/internal-hard-drive.json`);
  for (const d of drives.filter((x) => x.price > 0 && x.type === 'SSD' && x.capacity >= 500).slice(0, 180)) {
    const cap = d.capacity >= 1000 ? `${d.capacity / 1000}TB` : `${d.capacity}GB`;
    add(extractBrand(d.name), `${d.name} ${cap}`.trim(), 'Storage (SSD)', `${d.form_factor || 'M.2'}, ${d.interface || 'NVMe PCIe'}`);
  }

  // PSUs
  const psus = await fetchJson(`${BASE}/power-supply.json`);
  for (const p of psus.filter((x) => x.price > 0 && x.wattage >= 550).slice(0, 140)) {
    add(extractBrand(p.name), p.name, 'Power supply (PSU)', `${p.wattage}W, ${p.efficiency ? `80+ ${p.efficiency}` : 'Standard'}, ${p.modular || 'Non-Modular'}`);
  }

  return presets;
}

async function fetchOptionalLegoSets() {
  const key = process.env.REBRICKABLE_API_KEY?.trim();
  if (!key) return [];
  try {
    const res = await fetch(
      'https://rebrickable.com/api/v3/lego/sets/?page_size=200&ordering=-year,-num_parts',
      {
        headers: { Authorization: `key ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((s) => ({
      category: 'HOBBY',
      brand: 'LEGO',
      model: `${s.name} (${s.set_num})`,
      attributes: {
        series: `LEGO (${s.year}${s.num_parts ? `, ${s.num_parts} pcs` : ''})`,
      },
    }));
  } catch {
    return [];
  }
}

async function run() {
  console.log('Fetching PC parts from docyx/pc-part-dataset...');
  const [pcParts, legoSets] = await Promise.all([buildPcParts(), fetchOptionalLegoSets()]);
  const all = [...CURATED_PRESETS, ...legoSets, ...pcParts].map((item, idx) => ({
    id: `gen:${item.category.toLowerCase()}:${idx + 1}`,
    ...item,
  }));

  await writeFile(OUTPUT_PATH, `${JSON.stringify(all, null, 2)}\n`, 'utf8');
  console.log(`Saved ${all.length} general catalog presets (${pcParts.length} PC parts + ${CURATED_PRESETS.length + legoSets.length} curated/LEGO) to ${OUTPUT_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
