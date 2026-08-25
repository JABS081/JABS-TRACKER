import crypto from 'node:crypto';
const secret=()=>process.env.STRIPE_SECRET_KEY;
export const prices={
  PERSONAL_MONTHLY:process.env.STRIPE_PRICE_PERSONAL_MONTHLY,
  PERSONAL_YEARLY:process.env.STRIPE_PRICE_PERSONAL_YEARLY,
  PERSONAL_PLUS_MONTHLY:process.env.STRIPE_PRICE_PERSONAL_PLUS_MONTHLY,
  PERSONAL_PLUS_YEARLY:process.env.STRIPE_PRICE_PERSONAL_PLUS_YEARLY,
  PROFESSIONAL_MONTHLY:process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
  PROFESSIONAL_YEARLY:process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY,
};
export const plans={FREE:{limit:1},PERSONAL:{limit:1},PERSONAL_PLUS:{limit:3},PROFESSIONAL:{limit:10}};
export async function stripe(path,{method='GET',body}={}){if(!secret())throw Object.assign(new Error('Stripe is not configured.'),{status:503});const r=await fetch(`https://api.stripe.com/v1${path}`,{method,headers:{Authorization:`Bearer ${secret()}`,'Content-Type':'application/x-www-form-urlencoded'},body});const text=await r.text();let data={};try{data=JSON.parse(text)}catch{}if(!r.ok)throw Object.assign(new Error(data.error?.message||'Stripe request failed.'),{status:r.status});return data}
export function form(obj){const p=new URLSearchParams();Object.entries(obj).forEach(([k,v])=>v!==undefined&&v!==null&&p.set(k,String(v)));return p.toString()}
export function verifySignature(raw,header){const wh=process.env.STRIPE_WEBHOOK_SECRET;if(!wh)throw Object.assign(new Error('Stripe webhook secret is not configured.'),{status:503});const parts=String(header||'').split(',').reduce((a,x)=>{const [k,v]=x.split('=');(a[k]??=[]).push(v);return a},{});const timestamp=Number(parts.t?.[0]);const sigs=parts.v1||[];if(!timestamp||Math.abs(Date.now()/1000-timestamp)>300)throw Object.assign(new Error('Webhook timestamp outside tolerance.'),{status:400});const signed=`${timestamp}.${raw}`;const expected=crypto.createHmac('sha256',wh).update(signed).digest('hex');if(!sigs.some(s=>crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected))))throw Object.assign(new Error('Invalid Stripe signature.'),{status:400});return true}
