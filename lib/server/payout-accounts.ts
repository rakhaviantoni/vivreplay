import {Buffer} from 'node:buffer';
import {HttpError} from './store';

export type BankDetails={bankName:string;accountHolder:string;accountNumber:string};
async function encryptionKey(){
  const secret=process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
  if(!secret)throw new HttpError(503,'Bank account settings are temporarily unavailable.');
  const bytes=Buffer.from(secret,'base64');
  if(bytes.length!==32)throw new HttpError(503,'Bank account settings are temporarily unavailable.');
  return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function encryptBankDetails(details:BankDetails,ownerId:string,id:string){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(`${ownerId}:${id}`)},await encryptionKey(),new TextEncoder().encode(JSON.stringify(details)));
  return Buffer.concat([Buffer.from(iv),Buffer.from(encrypted)]).toString('base64');
}
export async function decryptBankDetails(value:string,ownerId:string,id:string):Promise<BankDetails>{
  const bytes=Buffer.from(value,'base64');
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:new TextEncoder().encode(`${ownerId}:${id}`)},await encryptionKey(),bytes.subarray(12));
  return JSON.parse(new TextDecoder().decode(clear)) as BankDetails;
}
