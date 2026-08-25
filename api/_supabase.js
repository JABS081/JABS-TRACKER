import { createClient } from '@supabase/supabase-js';

export function adminClient(){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error('Server Supabase configuration is missing.');
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
export function json(res,status,payload){return res.status(status).setHeader('Content-Type','application/json').json(payload)}
export function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):null}
export async function requireUser(req){
  const token=bearer(req); if(!token) throw Object.assign(new Error('Authentication required.'),{status:401});
  const db=adminClient(); const {data,error}=await db.auth.getUser(token); if(error||!data.user) throw Object.assign(new Error('Invalid session.'),{status:401});
  const {data:profile}=await db.from('profiles').select('id,company_id,account_type,role').eq('id',data.user.id).maybeSingle();
  return {user:data.user,profile:profile||{id:data.user.id}};
}
export function fail(res,error){return json(res,error.status||500,{error:error.message||'Unexpected server error.'})}
