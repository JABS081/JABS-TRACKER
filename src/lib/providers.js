import { config } from './config';

export const MapProvider = {
  tileUrl: config.mapTileUrl,
  attribution: config.mapAttribution,
  configured: Boolean(config.mapTileUrl),
};

export async function routeProvider({ start, destination, waypoints = [] }) {
  const base = config.routingUrl;
  if (!base) throw new Error('Routing provider is not configured.');
  const qs = new URLSearchParams({
    start: `${start.lng},${start.lat}`,
    destination: `${destination.lng},${destination.lat}`,
    ...(waypoints.length ? { waypoints: waypoints.map(p => `${p.lng},${p.lat}`).join(';') } : {})
  });
  const r = await fetch(`${base}?${qs}`);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Routing provider unavailable.');
  return body;
}

export async function geocodeProvider(query) {
  if (!config.geocodingUrl) throw new Error('Geocoding provider is not configured.');
  const r = await fetch(`${config.geocodingUrl}${config.geocodingUrl.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}`);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'Geocoding provider unavailable.');
  return body;
}
