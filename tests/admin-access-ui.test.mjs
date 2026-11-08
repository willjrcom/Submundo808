import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shell=read('artifacts/submundo-808/src/components/admin-shell.tsx');
const route=read('artifacts/submundo-808/src/components/admin-route.ts');
const component=read('artifacts/submundo-808/src/components/admin-admins.tsx');
const backend=read('server/index.mjs');

test('gerenciamento de administradores usa a navegação existente',()=>{
 assert.match(route,/'Administradores':'\/admins'/);
 assert.match(route,/administradores:'Administradores',admins:'Administradores'/);
 assert.match(shell,/\{name:'Administradores',Icon:Users\}/);
 assert.match(shell,/section==='Administradores'&&<AdminAdmins currentUserId=\{user\.id\}\/>/);
 assert.match(shell,/'administradores','admins'/);
});

test('CRUD tem modal para criar, editar, revogar e assumir propriedade',()=>{
 for(const word of ['Novo admin','Criar administrador','Editar administrador','Revogar acesso','Assumir propriedade','Ver histórico de alterações','Pesquisar por nome','Copiar credenciais']){
  assert.ok(component.includes(word),word);
 }
 assert.match(component,/role="dialog" aria-modal="true"/);
 assert.match(component,/dialog==='create'/);
 assert.match(component,/dialog==='edit'/);
 assert.match(component,/dialog==='revoke'/);
 assert.match(component,/dialog==='bootstrap'/);
 assert.match(component,/role==='owner'/);
 assert.match(component,/onClick=\{\(\)=>open\('create'\)\}/);
 assert.match(component,/const isOwner=state\?\.role==='owner'/);
 assert.match(component,/disabled=\{item\.role==='owner'&&state\.ownerCount<=1\}/);
});

test('interface preserva conta de usuário e não divulga credenciais em histórico',()=>{
 assert.match(component,/A conta pessoal e seus dados serão mantidos/);
 assert.match(component,/A pessoa perderá o acesso ao painel imediatamente/);
 assert.match(component,/created\.tempPassword/);
 assert.match(component,/tempPassword/);
 assert.doesNotMatch(component,/localStorage\.setItem/);
 assert.match(component,/\/api\/admin\/admins/);
 assert.match(component,/\/api\/admin\/admins-search/);
 assert.match(component,/\/api\/admin\/admins-audit/);
 assert.match(backend,/ensureAdminAccessSchema\(db\)/);
 assert.match(backend,/adminRole:adminRole\(db,user\.id\)/);
 assert.match(backend,/handleAdminAccess/);
});
