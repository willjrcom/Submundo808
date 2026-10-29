import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {updateEventExtras} from '../server/event-edit-extras.mjs';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE events (id TEXT PRIMARY KEY, doors_at TEXT NOT NULL DEFAULT '', cover_image TEXT NOT NULL DEFAULT '', services TEXT NOT NULL DEFAULT '')");
 db.prepare("INSERT INTO events (id,doors_at,cover_image,services) VALUES (?,?,?,?)").run('e1','2026-11-06T20:00','data:image/jpeg;base64,original','Chapelaria');
 return db;
}
test('editar evento persiste abertura dos portões, capa e serviços e recupera os três campos',()=>{
 const db=fixture();
 try{
  const values=updateEventExtras(db,'e1',{doors_at:'2026-11-06T21:00',cover_image:'data:image/jpeg;base64,nova',services:'Posto médico e chapelaria'});
  assert.deepEqual(({...db.prepare('SELECT doors_at,cover_image,services FROM events WHERE id=?').get('e1')}),values);
 }finally{db.close();}
});
test('editar evento preserva campos omitidos por clientes antigos e permite apagar valores intencionalmente',()=>{
 const db=fixture();
 try{
  updateEventExtras(db,'e1',{doors_at:'2026-11-06T22:00'});
  assert.deepEqual(({...db.prepare('SELECT doors_at,cover_image,services FROM events WHERE id=?').get('e1')}),{
   doors_at:'2026-11-06T22:00',cover_image:'data:image/jpeg;base64,original',services:'Chapelaria'
  });
  updateEventExtras(db,'e1',{cover_image:'',services:''});
  assert.deepEqual(({...db.prepare('SELECT doors_at,cover_image,services FROM events WHERE id=?').get('e1')}),{
   doors_at:'2026-11-06T22:00',cover_image:'',services:''
  });
 }finally{db.close();}
});
test('as rotas de criar e editar evento usam a mesma persistência para dados extras',()=>{
 const src=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
 const calls=src.match(/updateEventExtras\(db,id,b\);/g)||[];
 assert.equal(calls.length,2,'Criar e editar devem persistir os mesmos campos');
 const front=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-editors.tsx',import.meta.url),'utf8');
 for(const field of ['doors_at:doors','cover_image:cover','services,meaple_event_id'])assert.ok(front.includes(field),'O formulário precisa enviar '+field);
});
