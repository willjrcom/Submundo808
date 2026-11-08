// Runs after Vite: list the emitted participant shell files for PWA precaching.
// A real versioned asset list is needed because hashed JS/CSS filenames change.
import {readdir,stat,writeFile} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve(import.meta.dirname,'../dist/public');
const skip=new Set(['sw.js','offline-assets.json']);
const extensions=/\.(?:html|js|css|png|jpg|jpeg|webp|svg|woff2?|webmanifest|ico)$/i;
const collected=[];
async function walk(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const file=resolve(dir,entry.name);
  if(entry.isDirectory())await walk(file);
  else if(entry.isFile()&&!skip.has(entry.name)&&extensions.test(entry.name)){
   const size=(await stat(file)).size;
   // Skip oversized non-code media; do not consume all offline storage.
   if(size>5_000_000&&!/\.(?:js|css)$/i.test(entry.name))continue;
   collected.push('./'+relative(root,file).split(sep).join('/'));
  }
 }
}
await walk(root);
collected.sort();
if(!collected.includes('./index.html'))throw Error('Missing index.html in PWA build');
const version=createHash('sha256').update(collected.join('\n')).digest('hex').slice(0,12);
await writeFile(resolve(root,'offline-assets.json'),JSON.stringify({version,assets:['./',...collected]},null,2)+'\n');
console.info('[pwa] precache manifest '+version+' ('+collected.length+' assets)');
