import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresSync,postgresSql,parameterize,normalizePostgresRow} from '../server/postgres-sync.mjs';

test('parâmetros transformam ? em $1 sem substituir literais entre aspas',()=>{
 assert.deepEqual(parameterize("SELECT '?' AS mark, name FROM users WHERE id=? AND name='xx''?yy' AND email=?"),{
  sql:"SELECT '?' AS mark, name FROM users WHERE id=$1 AND name='xx''?yy' AND email=$2",
  parameters:2
 });
});
test('SQLite INSERT OR IGNORE e BEGIN IMMEDIATE ganham semântica PostgreSQL',()=>{
 assert.equal(postgresSql('INSERT OR IGNORE INTO friend_codes(token_hash,user_id,expires_at) VALUES(?,?,?)',{run:true}),
 'INSERT INTO friend_codes(token_hash,user_id,expires_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING 1 AS __changed');
 assert.equal(postgresSql('BEGIN IMMEDIATE'),'BEGIN');
 assert.equal(postgresSql('UPDATE notifications SET status=? WHERE id=?',{run:true}), 'UPDATE notifications SET status=$1 WHERE id=$2 RETURNING 1 AS __changed');
 assert.equal(postgresSql('CREATE TABLE foo(id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, lat REAL)',{ddl:true}),
 'CREATE TABLE foo(id TEXT PRIMARY KEY, created_at BIGINT NOT NULL, lat REAL)');
});
test('normalização preserva IDs, e-mails, CEP e converte apenas colunas numéricas',()=>{
 const row=normalizePostgresRow({id:'12345',user_id:'88',postal_code:'01800000',name:'808',created_at:'1790000000000',is_published:'0',recipients:'3',lat:'-23.5501',ok:'1',share_expires_at:null});
 assert.equal(row.id,'12345');assert.equal(row.user_id,'88');
 assert.equal(row.postal_code,'01800000');assert.equal(row.name,'808');
 assert.equal(row.created_at,1790000000000);assert.equal(row.is_published,0);
 assert.equal(row.recipients,3);assert.equal(row.lat,-23.5501);assert.equal(row.ok,1);
});
test('cliente síncrono mantém all/get/run/exec e count de DML',()=>{
 const history=[];
 class FakeClient{
  connectSync(url){history.push(['connect',url]);}
  querySync(sql,args){history.push([sql,args]);if(sql.startsWith('SELECT column_name'))return[{name:'id'},{name:'name'}];if(sql.startsWith('SELECT'))return[{created_at:'1790000000000',id:'uuid'}];if(sql.includes('RETURNING 1'))return[{__changed:1}];return [];}
  endSync(){history.push(['end']);}
 }
 const db=new PostgresSync('postgresql://localhost/test',{Client:FakeClient});
 assert.deepEqual(db.prepare('PRAGMA table_info(users)').all(),[{name:'id'},{name:'name'}]);
 assert.equal(db.prepare('SELECT * FROM users WHERE id=?').get('uuid').created_at,1790000000000);
 assert.equal(db.prepare('UPDATE users SET name=? WHERE id=?').run('test','uuid').changes,1);
 db.exec('BEGIN IMMEDIATE');db.exec('COMMIT');db.close();
 assert.ok(history.some(x=>x[0]==='BEGIN'));
 assert.ok(history.some(x=>x[0]==='COMMIT'));
 assert.equal(history.at(-1)[0],'end');
});
