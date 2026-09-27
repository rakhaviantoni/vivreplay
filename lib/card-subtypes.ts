/** Canonical One Piece Card Game traits used to split legacy concatenated source values. */
const traitNames = [
  'The Seven Warlords of the Sea', 'The Four Emperors', 'The Vinsmoke Family', 'The Akazaya Nine', 'The Sun Pirates', 'The Franky Family', 'The Tontattas', 'The Flying Fish Riders', 'The Pirates Fest', 'The House of Lambs', "The Owner of Cindry's Shadow", 'King of the Pirates', 'Kingdom of GERMA',
  'Land of Wano', 'Fish-Man Island', 'Kingdom of Prodence', 'Whole Cake Island', 'Sabaody Archipelago', 'Long Ring Long Land', 'Frost Moon Village', 'Windmill Village', 'Lulucia Kingdom', 'Evil Black Drum Kingdom', 'Mogaro Kingdom', 'Water Seven', 'Impel Down', 'Punk Hazard', 'Amazon Lily', 'Drum Kingdom', 'Goa Kingdom', 'Muggy Kingdom', 'Sky Island', 'Mary Geoise', 'Hot Springs Island', 'Omatsuri Island', 'Crown Island', 'Mecha Island', 'Sniper Island', 'Bowin Island', 'Foolshout Island', 'Asuka Island', 'Shipbuilding Town', 'Jaya Botanist', 'Grantesoro', 'Egghead', 'Elbaph', 'Dressrosa', 'Alabasta', 'Baterilla', 'Flevance', 'Ohara', 'Jaya', 'East Blue', 'The Moon',
  'World Government', 'Celestial Dragons', "Weevil's Mother", "The Victims' Club", 'Revolutionary Army', 'Former Revolutionary Army', 'Five Elders', 'Former Navy', 'Navy', 'SWORD', 'Admiral', 'Scientist', 'Biological Weapon', 'Jailer Beast', 'Shandian Warrior', 'Shandian', 'Supernovas', 'Vassals', 'Minks', 'Merfolk', 'Fish-Man', 'Neptunian', 'Lunarian', 'Giant', 'Animal', 'Music', 'FILM', 'ODYSSEY', 'SMILE', 'Seraphim', 'Plague', 'Journalist', 'Special', 'Monsters', 'Sprite', 'Alchemi', 'Allies',
  'Former Whitebeard Pirates', 'Former Roger Pirates', 'Former Rocks Pirates', 'Former Big Mom Pirates', 'Former Arlong Pirates', 'Former Baroque Works', 'Former Rolling Pirates', 'Former Rumbar Pirates', 'Former CP9',
  'Animal Kingdom Pirates', 'Thriller Bark Pirates', 'Fake Straw Hat Crew', 'Animal Kingdom Pirates', 'Donquixote Pirates', 'New Fish-Man Pirates', 'New Giant Pirates', 'New Giant Pirate Crew', 'Golden Lion Pirates', 'Blackbeard Pirates', 'Whitebeard Pirates', 'Red-Haired Pirates', 'Big Mom Pirates', 'Roger Pirates', 'Rocks Pirates', 'Straw Hat Crew', 'Heart Pirates', 'Kid Pirates', 'Bonney Pirates', 'Drake Pirates', 'Hawkins Pirates', 'Caribou Pirates', 'Firetank Pirates', 'Fallen Monk Pirates', 'On-Air Pirates', 'Arlong Pirates', 'Kuja Pirates', 'Foxy Pirates', 'Buggy Pirates', 'Krieg Pirates', 'Bellamy Pirates', 'Beautiful Pirates', 'Spade Pirates', 'Gasparde Pirates', 'Trump Pirates', 'Jellyfish Pirates', 'Bluejam Pirates', 'Black Cat Pirates', 'Alvida Pirates', 'Rolling Pirates', 'Rumbar Pirates', 'Peachbeard Pirates', 'Brownbeard Pirates', 'Gyro Pirates', 'Treasure Pirates', 'World Pirates', 'Space Pirates',
  'Eldoraggo Crew', 'Flying Pirates', 'Neo Navy', 'GERMA 66', 'Homies', 'Eldoraggo Crew', 'Barto Club', 'Happosui Army', 'Mountain Bandits', 'Monkey Mountain Alliance', 'Accino Family', "Buggy's Delivery", 'Cross Guild', 'Baroque Works', 'Galley-La Company', 'Yonta Maria Fleet', 'Kouzuki Clan', 'Kurozumi Clan', 'CP0', 'CP6', 'CP7', 'CP8', 'CP9', 'Mugiwara Chase'
] as const;

export const cardTraits = [...traitNames].sort((left, right) => right.length - left.length);

function canonicalize(value: string) {
  return value.trim().replace(/^Film\b/i, 'FILM').replace(/^Wano Country$/i, 'Land of Wano').replace(/^Straw Hat Cre$/i, 'Straw Hat Crew');
}

function valuesFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.map(String) : [trimmed];
  } catch { return [trimmed]; }
}

/** Splits historical `sub_types` values such as `Navy East Blue` into real traits. */
export function splitCardSubtypes(value: unknown): string[] {
  const traits: string[] = [];
  for (const raw of valuesFrom(value)) {
    let remaining = canonicalize(raw).replace(/[|/,;]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!remaining || remaining === 'NULL' || remaining === '?' || /^\d+$/.test(remaining)) continue;
    while (remaining) {
      const match = cardTraits.find(trait => remaining.toLowerCase() === trait.toLowerCase() || remaining.toLowerCase().startsWith(`${trait.toLowerCase()} `));
      if (!match) {
        if (remaining === 'Pirates') break;
        if (remaining.startsWith('Pirates ')) { remaining = remaining.slice('Pirates '.length); continue; }
        traits.push(remaining);
        break;
      }
      traits.push(match);
      remaining = remaining.slice(match.length).trim();
    }
  }
  return [...new Set(traits)];
}
