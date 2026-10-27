import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const origin=process.env.PG_TEST_BASE_URL;
const endpoints=origin?new URL(origin):null;
const api=async(path,{method='GET',body,cookie}={})=>{
 const res=await fetch(new URL(path,endpoints),{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>null);
 return {status:res.status,data,cookie:res.headers.get('set-cookie')?.split(';')[0]};
};
test('PostgreSQL vazio inicia, atende saúde e mantém todos os catálogos públicos vazios', {skip:!origin},async()=>{
 const health=await api('/api/health');assert.equal(health.status,200);assert.equal(health.data.status,'ok');
 const events=await api('/api/public/events');assert.equal(events.status,200);assert.deepEqual(events.data.items,[]);
 const maps=await api('/api/public/maps');assert.equal(maps.status,200);assert.deepEqual(maps.data.items,[]);
 const me=await api('/api/auth/me');assert.equal(me.status,200);assert.equal(me.data.user,null);
});
test('PostgreSQL grava usuário, autentica sessão, edita perfil e desliga compartilhamento', {skip:!origin},async()=>{
 const email='pg-test-'+Date.now()+'@example.invalid';
 const register=await api('/api/auth/register',{method:'POST',body:{name:'Teste Postgres',email,password:'SenhaNova123456'}});
 assert.equal(register.status,201,JSON.stringify(register.data));
 assert.ok(register.cookie);
 const me=await api('/api/auth/me',{cookie:register.cookie});
 assert.equal(me.status,200);assert.equal(me.data.user.email,email);
 if(process.env.PG_TEST_CONTAINER){
  const script="import {PostgresSync} from '/app/server/postgres-sync.mjs';const db=new PostgresSync(process.env.DATABASE_URL);db.prepare('INSERT OR IGNORE INTO admin_users(user_id,created_at) VALUES(?,?)').run(process.env.GRANT_USER_ID,Date.now());db.close();";
  execFileSync('docker',['exec','-e','GRANT_USER_ID='+register.data.user.id,process.env.PG_TEST_CONTAINER,'node','--input-type=module','-e',script],{timeout:20000,stdio:['ignore','pipe','pipe']});
  const denied=await api('/api/admin/venues',{cookie:register.cookie});assert.equal(denied.status,200);
  const venue=await api('/api/admin/venues',{method:'POST',cookie:register.cookie,body:{name:'Local PostgreSQL',city:'Sorocaba'}});
  assert.equal(venue.status,201,JSON.stringify(venue.data));
  const map=await api('/api/admin/maps',{method:'POST',cookie:register.cookie,body:{name:'Pista principal',venue_id:venue.data.id}});
  assert.equal(map.status,201,JSON.stringify(map.data));
  const mapDetail=await api('/api/public/map-detail?map_id='+encodeURIComponent(map.data.id));
  assert.equal(mapDetail.status,200,JSON.stringify(mapDetail.data));assert.ok(Array.isArray(mapDetail.data.areas));
  const event=await api('/api/admin/events',{method:'POST',cookie:register.cookie,body:{name:'Evento Teste PG',venue_id:venue.data.id,map_ids:[map.data.id],starts_at:'2027-01-01T20:00',ends_at:'2027-01-02T04:00'}});
  assert.equal(event.status,201,JSON.stringify(event.data));
  const blocked=await api('/api/location/preferences',{method:'POST',cookie:register.cookie,body:{gpsEnabled:true,shareEnabled:true,mode:'1h',eventId:event.data.id}});
  assert.equal(blocked.status,403,JSON.stringify(blocked.data));
  assert.match(blocked.data.error,/desabilitada/);
  const enabled=await api('/api/admin/edit-event',{method:'POST',cookie:register.cookie,body:{id:event.data.id,name:'Evento Teste PG',venue_id:venue.data.id,map_ids:[map.data.id],starts_at:'2027-01-01T20:00',ends_at:'2027-01-02T04:00',lineup:[],location_sharing_enabled:true}});
  assert.equal(enabled.status,200,JSON.stringify(enabled.data));
  const approved=await api('/api/location/preferences',{method:'POST',cookie:register.cookie,body:{gpsEnabled:true,shareEnabled:true,mode:'1h',eventId:event.data.id}});
  assert.equal(approved.status,200,JSON.stringify(approved.data));
  const disabled=await api('/api/admin/edit-event',{method:'POST',cookie:register.cookie,body:{id:event.data.id,name:'Evento Teste PG',venue_id:venue.data.id,map_ids:[map.data.id],starts_at:'2027-01-01T20:00',ends_at:'2027-01-02T04:00',lineup:[],location_sharing_enabled:false}});
  assert.equal(disabled.status,200,JSON.stringify(disabled.data));
  const revoked=await api('/api/location/preferences',{cookie:register.cookie});
  assert.equal(revoked.data.shareEnabled,false);
  const product=await api('/api/admin/save-product',{method:'POST',cookie:register.cookie,body:{name:'Água',category:'Bebidas',default_price_cents:500}});
  assert.equal(product.status,200,JSON.stringify(product.data));
  const listed=await api('/api/admin/search-venues?q=Local',{cookie:register.cookie});
  assert.equal(listed.status,200,JSON.stringify(listed.data));assert.ok(listed.data.items.some(x=>x.id===venue.data.id));
  const listings=await api('/api/admin/events',{cookie:register.cookie});
  assert.equal(listings.status,200);assert.ok(listings.data.items.some(x=>x.id===event.data.id));
 }
 const profile=await api('/api/auth/profile',{method:'POST',cookie:register.cookie,body:{name:'Participante PostgreSQL',phone:'11999999999',instagram:'submundo.teste'}});
 assert.equal(profile.status,200);
 const preferences=await api('/api/location/preferences',{cookie:register.cookie});
 assert.equal(preferences.status,200);assert.equal(preferences.data.shareEnabled,false);
 const notices=await api('/api/notifications',{cookie:register.cookie});
 assert.equal(notices.status,200);assert.deepEqual(notices.data.items,[]);
 const logout=await api('/api/auth/logout',{method:'POST',cookie:register.cookie});
 assert.equal(logout.status,200);
 const invalid=await api('/api/auth/me',{cookie:register.cookie});
 assert.equal(invalid.data.user,null);
 const login=await api('/api/auth/login',{method:'POST',body:{email,password:'SenhaNova123456'}});
 assert.equal(login.status,200);assert.ok(login.cookie);
});
