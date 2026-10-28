// Fixtures deliberately fictitious for the REAL event listings.
// These are NOT the venue's real floorplans, vendors, prices or emergency directions.
// Each event is provisioned only once, without touching manually edited maps/menus.
export const TOUR_DEMO_MENU=[
 {slug:'agua',name:'Água mineral 500 ml',category:'Bebidas',price:700},
 {slug:'refri',name:'Refrigerante 350 ml',category:'Bebidas',price:1000},
 {slug:'energetico',name:'Energético lata',category:'Bebidas',price:1800},
 {slug:'cerveja',name:'Cerveja lata',category:'Bebidas',price:1500},
 {slug:'suco',name:'Suco de fruta',category:'Bebidas',price:1400},
 {slug:'gin',name:'Gin tônica',category:'Drinks',price:3200},
 {slug:'caipirinha',name:'Caipirinha',category:'Drinks',price:2800},
 {slug:'drink',name:'Drink da casa',category:'Drinks',price:3000},
 {slug:'hamburguer',name:'Hambúrguer',category:'Comidas',price:3400},
 {slug:'batata',name:'Batata frita',category:'Comidas',price:2500},
 {slug:'hotdog',name:'Cachorro-quente',category:'Comidas',price:2000},
 {slug:'vegetariano',name:'Lanche vegetariano',category:'Comidas',price:2900}
];
const MENU_NOTE='DEMONSTRAÇÃO: produto, disponibilidade e preço ilustrativos; não é o cardápio oficial.';
export const TOUR_DEMO_MAP_NAME='DEMO — Planta ilustrativa, NÃO é o mapa real';
const MAP_NOTE='DEMONSTRAÇÃO: posição ilustrativa; NÃO use para localização, entrada ou segurança real.';
const MAP_AREAS=[
 {name:'Pista ilustrativa',kind:'pista',x:0,y:0,width:75,height:100,color:'#3B82F6',icon:'pista'},
 {name:'Área VIP ilustrativa',kind:'vip',x:75,y:0,width:25,height:60,color:'#9747FF',icon:'vip'},
 {name:'Lounge ilustrativo',kind:'descanso',x:75,y:60,width:25,height:40,color:'#00BDD6',icon:'descanso'}
];
const MAP_MARKERS=[
 {name:'Palco (DEMO)',type:'palco',x:40,y:0,anchor:{side:'top',offset:40},shape:'square',size:42},
 {name:'Entrada (DEMO)',type:'entrada',x:50,y:100,anchor:{side:'bottom',offset:50},shape:'square',size:42},
 {name:'Bar principal (DEMO)',type:'bar',x:17,y:55,categories:['Bebidas','Drinks'],shape:'square',size:42},
 {name:'Banheiros (DEMO)',type:'banheiro',x:92,y:52,shape:'square',size:42},
 {name:'Alimentação (DEMO)',type:'alimentacao',x:59,y:79,categories:['Comidas'],shape:'square',size:42},
 {name:'Bar secundário (DEMO)',type:'bar',x:81,y:84,categories:['Bebidas'],shape:'square',size:42}
];
export function ensureRealTourDemoAssets(db,eventId,venueId,now=Date.now()){
 db.exec('CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const key='meaple808-demo-assets-v1:'+eventId;
 if(db.prepare('SELECT 1 FROM app_settings WHERE key=?').get(key))return {created:false,mapsAdded:0,productsLinked:0};
 const mapId='meaple-808-demo-map-'+eventId.replace(/^meaple-808-event-/,'');
 let mapsAdded=0,productsLinked=0;
 const existingMaps=db.prepare('SELECT 1 FROM event_maps WHERE event_id=? LIMIT 1').get(eventId);
 if(!existingMaps){
  // Map belongs to the real venue, but its schematic is explicitly fictitious.
  const exists=db.prepare('SELECT id FROM venue_maps WHERE id=?').get(mapId);
  if(!exists){
   db.prepare('INSERT INTO venue_maps(id,venue_id,name,created_at) VALUES(?,?,?,?)').run(mapId,venueId,TOUR_DEMO_MAP_NAME,now);
   const stmt=db.prepare('INSERT INTO map_areas(id,map_id,name,kind,x,y,width,height,color,icon,description) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
   for(const [i,a] of MAP_AREAS.entries())stmt.run(mapId+'-area-'+i,mapId,a.name,a.kind,a.x,a.y,a.width,a.height,a.color,a.icon,MAP_NOTE);
   db.prepare('INSERT INTO map_markers(map_id,markers_json) VALUES(?,?)').run(mapId,JSON.stringify(MAP_MARKERS.map((m,i)=>({...m,id:mapId+'-point-'+i,description:MAP_NOTE}))));
   mapsAdded++;
  }
  if(db.prepare('SELECT venue_id FROM venue_maps WHERE id=?').get(mapId)?.venue_id===venueId){
   db.prepare('INSERT OR IGNORE INTO event_maps(event_id,map_id) VALUES(?,?)').run(eventId,mapId);
  }
 }
 const hasMenu=db.prepare('SELECT 1 FROM event_products WHERE event_id=? LIMIT 1').get(eventId);
 if(!hasMenu){
  for(const p of TOUR_DEMO_MENU){
   const id='meaple-808-demo-product-'+p.slug;
   if(!db.prepare('SELECT 1 FROM products WHERE id=?').get(id)){
    db.prepare('INSERT INTO products(id,name,description,category,default_price_cents,created_at) VALUES(?,?,?,?,?,?)').run(id,p.name,MENU_NOTE,p.category,p.price,now);
   }
   db.prepare('INSERT OR IGNORE INTO event_products(event_id,product_id,price_cents) VALUES(?,?,?)').run(eventId,id,p.price);
   productsLinked++;
  }
 }
 db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?)').run(key,'1');
 return {created:true,mapsAdded,productsLinked};
}
