import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  Battery,
  Bell,
  Clock3,
  History,
  LocateFixed,
  MapPin,
  Navigation,
  Pause,
  Phone,
  Play,
  Radio,
  Route,
  ShieldCheck,
  Signal,
  Smartphone,
  Users,
  Wifi
} from 'lucide-react';
import {config} from '../lib/config';
import './phone-dashboard.css';

const num=v=>{
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};

const fmt=v=>{
  const n=num(v);
  return n==null?'—':n.toLocaleString(undefined,{maximumFractionDigits:2});
};

const haversineM=(la1,lo1,la2,lo2)=>{
  const R=6371000,r=Math.PI/180;
  const dLa=(la2-la1)*r,dLo=(lo2-lo1)*r;
  const a=Math.sin(dLa/2)**2+Math.cos(la1*r)*Math.cos(la2*r)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(a)));
};

const freshness=timestamp=>{
  if(!timestamp)return 'UNKNOWN';

  const age=Math.max(
    0,
    (Date.now()-new Date(timestamp).getTime())/60000
  );

  if(age<5)return 'LIVE';
  if(age<30)return 'RECENT';
  if(age<120)return 'STALE';
  return 'OFFLINE';
};

function PhoneMap({asset,trail=[]}){

  const ref=useRef(null);
  const map=useRef(null);
  const marker=useRef(null);
  const line=useRef(null);
  const retry=useRef(null);

  const points=useMemo(
    ()=>trail
      .filter(p=>p?.latitude!=null&&p?.longitude!=null)
      .map(p=>[
        Number(p.latitude),
        Number(p.longitude)
      ])
      .filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])),
    [trail]
  );

  const liveLat=num(asset?.latitude);
  const liveLng=num(asset?.longitude);

  const hasLivePosition=
    liveLat!=null&&
    liveLng!=null&&
    liveLat>=-90&&
    liveLat<=90&&
    liveLng>=-180&&
    liveLng<=180;

  const lastTrailPoint=
    points.length
      ?points[points.length-1]
      :null;

  const fallbackCenter=[6.5244,3.3792];

  const position=
    hasLivePosition
      ?[liveLat,liveLng]
      :lastTrailPoint||fallbackCenter;

  const centerPhone=()=>{

    if(!map.current)return;

    map.current.flyTo(
      position,
      Math.max(map.current.getZoom(),13),
      {duration:.5}
    );

  };

  const fitTrail=()=>{

    if(!map.current)return;

    if(points.length>1){

      const bounds=window.L.latLngBounds(points);

      map.current.fitBounds(
        bounds,
        {
          padding:[45,45],
          maxZoom:16,
          animate:true
        }
      );

    }else{

      centerPhone();

    }

  };

  const initialise=()=>{

    if(!ref.current)return false;

    if(!window.L){

      retry.current=setTimeout(
        initialise,
        250
      );

      return false;
    }

    if(!map.current){

      map.current=window.L
        .map(ref.current,{
          zoomControl:false,
          attributionControl:true,
          preferCanvas:true,
          center:position,
          zoom:13
        });

      if(config.mapTileUrl){

        window.L
          .tileLayer(
            config.mapTileUrl,
            {
              attribution:config.mapAttribution,
              maxZoom:19,
              crossOrigin:true
            }
          )
          .addTo(map.current);

      }

      window.L
        .control
        .zoom({
          position:'bottomright'
        })
        .addTo(map.current);

    }

    const icon=window.L.divIcon({
      className:'phoneMapLeafletIcon',
      html:`
        <div class="phoneMapMarker">
          <span>⌁</span>
          <i></i>
        </div>
      `,
      iconSize:[46,46],
      iconAnchor:[23,23]
    });

    if(marker.current){

      marker.current.setLatLng(position);
      marker.current.setIcon(icon);

    }else{

      marker.current=
        window.L
          .marker(position,{
            icon,
            zIndexOffset:1000
          })
          .addTo(map.current);

    }

    marker.current.unbindTooltip();

    marker.current.bindTooltip(
      hasLivePosition
        ?`${asset?.identifier||asset?.name||'PHONE'} · LIVE`
        :`${asset?.identifier||asset?.name||'PHONE'} · WAITING FOR GPS`,
      {
        direction:'top',
        offset:[0,-22],
        opacity:.96
      }
    );

    if(line.current){

      line.current.remove();
      line.current=null;

    }

    if(points.length>1){

      line.current=
        window.L
          .polyline(
            points,
            {
              color:'#9f7cff',
              weight:5,
              opacity:.82,
              lineCap:'round',
              lineJoin:'round'
            }
          )
          .addTo(map.current);

    }

    if(hasLivePosition){

      map.current.panTo(
        position,
        {
          animate:true,
          duration:.45
        }
      );

    }

    requestAnimationFrame(
      ()=>{
        map.current?.invalidateSize({
          pan:false
        });
      }
    );

    return true;
  };

  useEffect(()=>{

    initialise();

    return()=>{

      if(retry.current){
        clearTimeout(retry.current);
        retry.current=null;
      }

    };

  },[]);

  useEffect(()=>{

    if(!map.current)return;

    const update=()=>initialise();

    update();

  },[
    liveLat,
    liveLng,
    asset?.identifier,
    asset?.name,
    points
  ]);

  useEffect(()=>{

    return()=>{

      if(retry.current){
        clearTimeout(retry.current);
        retry.current=null;
      }

      if(map.current){

        map.current.remove();
        map.current=null;

      }

      marker.current=null;
      line.current=null;

    };

  },[]);

  return(
    <div className="phoneMapStage">

      <div
        ref={ref}
        className="phoneCommandMap"
      />

      <div className="phoneMapTools">

        <button
          type="button"
          onClick={centerPhone}
          title="Center map on phone"
        >
          <LocateFixed size={14}/>
          CENTER
        </button>

        <button
          type="button"
          onClick={fitTrail}
          title="Fit historical phone trail"
        >
          <Route size={14}/>
          TRAIL
        </button>

      </div>

      <div
        className={
          `phoneGpsState ${
            hasLivePosition
              ?'live'
              :'waiting'
          }`
        }
      >

        <i/>

        {hasLivePosition
          ?'GPS POSITION ACTIVE'
          :'WAITING FOR GPS'}

      </div>

      {!hasLivePosition&&points.length===0&&(

        <div className="phoneMapWaiting">

          <LocateFixed size={28}/>

          <b>WAITING FOR DEVICE LOCATION</b>

          <span>
            The map is ready. A position will
            appear when authorized telemetry
            is received.
          </span>

        </div>

      )}

    </div>
  );

}

function Metric({icon:Icon,label,value,meta}){

  return(
    <div className="phoneMetric">

      <div className="phoneMetricIcon">
        <Icon size={18}/>
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{meta}</small>
      </div>

    </div>
  );
}

function PhoneStatus({status}){

  const tone=
    status==='LIVE'
      ?'live'
      :status==='RECENT'
        ?'recent'
        :status==='STALE'
          ?'stale'
          :'offline';

  return(
    <span className={`phoneStatus ${tone}`}>
      <i/>
      {status}
    </span>
  );
}

export default function PhoneDashboard({
  assets=[],
  trail=[],
  selected,
  setSelected,
  geofences=[],
  refresh
}){

  const phones=assets.filter(
    a=>a.asset_type==='PHONE'
  );

  const phone=
    selected?.asset_type==='PHONE'
      ?selected
      :phones[0];

  const [device,setDevice]=useState('');
  const [credential,setCredential]=useState('');
  const [tracking,setTracking]=useState(false);
  const [message,setMessage]=useState('');
  const [watchId,setWatchId]=useState(null);
  const [lastSample,setLastSample]=useState(null);
  const sentCount=useRef(0);
  const [sent,setSent]=useState(0);
  const [txError,setTxError]=useState('');
  const lastRefresh=useRef(0);
  const [tab,setTab]=useState('LIVE');
  const [sessionStart,setSessionStart]=useState(null);
  const [nowTick,setNowTick]=useState(Date.now());
  const [events,setEvents]=useState([]);
  const logEvent=label=>setEvents(e=>[{t:Date.now(),label},...e].slice(0,24));

  useEffect(()=>{
    if(!tracking)return;
    const id=setInterval(()=>setNowTick(Date.now()),1000);
    return ()=>clearInterval(id);
  },[tracking]);

  useEffect(()=>{

    setDevice(phone?.device_id||'');
    setTracking(false);
    setMessage('');
    setLastSample(null);
    sentCount.current=0;
    setSent(0);
    setTxError('');
    setSessionStart(null);
    setEvents([]);

  },[phone?.id]);

  const status=freshness(phone?.last_updated);

  const moving=
    Number(phone?.speed||0)>0;

  const lowBattery=
    phone?.battery_level!=null &&
    Number(phone.battery_level)<=20;

  const stale=
    status==='STALE'||
    status==='OFFLINE';

  const zoneLat=num(phone?.latitude);
  const zoneLng=num(phone?.longitude);

  const activeZones=(geofences||[]).filter(
    g=>g.active&&num(g.latitude)!=null&&num(g.longitude)!=null
  );

  const zoneStatus=activeZones.map(g=>{
    const distance=
      zoneLat!=null&&zoneLng!=null
        ?haversineM(zoneLat,zoneLng,Number(g.latitude),Number(g.longitude))
        :null;
    return {
      zone:g,
      distance,
      inside:distance!=null&&distance<=Number(g.radius_m||0)
    };
  }).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity));

  const insideZones=zoneStatus.filter(z=>z.inside);

  const startTracking=()=>{

    if(watchId!==null){
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    if(!phone){

      setMessage(
        'Select an authorized phone first.'
      );

      return;

    }

    if(!device||!credential){

      setMessage(
        'Enter the registered device ID and device credential.'
      );

      return;

    }

    if(!navigator.geolocation){

      setMessage(
        'This browser does not support geolocation.'
      );

      return;

    }

    if(!window.isSecureContext&&location.hostname!=='localhost'){

      setMessage(
        'Live GPS requires a secure (HTTPS) connection. Open JABS TRACKER over HTTPS on the phone, then start tracking again.'
      );

      return;

    }

    setMessage(
      'Requesting secure location permission…'
    );

    const send=position=>{

      const payload={
        device_id:device,
        asset_id:phone.id,
        asset_type:'PHONE',
        latitude:position.coords.latitude,
        longitude:position.coords.longitude,
        speed:position.coords.speed||0,
        heading:position.coords.heading||0,
        accuracy:position.coords.accuracy,
        timestamp:new Date(
          position.timestamp
        ).toISOString()
      };

      setLastSample(payload);

      fetch('/api/telemetry',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-jabs-device-key':credential
        },
        body:JSON.stringify(payload)
      })
      .then(async response=>{

        const body=await response
          .json()
          .catch(()=>({}));

        if(!response.ok||body.error){

          throw new Error(
            body.error||
            'Telemetry rejected by server.'
          );

        }

        sentCount.current+=1;
        setSent(sentCount.current);
        setTxError('');
        logEvent('Location transmitted');

        setMessage(
          `Live location transmitted · ${sentCount.current} sent · ${new Date().toLocaleTimeString()}`
        );

        const nowTs=Date.now();
        if(refresh&&nowTs-lastRefresh.current>8000){
          lastRefresh.current=nowTs;
          Promise.resolve(refresh()).catch(()=>{});
        }

      })
      .catch(error=>{
        setTxError(error.message);
        setMessage(error.message);
        logEvent('Telemetry rejected');
      });

    };

    const id=navigator.geolocation.watchPosition(
      send,
      error=>{
        const map={
          1:'Location permission denied. Enable location access for this site in your browser settings, then start tracking again.',
          2:'Position unavailable. Make sure device location / GPS is switched on and you have signal.',
          3:'Location request timed out. Move to an area with a clearer GPS signal and retry.'
        };
        setMessage(map[error.code]||error.message||'Unable to obtain location.');
        setTracking(false);
      },
      {
        enableHighAccuracy:true,
        maximumAge:5000,
        timeout:15000
      }
    );

    setWatchId(id);
    setTracking(true);
    setSessionStart(Date.now());
    logEvent('GPS tracking started');
    setMessage(
      'LIVE SESSION ACTIVE — location permission granted.'
    );

  };

  const stopTracking=()=>{

    if(watchId!==null){

      navigator.geolocation.clearWatch(
        watchId
      );

    }

    setWatchId(null);
    setTracking(false);
    setSessionStart(null);
    logEvent('Tracking stopped');

    setMessage(
      'Live phone tracking session stopped.'
    );

  };

  useEffect(()=>{

    return()=>{

      if(watchId!==null){

        navigator.geolocation.clearWatch(
          watchId
        );

      }

    };

  },[watchId]);


  const connected=status==='LIVE'||status==='RECENT';
  const lat=num(phone?.latitude);
  const lng=num(phone?.longitude);

  const trailPoints=(trail||[])
    .filter(p=>p&&p.latitude!=null&&p.longitude!=null)
    .map(p=>({
      lat:Number(p.latitude),
      lng:Number(p.longitude),
      t:new Date(p.recorded_at||p.created_at||p.timestamp||p.last_updated||0).getTime(),
      speed:p.speed
    }))
    .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng))
    .sort((a,b)=>a.t-b.t);

  const dayStart=new Date();dayStart.setHours(0,0,0,0);
  const todayPoints=trailPoints.filter(p=>p.t>=dayStart.getTime());
  const trailForMap=todayPoints.length?todayPoints:trailPoints;

  const trailDistanceKm=(()=>{
    let d=0;
    for(let i=1;i<trailForMap.length;i++){
      d+=haversineM(trailForMap[i-1].lat,trailForMap[i-1].lng,trailForMap[i].lat,trailForMap[i].lng);
    }
    return d/1000;
  })();

  const fmtDur=ms=>{
    if(!ms||ms<0)return '—';
    const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    return h?`${h}h ${m}m`:m?`${m}m ${sec}s`:`${sec}s`;
  };

  const trailDurationMs=trailForMap.length>1?trailForMap[trailForMap.length-1].t-trailForMap[0].t:0;
  const sessionDuration=tracking&&sessionStart?fmtDur(nowTick-sessionStart):'—';
  const currentSpeed=lastSample?num(lastSample.speed):num(phone?.speed);
  const currentAcc=lastSample?num(lastSample.accuracy):num(phone?.accuracy);
  const lastTxTime=lastSample?new Date(lastSample.timestamp):(phone?.last_updated?new Date(phone.last_updated):null);

  if(!phone){
    return (
      <div className="pc pcEmptyWrap">
        <header className="pcHeader">
          <div className="pcBrand">
            <span className="pcLogo"><Radio size={16}/></span>
            <div><b>JABS TRACKER</b><small>PHONE COMMAND</small></div>
          </div>
        </header>
        <div className="pcEmpty">
          <Smartphone size={44}/>
          <h2>No authorized phone</h2>
          <p>Phones connected to this organization will appear here.</p>
          <span className="pcTagline">TRACE IT · TRACK IT · TRUST IT</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pc" data-tab={tab}>

      <header className="pcHeader">
        <div className="pcBrand">
          <span className="pcLogo"><Radio size={16}/></span>
          <div><b>JABS TRACKER</b><small>PHONE COMMAND</small></div>
        </div>
        <div className="pcHeaderRight">
          <span className={`pcConn ${connected?'on':'off'}`}><i/>{connected?'CONNECTED':'OFFLINE'}</span>
          <PhoneStatus status={status}/>
        </div>
      </header>

      <div className="pcSub">
        <div className="pcSubLeft">
          <select
            className="pcPhoneSelect"
            value={phone.id||''}
            onChange={e=>{
              const nx=phones.find(x=>x.id===e.target.value);
              setSelected?.(nx||null);
            }}
          >
            {phones.map(p=><option key={p.id} value={p.id}>{p.identifier||p.name}</option>)}
          </select>
          <small>Last sync {lastTxTime?lastTxTime.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'—'}</small>
        </div>
        <span className="pcTagline">TRACE · TRACK · TRUST</span>
      </div>

      <main className="pcBody">

        {tab==='LIVE'&&(
          <>
            <section className="pcCard pcMapCard">
              <PhoneMap asset={phone} trail={trail}/>
            </section>

            <section className="pcCard pcLive">
              <div className="pcCardHead">
                <b>LIVE TRACKING</b>
                <span className={`pcStatePill ${tracking?'live':status.toLowerCase()}`}>
                  <i/>{tracking?'LIVE SESSION':status}
                </span>
              </div>
              <div className="pcLiveGrid">
                <div><span>STATUS</span><b>{tracking?'TRACKING':'STOPPED'}</b></div>
                <div><span>DURATION</span><b>{sessionDuration}</b></div>
                <div><span>SPEED</span><b>{currentSpeed==null?'—':`${fmt(currentSpeed)} km/h`}</b></div>
                <div><span>MOVEMENT</span><b>{currentSpeed==null?'—':currentSpeed>0?'MOVING':'STATIONARY'}</b></div>
                <div><span>ACCURACY</span><b>{currentAcc==null?'—':`±${fmt(currentAcc)} m`}</b></div>
                <div><span>BATTERY</span><b>{phone.battery_level==null?'—':`${fmt(phone.battery_level)}%`}</b></div>
                <div><span>TRANSMISSIONS</span><b>{sent}</b></div>
                <div><span>GPS FRESHNESS</span><b>{status}</b></div>
                <div className="pcLiveWide"><span>LAST LOCATION</span><b>{lat==null||lng==null?'No fix received yet':`${fmt(lat)}, ${fmt(lng)}`}</b></div>
              </div>
            </section>

            <section className="pcCard pcControls">
              <label className="pcField">
                <span>REGISTERED DEVICE ID</span>
                <input value={device} onChange={e=>setDevice(e.target.value)} placeholder="Device ID" autoComplete="off"/>
              </label>
              <label className="pcField">
                <span>DEVICE CREDENTIAL</span>
                <input type="password" value={credential} onChange={e=>setCredential(e.target.value)} placeholder="Private device credential" autoComplete="off"/>
              </label>
              <button
                className={`pcTrackBtn ${tracking?'stop':'start'}`}
                onClick={tracking?stopTracking:startTracking}
              >
                {tracking?<Pause size={18}/>:<Play size={18}/>}
                {tracking?' STOP TRACKING':' START LIVE TRACKING'}
              </button>
              {message&&(
                <div className={`pcFeedback ${txError?'err':''}`}>
                  <Activity size={14}/> {message}
                </div>
              )}
            </section>

            <section className="pcCard pcGeo">
              <div className="pcCardHead"><b>GEOFENCE STATUS</b><MapPin size={16}/></div>
              {lat==null||lng==null?(
                <div className="pcGeoState unknown"><i/>UNKNOWN — awaiting GPS position</div>
              ):!activeZones.length?(
                <div className="pcGeoState unknown"><i/>No safe zones configured</div>
              ):(
                <div className={`pcGeoState ${insideZones.length?'inside':'outside'}`}>
                  <i/>{insideZones.length?`INSIDE ${insideZones[0].zone.name||'SAFE ZONE'}`:'OUTSIDE ALL SAFE ZONES'}
                </div>
              )}
              {activeZones.length>0&&lat!=null&&lng!=null&&(
                <div className="pcGeoList">
                  {zoneStatus.slice(0,4).map(z=>(
                    <div key={z.zone.id}>
                      <span className={`pcDot ${z.inside?'in':'out'}`}/>
                      <b>{z.zone.name||'Zone'}</b>
                      <small>{z.inside?'INSIDE':z.distance!=null?`${fmt(z.distance/1000)} km`:'—'}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab==='HISTORY'&&(
          <>
            <section className="pcCard pcHistSummary">
              <div className="pcCardHead"><b>TODAY'S MOVEMENT</b><History size={16}/></div>
              {trailForMap.length<2?(
                <div className="pcEmptyState"><History size={26}/><span>No movement history available yet</span></div>
              ):(
                <div className="pcHistStats">
                  <div><span>POINTS</span><b>{trailForMap.length}</b></div>
                  <div><span>DISTANCE</span><b>{fmt(trailDistanceKm)} km</b></div>
                  <div><span>DURATION</span><b>{fmtDur(trailDurationMs)}</b></div>
                  <div><span>START</span><b>{new Date(trailForMap[0].t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b></div>
                  <div><span>LATEST</span><b>{new Date(trailForMap[trailForMap.length-1].t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b></div>
                </div>
              )}
            </section>

            <section className="pcCard pcMapCard">
              <PhoneMap asset={phone} trail={trail}/>
            </section>

            <section className="pcCard">
              <div className="pcCardHead"><b>ACTIVITY TIMELINE</b><Activity size={16}/></div>
              {events.length===0&&trailForMap.length<2?(
                <div className="pcEmptyState"><Activity size={24}/><span>No activity yet. Start a live session to record events.</span></div>
              ):(
                <div className="pcTimeline">
                  {events.map((e,i)=>(
                    <div key={`ev-${i}`}><span className="pcTlDot"/><div><b>{e.label}</b><small>{new Date(e.t).toLocaleTimeString()}</small></div></div>
                  ))}
                  {events.length===0&&trailForMap.slice(-8).reverse().map((p,i)=>(
                    <div key={`tp-${i}`}><span className="pcTlDot"/><div><b>Location recorded · {fmt(p.lat)}, {fmt(p.lng)}</b><small>{new Date(p.t).toLocaleString()}</small></div></div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab==='DEVICE'&&(
          <>
            <section className="pcCard">
              <div className="pcCardHead"><b>DEVICE IDENTITY</b><Smartphone size={16}/></div>
              <div className="pcDeviceHead">
                <span className="pcDeviceAvatar"><Phone size={20}/></span>
                <div><strong>{phone.identifier||phone.name||'PHONE'}</strong><span>{phone.name||'Organization device'}</span></div>
              </div>
              <div className="pcKV">
                <div><span>DEVICE ID</span><b>{phone.device_id||'NOT LINKED'}</b></div>
                <div><span>PAIRING</span><b>{phone.device_id?'PAIRED':'UNPAIRED'}</b></div>
                <div><span>CREDENTIAL</span><b>{credential?'ENTERED':'REQUIRED'}</b></div>
                <div><span>STATUS</span><b>{phone.status||'UNKNOWN'}</b></div>
                <div><span>LAST SEEN</span><b>{phone.last_updated?new Date(phone.last_updated).toLocaleString():'—'}</b></div>
                <div><span>LAST LOCATION</span><b>{lat==null||lng==null?'—':`${fmt(lat)}, ${fmt(lng)}`}</b></div>
              </div>
            </section>

            <section className="pcCard">
              <div className="pcCardHead"><b>DEVICE HEALTH</b><Activity size={16}/></div>
              <div className="pcHealth">
                <div>
                  <span>BATTERY</span>
                  <i><em style={{width:phone.battery_level==null?'18%':`${Math.min(100,Number(phone.battery_level))}%`}}/></i>
                  <b>{phone.battery_level==null?'UNKNOWN':lowBattery?'LOW':'HEALTHY'}</b>
                </div>
                <div>
                  <span>NETWORK</span>
                  <i><em style={{width:phone.network_type?'82%':'22%'}}/></i>
                  <b>{phone.network_type||'UNKNOWN'}</b>
                </div>
                <div>
                  <span>GPS</span>
                  <i><em style={{width:status==='LIVE'?'96%':status==='RECENT'?'72%':status==='STALE'?'45%':'18%'}}/></i>
                  <b>{status}</b>
                </div>
              </div>
            </section>

            <section className="pcCard pcPrivacy">
              <div className="pcCardHead"><b>PRIVACY</b><ShieldCheck size={16}/></div>
              <p>This device transmits location only through the authorized JABS device pipeline. Credentials remain private and are never stored in the interface.</p>
              <div className="pcPrivacyState"><ShieldCheck size={14}/> AUTHORIZED DEVICE PIPELINE</div>
            </section>
          </>
        )}

      </main>

      <nav className="pcNav">
        {[['LIVE',Radio],['HISTORY',History],['DEVICE',Smartphone]].map(([k,Icon])=>(
          <button key={k} className={tab===k?'active':''} onClick={()=>setTab(k)}>
            <Icon size={18}/>
            <span>{k}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}

