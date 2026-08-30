import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertTriangle, Anchor, ArrowRight, BarChart3, Bell, Boxes, CheckCircle2, ChevronRight,
  CircleUserRound, Clock3, Compass, Database, Gauge, Layers3, LogOut, MapPin, Menu, Navigation,
  Package, Phone, Radio, RefreshCw, Route, Settings, ShieldCheck, Ship, Smartphone, Truck, Users,
  Wifi, X, LocateFixed, History, Play, Pause, Search, CreditCard, UserPlus, LockKeyhole
} from 'lucide-react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { getSession, register, signIn, signOut } from './auth/session';
import { supabase } from './lib/supabase';
import {loadAlerts, loadAssets, loadLocations, loadTrips, subscribeToAlerts, subscribeToAssets, loadGeofences} from './lib/data';
import { config } from './lib/config';
import { TruckDashboard, ShipDashboard, PhoneDashboard } from './components/AssetDashboards';
import './styles.css';

const nav = [
  ['COMMAND CENTER', Activity], ['FLEET', Truck], ['TRIPS', Route], ['SHIPMENTS', Ship],
  ['SHIP TRACKING', Anchor], ['PHONE TRACKING', Phone], ['ANALYTICS', BarChart3], ['ALERTS', AlertTriangle],
  ['REPORTS', Database], ['GEOFENCES', MapPin], ['DEVICES', Wifi], ['ADMIN', Settings], ['BILLING', CreditCard]
];

const statusTone = s => ({ MOVING:'good', ACTIVE:'good', IN_TRANSIT:'info', TRANSIT:'info', STOPPED:'warn', IDLE:'warn', OFFLINE:'danger', DELAYED:'danger', AT_CUSTOMER:'info', LOADING:'warn' }[String(s||'').toUpperCase()] || 'info');
const iconFor = type => type === 'SHIP' ? Ship : type === 'PHONE' ? Smartphone : Truck;

function Toast({message,onClose}) { if(!message)return null; return <div className="toast"><AlertTriangle size={16}/><span>{message}</span><button onClick={onClose}><X size={14}/></button></div>; }
function Status({children}) { return <span className={`status ${statusTone(children)}`}>{children || 'UNKNOWN'}</span>; }
function Stat({icon:Icon,label,value,meta,tone='cyan'}) { return <div className="stat"><div className={`statIcon ${tone}`}><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></div>; }

function Cover({onEnter}) {
  const scenes = [
    {type:'TRUCK', eyebrow:'FLEET VISIBILITY', title:'TRACK EVERY', accent:' TRUCK', desc:'Real vehicle telemetry, movement history, route progress and operational exceptions in one command view.'},
    {type:'SHIP', eyebrow:'MARITIME VISIBILITY', title:'WATCH EVERY', accent:' SHIP', desc:'Monitor vessel position, voyage progress, arrival context and connected shipment operations.'},
    {type:'PHONE', eyebrow:'CONNECTED PEOPLE & DEVICES', title:'LOCATE EVERY', accent:' PHONE', desc:'Authorized browser location tracking with battery, signal freshness, movement and history.'},
    {type:'COMMAND', eyebrow:'OPERATIONAL INTELLIGENCE', title:'CONTROL EVERY', accent:' MOVEMENT', desc:'One secure workspace for trucks, ships, phones, trips, alerts, geofences and analytics.'}
  ];
  const [idx,setIdx] = useState(0), [muted,setMuted] = useState(true);
  const audio=useRef(null);
  const video=useRef(null);
  const s=scenes[idx];
  const videoSrc=`/videos/jabs-${s.type.toLowerCase()}.mp4`;
  useEffect(()=>{
    const t=setInterval(()=>setIdx(v=>(v+1)%scenes.length),5200);
    return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    const el=video.current;
    if(!el)return;

    el.pause();
    el.currentTime=0;
    el.muted=true;

    const play=()=>{
      el.muted=true;
      el.play().catch(()=>{});
    };

    if(el.readyState>=2) play();
    else el.addEventListener('loadeddata',play,{once:true});

    return()=>el.removeEventListener('loadeddata',play);
  },[videoSrc]);

  useEffect(()=>{
    if(!audio.current)return;
    if(muted) audio.current.pause();
    else audio.current.play().catch(()=>{});
  },[muted]);
  const Icon=iconFor(s.type);
  return <main className="cover">

    <div className="cinematicVideoLayer" aria-hidden="true">
      <video
        ref={video}
        key={videoSrc}
        className="cinematicVideo"
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={(e)=>{
          e.currentTarget.muted=true;
          e.currentTarget.play().catch(()=>{});
        }}
      />
      <div className="cinematicVideoGrade"/>
    </div>
    <div className={`coverScene ${s.type.toLowerCase()}`} aria-hidden="true"><div className="sceneMesh"/><div className="sceneOrb o1"/><div className="sceneOrb o2"/><div className="sceneRoute"/><div className="sceneAsset"><Icon size={86}/></div><div className="sceneHorizon"/></div>
    <div className="coverShade"/><div className="coverVignette"/>
    <audio ref={audio} loop preload="auto" src="/sounds/intro-ambient.wav"/>
    <header className="coverTop"><div className="coverBrand"><div className="coverLogo"><Radio size={22}/></div><div><b>JABS</b><span>TRACKER</span></div></div><div className="coverStatus"><i className="pulse"/> SYSTEM ONLINE</div><button className="coverSound" onClick={()=>setMuted(v=>!v)}>{muted?'SOUND OFF':'SOUND ON'}</button></header>
    <section className="coverContent"><div className="sceneMeta"><b>0{idx+1}</b><i/><span>0{scenes.length}</span></div><div className="coverCopy"><div className="sceneLabel"><Icon size={17}/><span>{s.eyebrow}</span></div><h1>{s.title}<em>{s.accent}</em></h1><p>{s.desc}</p><div className="coverActions"><button className="enterButton" onClick={onEnter}>ENTER JABS TRACKER <ArrowRight size={18}/></button><span>TRACE IT <b>•</b> TRACK IT <b>•</b> TRUST IT</span></div></div><div className="sceneSelector">{scenes.map((x,i)=>{const I=iconFor(x.type);return <button key={x.type} className={i===idx?'selected':''} onClick={()=>setIdx(i)}><I size={15}/>{x.type}</button>})}</div></section>
    <footer className="coverFooter"><span>JABS SMALL & MEDIUM ENTERPRISE</span><i/><span>OPERATIONAL VISIBILITY PLATFORM</span><div className="coverProgress"><span style={{width:`${((idx+1)/4)*100}%`}}/></div></footer>
  </main>;
}

function Login({onAuthenticated}) {
  const [mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const r=mode==='login'?await signIn(email,password):await register(email,password,name);if(r.session)onAuthenticated(r.session);else if(mode==='register')setError('Account created. Check your email if confirmation is enabled, then sign in.');}catch(err){setError(err.message)}finally{setBusy(false)}};
  return <main className="authScreen"><div className="authArt"><div className="authGrid"/><div className="authOrb"/></div><div className="authCard"><div className="brand"><div className="logo"><Radio size={22}/></div><div><b>JABS</b><span>TRACKER</span></div></div><div className="authTitle"><span>SECURE OPERATIONS</span><h1>{mode==='login'?'Welcome back':'Create your account'}</h1><p>{mode==='login'?'Sign in to access your authorized tracking workspace.':'Create an account to begin your secured workspace.'}</p></div><form onSubmit={submit}>{mode==='register'&&<label>FULL NAME<input value={name} onChange={e=>setName(e.target.value)} required/></label>}<label>EMAIL<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label><label>PASSWORD<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} autoComplete={mode==='login'?'current-password':'new-password'}/></label>{error&&<div className="formError"><AlertTriangle size={15}/>{error}</div>}<button className="primary wide" disabled={busy}>{busy?'AUTHENTICATING…':mode==='login'?'SIGN IN':'CREATE ACCOUNT'} <ArrowRight size={16}/></button></form><button className="switchAuth" onClick={()=>{setMode(v=>v==='login'?'register':'login');setError('')}}>{mode==='login'?<><UserPlus size={15}/> Create an account</>:<><LockKeyhole size={15}/> Return to sign in</>}</button><div className="authNote"><ShieldCheck size={15}/> Access is controlled by Supabase authentication and database policies.</div></div></main>;
}

function LeafletMap({assets,selected,onSelect,trail=[]}) {
  const ref=useRef(null), map=useRef(null), markers=useRef(new Map()), trailLayer=useRef(null);
  useEffect(()=>{
    if(!window.L || !ref.current) return;
    if(!map.current){
      map.current=window.L.map(ref.current,{zoomControl:false,attributionControl:true}).setView([6.5244,3.3792],7);
      if(config.mapTileUrl) window.L.tileLayer(config.mapTileUrl,{attribution:config.mapAttribution,maxZoom:19}).addTo(map.current);
      else window.L.control({position:'topright'}).onAdd=()=>{const d=document.createElement('div');d.className='mapProviderError';d.textContent='Map tiles not configured';return d};
      window.L.control.zoom({position:'bottomright'}).addTo(map.current);
    }
    const m=markers.current;
    assets.forEach(a=>{if(!Number.isFinite(Number(a.latitude))||!Number.isFinite(Number(a.longitude)))return;const key=a.id;let marker=m.get(key);const Icon=iconFor(a.asset_type);const html=`<div class="assetMarker ${String(a.status).toLowerCase()}"><span>${a.asset_type==='SHIP'?'⚓':a.asset_type==='PHONE'?'⌁':'▴'}</span></div>`;if(!marker){marker=window.L.marker([a.latitude,a.longitude],{icon:window.L.divIcon({className:'',html,iconSize:[34,34],iconAnchor:[17,17]})}).addTo(map.current);
        marker.bindTooltip(
          `<b>${a.identifier || a.name || 'ASSET'}</b><br/>${a.asset_type || 'ASSET'} · ${a.status || 'UNKNOWN'}`,
          {direction:'top',offset:[0,-18],opacity:.94}
        );
        marker.on('click',()=>onSelect(a));
        m.set(key,marker)}else marker.setLatLng([a.latitude,a.longitude]);});
    [...m.keys()].filter(k=>!assets.some(a=>a.id===k)).forEach(k=>{m.get(k).remove();m.delete(k)});
    const positionedAssets = assets.filter(a =>
      Number.isFinite(Number(a.latitude)) &&
      Number.isFinite(Number(a.longitude))
    );

    if(selected &&
       Number.isFinite(Number(selected.latitude)) &&
       Number.isFinite(Number(selected.longitude))) {
      map.current.flyTo(
        [Number(selected.latitude), Number(selected.longitude)],
        13,
        {duration:.7}
      );
    } else if(positionedAssets.length > 1) {
      const bounds = window.L.latLngBounds(
        positionedAssets.map(a => [
          Number(a.latitude),
          Number(a.longitude)
        ])
      );

      map.current.fitBounds(bounds, {
        padding: [55,55],
        maxZoom: 12,
        animate: true
      });
    } else if(positionedAssets.length === 1) {
      map.current.setView(
        [
          Number(positionedAssets[0].latitude),
          Number(positionedAssets[0].longitude)
        ],
        11,
        {animate:true}
      );
    }

    if(trailLayer.current) trailLayer.current.remove();
    if(trail.length>1) trailLayer.current=window.L.polyline(trail.map(p=>[p.latitude,p.longitude]),{color:'#43d9ff',weight:4,opacity:.75}).addTo(map.current);
    setTimeout(()=>map.current?.invalidateSize(),100);
  },[assets,selected,trail,onSelect]);
  return <div className="leafletMap" ref={ref}>{!window.L&&<div className="mapProviderError">Map library unavailable</div>}</div>;
}

function LiveMap({assets,selected,setSelected,trail}) { return <div className="mapPanel"><div className="panelHead"><div><b>LIVE ASSET MAP</b><small>{assets.length} tracked assets · realtime feed</small></div><div className="mapTools"><span className="liveBadge"><i className="pulse"/> LIVE</span></div></div><LeafletMap assets={assets} selected={selected} onSelect={setSelected} trail={trail}/><div className="mapLegend"><span><i className="goodDot"/> Moving</span><span><i className="warnDot"/> Idle</span><span><i className="dangerDot"/> Offline / Exception</span></div></div> }

function AssetDrawer({asset,onClose,trail}){if(!asset)return null;const Icon=iconFor(asset.asset_type);return <aside className="assetDrawer"><div className="drawerHead"><div><span className="assetIcon"><Icon size={17}/></span><div><b>{asset.identifier||asset.name}</b><small>{asset.name||asset.asset_type}</small></div></div><button onClick={onClose}><X/></button></div><div className="drawerStatus"><Status>{asset.status}</Status><span>Updated {asset.last_updated?new Date(asset.last_updated).toLocaleString():'—'}</span></div><div className="metricGrid"><div><small>SPEED</small><b>{asset.speed??0} km/h</b></div><div><small>HEADING</small><b>{asset.heading??0}°</b></div><div><small>LATITUDE</small><b>{Number(asset.latitude).toFixed(5)}</b></div><div><small>LONGITUDE</small><b>{Number(asset.longitude).toFixed(5)}</b></div></div><div className="drawerSection"><b>TRIP CONTEXT</b><p>{asset.current_trip_id||'No active trip linked'}</p></div><div className="drawerSection"><b>RECENT TRAIL</b><p>{trail.length} location points loaded for the selected window.</p></div><button className="outline wide"><History size={15}/> Open movement history</button></aside>}

function CommandCenter({assets,alerts,trips,setSelected,selected,trail,refresh}) {
  const moving=assets.filter(a=>['MOVING','IN_TRANSIT','TRANSIT'].includes(String(a.status).toUpperCase())).length;
  const offline=assets.filter(a=>String(a.status).toUpperCase()==='OFFLINE').length;
  const ships=assets.filter(a=>a.asset_type==='SHIP').length;
  const trucks=assets.filter(a=>a.asset_type==='TRUCK').length;
  const phones=assets.filter(a=>a.asset_type==='PHONE').length;

  return <>
    <div className="pageHero">
      <div>
        <span>OPERATIONAL VISIBILITY</span>
        <h1>Command Center</h1>
        <p>
          Real-time intelligence across every authorized truck, ship and phone.
          Select any asset to inspect telemetry and movement history.
        </p>
      </div>

      <button className="outline" onClick={refresh}>
        <RefreshCw size={15}/> Refresh
      </button>
    </div>

    <div className="stats">
      <Stat
        icon={Truck}
        label="TRACKED ASSETS"
        value={assets.length}
        meta={`${trucks} trucks · ${ships} ships · ${phones} phones`}
      />

      <Stat
        icon={Navigation}
        label="MOVING"
        value={moving}
        meta="Current telemetry"
        tone="blue"
      />

      <Stat
        icon={AlertTriangle}
        label="OPEN ALERTS"
        value={alerts.length}
        meta={offline ? `${offline} asset(s) offline` : 'No offline assets'}
        tone="red"
      />

      <Stat
        icon={Route}
        label="ACTIVE TRIPS"
        value={trips.filter(t=>!['COMPLETED','CANCELLED'].includes(String(t.status||'').toUpperCase())).length}
        meta="Operational journeys"
        tone="green"
      />
    </div>

    <div className="workspace">
      <LiveMap
        assets={assets}
        selected={selected}
        setSelected={setSelected}
        trail={trail}
      />

      <div className="sideStack">

        <div className="panel">
          <div className="panelHead">
            <div>
              <b>ACTIVE ASSETS</b>
              <small>Click any asset to focus the map</small>
            </div>
          </div>

          <div className="assetList">
            {assets.slice(0,12).map(a=>{
              const I=iconFor(a.asset_type);

              return (
                <button
                  key={a.id}
                  onClick={()=>setSelected(a)}
                  className={selected?.id===a.id?'selectedAsset':''}
                >
                  <span className="assetIcon">
                    <I size={16}/>
                  </span>

                  <span>
                    <b>{a.identifier || a.name || 'UNNAMED ASSET'}</b>
                    <small>
                      {a.name || a.asset_type}
                      {a.speed!=null ? ` · ${a.speed} km/h` : ''}
                    </small>
                  </span>

                  <Status>{a.status}</Status>
                </button>
              );
            })}

            {!assets.length &&
              <Empty text="No authorized assets yet."/>
            }
          </div>
        </div>

        <div className="panel">
          <div className="panelHead">
            <div>
              <b>EXCEPTIONS</b>
              <small>Latest operational events</small>
            </div>
          </div>

          {alerts.slice(0,5).map(a=>
            <div className="eventRow" key={a.id}>
              <span className={`eventDot ${String(a.severity).toLowerCase()}`}/>
              <div>
                <b>{a.title||a.alert_type}</b>
                <small>{a.message||'Operational exception'}</small>
              </div>
              <time>
                {a.created_at
                  ? new Date(a.created_at).toLocaleTimeString([],{
                      hour:'2-digit',
                      minute:'2-digit'
                    })
                  : '—'}
              </time>
            </div>
          )}

          {!alerts.length &&
            <Empty text="No unresolved alerts."/>
          }
        </div>

      </div>
    </div>

    <AssetDrawer
      asset={selected}
      onClose={()=>setSelected(null)}
      trail={trail}
    />
  </>;
}
function Empty({text}){return <div className="empty"><Database size={20}/><span>{text}</span></div>}


function GeofenceControlCenter({geofences=[],assets=[],refresh}) {
 const [name,setName]=useState('');
 const [type,setType]=useState('CUSTOMER');
 const [latitude,setLatitude]=useState('');
 const [longitude,setLongitude]=useState('');
 const [radius,setRadius]=useState('250');
 const [active,setActive]=useState(true);
 const [selectedAssets,setSelectedAssets]=useState([]);
 const [companyId,setCompanyId]=useState('');
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');

 const loadCompany=async()=>{
   if(!supabase)return;
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)return;

   const {data,error}=await supabase
     .from('company_members')
     .select('company_id')
     .eq('user_id',user.id)
     .eq('active',true)
     .limit(1)
     .maybeSingle();

   if(error){
     setMessage(error.message);
     return;
   }

   setCompanyId(data?.company_id||'');
 };

 useEffect(()=>{
   loadCompany();
 },[]);

 const toggleAsset=id=>{
   setSelectedAssets(list=>
     list.includes(id)
       ? list.filter(x=>x!==id)
       : [...list,id]
   );
 };

 const resetForm=()=>{
   setName('');
   setType('CUSTOMER');
   setLatitude('');
   setLongitude('');
   setRadius('250');
   setActive(true);
   setSelectedAssets([]);
 };

 const createGeofence=async e=>{
   e.preventDefault();
   setMessage('');

   const lat=Number(latitude);
   const lng=Number(longitude);
   const radiusM=Number(radius);

   if(!companyId){
     setMessage('No active organization is attached to this account.');
     return;
   }

   if(!name.trim()){
     setMessage('Enter a geofence name.');
     return;
   }

   if(!Number.isFinite(lat)||lat<-90||lat>90){
     setMessage('Enter a valid latitude between -90 and 90.');
     return;
   }

   if(!Number.isFinite(lng)||lng<-180||lng>180){
     setMessage('Enter a valid longitude between -180 and 180.');
     return;
   }

   if(!Number.isFinite(radiusM)||radiusM<20){
     setMessage('Geofence radius must be at least 20 metres.');
     return;
   }

   setSaving(true);

   try{
     const {data,error}=await supabase
       .from('geofences')
       .insert({
         company_id:companyId,
         name:name.trim(),
         type,
         latitude:lat,
         longitude:lng,
         radius_m:radiusM,
         active
       })
       .select('*')
       .single();

     if(error)throw error;

     if(selectedAssets.length){
       const rows=selectedAssets.map(asset_id=>({
         geofence_id:data.id,
         asset_id,
         active:true
       }));

       const {error:assignmentError}=await supabase
         .from('geofence_assets')
         .insert(rows);

       if(assignmentError)throw assignmentError;
     }

     setMessage('Geofence created and asset assignments saved.');
     resetForm();
     await refresh();
   }catch(err){
     setMessage(err.message||'Unable to create geofence.');
   }finally{
     setSaving(false);
   }
 };

 const deleteGeofence=async id=>{
   if(!window.confirm('Delete this geofence and its asset assignments?'))return;

   setMessage('');

   const {error}=await supabase
     .from('geofences')
     .delete()
     .eq('id',id);

   if(error){
     setMessage(error.message);
     return;
   }

   setMessage('Geofence deleted.');
   await refresh();
 };

 const toggleGeofence=async(g)=>{
   const {error}=await supabase
     .from('geofences')
     .update({active:!g.active})
     .eq('id',g.id);

   if(error){
     setMessage(error.message);
     return;
   }

   await refresh();
 };

 return <div className="page">

   <div className="pageHero">
     <div>
       <span>SAFETY & LOCATION INTELLIGENCE</span>
       <h1>Geofence Control Center</h1>
       <p>
         Create safe zones, operational zones and restricted areas,
         then attach authorized trucks, phones or workforce assets.
       </p>
     </div>

     <div className="heroIcon">
       <MapPin size={22}/>
     </div>
   </div>

   <div className="geofenceControlGrid">

     <form className="formPanel" onSubmit={createGeofence}>
       <div className="panelHead">
         <div>
           <b>CREATE GEOFENCE</b>
           <small>Organization-controlled location boundary</small>
         </div>
         <MapPin size={18}/>
       </div>

       <label>
         GEOFENCE NAME
         <input
           value={name}
           onChange={e=>setName(e.target.value)}
           placeholder="Home / School / Mining Site / Customer"
         />
       </label>

       <label>
         TYPE
         <select value={type} onChange={e=>setType(e.target.value)}>
           <option value="HOME">HOME / SAFE ZONE</option>
           <option value="SCHOOL">SCHOOL</option>
           <option value="WORK">WORK / DEPARTMENT</option>
           <option value="SITE">MINING / OPERATIONAL SITE</option>
           <option value="CUSTOMER">CUSTOMER</option>
           <option value="RESTRICTED">RESTRICTED AREA</option>
           <option value="CUSTOM">CUSTOM</option>
         </select>
       </label>

       <div className="formTwo">
         <label>
           LATITUDE
           <input
             type="number"
             step="any"
             value={latitude}
             onChange={e=>setLatitude(e.target.value)}
             placeholder="6.5244"
           />
         </label>

         <label>
           LONGITUDE
           <input
             type="number"
             step="any"
             value={longitude}
             onChange={e=>setLongitude(e.target.value)}
             placeholder="3.3792"
           />
         </label>
       </div>

       <label>
         RADIUS — METRES
         <input
           type="number"
           min="20"
           value={radius}
           onChange={e=>setRadius(e.target.value)}
         />
       </label>

       <label className="checkRow">
         <input
           type="checkbox"
           checked={active}
           onChange={e=>setActive(e.target.checked)}
         />
         <span>
           <b>ACTIVE GEOFENCE</b>
           <small>Generate location-boundary events when enabled.</small>
         </span>
       </label>

       <div className="assetAssignmentBox">
         <div className="panelHead">
           <div>
             <b>ASSIGN ASSETS</b>
             <small>Choose which authorized assets use this zone.</small>
           </div>
         </div>

         {!assets.length &&
           <div className="infoBox">No authorized assets available.</div>
         }

         {assets.map(asset=>
           <label className="assetCheck" key={asset.id}>
             <input
               type="checkbox"
               checked={selectedAssets.includes(asset.id)}
               onChange={()=>toggleAsset(asset.id)}
             />
             <span>
               <b>{asset.identifier||asset.name||'Unnamed asset'}</b>
               <small>{asset.asset_type||'ASSET'} · {asset.status||'UNKNOWN'}</small>
             </span>
           </label>
         )}
       </div>

       {message&&
         <div className="infoBox">{message}</div>
       }

       <div className="formActions">
         <button className="primary" disabled={saving}>
           {saving?'CREATING…':'CREATE GEOFENCE'}
         </button>

         <button
           type="button"
           className="outline"
           onClick={resetForm}
           disabled={saving}
         >
           RESET
         </button>
       </div>

     </form>

     <section className="panel">

       <div className="panelHead">
         <div>
           <b>ACTIVE LOCATION ZONES</b>
           <small>
             {geofences.length} organization geofence{geofences.length===1?'':'s'}
           </small>
         </div>
         <MapPin size={18}/>
       </div>

       <div className="geofenceList">

         {!geofences.length&&
           <Empty
             text="No geofences have been created for this organization."
           />
         }

         {geofences.map(g=>
           <div className="geofenceItem" key={g.id}>

             <div className="geofenceItemTop">
               <div>
                 <b>{g.name||'Unnamed geofence'}</b>
                 <small>
                   {(g.type||'CUSTOM').replaceAll('_',' ')}
                   {' · '}
                   {Number(g.radius_m||0).toLocaleString()} m
                 </small>
               </div>

               <span className={g.active?'statusPill live':'statusPill'}>
                 {g.active?'ACTIVE':'PAUSED'}
               </span>
             </div>

             <div className="geofenceCoordinates">
               <span>
                 LAT {Number(g.latitude).toFixed(5)}
               </span>
               <span>
                 LNG {Number(g.longitude).toFixed(5)}
               </span>
             </div>

             <div className="geofenceItemActions">
               <button
                 className="outline"
                 onClick={()=>toggleGeofence(g)}
               >
                 {g.active?'PAUSE':'ACTIVATE'}
               </button>

               <button
                 className="dangerBtn"
                 onClick={()=>deleteGeofence(g.id)}
               >
                 DELETE
               </button>
             </div>

           </div>
         )}

       </div>

     </section>

   </div>

   <div className="infoBox">
     <b>SAFETY ENGINE:</b> these zones are stored in Supabase and are
     organization-scoped. The next layer will turn asset movement into
     ENTER, EXIT, DWELL and safety alerts.
   </div>

 </div>
}

function TablePage({title,icon:Icon,rows,columns}){return <div className="page"><div className="pageHero"><div><span>LIVE MODULE</span><h1>{title}</h1><p>Records are loaded from the connected operational data layer. No demo records are inserted by the interface.</p></div><div className="heroIcon"><Icon size={22}/></div></div><div className="tablePanel"><div className="tableWrap"><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(c=><td key={c}>{String(r[c.toLowerCase().replaceAll(' ','_')] ?? r[c] ?? '—')}</td>)}</tr>)}</tbody></table>{!rows.length&&<Empty text="No records are available for this account."/>}</div></div></div>}

function Analytics({assets,trips}){const series=useMemo(()=>{const by={};trips.forEach(t=>{const d=new Date(t.created_at||Date.now()).toLocaleDateString(undefined,{weekday:'short'});by[d]=(by[d]||0)+Number(t.actual_distance_km||t.planned_distance_km||0)});return Object.entries(by).map(([d,km])=>({d,km}))},[trips]);return <div className="page"><div className="pageHero"><div><span>PERFORMANCE INTELLIGENCE</span><h1>Analytics</h1><p>Operational metrics calculated from connected trip and asset records.</p></div></div><div className="stats"><Stat icon={Navigation} label="DISTANCE" value={`${series.reduce((a,b)=>a+b.km,0).toFixed(0)} km`} meta="Loaded trip records"/><Stat icon={Gauge} label="ASSET UTILIZATION" value={assets.length?`${Math.round(assets.filter(a=>a.status!=='OFFLINE').length/assets.length*100)}%`:'—'} meta="Online asset ratio" tone="green"/></div><div className="chartPanel"><div className="panelHead"><div><b>TRIP DISTANCE TREND</b><small>Derived from stored trip distances</small></div></div>{series.length?<ResponsiveContainer width="100%" height={330}><AreaChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#1b3344"/><XAxis dataKey="d" stroke="#7d95a5"/><YAxis stroke="#7d95a5"/><Tooltip contentStyle={{background:'#07131d',border:'1px solid #214256'}}/><Area type="monotone" dataKey="km" stroke="#43d9ff" fill="#43d9ff" fillOpacity={.12}/></AreaChart></ResponsiveContainer>:<Empty text="Not enough connected trip history for a trend yet."/>}</div></div>}

function PhoneTracking({assets,refresh}){const [assetId,setAssetId]=useState(''),[deviceId,setDeviceId]=useState(''),[key,setKey]=useState(''),[watching,setWatching]=useState(false),[message,setMessage]=useState('');const watch=useRef(null);const start=()=>{if(!navigator.geolocation){setMessage('This browser does not support location.');return}if(!assetId||!deviceId||!key){setMessage('Enter the authorized phone asset ID, device ID and device credential.');return}const send=pos=>fetch('/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json','x-jabs-device-key':key},body:JSON.stringify({device_id:deviceId,asset_id:assetId,asset_type:'PHONE',latitude:pos.coords.latitude,longitude:pos.coords.longitude,speed:pos.coords.speed||0,heading:pos.coords.heading||0,accuracy:pos.coords.accuracy,timestamp:new Date(pos.timestamp).toISOString()})}).then(r=>r.json()).then(b=>{if(b.error)throw new Error(b.error);setMessage('Location sent successfully.');refresh()}).catch(e=>setMessage(e.message));watch.current=navigator.geolocation.watchPosition(send,e=>setMessage(e.message),{enableHighAccuracy:true,maximumAge:5000,timeout:15000});setWatching(true)};const stop=()=>{if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;setWatching(false)};useEffect(()=>()=>stop(),[]);return <div className="page"><div className="pageHero"><div><span>CONNECTED PHONE</span><h1>Phone Tracking</h1><p>Authorized browser geolocation sends real telemetry to the same asset pipeline as trucks and ships.</p></div></div><div className="phoneGrid"><div className="formPanel"><h3>Start a secure phone session</h3><label>PHONE ASSET<select value={assetId} onChange={e=>setAssetId(e.target.value)}><option value="">Select authorized phone asset</option>{assets.filter(a=>a.asset_type==='PHONE').map(a=><option key={a.id} value={a.id}>{a.identifier}</option>)}</select></label><label>DEVICE ID<input value={deviceId} onChange={e=>setDeviceId(e.target.value)} placeholder="Registered device ID"/></label><label>DEVICE CREDENTIAL<input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="Shown only when created/rotated"/></label><div className="formActions">{watching?<button className="dangerBtn" onClick={stop}><Pause size={15}/> Stop tracking</button>:<button className="primary" onClick={start}><Play size={15}/> Start tracking</button>}</div>{message&&<div className="infoBox">{message}</div>}</div><div className="panel"><div className="panelHead"><div><b>PHONE PRIVACY & QUALITY</b><small>Use only with authorization</small></div></div><div className="checkList"><div><CheckCircle2/> Location permission required</div><div><CheckCircle2/> Battery and network affect continuity</div><div><CheckCircle2/> Last-update timestamp is always shown</div><div><CheckCircle2/> Device credentials are never displayed in normal responses</div></div></div></div></div>}

function Billing(){
 const [plans,setPlans]=useState(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 useEffect(()=>{fetch('/api/billing/plans').then(r=>r.json()).then(setPlans).catch(e=>setMsg(e.message))},[]);
 const checkout=async plan=>{setBusy(true);setMsg('');try{const r=await fetch('/api/billing/create-checkout-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,interval:'monthly'})});const b=await r.json();if(!r.ok)throw new Error(b.error||'Checkout unavailable');window.location.href=b.url}catch(e){setMsg(e.message)}finally{setBusy(false)}};
 const portal=async()=>{setBusy(true);try{const r=await fetch('/api/billing/create-portal-session',{method:'POST'});const b=await r.json();if(!r.ok)throw new Error(b.error||'Billing portal unavailable');window.location.href=b.url}catch(e){setMsg(e.message)}finally{setBusy(false)}};
 const cards=[['FREE','1 asset',['Live tracking','Basic alerts']],['PERSONAL','1 asset',['Live tracking','History']],['PERSONAL_PLUS','3 assets',['Advanced analytics','Exports']],['PROFESSIONAL','10 assets',['Advanced alerts','Driver behavior']]];
 return <div className="page"><div className="pageHero"><div><span>ACCOUNT SERVICES</span><h1>Billing</h1><p>Stripe billing is server-controlled. Paid access is activated only after a verified subscription event.</p></div><button className="outline" onClick={portal} disabled={busy}><CreditCard size={15}/> Manage Billing</button></div><div className="billingGrid">{cards.map(([name,limit,features])=><div className="plan" key={name}><span>{name.replace('_',' ')}</span><h3>{limit}</h3>{features.map(f=><p key={f}><CheckCircle2 size={14}/>{f}</p>)}{name==='FREE'?<button className="outline wide" disabled>Current base tier</button>:<button className="primary wide" onClick={()=>checkout(name)} disabled={busy||!plans?.plans?.[name]?.monthly}>{busy?'Preparing…':'Choose plan'}</button>}</div>)}</div>{msg&&<div className="infoBox">{msg}</div>}<div className="infoBox">Currency, tax, coupons and trials remain backend-controlled through configured Stripe Prices and flags. No frontend exchange-rate conversion or fake payment success is used.</div></div>
}
function ProfileMenu({profile,onLogout}){return <div className="profileMenu"><div className="profileTop"><CircleUserRound size={20}/><div><b>{profile?.full_name||'Authenticated User'}</b><small>{profile?.role||'USER'}</small></div></div><button onClick={onLogout}><LogOut size={15}/> Sign out securely</button></div>}

function App(){const [session,setSession]=useState(null),[showCover,setShowCover]=useState(true),[profile,setProfile]=useState(null),[section,setSection]=useState('COMMAND CENTER'),[assets,setAssets]=useState([]),[alerts,setAlerts]=useState([]),[geofences,setGeofences]=useState([]),[trips,setTrips]=useState([]),[selected,setSelected]=useState(null),[trail,setTrail]=useState([]),[mobile,setMobile]=useState(false),[profileOpen,setProfileOpen]=useState(false),[toast,setToast]=useState('');
 const refresh=async()=>{const [a,al,t,g]=await Promise.all([loadAssets(),loadAlerts(),loadTrips(),loadGeofences()]);if(a.error)setToast(a.error.message);setAssets(a.data||[]);setAlerts((al.data||[]).filter(x=>!x.acknowledged));setTrips(t.data||[]);setGeofences(g.data||[])};
 useEffect(()=>{getSession().then(({data})=>setSession(data.session)); if(supabase){const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()}},[]);
 useEffect(()=>{
  if(!session)return;

  refresh();

  const u=subscribeToAssets(async()=>{
    await refresh();

    if(selected){
      const r=await loadLocations(selected,24);
      if(!r.error)setTrail(r.data||[]);
    }
  });

  const v=subscribeToAlerts(()=>refresh());

  return()=>{
    u();
    v();
  };
},[session,selected]);
 useEffect(()=>{if(!session||!supabase)return;supabase.from('profiles').select('full_name,role,phone').eq('id',session.user.id).maybeSingle().then(({data})=>setProfile(data||{}))},[session]);
 useEffect(()=>{if(selected)loadLocations(selected,24).then(({data})=>setTrail(data||[]))},[selected]);
 if(!session)return showCover?<Cover onEnter={()=>setShowCover(false)}/>:<Login onAuthenticated={s=>{setSession(s);setShowCover(false)}}/>;
 const go=n=>{setSection(n);setMobile(false)};
 const content= section==='COMMAND CENTER'?<CommandCenter assets={assets} alerts={alerts} trips={trips} selected={selected} setSelected={setSelected} trail={trail} refresh={refresh}/> : section==='PHONE TRACKING'?<PhoneDashboard assets={assets} selected={selected} setSelected={setSelected} trail={trail}/>:section==='ANALYTICS'?<Analytics assets={assets} trips={trips}/>:section==='BILLING'?<Billing/>:section==='FLEET'?<TruckDashboard assets={assets} selected={selected} setSelected={setSelected} trail={trail}/>:section==='SHIP TRACKING'?<ShipDashboard assets={assets} selected={selected} setSelected={setSelected} trail={trail}/>:section==='ALERTS'?<TablePage title="Alerts" icon={AlertTriangle} rows={alerts} columns={['TITLE','ALERT_TYPE','SEVERITY','MESSAGE','CREATED_AT']}/>:section==='TRIPS'?<TablePage title="Trips" icon={Route} rows={trips} columns={['TRIP_NUMBER','STATUS','ORIGIN','DESTINATION','ETA','CREATED_AT']}/>:section==='REPORTS'?<TablePage title="Reports" icon={Database} rows={trips} columns={['TRIP_NUMBER','STATUS','ORIGIN','DESTINATION','ACTUAL_DISTANCE_KM']}/>:section==='DEVICES'?<TablePage title="Devices" icon={Wifi} rows={assets.filter(a=>a.device_id)} columns={['IDENTIFIER','DEVICE_ID','ASSET_TYPE','STATUS','LAST_UPDATED']}/>:section==='GEOFENCES'?<GeofenceControlCenter geofences={geofences} assets={assets} refresh={refresh}/>:section==='SHIPMENTS'?<TablePage title="Shipments" icon={Package} rows={[]} columns={['SHIPMENT_ID','STATUS','ORIGIN','DESTINATION','ETA']}/>:<div className="page"><div className="pageHero"><div><span>ADMINISTRATION</span><h1>{section}</h1><p>Access-controlled module. Connect the corresponding backend records before enabling mutations.</p></div></div><Empty text="No administrative records are exposed to this role."/></div>;
 return <div className="app"><aside className={`sidebar ${mobile?'open':''}`}><div className="brand"><div className="logo"><Radio size={22}/></div><div><b>JABS</b><span>TRACKER</span></div></div><div className="live"><i className="pulse"/> LIVE <small>{config.mapTileUrl?'MAP READY':'MAP CONFIG REQUIRED'}</small></div><nav>{nav.map(([n,I])=><button key={n} className={section===n?'active':''} onClick={()=>go(n)}><I size={17}/><span>{n}</span></button>)}</nav><div className="sideFoot"><ShieldCheck size={16}/><span>SECURE OPERATIONS<br/><b>ROLE CONTROLLED</b></span></div></aside>{mobile&&<button className="mobileBackdrop" onClick={()=>setMobile(false)}/>}<main className="dashboardMain"><header className="topbar"><button className="mobileMenu" onClick={()=>setMobile(v=>!v)}><Menu/></button><div className="crumb">JABS TRACKER <ChevronRight size={14}/><b>{section}</b></div><div className="headerRight"><div className="clock"><Clock3 size={14}/>{new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div><button className="iconBtn"><Bell size={18}/>{alerts.length>0&&<i/>}</button><button className="user" onClick={()=>setProfileOpen(v=>!v)}><span>{(profile?.full_name||session.user.email||'U').slice(0,2).toUpperCase()}</span><div><b>{profile?.full_name||'ACCOUNT'}</b><small>{profile?.role||'USER'}</small></div></button>{profileOpen&&<ProfileMenu profile={profile} onLogout={async()=>{await signOut();setSession(null);setProfile(null);setProfileOpen(false);setShowCover(true)}}/>}</div></header><div className="content">{content}</div></main><Toast message={toast} onClose={()=>setToast('')}/></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
