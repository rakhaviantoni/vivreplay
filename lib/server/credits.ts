import {db as database} from './store';

type DB=ReturnType<typeof database>;

export interface CreditLedgerEntry{
  id:string;
  delta:number;
  currency:'IDR'|'USD';
  kind:string;
  referenceId:string|null;
  description:string;
  createdAt:string;
}

let creditSchemaReady=false;

export async function ensureCreditSchema(db:DB){
  if(creditSchemaReady)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS market_credit_wallets (
      profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 0,
      balance_usd INTEGER NOT NULL DEFAULT 0,
      auto_renew_pro INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS market_credit_ledger (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IDR',
      kind TEXT NOT NULL,
      reference_id TEXT,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_market_credit_ledger_profile ON market_credit_ledger(profile_id,created_at DESC)'),
  ]);
  await db.prepare('ALTER TABLE market_credit_wallets ADD COLUMN balance_usd INTEGER NOT NULL DEFAULT 0').run().catch(()=>undefined);
  await db.prepare("ALTER TABLE market_credit_ledger ADD COLUMN currency TEXT NOT NULL DEFAULT 'IDR'").run().catch(()=>undefined);
  creditSchemaReady=true;
}

export async function getCreditWallet(db:DB,profileId:string):Promise<{
  balance:number;
  balanceUsd:number;
  autoRenewPro:boolean;
  ledger:CreditLedgerEntry[];
}>{
  await ensureCreditSchema(db);
  const [wallet,ledgerRows]=await Promise.all([
    db.prepare('SELECT balance,balance_usd AS balanceUsd,auto_renew_pro AS autoRenewPro FROM market_credit_wallets WHERE profile_id=?').bind(profileId).first<{balance:number;balanceUsd?:number;autoRenewPro:number}>(),
    db.prepare("SELECT id,delta,COALESCE(currency,'IDR') AS currency,kind,reference_id AS referenceId,description,created_at AS createdAt FROM market_credit_ledger WHERE profile_id=? ORDER BY created_at DESC LIMIT 20").bind(profileId).all<CreditLedgerEntry>(),
  ]);
  return {
    balance:Number(wallet?.balance)||0,
    balanceUsd:Number(wallet?.balanceUsd)||0,
    autoRenewPro:Boolean(wallet?.autoRenewPro),
    ledger:(ledgerRows.results??[]).map(row=>({...row,currency:row.currency==='USD'?'USD':'IDR'})),
  };
}

export async function addCredits(
  db:DB,
  params:{profileId:string;amount:number;currency?:'IDR'|'USD';kind:string;referenceId?:string|null;description:string},
):Promise<number>{
  await ensureCreditSchema(db);
  const amount=Math.round(params.amount);
  const currency=params.currency==='USD'?'USD':'IDR';
  if(!Number.isSafeInteger(amount)||amount<=0)return 0;
  const col=currency==='USD'?'balance_usd':'balance';
  await db.batch([
    db.prepare(`INSERT INTO market_credit_wallets (profile_id,${col},auto_renew_pro,updated_at)
      VALUES (?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(profile_id) DO UPDATE SET
        ${col}=market_credit_wallets.${col}+excluded.${col},
        updated_at=CURRENT_TIMESTAMP`).bind(params.profileId,amount),
    db.prepare(`INSERT INTO market_credit_ledger (id,profile_id,delta,currency,kind,reference_id,description)
      VALUES (?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(),
      params.profileId,
      amount,
      currency,
      params.kind,
      params.referenceId??null,
      params.description,
    ),
  ]);
  const updated=await db.prepare(`SELECT ${col} AS bal FROM market_credit_wallets WHERE profile_id=?`).bind(params.profileId).first<{bal:number}>();
  return Number(updated?.bal)||0;
}

export async function spendCredits(
  db:DB,
  params:{profileId:string;amount:number;currency?:'IDR'|'USD';kind:string;referenceId?:string|null;description:string},
):Promise<{ok:true;balance:number}|{ok:false}>{
  await ensureCreditSchema(db);
  const amount=Math.round(params.amount);
  const currency=params.currency==='USD'?'USD':'IDR';
  if(!Number.isSafeInteger(amount)||amount<=0)return {ok:false};
  const col=currency==='USD'?'balance_usd':'balance';
  const result=await db.prepare(`UPDATE market_credit_wallets SET ${col}=${col}-?,updated_at=CURRENT_TIMESTAMP WHERE profile_id=? AND ${col}>=?`).bind(amount,params.profileId,amount).run();
  if(!result.meta.changes)return {ok:false};
  await db.prepare(`INSERT INTO market_credit_ledger (id,profile_id,delta,currency,kind,reference_id,description)
    VALUES (?,?,?,?,?,?,?)`).bind(
    crypto.randomUUID(),
    params.profileId,
    -amount,
    currency,
    params.kind,
    params.referenceId??null,
    params.description,
  ).run();
  const updated=await db.prepare(`SELECT ${col} AS bal FROM market_credit_wallets WHERE profile_id=?`).bind(params.profileId).first<{bal:number}>();
  return {ok:true,balance:Number(updated?.bal)||0};
}

export async function setAutoRenewPro(db:DB,profileId:string,enabled:boolean):Promise<boolean>{
  await ensureCreditSchema(db);
  await db.prepare(`INSERT INTO market_credit_wallets (profile_id,balance,auto_renew_pro,updated_at)
    VALUES (?, 0, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(profile_id) DO UPDATE SET
      auto_renew_pro=excluded.auto_renew_pro,
      updated_at=CURRENT_TIMESTAMP`).bind(profileId,enabled?1:0).run();
  return enabled;
}
