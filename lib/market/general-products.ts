export type GeneralMarketCategory='HOBBY'|'COMPUTER'|'COMPUTER_PART'|'CONSOLE'|'PHYSICAL_GAME'|'ACCESSORY';
export type GeneralMarketField={key:string;label:string;placeholder:string};
export type GeneralMarketCategoryConfig={label:string;fields:GeneralMarketField[]};

export const generalMarketCategories:Record<GeneralMarketCategory,GeneralMarketCategoryConfig>={
  HOBBY:{label:'Hobby & collectibles',fields:[{key:'series',label:'Series or collection',placeholder:'e.g. Gundam, scale model, figure'}]},
  COMPUTER:{label:'Computers & laptops',fields:[{key:'processor',label:'Processor',placeholder:'e.g. Core i7-13700H'},{key:'graphics',label:'Graphics',placeholder:'e.g. RTX 4060'},{key:'memory',label:'Memory',placeholder:'e.g. 16 GB'},{key:'storage',label:'Storage',placeholder:'e.g. 1 TB SSD'}]},
  COMPUTER_PART:{label:'PC parts',fields:[{key:'partType',label:'Part',placeholder:'e.g. Graphics card, RAM, SSD'},{key:'model',label:'Brand and model',placeholder:'Model name'},{key:'compatibility',label:'Compatibility',placeholder:'Socket, form factor, or interface'}]},
  CONSOLE:{label:'Consoles & handhelds',fields:[{key:'platform',label:'Platform',placeholder:'e.g. PlayStation 5'},{key:'storage',label:'Storage',placeholder:'e.g. 1 TB'},{key:'region',label:'Region',placeholder:'e.g. Japan, Asia, Global'}]},
  PHYSICAL_GAME:{label:'Disc & cartridge games',fields:[{key:'platform',label:'Platform',placeholder:'e.g. Nintendo Switch'},{key:'format',label:'Format',placeholder:'Disc or cartridge'},{key:'language',label:'Language',placeholder:'e.g. English, Japanese'}]},
  ACCESSORY:{label:'Accessories',fields:[{key:'compatibleWith',label:'Works with',placeholder:'Console, PC, or device'},{key:'model',label:'Brand and model',placeholder:'Model name'}]},
};

export const generalMarketConditionOptions=['NEW','LIKE_NEW','USED_GOOD','USED_FAIR'] as const;
export const isGeneralMarketCondition=(condition:string|undefined):condition is (typeof generalMarketConditionOptions)[number]=>generalMarketConditionOptions.some(value=>value===condition);
export const generalMarketCategoryLabel=(category:string,locale='EN')=>locale==='ID'?({HOBBY:'Hobi & koleksi',COMPUTER:'Komputer & laptop',COMPUTER_PART:'Komponen PC',CONSOLE:'Konsol & handheld',PHYSICAL_GAME:'Game fisik',ACCESSORY:'Aksesori'} as Record<string,string>)[category]??category:generalMarketCategories[category as GeneralMarketCategory]?.label??category;
export function generalMarketConditionLabel(condition:string,locale='EN'){
  const labels:Record<string,[string,string]>={NEW:['New','Baru'],LIKE_NEW:['Like new','Seperti baru'],USED_GOOD:['Used, good condition','Bekas, kondisi baik'],USED_FAIR:['Used, visible wear','Bekas, ada tanda pemakaian']};
  return labels[condition]?.[locale==='ID'?1:0]??condition;
}
