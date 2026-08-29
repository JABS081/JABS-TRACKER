import { supabase } from './supabase';

const empty = (error) => ({ data: [], error });

export async function loadAssets() {
  if (!supabase) return empty(new Error('Supabase is not configured.'));

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) return empty(sessionError);

  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    return empty(
      new Error('No authenticated Supabase session. Please sign in again.')
    );
  }

  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('identifier');

  if (error) return empty(error);

  return {
    data: data || [],
    error: null
  };
}

export async function loadAlerts() {
  if (!supabase) return empty(new Error('Supabase is not configured.'));

  return supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
}

export async function loadGeofences() {
  if (!supabase) return empty(new Error('Supabase is not configured.'));

  return supabase
    .from('geofences')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
}

export async function loadTrips() {
  if (!supabase) return empty(new Error('Supabase is not configured.'));

  return supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
}

/*
 * Load historical telemetry for a universal asset.
 *
 * The assets table links the universal asset to either:
 *   - vehicle_id
 *   - device_id
 *
 * The locations table does NOT have asset_id.
 */
export async function loadLocations(asset, hours = 24) {
  if (!supabase) {
    return empty(new Error('Supabase is not configured.'));
  }

  if (!asset) {
    return empty(new Error('No asset selected.'));
  }

  const since = new Date(
    Date.now() - hours * 3600000
  ).toISOString();

  /*
   * Prefer the GPS device relationship when available.
   */
  if (asset.device_id) {
    return supabase
      .from('locations')
      .select('*')
      .eq('device_id', asset.device_id)
      .gte('recorded_at', since)
      .order('recorded_at');
  }

  /*
   * Fall back to the vehicle relationship.
   */
  if (asset.vehicle_id) {
    return supabase
      .from('locations')
      .select('*')
      .eq('vehicle_id', asset.vehicle_id)
      .gte('recorded_at', since)
      .order('recorded_at');
  }

  return empty(
    new Error('Selected asset has no linked device or vehicle.')
  );
}

export function subscribeToAssets(onChange) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('jabs-assets-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'assets'
      },
      onChange
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'locations'
      },
      onChange
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export function subscribeToAlerts(onChange) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('jabs-alerts-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'alerts'
      },
      onChange
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
