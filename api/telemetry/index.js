import crypto from 'node:crypto';
import {adminClient,json,fail} from '../_supabase.js';

const num=v=>Number.isFinite(Number(v));

export default async function handler(req,res){
  try{
    if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});

    const key=req.headers['x-jabs-device-key'];
    if(!key) return json(res,401,{error:'Device credential required.'});

    const body=req.body||{};
    const {
      device_id,asset_id,asset_type,latitude,longitude,
      speed=0,heading=0,accuracy=null,battery_level=null,
      network_type=null,timestamp
    }=body;

    if(!device_id||!asset_id||asset_type!=='PHONE'||!num(latitude)||!num(longitude)){
      return json(res,400,{error:'device_id, asset_id, asset_type PHONE, latitude and longitude are required.'});
    }

    if(Number(latitude)<-90||Number(latitude)>90||Number(longitude)<-180||Number(longitude)>180){
      return json(res,400,{error:'Invalid coordinates.'});
    }

    if(num(battery_level)&&(Number(battery_level)<0||Number(battery_level)>100)){
      return json(res,400,{error:'Invalid battery level.'});
    }

    const db=adminClient();
    const hash=crypto.createHash('sha256').update(String(key)).digest('hex');

    const {data:device,error:de}=await db
      .from('devices')
      .select('id,device_code,device_type,vehicle_id,active,last_seen_at,revoked_at,credential_hash')
      .eq('device_code',device_id)
      .maybeSingle();

    if(de) throw de;

    if(!device||!device.active||device.revoked_at){
      return json(res,401,{error:'Device is inactive or revoked.'});
    }

    if(!device.credential_hash||device.credential_hash!==hash){
      return json(res,401,{error:'Invalid device credential.'});
    }

    const {data:asset,error:ae}=await db
      .from('assets')
      .select('id,asset_type,device_id')
      .eq('id',asset_id)
      .maybeSingle();

    if(ae) throw ae;

    if(!asset||asset.asset_type!=='PHONE'||asset.device_id!==device.id){
      return json(res,403,{error:'Device is not authorized for this phone asset.'});
    }

    const recorded_at=timestamp||new Date().toISOString();
    const now=new Date().toISOString();

    const loc={
      device_id:device.id,
      asset_id,
      latitude:Number(latitude),
      longitude:Number(longitude),
      speed:Number(speed)||0,
      heading:Number(heading)||0,
      accuracy:num(accuracy)?Number(accuracy):null,
      battery_level:num(battery_level)?Number(battery_level):null,
      network_type:network_type?String(network_type).slice(0,40):null,
      recorded_at
    };

    const {error:le}=await db.from('locations').insert(loc);
    if(le) throw le;

    const {error:assetUpdateError}=await db
      .from('assets')
      .update({
        latitude:loc.latitude,
        longitude:loc.longitude,
        speed:loc.speed,
        heading:loc.heading,
        accuracy:loc.accuracy,
        battery_level:loc.battery_level,
        network_type:loc.network_type,
        status:loc.speed>3?'MOVING':'STOPPED',
        last_updated:recorded_at,
        updated_at:now
      })
      .eq('id',asset_id);

    if(assetUpdateError) throw assetUpdateError;

    const {error:deviceUpdateError}=await db
      .from('devices')
      .update({last_seen_at:recorded_at})
      .eq('id',device.id);

    if(deviceUpdateError) throw deviceUpdateError;

    return json(res,201,{
      ok:true,
      asset_id,
      recorded_at,
      status:loc.speed>3?'MOVING':'STOPPED'
    });

  }catch(e){
    return fail(res,e);
  }
}
