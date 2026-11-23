import {db as database} from './store';

type DB=ReturnType<typeof database>;

export interface CreditLedgerEntry{
  id:string;
  delta:number;
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
      auto_renew_pro INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS market_credit_ledger (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      kind TEXT NOT NULL,
      reference_id TEXT,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_market_credit_ledger_profile ON market_credit_ledger(profile_id,created_at DESC)'),
  ]);
  creditSchemaReady=true;
}

export async function getCreditWallet(db:DB,profileId:string):Promise<{
  balance:number;
  autoRenewPro:boolean;
  ledger:CreditLedgerEntry[];
}>{
  await ensureCreditSchema(db);
  const [wallet,ledgerRows]=await Promise.all([
    db.prepare('SELECT balance,auto_renew_pro AS autoRenewPro FROM market_credit_wallets WHERE profile_id=?').bind(profileId).first<{balance:number;autoRenewPro:number}>(),
    db.prepare('SELECT id,delta,kind,reference_id AS referenceId,description,created_at AS createdAt FROM market_credit_ledger WHERE profile_id=? ORDER BY created_at DESC LIMIT 20').bind(profileId).all<CreditLedgerEntry>(),
  ]);
  return {
    balance:Number(wallet?.balance)||0,
    autoRenewPro:Boolean(wallet?.autoRenewPro),
    ledger:ledgerRows.results??[],
  };
}

export async function addCredits(
  db:DB,
  params:{profileId:string;amount:number;kind:string;referenceId?:string|null;description:string},
):Promise<number>{
  await ensureCreditSchema(db);
  const amount=Math.round(params.amount);
  if(!Number.isSafeInteger(amount)||amount<=0)return 0;
  await db.batch([
    db.prepare(`INSERT INTO market_credit_wallets (profile_id,balance,auto_renew_pro,updated_at)
      VALUES (?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(profile_id) DO UPDATE SET
        balance=market_credit_wallets.balance+excluded.balance,
        updated_at=CURRENT_TIMESTAMP`).bind(params.profileId,amount),
    db.prepare(`INSERT INTO market_credit_ledger (id,profile_id,delta,kind,reference_id,description)
      VALUES (?,?,?,?,?,?)`).bind(
      crypto.randomUUID(),
      params.profileId,
      amount,
      params.kind,
      params.referenceId??null,
      params.description,
    ),
  ]);
  const updated=await db.prepare('SELECT balance FROM market_credit_wallets WHERE profile_id=?').bind(params.profileId).first<{balance:number}>();
  return Number(updated?.balance)||0;
}

export async function spendCredits(
  db:DB,
  params:{profileId:string;amount:number;kind:string;referenceId?:string|null;description:string},
):Promise<{ok:true;balance:number}|{ok:false}>{
  await ensureCreditSchema(db);
  const amount=Math.round(params.amount);
  if(!Number.isSafeInteger(amount)||amount<=0)return {ok:false};
  const result=await db.prepare(`UPDATE market_credit_wallets SET balance=balance-?,updated_at=CURRENT_TIMESTAMP WHERE profile_id=? AND balance>=?`).bind(amount,params.profileId,amount).run();
  if(!result.meta.changes)return {ok:false};
  await db.prepare(`INSERT INTO market_credit_ledger (id,profile_id,delta,kind,reference_id,description)
    VALUES (?,?,?,?,?,?)`).bind(
    crypto.randomUUID(),
    params.profileId,
    -amount,
    params.kind,
    params.referenceId??null,
    params.description,
  ).run();
  const updated=await db.prepare('SELECT balance FROM market_credit_wallets WHERE profile_id=?').bind(params.profileId).first<{balance:number}>();
  return {ok:true,balance:Number(updated?.balance)||0};
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
