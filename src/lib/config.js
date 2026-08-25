export const config = {
  appName: import.meta.env.VITE_APP_NAME || 'JABS TRACKER',
  mapTileUrl: import.meta.env.VITE_MAP_TILE_URL || '',
  mapAttribution: import.meta.env.VITE_MAP_ATTRIBUTION || '',
  routingUrl: import.meta.env.VITE_ROUTING_URL || '/api/routing/route',
  geocodingUrl: import.meta.env.VITE_GEOCODING_URL || '',
  streetImageryUrl: import.meta.env.VITE_STREET_IMAGERY_URL || '',
};
