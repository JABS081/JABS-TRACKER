import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CircleDot,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { config } from '../lib/config';

const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const fmt = value =>
  num(value) == null ? '—' : Number(value).toFixed(5);

function GeoMap({
  geofences = [],
  assets = [],
  selected,
  setSelected
}) {
  const ref = useRef(null);
  const map = useRef(null);
  const zones = useRef(new Map());
  const markers = useRef(new Map());

  useEffect(() => {
    if (!window.L || !ref.current) return;

    if (!map.current) {
      map.current = window.L
        .map(ref.current, {
          zoomControl: false,
          attributionControl: true
        })
        .setView([6.5244, 3.3792], 7);

      if (config.mapTileUrl) {
        window.L
          .tileLayer(config.mapTileUrl, {
            attribution: config.mapAttribution,
            maxZoom: 19
          })
          .addTo(map.current);
      }

      window.L
        .control
        .zoom({ position: 'bottomright' })
        .addTo(map.current);
    }

    const zoneMap = zones.current;

    geofences.forEach(zone => {
      const lat = num(zone.latitude);
      const lng = num(zone.longitude);
      const radius = Math.max(1, num(zone.radius_m) ?? 250);

      if (lat == null || lng == null) return;

      const active = zone.active !== false;

      const style = {
        radius,
        weight: selected?.id === zone.id ? 3 : 2,
        opacity: active ? .9 : .3,
        fillOpacity: active ? .13 : .04,
        color: active ? '#43d9ff' : '#647784'
      };

      let circle = zoneMap.get(zone.id);

      if (!circle) {
        circle = window.L
          .circle([lat, lng], style)
          .addTo(map.current);

        circle.bindTooltip(
          `<b>${zone.name || 'GEOFENCE'}</b><br/>${zone.type || 'CUSTOMER'} · ${radius} m`,
          { direction: 'top' }
        );

        circle.on('click', () => setSelected(zone));

        zoneMap.set(zone.id, circle);
      } else {
        circle.setLatLng([lat, lng]);
        circle.setRadius(radius);
        circle.setStyle(style);
      }
    });

    [...zoneMap.keys()]
      .filter(id => !geofences.some(z => z.id === id))
      .forEach(id => {
        zoneMap.get(id).remove();
        zoneMap.delete(id);
      });

    const assetMap = markers.current;

    assets.forEach(asset => {
      const lat = num(asset.latitude);
      const lng = num(asset.longitude);

      if (lat == null || lng == null) return;

      let marker = assetMap.get(asset.id);

      const symbol =
        asset.asset_type === 'SHIP'
          ? '⚓'
          : asset.asset_type === 'PHONE'
            ? '⌁'
            : '▴';

      const html =
        `<div class="geoAssetMarker ${String(asset.status || '').toLowerCase()}">${symbol}</div>`;

      if (!marker) {
        marker = window.L
          .marker([lat, lng], {
            icon: window.L.divIcon({
              className: '',
              html,
              iconSize: [30, 30],
              iconAnchor: [15, 15]
            })
          })
          .addTo(map.current);

        marker.bindTooltip(
          `<b>${asset.identifier || asset.name || 'ASSET'}</b><br/>${asset.asset_type || 'ASSET'} · ${asset.status || 'UNKNOWN'}`,
          { direction: 'top' }
        );

        assetMap.set(asset.id, marker);
      } else {
        marker.setLatLng([lat, lng]);
      }
    });

    [...assetMap.keys()]
      .filter(id => !assets.some(a => a.id === id))
      .forEach(id => {
        assetMap.get(id).remove();
        assetMap.delete(id);
      });

    const positions = geofences
      .filter(z => num(z.latitude) != null && num(z.longitude) != null)
      .map(z => [num(z.latitude), num(z.longitude)]);

    if (
      selected &&
      num(selected.latitude) != null &&
      num(selected.longitude) != null
    ) {
      map.current.flyTo(
        [
          num(selected.latitude),
          num(selected.longitude)
        ],
        14,
        { duration: .5 }
      );
    } else if (positions.length > 1) {
      map.current.fitBounds(
        window.L.latLngBounds(positions),
        {
          padding: [45, 45],
          maxZoom: 12
        }
      );
    } else if (positions.length === 1) {
      map.current.setView(positions[0], 12);
    }

    setTimeout(() => map.current?.invalidateSize(), 100);
  }, [geofences, assets, selected, setSelected]);

  return (
    <div className="geofenceMap" ref={ref}>
      {!window.L && (
        <div className="mapProviderError">
          Map library unavailable
        </div>
      )}
    </div>
  );
}

export default function GeofenceControlCenter({
  geofences = [],
  assets = [],
  refresh
}) {
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    type: 'CUSTOMER',
    latitude: '',
    longitude: '',
    radius_m: '250'
  });

  const loadEvents = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('geofence_events')
      .select('*')
      .order('occurred_at', {
        ascending: false
      })
      .limit(30);

    if (!error) {
      setEvents(data || []);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const active = geofences.filter(
    z => z.active !== false
  ).length;

  const totalRadius = useMemo(
    () =>
      geofences.reduce(
        (sum, z) => sum + (num(z.radius_m) || 0),
        0
      ),
    [geofences]
  );

  const createGeofence = async event => {
    event.preventDefault();

    setBusy(true);
    setMessage('');

    const latitude = num(form.latitude);
    const longitude = num(form.longitude);
    const radius = num(form.radius_m);

    if (
      !form.name ||
      latitude == null ||
      longitude == null ||
      radius == null ||
      radius < 1
    ) {
      setMessage(
        'Enter a zone name, valid coordinates and a radius greater than 0.'
      );
      setBusy(false);
      return;
    }

    if (!supabase) {
      setMessage('Supabase is not configured.');
      setBusy(false);
      return;
    }

    const { error } = await supabase
      .from('geofences')
      .insert({
        name: form.name.trim(),
        type: form.type,
        latitude,
        longitude,
        radius_m: radius,
        active: true
      });

    if (error) {
      setMessage(error.message);
    } else {
      setForm({
        name: '',
        type: 'CUSTOMER',
        latitude: '',
        longitude: '',
        radius_m: '250'
      });

      setShowForm(false);
      setMessage('Geofence created successfully.');

      await refresh?.();
    }

    setBusy(false);
  };

  const toggleGeofence = async zone => {
    if (!supabase) return;

    setBusy(true);
    setMessage('');

    const { error } = await supabase
      .from('geofences')
      .update({
        active: zone.active === false
      })
      .eq('id', zone.id);

    if (error) {
      setMessage(error.message);
    } else {
      setSelected(null);
      await refresh?.();
    }

    setBusy(false);
  };

  const deleteGeofence = async zone => {
    if (
      !supabase ||
      !window.confirm(
        `Delete geofence "${zone.name}"?`
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');

    const { error } = await supabase
      .from('geofences')
      .delete()
      .eq('id', zone.id);

    if (error) {
      setMessage(error.message);
    } else {
      setSelected(null);
      await refresh?.();
    }

    setBusy(false);
  };

  return (
    <div className="page geofencePage">

      <div className="pageHero">
        <div>
          <span>SAFETY / MOVEMENT BOUNDARIES</span>
          <h1>Geofence Control Center</h1>
          <p>
            Create safe zones, customer zones and operational
            boundaries. Every boundary is stored in Supabase and
            visualized against connected assets.
          </p>
        </div>

        <div className="geofenceHeroActions">
          <button
            className="outline"
            onClick={() => {
              refresh?.();
              loadEvents();
            }}
          >
            <RefreshCw size={15}/>
            Refresh
          </button>

          <button
            className="primary"
            onClick={() => setShowForm(v => !v)}
          >
            <Plus size={15}/>
            New Geofence
          </button>
        </div>
      </div>

      <div className="stats geofenceStats">

        <div className="stat">
          <div className="statIcon">
            <MapPin size={18}/>
          </div>
          <div>
            <span>DEFINED ZONES</span>
            <strong>{geofences.length}</strong>
            <small>Stored boundaries</small>
          </div>
        </div>

        <div className="stat">
          <div className="statIcon green">
            <ShieldCheck size={18}/>
          </div>
          <div>
            <span>ACTIVE ZONES</span>
            <strong>{active}</strong>
            <small>Currently enforced</small>
          </div>
        </div>

        <div className="stat">
          <div className="statIcon blue">
            <CircleDot size={18}/>
          </div>
          <div>
            <span>ZONE COVERAGE</span>
            <strong>
              {totalRadius > 0
                ? `${(totalRadius / 1000).toFixed(1)} km`
                : '—'}
            </strong>
            <small>Combined radius</small>
          </div>
        </div>

        <div className="stat">
          <div className="statIcon red">
            <AlertTriangle size={18}/>
          </div>
          <div>
            <span>RECENT EVENTS</span>
            <strong>{events.length}</strong>
            <small>Latest stored events</small>
          </div>
        </div>

      </div>

      {showForm && (
        <form
          className="geofenceForm assetCard"
          onSubmit={createGeofence}
        >
          <div className="assetSectionHead">
            <div>
              <b>CREATE SAFETY / OPERATIONAL ZONE</b>
              <small>
                Define the exact boundary and monitoring radius.
              </small>
            </div>

            <button
              type="button"
              className="iconBtn"
              onClick={() => setShowForm(false)}
            >
              <X size={16}/>
            </button>
          </div>

          <div className="geofenceFormGrid">

            <label>
              ZONE NAME
              <input
                value={form.name}
                onChange={e =>
                  setForm({
                    ...form,
                    name: e.target.value
                  })
                }
                placeholder="Home / Mine Site / Customer"
                required
              />
            </label>

            <label>
              ZONE TYPE
              <select
                value={form.type}
                onChange={e =>
                  setForm({
                    ...form,
                    type: e.target.value
                  })
                }
              >
                <option>CUSTOMER</option>
                <option>HOME</option>
                <option>SCHOOL</option>
                <option>MINING_SITE</option>
                <option>DEPOT</option>
                <option>SAFE_ZONE</option>
                <option>RESTRICTED</option>
              </select>
            </label>

            <label>
              LATITUDE
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={e =>
                  setForm({
                    ...form,
                    latitude: e.target.value
                  })
                }
                placeholder="6.524400"
                required
              />
            </label>

            <label>
              LONGITUDE
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={e =>
                  setForm({
                    ...form,
                    longitude: e.target.value
                  })
                }
                placeholder="3.379200"
                required
              />
            </label>

            <label>
              RADIUS (METRES)
              <input
                type="number"
                min="1"
                value={form.radius_m}
                onChange={e =>
                  setForm({
                    ...form,
                    radius_m: e.target.value
                  })
                }
                required
              />
            </label>

          </div>

          <div className="formActions">
            <button
              type="submit"
              className="primary"
              disabled={busy}
            >
              <Plus size={15}/>
              {busy ? 'CREATING…' : 'CREATE ZONE'}
            </button>
          </div>
        </form>
      )}

      <div className="geofenceWorkspace">

        <section className="assetMapCard geofenceMapCard">
          <div className="assetSectionHead">
            <div>
              <b>BOUNDARY MAP</b>
              <small>
                Geofences + current authorized asset positions
              </small>
            </div>

            <span className="assetLive">
              <i/>
              LIVE VIEW
            </span>
          </div>

          <GeoMap
            geofences={geofences}
            assets={assets}
            selected={selected}
            setSelected={setSelected}
          />
        </section>

        <aside className="geofenceListCard assetCard">

          <div className="assetSectionHead">
            <div>
              <b>ACTIVE BOUNDARIES</b>
              <small>
                {geofences.length} configured zone(s)
              </small>
            </div>
            <MapPin size={18}/>
          </div>

          <div className="geofenceList">

            {geofences.map(zone => (
              <button
                key={zone.id}
                className={`geofenceRow ${
                  selected?.id === zone.id
                    ? 'selected'
                    : ''
                }`}
                onClick={() => setSelected(zone)}
              >
                <span className="zoneDot"/>

                <span>
                  <b>{zone.name}</b>
                  <small>
                    {zone.type || 'CUSTOMER'}
                    {' · '}
                    {fmt(zone.radius_m)} m
                    {' · '}
                    {zone.active === false
                      ? 'DISABLED'
                      : 'ACTIVE'}
                  </small>
                </span>

                <span
                  className={
                    zone.active === false
                      ? 'zoneOff'
                      : 'zoneOn'
                  }
                >
                  {zone.active === false ? 'OFF' : 'ON'}
                </span>
              </button>
            ))}

            {!geofences.length && (
              <div className="empty">
                <MapPin size={20}/>
                <span>
                  No geofences yet. Create your first
                  safety or operational zone.
                </span>
              </div>
            )}

          </div>

          {selected && (
            <div className="geofenceDetail">

              <div>
                <span>SELECTED ZONE</span>
                <b>{selected.name}</b>
                <small>
                  {fmt(selected.latitude)},
                  {' '}
                  {fmt(selected.longitude)}
                  {' · '}
                  {fmt(selected.radius_m)} m radius
                </small>
              </div>

              <div className="geofenceDetailActions">

                <button
                  className="outline"
                  disabled={busy}
                  onClick={() =>
                    toggleGeofence(selected)
                  }
                >
                  {selected.active === false
                    ? 'ENABLE'
                    : 'DISABLE'}
                </button>

                <button
                  className="outline dangerOutline"
                  disabled={busy}
                  onClick={() =>
                    deleteGeofence(selected)
                  }
                >
                  <Trash2 size={14}/>
                  DELETE
                </button>

              </div>

            </div>
          )}

        </aside>

      </div>

      <section className="assetCard geofenceEvents">

        <div className="assetSectionHead">
          <div>
            <b>GEOFENCE EVENT FEED</b>
            <small>
              Stored boundary crossings and proximity events
            </small>
          </div>
          <AlertTriangle size={18}/>
        </div>

        <div className="geofenceEventTable">

          {events.map(event => (
            <div
              className="geofenceEventRow"
              key={event.id}
            >
              <span className="eventDot"/>

              <div>
                <b>
                  {String(
                    event.event_type || 'EVENT'
                  ).replaceAll('_', ' ')}
                </b>

                <small>
                  {event.asset_id ||
                    event.vehicle_id ||
                    'Asset'}
                  {' · '}
                  {event.geofence_id || 'Zone'}
                </small>
              </div>

              <time>
                {event.occurred_at
                  ? new Date(
                      event.occurred_at
                    ).toLocaleString()
                  : '—'}
              </time>
            </div>
          ))}

          {!events.length && (
            <div className="empty">
              <ShieldCheck size={20}/>
              <span>
                No stored geofence events yet.
              </span>
            </div>
          )}

        </div>

      </section>

      {message && (
        <div className="infoBox">
          {message}
        </div>
      )}

    </div>
  );
}
