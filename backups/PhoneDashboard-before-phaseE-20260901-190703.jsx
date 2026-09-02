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

  useEffect(()=>{

    setDevice(phone?.device_id||'');
    setTracking(false);
    setMessage('');
    setLastSample(null);
    sentCount.current=0;
    setSent(0);
    setTxError('');

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

  if(!phone){

    return(
      <div className="phoneDashboard">

        <div className="phoneEmpty">

          <Smartphone size={48}/>

          <span>
            CONNECTED PEOPLE / DEVICE VISIBILITY
          </span>

          <h1>
            Phone Command
          </h1>

          <p>
            No authorized phone is currently
            available to this organization.
          </p>

        </div>

      </div>
    );

  }

  return(

    <div className="phoneDashboard">

      <div className="phoneHero">

        <div>

          <span>
            ORGANIZATION PEOPLE / PHONE OPERATIONS
          </span>

          <h1>
            Phone Command
          </h1>

          <p>
            Organization-level visibility for
            authorized phones, workforce movement,
            safety status, device health and
            location continuity.
          </p>

        </div>

        <div className="phoneHeroRight">

          <PhoneStatus status={status}/>

          <select
            value={phone.id||''}
            onChange={e=>{
              const next=phones.find(
                x=>x.id===e.target.value
              );
              setSelected?.(next||null);
            }}
          >

            <option value="">
              Select phone
            </option>

            {phones.map(p=>(
              <option
                key={p.id}
                value={p.id}
              >
                {p.identifier||p.name}
              </option>
            ))}

          </select>

        </div>

      </div>

      <div className="phoneOrgStrip">

        <div>
          <Users size={17}/>
          <span>
            AUTHORIZED PHONES
            <b>{phones.length}</b>
          </span>
        </div>

        <div>
          <Navigation size={17}/>
          <span>
            MOVING
            <b>
              {
                phones.filter(
                  p=>Number(p.speed||0)>0
                ).length
              }
            </b>
          </span>
        </div>

        <div>
          <Battery size={17}/>
          <span>
            LOW BATTERY
            <b>
              {
                phones.filter(
                  p=>p.battery_level!=null &&
                  Number(p.battery_level)<=20
                ).length
              }
            </b>
          </span>
        </div>

        <div>
          <Signal size={17}/>
          <span>
            NEED ATTENTION
            <b>
              {
                phones.filter(
                  p=>['STALE','OFFLINE']
                  .includes(
                    freshness(p.last_updated)
                  )
                ).length
              }
            </b>
          </span>
        </div>

      </div>

      <div className="phoneMetrics">

        <Metric
          icon={MapPin}
          label="CURRENT LOCATION"
          value={`${fmt(phone.latitude)}, ${fmt(phone.longitude)}`}
          meta="Latest authorized position"
        />

        <Metric
          icon={Battery}
          label="BATTERY"
          value={
            phone.battery_level==null
              ?'—'
              :`${fmt(phone.battery_level)}%`
          }
          meta={
            lowBattery
              ?'LOW — attention required'
              :'Device power status'
          }
        />

        <Metric
          icon={Signal}
          label="NETWORK"
          value={
            phone.network_type||'UNKNOWN'
          }
          meta="Current network type"
        />

        <Metric
          icon={Clock3}
          label="LAST SEEN"
          value={
            phone.last_updated
              ?new Date(
                phone.last_updated
              ).toLocaleTimeString(
                [],
                {
                  hour:'2-digit',
                  minute:'2-digit'
                }
              )
              :'—'
          }
          meta={status}
        />

      </div>

      <div className="phoneMainGrid">

        <section className="phoneMapCard">

          <div className="phoneSectionHead">

            <div>

              <b>
                LIVE PEOPLE / DEVICE MAP
              </b>

              <small>
                {
                  phone.identifier||
                  phone.name||
                  'AUTHORIZED PHONE'
                }
                {' · '}
                live location and movement trail
              </small>

            </div>

            <span className="phoneLiveBadge">
              <i/>
              {tracking?'TRACKING':'MONITORING'}
            </span>

          </div>

          <div className="phoneMapWrap">

            <PhoneMap
              asset={phone}
              trail={trail}
            />

            <div className="phoneMapOverlay">

              <span>
                <LocateFixed size={13}/>
                GPS ACCURACY
              </span>

              <b>
                {
                  phone.accuracy
                    ?`±${fmt(phone.accuracy)} m`
                    :'UNKNOWN'
                }
              </b>

            </div>

            <div className="phoneMovementBadge">

              <span>
                <Navigation size={13}/>
                MOVEMENT
              </span>

              <b>
                {moving?'MOVING':'STATIONARY'}
              </b>

            </div>

          </div>

          <div className="phoneMapFooter">

            <span>
              <MapPin size={13}/>
              {fmt(phone.latitude)},
              {' '}
              {fmt(phone.longitude)}
            </span>

            <span>
              <Clock3 size={13}/>
              {phone.last_updated
                ?new Date(
                  phone.last_updated
                ).toLocaleString()
                :'No timestamp'}
            </span>

          </div>

        </section>

        <aside className="phoneSideColumn">

          <section className="phoneCard">

            <div className="phoneSectionHead">

              <div>
                <b>
                  DEVICE IDENTITY
                </b>
                <small>
                  Organization registered device
                </small>
              </div>

              <Smartphone size={18}/>

            </div>

            <div className="phoneIdentity">

              <div className="phoneAvatar">
                <Phone size={22}/>
              </div>

              <div>

                <strong>
                  {phone.identifier||
                   phone.name||
                   'PHONE'}
                </strong>

                <span>
                  {phone.name||
                   'Connected organization device'}
                </span>

              </div>

            </div>

            <div className="phoneDataRows">

              <div>
                <span>DEVICE</span>
                <b>
                  {phone.device_id||'NOT LINKED'}
                </b>
              </div>

              <div>
                <span>STATUS</span>
                <b>
                  {phone.status||'UNKNOWN'}
                </b>
              </div>

              <div>
                <span>GPS</span>
                <b>
                  {phone.accuracy
                    ?'LOCKED'
                    :'UNKNOWN'}
                </b>
              </div>

            </div>

          </section>

          <section className="phoneCard">

            <div className="phoneSectionHead">

              <div>
                <b>
                  DEVICE HEALTH
                </b>
                <small>
                  Continuity indicators
                </small>
              </div>

              <Activity size={18}/>

            </div>

            <div className="phoneHealthRows">

              <div>
                <span>BATTERY</span>
                <b>
                  {
                    phone.battery_level==null
                      ?'UNKNOWN'
                      :lowBattery
                        ?'LOW'
                        :'HEALTHY'
                  }
                </b>
                <i>
                  <em
                    style={{
                      width:
                        phone.battery_level==null
                          ?'20%'
                          :`${Math.min(
                            100,
                            Number(
                              phone.battery_level
                            )
                          )}%`
                    }}
                  />
                </i>
              </div>

              <div>
                <span>NETWORK</span>
                <b>
                  {phone.network_type||'UNKNOWN'}
                </b>
                <i>
                  <em
                    style={{
                      width:
                        phone.network_type
                          ?'82%'
                          :'25%'
                    }}
                  />
                </i>
              </div>

              <div>
                <span>LOCATION</span>
                <b>
                  {status}
                </b>
                <i>
                  <em
                    style={{
                      width:
                        status==='LIVE'
                          ?'96%'
                          :status==='RECENT'
                            ?'75%'
                            :status==='STALE'
                              ?'45%'
                              :'18%'
                    }}
                  />
                </i>
              </div>

            </div>

          </section>

          <section className="phoneCard phoneSafeZone">

            <div className="phoneSectionHead">
              <div>
                <b>SAFE ZONE STATUS</b>
                <small>Live geofence relationship</small>
              </div>
              <MapPin size={18}/>
            </div>

            {zoneLat==null||zoneLng==null?(
              <div className="safeZoneEmpty">
                <ShieldCheck size={20}/>
                <span>
                  Location required to evaluate safe zones.
                  Waiting for authorized GPS position.
                </span>
              </div>
            ):!activeZones.length?(
              <div className="safeZoneEmpty">
                <ShieldCheck size={20}/>
                <span>
                  No active organization safe zones are configured.
                </span>
              </div>
            ):(
              <>
                <div className={`safeZoneBanner ${insideZones.length?'inside':'outside'}`}>
                  <i/>
                  {insideZones.length
                    ?`INSIDE SAFE ZONE${insideZones.length>1?'S':''}`
                    :'OUTSIDE ALL SAFE ZONES'}
                </div>

                <div className="safeZoneRows">
                  {zoneStatus.slice(0,5).map(z=>(
                    <div key={z.zone.id}>
                      <span className={`zoneDot ${z.inside?'in':'out'}`}/>
                      <div>
                        <b>{z.zone.name||'Unnamed zone'}</b>
                        <small>
                          {(z.zone.type||'CUSTOM').replaceAll('_',' ')}
                          {' · '}
                          {Number(z.zone.radius_m||0).toLocaleString()} m
                        </small>
                      </div>
                      <strong>
                        {z.inside
                          ?'INSIDE'
                          :z.distance!=null
                            ?`${fmt(z.distance/1000)} km`
                            :'—'}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            )}

          </section>

          <section className="phoneCard phonePrivacy">

            <div className="phoneSectionHead">

              <div>
                <b>
                  ORGANIZATION PRIVACY
                </b>
                <small>
                  Authorized tracking only
                </small>
              </div>

              <ShieldCheck size={18}/>

            </div>

            <p>
              This device participates in tracking
              only through the registered asset
              pipeline. Location permission and
              device credentials are required.
            </p>

            <div className="privacyState">
              <ShieldCheck size={15}/>
              AUTHORIZED DEVICE PIPELINE
            </div>

          </section>

        </aside>

      </div>

      <div className="phoneLowerGrid">

        <section className="phoneCard">

          <div className="phoneSectionHead">

            <div>
              <b>
                LIVE TRACKING SESSION
              </b>

              <small>
                Continuous authorized browser
                telemetry
              </small>
            </div>

            <Radio size={18}/>

          </div>

          {tracking&&(
            <div className="phoneLiveSession">
              <div className="phoneLiveSessionTop">
                <span className="phoneLiveDot"/>
                <b>LIVE SESSION ACTIVE</b>
                <span className="phoneLiveTx">{sent} sent</span>
              </div>
              <div className="phoneLiveGrid">
                <div><span>LATITUDE</span><b>{lastSample?fmt(lastSample.latitude):'…'}</b></div>
                <div><span>LONGITUDE</span><b>{lastSample?fmt(lastSample.longitude):'…'}</b></div>
                <div><span>ACCURACY</span><b>{lastSample?.accuracy!=null?`±${fmt(lastSample.accuracy)} m`:'…'}</b></div>
                <div><span>MOVEMENT</span><b>{lastSample?(Number(lastSample.speed)>0?'MOVING':'STATIONARY'):'…'}</b></div>
                <div><span>LAST TX</span><b>{lastSample?new Date(lastSample.timestamp).toLocaleTimeString():'…'}</b></div>
                <div><span>TELEMETRY</span><b className={txError?'txErr':'txOk'}>{txError?'REJECTED':sent>0?'FLOWING':'ACQUIRING GPS'}</b></div>
              </div>
            </div>
          )}

          <div className="phoneControls">

            <label>
              REGISTERED DEVICE ID

              <input
                value={device}
                onChange={e=>
                  setDevice(e.target.value)
                }
                placeholder="Device ID"
              />

            </label>

            <label>
              DEVICE CREDENTIAL

              <input
                type="password"
                value={credential}
                onChange={e=>
                  setCredential(e.target.value)
                }
                placeholder="Private device credential"
              />

            </label>

            <button
              className={
                tracking
                  ?'phoneStopButton'
                  :'phoneStartButton'
              }
              onClick={
                tracking
                  ?stopTracking
                  :startTracking
              }
            >

              {tracking
                ?<Pause size={16}/>
                :<Play size={16}/>
              }

              {tracking
                ?' STOP LIVE SESSION'
                :' START LIVE SESSION'
              }

            </button>

          </div>

          {message&&(
            <div className="phoneMessage">
              <Activity size={15}/>
              {message}
            </div>
          )}

          {lastSample&&(

            <div className="phoneLastSample">

              <span>
                LAST TRANSMITTED
              </span>

              <b>
                {fmt(lastSample.latitude)},
                {' '}
                {fmt(lastSample.longitude)}
              </b>

              <small>
                ±{fmt(lastSample.accuracy)} m ·
                {' '}
                {new Date(
                  lastSample.timestamp
                ).toLocaleTimeString()}
              </small>

            </div>

          )}

        </section>

        <section className="phoneCard">

          <div className="phoneSectionHead">

            <div>
              <b>
                MOVEMENT HISTORY
              </b>

              <small>
                Recent location points received
              </small>
            </div>

            <History size={18}/>

          </div>

          {!trail.length?(
            <div className="phoneHistoryEmpty">
              <History size={24}/>
              <span>
                No movement history is available
                for this phone yet.
              </span>
            </div>
          ):(
            <div className="phoneHistoryList">

              {trail
                .slice(-8)
                .reverse()
                .map((point,index)=>{

                  const timestamp=
                    point.recorded_at||
                    point.created_at||
                    point.timestamp||
                    point.last_updated;

                  return(
                    <div
                      key={
                        point.id||
                        `${timestamp}-${index}`
                      }
                    >

                      <span className="historyDot"/>

                      <div>

                        <b>
                          {fmt(point.latitude)},
                          {' '}
                          {fmt(point.longitude)}
                        </b>

                        <small>
                          {timestamp
                            ?new Date(
                              timestamp
                            ).toLocaleString()
                            :'Unknown time'}
                        </small>

                      </div>

                      <strong>
                        {
                          point.speed!=null
                            ?`${fmt(point.speed)} km/h`
                            :'—'
                        }
                      </strong>

                    </div>
                  );

                })}

            </div>
          )}

        </section>

      </div>

      <section className="phoneCommandFooter">

        <div>

          <span>
            ORGANIZATION CONTROL
          </span>

          <b>
            {phone.identifier||
             phone.name||
             'Phone'} command workspace
          </b>

        </div>

        <div className="phoneFooterActions">

          <button className="phoneOutline">
            <LocateFixed size={15}/>
            Locate Device
          </button>

          <button className="phoneOutline">
            <History size={15}/>
            View History
          </button>

          <button className="phoneOutline">
            <Bell size={15}/>
            Safety Alerts
          </button>

          <button className="phonePrimary">
            <Route size={15}/>
            View Movement
          </button>

        </div>

      </section>

    </div>

  );

}
