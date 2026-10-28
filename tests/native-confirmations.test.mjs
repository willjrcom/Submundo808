import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const appDir=fileURLToPath(new URL('../artifacts/submundo-808/src/',import.meta.url));
function source(path){return readFileSync(join(appDir,path),'utf8');}
function appFiles(dir){
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  if(entry.name==='ui'&&entry.isDirectory())return [];
  const path=join(dir,entry.name);
  return entry.isDirectory()?appFiles(path):/\.(?:tsx?|jsx?)$/.test(entry.name)?[path]:[];
 });
}

test('nenhuma tela usa confirm/alert/prompt nativos do navegador para ações do usuário',()=>{
 const native=/(?:\bwindow\s*\.\s*|\bglobalThis\s*\.\s*|\b)(?:confirm|alert)\s*\(/g;
 for(const path of appFiles(appDir)){
  const text=readFileSync(path,'utf8');
  assert.doesNotMatch(text,native,path.replace(appDir,''));
 }
 // The PWA installation prompt is an explicit browser API, not an
 // interchangeable confirmation dialog, and beforeunload cannot use a custom
 // modal due to browser restrictions.
});

test('editor de mapas exige confirmação em modal tanto para descartar quanto para sair',()=>{
 const s=source('components/admin-map-workspace.tsx');
 assert.match(s,/pendingDiscardAction,setPendingDiscardAction/);
 assert.match(s,/setPendingDiscardAction\('discard'\)/);
 assert.match(s,/setPendingDiscardAction\('leave'\)/);
 assert.match(s,/function confirmDiscardAction\(\)/);
 assert.match(s,/role="alertdialog" aria-modal="true" aria-labelledby="confirm-discard-title"/);
 assert.match(s,/Sair sem salvar o mapa\?/);
 assert.match(s,/Descartar alterações do mapa\?/);
 assert.match(s,/Continuar editando/);
 assert.match(s,/onClick=\{\(\)=>void confirmDiscardAction\(\)\}/);
 assert.match(s,/pendingDiscardAction==='leave'\)\{setPendingDiscardAction\(null\);onBack\(\)/);
 assert.match(s,/onClick=\{requestDiscard\}/);
 assert.match(s,/if\(event\.key==='Escape'&&pendingDiscardAction\)/);
});

test('remoções de amigos e integrantes continuam exigindo confirmação visual',()=>{
 const friends=source('components/friends.tsx');
 const groups=source('components/friend-groups.tsx');
 assert.match(friends,/friendToRemove&&<div role="presentation"/);
 assert.match(friends,/onClick=\{\(\)=>void confirmRemoveFriend\(\)\}/);
 assert.match(groups,/pendingMemberOperation/);
 assert.match(groups,/onClick=\{\(\)=>void confirmMemberOperation\(\)\}/);
});
