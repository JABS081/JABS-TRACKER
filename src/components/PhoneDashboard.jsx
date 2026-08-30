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

  const points=useMemo(()=>trail
    .filter(p=>p?.latitude!=null&&p?.longitude!=null)
    .map(p=>[
      Number(p.latitude),
      Number(p.longitude)
    ])
    .filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])),
    [trail]
  );

  useEffect(()=>{

    if(!window.L||!ref.current||!asset)return;

    const lat=num(asset.latitude);
    const lng=num(asset.longitude);

    if(lat==null||lng==null)return;

    if(!map.current){

      map.current=window.L
        .map(ref.current,{
          zoomControl:false,
          attributionControl:true
        })
        .setView([lat,lng],13);

      if(config.mapTileUrl){

        window.L
          .tileLayer(config.mapTileUrl,{
            attribution:config.mapAttribution,
            maxZoom:19
          })
          .addTo(map.current);

      }

      window.L
        .control
        .zoom({position:'bottomright'})
        .addTo(map.current);

    }

    const icon=window.L.divIcon({
      className:'',
      html:`
        <div class="phoneMapMarker">
          <span>⌁</span>
        </div>
      `,
      iconSize:[42,42],
      iconAnchor:[21,21]
    });

    if(!marker.current){

      marker.current=window.L
        .marker([lat,lng],{
          icon,
          zIndexOffset:1000
        })
        .addTo(map.current);

    }else{

      marker.current.setLatLng([lat,lng]);
      marker.current.setIcon(icon);

    }

    if(line.current){
      line.current.remove();
      line.current=null;
    }

    if(points.length>1){

      line.current=window.L
        .polyline(points,{
          color:'#9f7cff',
          weight:5,
          opacity:.8
        })
        .addTo(map.current);

    }

    map.current.flyTo(
      [lat,lng],
      Math.max(map.current.getZoom(),12),
      {duration:.45}
    );

    setTimeout(
      ()=>map.current?.invalidateSize(),
      100
    );

  },[asset,points]);

  useEffect(()=>{

    return()=>{

      if(map.current){

        map.current.remove();
        map.current=null;

      }

    };

  },[]);

  return (
    <div
      ref={ref}
      className="phoneCommandMap"
    />
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
  setSelected
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

  useEffect(()=>{

    setDevice(phone?.device_id||'');
    setTracking(false);
    setMessage('');
    setLastSample(null);

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

  const startTracking=()=>{

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

        setMessage(
          `Live location transmitted · ${new Date().toLocaleTimeString()}`
        );

      })
      .catch(error=>{
        setMessage(error.message);
      });

    };

    const id=navigator.geolocation.watchPosition(
      send,
      error=>{
        setMessage(error.message);
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
