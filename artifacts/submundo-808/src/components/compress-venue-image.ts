/** Compress venue images before sending them to the JSON API (max body 200 kB). */
export async function compressVenueImage(file:File,kind:'cover'|'logo'):Promise<string>{
 if(file.size>6_000_000)throw Error('Selecione uma imagem de até 6 MB.');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Use uma imagem JPEG, PNG ou WebP.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Imagem inválida.'));image.src=url;});
  const limit=kind==='cover'?95000:45000;
  const maxWidth=kind==='cover'?1100:256,maxHeight=kind==='cover'?500:256;
  for(const factor of [1,.82,.68,.55]){
   const scale=Math.min(1,maxWidth/image.width,maxHeight/image.height)*factor;
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.width*scale));
   canvas.height=Math.max(1,Math.round(image.height*scale));
   const context=canvas.getContext('2d');
   if(!context)throw Error('Não foi possível processar a imagem.');
   context.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of [.78,.62,.48]){
    const data=canvas.toDataURL('image/jpeg',quality);
    if(data.length<=limit)return data;
   }
  }
  throw Error('A imagem ainda está grande. Escolha outra foto.');
 }finally{URL.revokeObjectURL(url);}
}
