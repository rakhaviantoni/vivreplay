import {DEFAULT_EMAIL_FROM,DEFAULT_SUPPORT_EMAIL,DEFAULT_APP_URL} from '@/lib/auth-email';

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char));

export async function emailPayoutRequest(input:{requestId:string;seller:string;amount:number;currency:string}){
  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey)throw new Error('Email delivery is not configured.');
  const recipient=process.env.MARKET_PAYOUT_ADMIN_EMAIL?.trim()||DEFAULT_SUPPORT_EMAIL;
  const amount=new Intl.NumberFormat('id-ID',{style:'currency',currency:input.currency,maximumFractionDigits:0}).format(input.amount);
  const seller=escapeHtml(input.seller);
  const link=`${DEFAULT_APP_URL}/admin?section=payouts`;
  const subject=`Market payout request: ${amount}`;
  const text=`${input.seller} requested a Market payout of ${amount}.\n\nReview the request: ${link}\nRequest ID: ${input.requestId}`;
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f1eee6;color:#292b27;font:15px/1.5 Arial,Helvetica,sans-serif"><main style="max-width:560px;margin:0 auto;padding:26px;background:#fffdf8;border:1px solid #e1dbcf;border-radius:10px"><p style="margin:0 0 8px;color:#896318;font-size:12px;font-weight:700">VivrePlay Market</p><h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">New payout request</h1><p style="margin:0 0 6px">${seller} requested a bank transfer of <strong>${escapeHtml(amount)}</strong>.</p><p style="margin:0 0 20px;color:#625f56;font-size:12px">Request ${escapeHtml(input.requestId)}</p><a href="${link}" style="display:inline-block;padding:11px 16px;border-radius:6px;background:#b8791d;color:#fffdf7;font-weight:700;text-decoration:none">Review payouts</a><p style="margin:20px 0 0;color:#777267;font-size:11px">Check that the funds have cleared in iPaymu before sending the transfer. Bank details are available in the admin workspace.</p></main></body></html>`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:DEFAULT_EMAIL_FROM,to:[recipient],subject,text,html,tags:[{name:'category',value:'admin-payout-request'}]})});
  if(!response.ok)throw new Error(`Email delivery failed (${response.status}).`);
}
