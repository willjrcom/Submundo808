import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readMapDraft,persistMapDraft,removeMapDraft} from '../artifacts/submundo-808/src/components/map-edit-draft.ts';

const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const editor=source('artifacts/submundo-808/src/components/admin-map-workspace.tsx');
const backend=source('server/index.mjs');
const storage=()=>{
 const values=new Map();
 return {
  values,
  getItem:key=>values.get(key)??null,
  setItem:(key,value)=>{values.set(key,value);},
  removeItem:key=>values.delete(key)
 };
};

test('an unpublished map survives a remount and is isolated per map',()=>{
 const st=storage();
 const snapshot={areas:[{id:'room-1',name:'Pista',x:10,y:20,width:35,height:30}],
  markers:[{id:'bar',name:'Bar',x:25,y:30}],frame:{x:5,y:10,width:90,height:80}};
 assert.equal(persistMapDraft('map-1',snapshot,st),true);
 const recovered=readMapDraft('map-1',st);
 assert.deepEqual(recovered.areas,snapshot.areas);
 assert.deepEqual(recovered.markers,snapshot.markers);
 assert.deepEqual(recovered.frame,snapshot.frame);
 assert.equal(readMapDraft('map-2',st),null);
 assert.equal(removeMapDraft('map-1',st),true);
 assert.equal(readMapDraft('map-1',st),null);
});
test('expired, malformed and oversized drafts are never restored',()=>{
 const st=storage();
 assert.equal(persistMapDraft('m',{areas:[],markers:[],frame:{x:0}},st),true);
 const k=[...st.values.keys()][0];
 const raw=JSON.parse(st.values.get(k));
 st.values.set(k,JSON.stringify({...raw,updatedAt:Date.now()-15*24*60*60*1000}));
 assert.equal(readMapDraft('m',st),null);
 st.values.set(k,'{malformed');
 assert.equal(readMapDraft('m',st),null);
 st.values.set(k,'x'.repeat(2_000_001));
 assert.equal(readMapDraft('m',st),null);
});
test('blocked browser storage is safe and reports inability to persist',()=>{
 const blocked={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');},removeItem:()=>{throw Error('denied');}};
 assert.equal(readMapDraft('map',blocked),null);
 assert.equal(persistMapDraft('map',{areas:[],markers:[],frame:{}},blocked),false);
 assert.equal(removeMapDraft('map',blocked),false);
});
test('missing icon import cannot crash React when format panel renders',()=>{
 assert.match(editor,/Grid3X3,X,AlertTriangle\s*\}\s*from 'lucide-react'/);
 assert.match(editor,/<X size=\{16\}\/>/);
 assert.match(editor,/role="alert"[\s\S]*?rascunho local/);
});
test('selected rooms move by dragging and resize via handles without a mode menu',()=>{
 assert.match(editor,/setSelected\(selected===id\?'':id\)/);
 assert.match(editor,/setEditLayout\(selecting\);setFrameEditing\(false\)/);
 assert.match(editor,/setResizeId\(selecting&&areas\.some\(a=>a\.id===id\)\?id:null\)/);
 assert.match(editor,/onPointerDown=\{e=>startDrag\(e,a\.id,'area'\)\}/);
 assert.match(editor,/outerResizeHandles\(areas,a\.id\)\.map\(handle=>/);
 assert.match(editor,/onPointerDown=\{e=>startDrag\(e,handle\.areaId,'resize',handle\.edge\)\}/);
 assert.match(editor,/resizeOuterGroupEdge\(d\.snapshot\.areas/);
 assert.doesNotMatch(editor,/if\(kind==='area'&&resizeId===id\)return/);
 assert.doesNotMatch(editor,/Concluir movimento|Concluir redimensionamento/);
 const menu=editor.slice(editor.indexOf('{editMenuOpen&&<div role="menu"'),editor.indexOf('</div>}',editor.indexOf('{editMenuOpen&&<div role="menu"')));
 assert.match(menu,/> Agrupar<\/button>|> Desagrupar<\/button>/);
 assert.match(menu,/Formato<\/button>/);
 assert.doesNotMatch(menu,/> Mover<\/button>|> Redimensionar<\/button>/);
});
test('the Edit menu closes on outside pointer click and Escape',()=>{
 assert.match(editor,/ref=\{editMenuRef\}/);
 assert.match(editor,/editMenuRef\.current\?\.contains\(event\.target\)/);
 assert.match(editor,/document\.addEventListener\('pointerdown',outside\)/);
 assert.match(editor,/document\.removeEventListener\('pointerdown',outside\)/);
 assert.match(editor,/event\.key==='Escape'&&editMenuOpen/);
});
test('failed saves keep a local draft; only confirmed saves or discards clear it',()=>{
 assert.match(editor,/persistMapDraft\(map\.id,\{areas,markers,frame\}\)/);
 assert.match(editor,/readMapDraft<Area,Marker,MapFrame>\(map\.id\)/);
 assert.match(editor,/editRevision\.current===revisionAtStart/);
 assert.match(editor,/As alterações continuam no editor e no rascunho local/);
 assert.match(editor,/setDraftUnavailable\(!ok\)/);
 assert.match(backend,/db\.exec\('BEGIN'\)/);
 assert.match(backend,/db\.exec\('ROLLBACK'\)/);
 assert.match(backend,/db\.exec\('COMMIT'\)/);
});
