import { supabase } from '../lib/supabase';

export async function getSession() {
  if (!supabase) return { data: { session: null }, error: new Error('Authentication is not configured.') };
  return supabase.auth.getSession();
}
export async function signIn(email, password) {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function register(email, password, fullName) {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) throw error;
  return data;
}
export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
