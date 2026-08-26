import React, {useEffect,useRef,useState} from 'react';
import {Activity,Anchor,Battery,Bell,Car,Clock3,Gauge,History,LocateFixed,MapPin,Navigation,Radio,Route,Satellite,Ship,ShieldCheck,Signal,Smartphone,Truck,UserRound,Users,Wifi,Wind,Zap} from 'lucide-react';
import {config} from '../lib/config';

const tone=s=>({ACTIVE:'good',MOVING:'good',IN_TRANSIT:'info',TRANSIT:'info',IDLE:'warn',STOPPED:'warn',OFFLINE:'danger',DELAYED:'danger'}[String(s||'').toUpperCase()]||'info');
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const fmt=v=>v==null?'—':Number(v).toLocaleString(undefined,{maximumFractionDigits:2});

function Metric({icon:Icon,label,value,meta}){return <div className="assetMetric"><div className="assetMetricIcon"><Icon size={17}/></div><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></div>}
function EmptyAsset({icon:Icon,title,text}){return <div className="assetEmpty"><Icon size={34}/><h3>{title}</h3><p>{text}</p></div>}
function MiniMap({asset,trail=[],mode='road'}){
 const ref=useRef(null),map=useRef(null),marker=useRef(null),line=useRef(null);
 useEffect(()=>{if(!window.L||!ref.current||!asset)return;const lat=n(asset.latitude),lng=n(asset.longitude);if(lat==null||lng==null)return;
  if(!map.current){map.current=window.L.map(ref.current,{zoomControl:false,attributionControl:true}).setView([lat,lng],12);if(config.mapTileUrl)window.L.tileLayer(config.mapTileUrl,{attribution:config.mapAttribution,maxZoom:19}).addTo(map.current);window.L.control.zoom({position:'bottomright'}).addTo(map.current)}
  const html=`<div class="assetDashMarker ${tone(asset.status)}"><span>${mode==='sea'?'⚓':mode==='phone'?'⌁':'▴'}</span></div>`;
  if(!marker.current)marker.current=window.L.marker([lat,lng],{icon:window.L.divIcon({className:'',html,iconSize:[38,38],iconAnchor:[19,19]})}).addTo(map.current);else marker.current.setLatLng([lat,lng]);
  if(line.current)line.current.remove();if(trail.length>1)line.current=window.L.polyline(trail.map(p=>[Number(p.latitude),Number(p.longitude)]),{color:mode==='sea'?'#46d7ff':mode==='phone'?'#9f7cff':'#35e09a',weight:4,opacity:.8}).addTo(map.current);
  map.current.flyTo([lat,lng],Math.max(map.current.getZoom(),11),{duration:.45});setTimeout(()=>map.current?.invalidateSize(),80);
 },[asset,trail,mode]);
 return <div className="assetMiniMap" ref={ref}/>;
}
function Shell({eyebrow,title,subtitle,asset,assets,onSelect,accent='cyan',children}){
 return <div className={`assetDashboard ${accent}`}><div className="assetHero"><div><span>{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="assetHeroActions"><div className={`assetPill ${tone(asset?.status)}`}><i/>{asset?.status||'NO ASSET'}</div><select value={asset?.id||''} onChange={e=>onSelect?.(assets.find(x=>x.id===e.target.value)||null)}><option value="">Select asset</option>{assets.map(a=><option key={a.id} value={a.id}>{a.identifier||a.name}</option>)}</select></div></div>{children}</div>
}
function Telemetry({asset}){return <section className="assetCard"><div className="assetSectionHead"><div><b>LIVE TELEMETRY</b><small>Connected operational data</small></div><Radio size={18}/></div><div className="telemetryList">{[['Identifier',asset.identifier],['Name',asset.name],['Device',asset.device_id||'Not linked'],['Latitude',fmt(asset.latitude)],['Longitude',fmt(asset.longitude)],['Updated',asset.last_updated?new Date(asset.last_updated).toLocaleString():'—']].map(([a,b])=><div key={a}><span>{a}</span><b>{b||'—'}</b></div>)}</div></section>}

export function TruckDashboard({assets=[],trail=[],selected,setSelected}){
 const rows=assets.filter(a=>a.asset_type==='TRUCK'),
 a=selected?.asset_type==='TRUCK'?selected:rows[0],
 speed=n(a?.speed)||0,
 heading=n(a?.heading),
 lat=n(a?.latitude),
 lng=n(a?.longitude),
 freshness=a?.last_updated?new Date(a.last_updated):null,
 ageMinutes=freshness?Math.max(0,(Date.now()-freshness.getTime())/60000):null,
 signal=ageMinutes==null?'UNKNOWN':ageMinutes<5?'LIVE':ageMinutes<30?'RECENT':'STALE',
 movement=speed>0?'MOVING':String(a?.status||'').toUpperCase()==='ACTIVE'?'ACTIVE':'STATIONARY';

 return <Shell
   eyebrow="FLEET CONTROL / TRUCK OPERATIONS"
   title="Truck Command"
   subtitle="Dedicated vehicle visibility for movement, route progress, telemetry, driver context and operational exceptions."
   asset={a}
   assets={rows}
   onSelect={setSelected}
 >
 {!a?
   <EmptyAsset
     icon={Truck}
     title="No authorized truck"
     text="Truck records visible to this account will appear here."
   />
 :
 <>
   <div className="truckCommandBanner">
     <div className="truckIdentity">
       <div className="truckIdentityIcon"><Truck size={25}/></div>
       <div>
         <span>ACTIVE VEHICLE</span>
         <strong>{a.identifier||a.name||'UNNAMED TRUCK'}</strong>
         <small>{a.name||'JABS Fleet Vehicle'} · {a.status||'UNKNOWN'}</small>
       </div>
     </div>

     <div className="truckBannerMetrics">
       <div>
         <span>OPERATING STATE</span>
         <b className={movement==='MOVING'?'stateLive':''}>{movement}</b>
       </div>
       <div>
         <span>DATA FRESHNESS</span>
         <b>{signal}</b>
       </div>
       <div>
         <span>GPS POSITION</span>
         <b>{lat==null||lng==null?'NO FIX':'LOCKED'}</b>
       </div>
     </div>

     <div className="truckLivePulse">
       <i/>
       <span>LIVE TELEMETRY</span>
     </div>
   </div>

   <div className="assetKpis truckKpis">
     <Metric
       icon={Gauge}
       label="CURRENT SPEED"
       value={`${fmt(speed)} km/h`}
       meta={speed>0?'Vehicle moving':'Vehicle stationary'}
     />
     <Metric
       icon={Navigation}
       label="HEADING"
       value={heading==null?'—':`${fmt(heading)}°`}
       meta={heading==null?'No heading':'GPS heading'}
     />
     <Metric
       icon={Route}
       label="TRIP"
       value={a.current_trip_id||'NO ACTIVE TRIP'}
       meta={a.current_trip_id?'Trip context':'Awaiting assignment'}
     />
     <Metric
       icon={Satellite}
       label="LAST UPDATE"
       value={freshness?freshness.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'—'}
       meta={signal==='LIVE'?'Telemetry live':signal==='RECENT'?'Recently updated':'Check connection'}
     />
   </div>

   <div className="truckOperationsGrid">

     <section className="assetMapCard truckHeroMap">
       <div className="assetSectionHead">
         <div>
           <b>TRUCK ROUTE MAP</b>
           <small>{a.identifier||a.name} · live position, route and movement trail</small>
         </div>
         <span className="assetLive"><i/> LIVE</span>
       </div>

       <div className="truckMapWrap">
         <MiniMap asset={a} trail={trail}/>

         <div className="truckMapOverlay topLeft">
           <span><LocateFixed size={13}/> GPS LOCK</span>
           <b>{lat==null?'—':fmt(lat)}, {lng==null?'—':fmt(lng)}</b>
         </div>

         <div className="truckMapOverlay bottomRight">
           <span><Navigation size={13}/> COURSE</span>
           <b>{heading==null?'—':`${fmt(heading)}°`}</b>
         </div>
       </div>

       <div className="assetMapFooter">
         <span><MapPin size={13}/> {lat==null||lng==null?'Location unavailable':`${fmt(lat)}, ${fmt(lng)}`}</span>
         <span><Clock3 size={13}/> {freshness?freshness.toLocaleString():'No timestamp'}</span>
       </div>
     </section>

     <aside className="truckIntelligenceColumn">

       <Telemetry asset={a}/>

       <section className="assetCard truckHealthCard">
         <div className="assetSectionHead">
           <div>
             <b>CONNECTION HEALTH</b>
             <small>Vehicle telemetry pipeline</small>
           </div>
           <Wifi size={18}/>
         </div>

         <div className="connectionRows">
           <div>
             <span>GPS</span>
             <b className={lat!=null&&lng!=null?'healthy':''}>{lat!=null&&lng!=null?'LOCKED':'NO FIX'}</b>
             <i><em style={{width:lat!=null&&lng!=null?'94%':'22%'}}/></i>
           </div>

           <div>
             <span>TELEMETRY</span>
             <b className={signal==='LIVE'?'healthy':''}>{signal}</b>
             <i><em style={{width:signal==='LIVE'?'96%':signal==='RECENT'?'72%':'25%'}}/></i>
           </div>

           <div>
             <span>DEVICE</span>
             <b>{a.device_id?'CONNECTED':'NOT LINKED'}</b>
             <i><em style={{width:a.device_id?'88%':'20%'}}/></i>
           </div>
         </div>
       </section>

       <section className="assetCard truckTripCard">
         <div className="assetSectionHead">
           <div>
             <b>TRIP INTELLIGENCE</b>
             <small>Current operational context</small>
           </div>
           <Route size={18}/>
         </div>

         <div className="tripIdentity">
           <div className="tripIcon"><Navigation size={17}/></div>
           <div>
             <span>ACTIVE TRIP</span>
             <strong>{a.current_trip_id||'NO ACTIVE TRIP'}</strong>
           </div>
         </div>

         <div className="tripStats">
           <div><span>PROGRESS</span><b>{a.trip_progress!=null?`${fmt(a.trip_progress)}%`:'—'}</b></div>
           <div><span>DRIVER</span><b>{a.driver_name||'NOT LINKED'}</b></div>
         </div>

         <div className="progressTrack enhanced">
           <span style={{width:a.trip_progress?`${Math.min(100,Number(a.trip_progress))}%`:'12%'}}/>
         </div>
       </section>

     </aside>
   </div>

   <div className="assetBottomGrid truckBottomGrid">

     <section className="assetCard">
       <div className="assetSectionHead">
         <div>
           <b>DRIVER / TRIP</b>
           <small>Operational assignment</small>
         </div>
         <UserRound size={18}/>
       </div>

       <div className="driverBlock enhanced">
         <div className="driverAvatar"><Truck size={20}/></div>
         <div>
           <b>{a.driver_name||'Driver not linked'}</b>
           <small>{a.current_trip_id||'No active trip assigned'}</small>
         </div>
         <Status>{a.status}</Status>
       </div>

       <div className="driverMeta">
         <span><Users size={13}/> Assignment</span>
         <b>{a.driver_name?'CONNECTED':'PENDING'}</b>
       </div>
     </section>

     <section className="assetCard">
       <div className="assetSectionHead">
         <div>
           <b>DRIVING BEHAVIOR</b>
           <small>Safety and movement indicators</small>
         </div>
         <Car size={18}/>
       </div>

       <div className="behaviorGrid enhancedBehavior">
         <div>
           <span>Harsh braking</span>
           <b>—</b>
         </div>
         <div>
           <span>Overspeed</span>
           <b className={speed>80?'attention':''}>{speed>80?'REVIEW':'NORMAL'}</b>
         </div>
         <div>
           <span>Idle time</span>
           <b>—</b>
         </div>
         <div>
           <span>Safety score</span>
           <b>—</b>
         </div>
       </div>
     </section>

     <section className="assetCard">
       <div className="assetSectionHead">
         <div>
           <b>LOCATION DATA</b>
           <small>Connected asset coordinates</small>
         </div>
         <MapPin size={18}/>
       </div>

       <div className="coordinateGrid enhancedCoordinates">
         <div><span>LATITUDE</span><b>{lat==null?'—':fmt(lat)}</b></div>
         <div><span>LONGITUDE</span><b>{lng==null?'—':fmt(lng)}</b></div>
         <div><span>SPEED</span><b>{fmt(speed)} km/h</b></div>
         <div><span>HEADING</span><b>{heading==null?'—':`${fmt(heading)}°`}</b></div>
       </div>
     </section>

   </div>

   <section className="truckCommandActions">
     <div>
       <span>OPERATIONAL CONTROLS</span>
       <b>{a.identifier||a.name||'Vehicle'} command actions</b>
     </div>

     <div className="truckActionButtons">
       <button className="outline"><LocateFixed size={15}/> Locate Vehicle</button>
       <button className="outline"><History size={15}/> Movement History</button>
       <button className="outline"><Bell size={15}/> Create Alert</button>
       <button className="primary"><Navigation size={15}/> View Route</button>
     </div>
   </section>
 </>
 }
 </Shell>
}

export function ShipDashboard({assets=[],trail=[],selected,setSelected}){
 const rows=assets.filter(a=>a.asset_type==='SHIP'),a=selected?.asset_type==='SHIP'?selected:rows[0],speed=n(a?.speed)||0,heading=n(a?.heading);
 return <Shell eyebrow="MARITIME OPERATIONS / VESSEL CONTROL" title="Ship Command" subtitle="Dedicated maritime visibility for vessel position, voyage progress, destination, route context and marine telemetry." asset={a} assets={rows} onSelect={setSelected} accent="sea">{!a?<EmptyAsset icon={Ship} title="No authorized vessel" text="Connected ship records will appear here when available."/>:<><div className="assetKpis"><Metric icon={Wind} label="VESSEL SPEED" value={`${fmt(speed)} kn`} meta="Current speed"/><Metric icon={Navigation} label="HEADING" value={heading==null?'—':`${fmt(heading)}°`} meta="Course"/><Metric icon={Anchor} label="VOYAGE" value={a.current_trip_id||'NO VOYAGE'} meta="Voyage reference"/><Metric icon={Satellite} label="LAST POSITION" value={a.last_updated?new Date(a.last_updated).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'—'} meta="Position freshness"/></div><div className="assetMainGrid"><section className="assetMapCard"><div className="assetSectionHead"><div><b>MARITIME TRACK</b><small>{a.identifier||a.name} · vessel position and route</small></div><span className="assetLive"><i/> AIS / LIVE</span></div><MiniMap asset={a} trail={trail} mode="sea"/><div className="assetMapFooter"><span><Anchor size={13}/> {fmt(a.latitude)}, {fmt(a.longitude)}</span><span><Navigation size={13}/> {heading==null?'—':`${fmt(heading)}°`}</span></div></section><aside className="assetSideColumn"><Telemetry asset={a}/><section className="assetCard"><div className="assetSectionHead"><div><b>VOYAGE PROFILE</b><small>Vessel context</small></div><Ship size={18}/></div><div className="telemetryList"><div><span>Destination</span><b>{a.destination||'Not assigned'}</b></div><div><span>ETA</span><b>{a.eta||'—'}</b></div><div><span>Vessel type</span><b>{a.vessel_type||'Cargo / vessel'}</b></div><div><span>Status</span><b>{a.status||'UNKNOWN'}</b></div></div></section></aside></div><div className="assetBottomGrid"><section className="assetCard"><div className="assetSectionHead"><div><b>VOYAGE PROGRESS</b><small>Route completion</small></div><Route size={18}/></div><div className="voyageProgress"><strong>{a.trip_progress?`${fmt(a.trip_progress)}%`:'—'}</strong><span style={{width:a.trip_progress?`${Math.min(100,Number(a.trip_progress))}%`:'28%'}}/></div><div className="voyageStops"><span>ORIGIN<br/><b>{a.origin||'—'}</b></span><span>DESTINATION<br/><b>{a.destination||'—'}</b></span></div></section><section className="assetCard"><div className="assetSectionHead"><div><b>ENGINE / VESSEL STATUS</b><small>Connected telemetry</small></div><Zap size={18}/></div><div className="healthBars"><div><span>Engine</span><i><b style={{width:speed>0?'82%':'32%'}}/></i></div><div><span>Generator</span><i><b style={{width:'76%'}}/></i></div><div><span>Navigation</span><i><b style={{width:'91%'}}/></i></div></div></section></div></>}</Shell>
}
export function PhoneDashboard({assets=[],trail=[],selected,setSelected}){
 const rows=assets.filter(a=>a.asset_type==='PHONE'),a=selected?.asset_type==='PHONE'?selected:rows[0];const [msg,setMsg]=useState(''),[key,setKey]=useState(''),[device,setDevice]=useState('');useEffect(()=>setDevice(a?.device_id||''),[a]);
 const send=()=>{if(!a||!device||!key)return setMsg('Select an authorized phone and enter its device credential.');if(!navigator.geolocation)return setMsg('This browser does not support geolocation.');navigator.geolocation.getCurrentPosition(async p=>{try{const r=await fetch('/api/telemetry',{method:'POST',headers:{'Content-Type':'application/json','x-jabs-device-key':key},body:JSON.stringify({device_id:device,asset_id:a.id,asset_type:'PHONE',latitude:p.coords.latitude,longitude:p.coords.longitude,speed:p.coords.speed||0,heading:p.coords.heading||0,accuracy:p.coords.accuracy,timestamp:new Date(p.timestamp).toISOString()})});const b=await r.json();if(!r.ok||b.error)throw new Error(b.error||'Telemetry rejected');setMsg('Location telemetry sent successfully.')}catch(e){setMsg(e.message)}},e=>setMsg(e.message),{enableHighAccuracy:true,timeout:15000,maximumAge:0})};
 return <Shell eyebrow="CONNECTED PEOPLE / DEVICE VISIBILITY" title="Phone Command" subtitle="Dedicated privacy-aware visibility for live location, battery, network, freshness and authorized movement tracking." asset={a} assets={rows} onSelect={setSelected} accent="phone">{!a?<EmptyAsset icon={Smartphone} title="No authorized phone" text="Phone assets connected to this account will appear here."/>:<><div className="assetKpis"><Metric icon={MapPin} label="LOCATION" value={`${fmt(a.latitude)}, ${fmt(a.longitude)}`} meta="Latest coordinates"/><Metric icon={Battery} label="BATTERY" value={a.battery_level==null?'—':`${fmt(a.battery_level)}%`} meta="Device telemetry"/><Metric icon={Signal} label="NETWORK" value={a.network_type||'—'} meta="Signal status"/><Metric icon={Clock3} label="FRESHNESS" value={a.last_updated?new Date(a.last_updated).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'—'} meta="Last update"/></div><div className="assetMainGrid"><section className="assetMapCard"><div className="assetSectionHead"><div><b>LIVE PHONE LOCATION</b><small>Authorized device location</small></div><span className="assetLive"><i/> READY</span></div><MiniMap asset={a} trail={trail} mode="phone"/><div className="assetMapFooter"><span><MapPin size={13}/> {fmt(a.latitude)}, {fmt(a.longitude)}</span><span><Wifi size={13}/> {a.accuracy?`±${fmt(a.accuracy)} m`:'Accuracy —'}</span></div></section><aside className="assetSideColumn"><Telemetry asset={a}/><section className="assetCard"><div className="assetSectionHead"><div><b>PRIVACY CONTROL</b><small>Authorization required</small></div><ShieldCheck size={18}/></div><div className="privacyNotice"><ShieldCheck size={18}/><p>Location is transmitted only through the registered device pipeline. Credentials remain hidden.</p></div></section></aside></div><div className="assetBottomGrid"><section className="assetCard"><div className="assetSectionHead"><div><b>SEND SECURE LOCATION</b><small>One authorized browser location sample</small></div><Navigation size={18}/></div><div className="phoneControls"><label>DEVICE ID<input value={device} onChange={e=>setDevice(e.target.value)} placeholder="Registered device ID"/></label><label>DEVICE CREDENTIAL<input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="Device credential"/></label><button className="primary" onClick={send}><Navigation size={15}/> SEND LOCATION</button></div>{msg&&<div className="infoBox">{msg}</div>}</section><section className="assetCard"><div className="assetSectionHead"><div><b>PHONE QUALITY</b><small>Continuity indicators</small></div><Activity size={18}/></div><div className="behaviorGrid"><div><span>GPS</span><b>{a.accuracy?'LOCKED':'UNKNOWN'}</b></div><div><span>Battery</span><b>{a.battery_level==null?'—':a.battery_level>20?'HEALTHY':'LOW'}</b></div><div><span>Network</span><b>{a.network_type||'—'}</b></div><div><span>Tracking</span><b>STANDBY</b></div></div></section></div></>}</Shell>
}
