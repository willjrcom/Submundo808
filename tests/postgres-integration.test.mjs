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

  // Real PostgreSQL round-trip for administrative create/edit/delete controls.
  // Use isolated extra records; leave the original "Evento Teste PG" intact for
  // the following catalog-reset and data-preservation smoke test.
  const venueName='CRUD PostgreSQL '+Date.now();
  const createdVenue=await api('/api/admin/venues',{method:'POST',cookie:register.cookie,body:{
   name:venueName,address:'Rua Exemplo, 10 - Centro, Sorocaba - SP, 18000-000, Brasil',
   city:'Sorocaba - SP',postal_code:'18000-000',street:'Rua Exemplo, 10',
   neighborhood:'Centro',complement:'Salão A',address_url:'https://maps.google.com/',services:'Guarda-volumes'
  }});
  assert.equal(createdVenue.status,201,JSON.stringify(createdVenue.data));
  const venueId=createdVenue.data.id;
  const venueCatalog=await api('/api/admin/venues',{cookie:register.cookie});
  const persistedVenue=venueCatalog.data.items.find(x=>x.id===venueId);
  assert.ok(persistedVenue);
  assert.equal(persistedVenue.street,'Rua Exemplo, 10');
  assert.equal(persistedVenue.neighborhood,'Centro');
  assert.equal(persistedVenue.postal_code,'18000-000');
  assert.equal(persistedVenue.complement,'Salão A');
  assert.equal(persistedVenue.services,'Guarda-volumes');
  assert.equal(persistedVenue.address_url,'https://maps.google.com/');
  const editedVenue=await api('/api/admin/edit-venue',{method:'POST',cookie:register.cookie,body:{
   ...persistedVenue,name:venueName+' editado',street:'Rua Corrigida, 21',
   address:'Rua Corrigida, 21 - Centro, Sorocaba - SP, 18000-000, Brasil',services:'Posto médico'
  }});
  assert.equal(editedVenue.status,200,JSON.stringify(editedVenue.data));
  const refreshedVenues=await api('/api/admin/venues',{cookie:register.cookie});
  assert.equal(refreshedVenues.data.items.find(x=>x.id===venueId).street,'Rua Corrigida, 21');
  assert.equal(refreshedVenues.data.items.find(x=>x.id===venueId).services,'Posto médico');

  const createdMap=await api('/api/admin/maps',{method:'POST',cookie:register.cookie,body:{name:'Mapa A',venue_id:venueId}});
  assert.equal(createdMap.status,201,JSON.stringify(createdMap.data));
  const mapId=createdMap.data.id;
  const renamedMap=await api('/api/admin/edit-map',{method:'POST',cookie:register.cookie,body:{id:mapId,name:'Mapa editado',venue_id:venueId}});
  assert.equal(renamedMap.status,200,JSON.stringify(renamedMap.data));
  const mapCatalog=await api('/api/admin/maps',{cookie:register.cookie});
  assert.equal(mapCatalog.data.items.find(x=>x.id===mapId).name,'Mapa editado');
  const mapLayout=await api('/api/public/map-detail?map_id='+encodeURIComponent(mapId));
  assert.equal(mapLayout.status,200);assert.ok(mapLayout.data.areas.length>0);

  const newEvent=await api('/api/admin/events',{method:'POST',cookie:register.cookie,body:{
   name:'Evento CRUD PG',venue_id:venueId,map_ids:[mapId],description:'Descrição criada',
   starts_at:'2027-02-01T21:00',ends_at:'2027-02-02T04:00',
   doors_at:'2027-02-01T20:00',cover_image:'data:image/jpeg;base64,YWJj',
   services:'Bebidas',site_url:'https://example.org',tickets_url:'https://example.org/tickets',
   instagram_url:'https://instagram.com/exemplo',lineup:[],location_sharing_enabled:false
  }});
  assert.equal(newEvent.status,201,JSON.stringify(newEvent.data));
  const extraEventId=newEvent.data.id;
  const createdEventCatalog=await api('/api/admin/events',{cookie:register.cookie});
  assert.equal(createdEventCatalog.data.items.find(x=>x.id===extraEventId).doors_at,'2027-02-01T20:00');
  assert.equal(createdEventCatalog.data.items.find(x=>x.id===extraEventId).services,'Bebidas');
  const editedEvent=await api('/api/admin/edit-event',{method:'POST',cookie:register.cookie,body:{
   id:extraEventId,name:'Evento CRUD PG editado',venue_id:venueId,map_ids:[mapId],
   description:'Descrição editada',starts_at:'2027-02-01T21:00',
   ends_at:'2027-02-02T04:00',doors_at:'2027-02-01T20:30',
   cover_image:'data:image/jpeg;base64,ZGVm',services:'Chapelaria',
   site_url:'https://example.org',tickets_url:'https://example.org/tickets',
   instagram_url:'https://instagram.com/exemplo',lineup:[],
   location_sharing_enabled:false
  }});
  assert.equal(editedEvent.status,200,JSON.stringify(editedEvent.data));
  const editedEvents=await api('/api/admin/events',{cookie:register.cookie});
  const persistedEvent=editedEvents.data.items.find(x=>x.id===extraEventId);
  assert.equal(persistedEvent.name,'Evento CRUD PG editado');
  assert.equal(persistedEvent.description,'Descrição editada');
  assert.equal(persistedEvent.doors_at,'2027-02-01T20:30');
  assert.equal(persistedEvent.cover_image,'data:image/jpeg;base64,ZGVm');
  assert.equal(persistedEvent.services,'Chapelaria');
  assert.deepEqual(persistedEvent.map_ids,[mapId]);

  const productName='Produto CRUD PG '+Date.now();
  const createdProduct=await api('/api/admin/save-product',{method:'POST',cookie:register.cookie,body:{
   name:productName,description:'Descrição produto',category:'Bebidas',default_price_cents:700
  }});
  assert.equal(createdProduct.status,200,JSON.stringify(createdProduct.data));
  const productList=await api('/api/admin/products',{cookie:register.cookie});
  const extraProduct=productList.data.items.find(x=>x.name===productName);
  assert.ok(extraProduct);
  const editedProduct=await api('/api/admin/save-product',{method:'POST',cookie:register.cookie,body:{
   id:extraProduct.id,name:productName+' editado',description:'Descrição atualizada',
   category:'Drinks',default_price_cents:850
  }});
  assert.equal(editedProduct.status,200,JSON.stringify(editedProduct.data));
  const updatedProducts=await api('/api/admin/products',{cookie:register.cookie});
  assert.equal(updatedProducts.data.items.find(x=>x.id===extraProduct.id).default_price_cents,850);
  const menuSaved=await api('/api/admin/save-event-products',{method:'POST',cookie:register.cookie,body:{
   event_id:extraEventId,items:[{product_id:extraProduct.id,price_cents:799}]
  }});
  assert.equal(menuSaved.status,200,JSON.stringify(menuSaved.data));
  const menuRead=await api('/api/admin/event-products?event_id='+extraEventId,{cookie:register.cookie});
  assert.equal(menuRead.data.items.find(x=>x.product_id===extraProduct.id).price_cents,799);

  const blockedVenue=await api('/api/admin/delete',{method:'POST',cookie:register.cookie,body:{id:venueId,entity:'venue'}});
  assert.equal(blockedVenue.status,409,'Venue with maps and events must not be deleted');
  const blockedMap=await api('/api/admin/delete',{method:'POST',cookie:register.cookie,body:{id:mapId,entity:'map'}});
  assert.equal(blockedMap.status,409,'Map attached to an event must not be deleted');
  const deleteEvent=await api('/api/admin/delete',{method:'POST',cookie:register.cookie,body:{id:extraEventId,entity:'event'}});
  assert.equal(deleteEvent.status,200,JSON.stringify(deleteEvent.data));
  const deletedMenu=await api('/api/admin/event-products?event_id='+extraEventId,{cookie:register.cookie});
  assert.deepEqual(deletedMenu.data.items,[]);
  const deleteMap=await api('/api/admin/delete',{method:'POST',cookie:register.cookie,body:{id:mapId,entity:'map'}});
  assert.equal(deleteMap.status,200,JSON.stringify(deleteMap.data));
  const deleteVenue=await api('/api/admin/delete',{method:'POST',cookie:register.cookie,body:{id:venueId,entity:'venue'}});
  assert.equal(deleteVenue.status,200,JSON.stringify(deleteVenue.data));
  const deleteProduct=await api('/api/admin/delete-product',{method:'POST',cookie:register.cookie,body:{id:extraProduct.id}});
  assert.equal(deleteProduct.status,200,JSON.stringify(deleteProduct.data));
  assert.ok(!(await api('/api/admin/venues',{cookie:register.cookie})).data.items.some(x=>x.id===venueId));
  assert.ok(!(await api('/api/admin/maps',{cookie:register.cookie})).data.items.some(x=>x.id===mapId));
  assert.ok(!(await api('/api/admin/events',{cookie:register.cookie})).data.items.some(x=>x.id===extraEventId));
  assert.ok(!(await api('/api/admin/products',{cookie:register.cookie})).data.items.some(x=>x.id===extraProduct.id));

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
