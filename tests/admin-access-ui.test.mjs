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
 assert.match(shell,/const knownAdminRoute=isKnownAdminPath\(currentPath\)/);
 assert.match(route,/administradores:'Administradores',admins:'Administradores'/);
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
 assert.match(component,/state\.bootstrapEligible/);
 assert.doesNotMatch(component,/<input type="password" autoComplete="current-password"/);
 assert.match(component,/role==='owner'/);
 assert.match(component,/onClick=\{\(\)=>open\('create'\)\}/);
 assert.match(component,/const isOwner=state\?\.role==='owner'/);
 assert.doesNotMatch(component,/onClick=\{\(\)=>open\('revoke',item\)\}/);
 assert.match(component,/disabled=\{busy\|\|\(selected\.role==='owner'&&state\?\.ownerCount===1\)\}/);
 assert.match(component,/onClick=\{\(\)=>open\('revoke',selected\)\}/);
 assert.match(component,/Confirmar exclusão/);
 assert.match(component,/Não é possível remover o último proprietário/);
});

test('interface preserva conta de usuário e não divulga credenciais em histórico',()=>{
 assert.match(component,/A conta pessoal e seus dados serão mantidos/);
 assert.match(component,/A pessoa perderá o acesso ao painel imediatamente/);
 assert.match(component,/created\.tempPassword/);
 assert.match(component,/tempPassword/);
 assert.doesNotMatch(component,/localStorage\.setItem/);
 assert.match(component,/\/api\/admin\/admins/);
 assert.match(component,/\/api\/admin\/admins-search/);
 assert.match(component,/adminApi<\{items:Log\[\]\}>\('admins-audit'\)/);
 assert.match(backend,/ensureAdminAccessSchema\(db\)/);
 assert.match(backend,/adminRole:adminRole\(db,user\.id\)/);
 assert.match(backend,/handleAdminAccess/);
});

test('listagem tem apenas Editar; excluir fica dentro de Editar administrador e exige confirmação',()=>{
 const listStart=component.indexOf('{filtered.length?filtered.map(item=>');
 const listEnd=component.indexOf('{state&&!isOwner&&state.ownerCount>0',listStart);
 assert.ok(listStart>0&&listEnd>listStart);
 const list=component.slice(listStart,listEnd);
 assert.match(list,/onClick=\{\(\)=>open\('edit',item\)\}/);
 assert.doesNotMatch(list,/open\('revoke',item\)/);
 assert.doesNotMatch(list,/<Trash2/);
 const editStart=component.indexOf("{dialog==='edit'&&<>");
 const editFooter=component.indexOf("<footer className=",editStart);
 assert.ok(editStart>0&&editFooter>editStart);
 const footer=component.slice(editFooter,component.indexOf('</footer>',editFooter));
 assert.match(footer,/dialog==='edit'&&selected&&<button/);
 assert.match(footer,/onClick=\{\(\)=>open\('revoke',selected\)\}/);
 assert.match(footer,/Excluir acesso/);
 assert.match(footer,/dialog==='revoke'\?'Confirmar exclusão'/);
 assert.doesNotMatch(footer,/Cancelar|ArrowLeft/);
 assert.match(component,/aria-label="Fechar modal"/);
 assert.match(component,/A conta pessoal e seus dados serão mantidos/);
});

test('UI esclarece que o proprietário herda o acesso operacional e gerencia outros administradores',()=>{
 assert.match(component,/Administrador: gerencia as operações do painel/);
 assert.match(component,/Proprietário: também pode criar, editar e revogar acessos administrativos/);
 assert.match(component,/selected\.role==='owner'&&state\?\.ownerCount===1/);
});
