/** Crops locally, compresses to WebP and keeps profile/group photos small enough for JSON storage. */
export async function optimizeAvatar(file:File,{size=320,maxChars=150000}:{size?:number;maxChars?:number}={}):Promise<string>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Escolha uma imagem JPG, PNG ou WebP.');
 if(file.size>8_000_000)throw Error('Escolha uma imagem de até 8 MB.');
 if(!file.size)throw Error('O arquivo está vazio.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Não foi possível abrir esta imagem.'));image.src=url;});
  const edge=Math.min(image.naturalWidth,image.naturalHeight);
  if(!edge)throw Error('Imagem inválida.');
  for(const dimension of [size,Math.min(size,256),192]){
   const canvas=document.createElement('canvas');canvas.width=dimension;canvas.height=dimension;
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Não foi possível preparar a imagem neste navegador.');
   ctx.drawImage(image,(image.naturalWidth-edge)/2,(image.naturalHeight-edge)/2,edge,edge,0,0,dimension,dimension);
   for(const quality of [0.78,0.66,0.54,0.42]){
    const data=canvas.toDataURL('image/webp',quality);
    if(!data.startsWith('data:image/webp;base64,'))throw Error('Este navegador não oferece compressão WebP.');
    if(data.length<=maxChars)return data;
   }
  }
  throw Error('Não foi possível reduzir esta foto ao limite permitido. Selecione outra imagem.');
 }finally{URL.revokeObjectURL(url);}
}
