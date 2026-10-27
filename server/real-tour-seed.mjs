import {DEMO_EVENT_NAME} from './demo-seed.mjs';
import {SHOWCASE_EVENTS} from './demo-showcase.mjs';
// Agenda oficial consultada em 27/10/2026: https://meaple.com.br/808
// Snapshot intencional: sem scraping em runtime, sem inventar horários de DJs ou mapas.
// AUTO_SEED_DEMO=true cria apenas os registros ausentes, preservando edições existentes.
export const REAL_808_TOUR=[
  {
    "id": "brasilia-2026-10-31",
    "name": "SUBMUNDO 808 BRASÍLIA",
    "date": "2026-10-31",
    "start": "20:00",
    "end": "06:00",
    "venue": "Arena Mané Garrincha",
    "city": "Brasília - DF",
    "address": "Eixo Monumental - SRPN - Asa Norte, Brasília - DF, 70070-701, Brasil",
    "url": "https://meaple.com.br/808/submundo-808-brasilia-df",
    "djs": []
  },
  {
    "id": "bauru-2026-11-06",
    "name": "SUBMUNDO 808 BAURU",
    "date": "2026-11-06",
    "start": "20:00",
    "end": "06:00",
    "venue": "Garden Eventos Bauru",
    "city": "Bauru - SP",
    "address": "R. Quatro, 425 - Jardim Santos Dumont, Bauru - SP, Brasil",
    "url": "https://meaple.com.br/808/submundo-808-bauru-sp",
    "djs": [
      "LETTS",
      "PETRUS",
      "CHRISTOPHER LUZ",
      "MEGABAILE DO AREIAS",
      "COLOMBO",
      "ALEXIA",
      "BRUQ",
      "YURI DIMC",
      "MARIA MÁQUINA",
      "TRAVADRAKE"
    ]
  },
  {
    "id": "sorocaba-2026-11-07",
    "name": "SUBMUNDO 808 SOROCABA",
    "date": "2026-11-07",
    "start": "20:00",
    "end": "06:00",
    "venue": "Uzna",
    "city": "Sorocaba - SP",
    "address": "Av. Liberdade, 5005 - Éden, Sorocaba - SP, 18087-170, Brasil",
    "url": "https://meaple.com.br/808/submundo-808-sorocaba-sp",
    "djs": [
      "KENAN E KEL",
      "TRESK",
      "PETRUS",
      "BIBI B2B AYLA",
      "CHRISTOPHER LUZ",
      "GBR",
      "MU540",
      "CLANDESTINA",
      "JOÃO MARCONEX",
      "DIGDIN",
      "SHAY",
      "BLACKAT",
      "NOVIN",
      "D.SILVESTRE"
    ]
  },
  {
    "id": "porto-alegre-2026-11-14",
    "name": "SUBMUNDO 808 PORTO ALEGRE",
    "date": "2026-11-14",
    "start": "20:00",
    "end": "06:00",
    "venue": "KTO Arena",
    "city": "Porto Alegre - RS",
    "address": "Av. Severo Dullius, 1995 - Anchieta, Porto Alegre - RS, 90200-310, Brasil",
    "url": "https://meaple.com.br/808/submundo-808-porto-alegre",
    "djs": [
      "TH4YS",
      "MARTINELLI",
      "TRESK",
      "BASSAN",
      "DELAZARI B2B CAIOBA",
      "DAY DO CARMO",
      "SALIM",
      "KESSEL",
      "BADDIE LOMA",
      "DANNA B2B COPPETTI",
      "MALONE B2B BRUNIN TKS",
      "D.SILVESTRE",
      "KINHO"
    ]
  },
  {
    "id": "fortaleza-2026-11-19",
    "name": "SUBMUNDO 808 FORTALEZA",
    "date": "2026-11-19",
    "start": "20:00",
    "end": "06:00",
    "venue": "Dragão Hall",
    "city": "Fortaleza - CE",
    "address": "R. Almirante Jaceguai, 19 - Centro, Fortaleza - CE, 60060-210, Brasil",
    "url": "https://meaple.com.br/808/submundo-808-fortaleza",
    "djs": [
      "KENAN E KEL",
      "CLEI",
      "TRESK",
      "NOVIN",
      "BABITA",
      "NANDI",
      "LETTS",
      "ELK",
      "RAFAEL ROSA",
      "CARINA",
      "YURI DIMC",
      "LOLOST B2B DDZIN"
    ]
  },
  {
    "id": "sao-jose-dos-campos-2026-11-21",
    "name": "SUBMUNDO 808 SÃO JOSÉ DOS CAMPOS",
    "date": "2026-11-21",
    "start": "20:00",
    "end": "06:00",
    "venue": "Palácio Sunset",
    "city": "São José dos Campos - SP",
    "address": "R. Dr. Pedro Luiz de Oliveira Costa, 1152 - Jardim Limoeiro, São José dos Campos - SP, 12241-430, Brasil",
    "url": "https://meaple.com.br/808/submundo-808-sao-jose-dos-campos-sp",
    "djs": [
      "TORMENTA",
      "RAMEMES",
      "BLAKES",
      "MAGIA",
      "RUGAL",
      "LETTS",
      "HALC",
      "RAY",
      "RD DA DZ7",
      "DIGDIN",
      "CHAKAL",
      "LÉO DA 17"
    ]
  },
  {
    "id": "vitoria-2026-11-28",
    "name": "SUBMUNDO 808 VITÓRIA",
    "date": "2026-11-28",
    "start": "20:00",
    "end": "06:00",
    "venue": "Cafe de La Musique Vila Velha",
    "city": "Vila Velha - ES",
    "address": "Av. Est. José Júlio de Souza, 310 - Itaparica, Vila Velha - ES, 29103-865, Brasil",
    "url": "https://meaple.com.br/808/submundo-808-vitoria",
    "djs": []
  },
  {
    "id": "festival-sao-paulo-2026-12-12",
    "name": "FESTIVAL SUBMUNDO 808",
    "date": "2026-12-12",
    "start": "16:00",
    "end": "05:00",
    "venue": "Neo Química Arena",
    "city": "São Paulo - SP",
    "address": "Av. Sport Club Corinthians Paulista, 3158 - Itaquera, São Paulo - SP, Brasil",
    "url": "https://meaple.com.br/808/festival-submundo-808-sp",
    "djs": [
      "KENAN E KEL",
      "TRESK",
      "CLEI",
      "MU540",
      "NOVIN",
      "CLEMENTAUM",
      "PETRUS",
      "GP DA ZL",
      "TH4YS",
      "CHRISTOPHER LUZ",
      "CAIO PRINCE",
      "D. SILVESTRE",
      "MAJESTADE BABILÔNIA",
      "LETTS",
      "RAMEMES",
      "PLEBEU B2B GABREULS",
      "CLANDESTINA B2B YURI DIMC",
      "LÉO DA 17",
      "HALC PART. MC ZL",
      "BASSAN",
      "DEEKAPZ",
      "RAY B2B RD DA DZ7",
      "WESLEY GONZAGA",
      "ADAME B2B TTOTEN",
      "LARA SANCHES B2B THR",
      "PABLO RB B2B NATHAN RV",
      "BRUNO PRADO",
      "CAISNIARA",
      "VICTOR LOU",
      "KEU B2B JLZ",
      "PÉTALA B2B LAVS",
      "BRUM B2B DAY DO CARMO",
      "MISSIATTO",
      "RAFAEL ROSA",
      "BADSISTA",
      "ALÍRIO",
      "KAIM B2B MAVI",
      "GAB B2B KOHURU",
      "CHEDIAK",
      "TRINDADE",
      "RUGAL",
      "SATI MARCONEX",
      "PEDRO BALA B2B JEJE DA ZS",
      "DOROM B2B PEDRO NEVES",
      "GUSS",
      "MAGIA",
      "THIAGO MARTINS",
      "RAFINHA DZ7 B2B MUTTLEY",
      "TORMENTA",
      "IRMÃOS METRALHA",
      "ALEXIA B2B TURIN",
      "FRESHPRINCEDABAHIA",
      "BLACKAT",
      "+ 1 BAILE (ADK, MATTX, THIBARÃO E BRABA DA NBR)",
      "RITMO DELAS (ADRY, FRANZONI E AMETISTA)",
      "OS MENINO DA UMBRELLA"
    ]
  }
];

function followingDay(date){
 const d=new Date(date+'T12:00:00Z');
 d.setUTCDate(d.getUTCDate()+1);
 return d.toISOString().slice(0,10);
}
// Remove da agenda pública somente registros fictícios intactos da antiga POC.
// Não exclui eventos, locais, mapas nem registros personalizados e não repete
// a arquivação caso o administrador republique algo posteriormente.
function archiveUnmodifiedLegacyEvents(db){
 db.exec('CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 const key='real_tour_v1_archived_legacy_examples';
 if(db.prepare('SELECT 1 FROM app_settings WHERE key=?').get(key))return 0;
 let archived=0;
 const legacyId=db.prepare('SELECT value FROM app_settings WHERE key=?').get('default_demo_event_id')?.value;
 if(legacyId){
  const r=db.prepare("UPDATE events SET is_published=0 WHERE id=? AND name=? AND tickets_url='' AND is_published=1").run(legacyId,DEMO_EVENT_NAME);
  archived+=r.changes||0;
 }
 for(const example of SHOWCASE_EVENTS){
  const r=db.prepare("UPDATE events SET is_published=0 WHERE id=? AND name=? AND tickets_url='' AND is_published=1").run('poc-v2-event-'+example.slug,example.name);
  archived+=r.changes||0;
 }
 db.prepare('INSERT OR IGNORE INTO app_settings(key,value) VALUES(?,?)').run(key,'1');
 return archived;
}
export function ensureRealTourDemo(db){
 const legacyArchived=archiveUnmodifiedLegacyEvents(db);
 let venuesAdded=0,eventsAdded=0,eventsExisting=0;
 db.exec('BEGIN');
 try{
 for(const e of REAL_808_TOUR){
  const venueId='meaple-808-venue-'+e.id;
  const eventId='meaple-808-event-'+e.id;
  const sourceId=e.url.split('/').at(-1);
  const existing=db.prepare('SELECT id FROM events WHERE id=? OR tickets_url=? OR meaple_event_id=? LIMIT 1').get(eventId,e.url,sourceId);
  if(existing){eventsExisting++;continue;}
  let venue=db.prepare('SELECT id FROM venues WHERE id=? OR (lower(name)=lower(?) AND lower(city)=lower(?)) LIMIT 1').get(venueId,e.venue,e.city);
  if(!venue){
   db.prepare('INSERT INTO venues(id,name,address,city,created_at) VALUES(?,?,?,?,?)').run(venueId,e.venue,e.address,e.city,Date.now());
   venue={id:venueId};venuesAdded++;
  }
  const starts=e.date+'T'+e.start;
  const ends=(e.end<=e.start?followingDay(e.date):e.date)+'T'+e.end;
  const description='Edição oficial da Submundo 808 em '+e.city+'. Confira a programação, as informações e os ingressos na página oficial da Meaple.';
  const lineup=e.djs.map(nome=>({nome}));
  const doors=e.id.startsWith('festival-')?'':starts;
  db.prepare('INSERT INTO events(id,venue_id,name,description,starts_at,ends_at,site_url,tickets_url,instagram_url,lineup_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(
   eventId,venue.id,e.name,description,starts,ends,'https://meaple.com.br/808',e.url,'',JSON.stringify(lineup),Date.now()
  );
  db.prepare('UPDATE events SET meaple_event_id=?,doors_at=?,is_published=1,location_sharing_enabled=0 WHERE id=?').run(sourceId,doors,eventId);
  eventsAdded++;
 }
 db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return {eventsAdded,eventsExisting,venuesAdded,legacyArchived,total:REAL_808_TOUR.length};
}
