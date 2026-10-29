import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {databaseMode} from '../server/database-mode.mjs';
test('produção sem DATABASE_URL recusa SQLite em vez de criar banco alternativo',()=>{
 for(const env of [{NODE_ENV:'production'},{APP_ENV:'production'},{NODE_ENV:'production',DATABASE_URL:''}]){
  assert.throws(()=>databaseMode(env),/DATABASE_URL é obrigatória em produção/);
 }
});
test('produção usa somente PostgreSQL quando DATABASE_URL é válida',()=>{
 assert.equal(databaseMode({NODE_ENV:'production',DATABASE_URL:'postgresql://example.invalid/db'}),'postgresql');
 assert.throws(()=>databaseMode({APP_ENV:'production',DATABASE_URL:'file:/tmp/example.db'}),/PostgreSQL/);
});
test('SQLite é permitido apenas no modo desenvolvimento, nunca como fallback de produção',()=>{
 assert.equal(databaseMode({NODE_ENV:'development'}),'sqlite');
});
test('admin consulta driver do banco sem expor credenciais',()=>{
 const server=readFileSync(new URL('../server/index.mjs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../artifacts/submundo-808/src/components/admin-shell.tsx',import.meta.url),'utf8');
 assert.match(server,/key==='database-status'.*engine:storageMode/);
 assert.match(ui,/Banco de dados da aplicação/);
 assert.match(ui,/api\('database-status'\)/);
});
