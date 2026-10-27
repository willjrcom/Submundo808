import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readHealth} from '../server/health.mjs';

test('health check responde ok quando a conexão SQLite está operacional',()=>{
 const db=new DatabaseSync(':memory:');
 try{assert.deepEqual(readHealth(db),{ok:true});}
 finally{db.close();}
});
test('health check falha sem vazar informação do banco',()=>{
 const db=new DatabaseSync(':memory:');db.close();
 assert.deepEqual(readHealth(db),{ok:false});
});
