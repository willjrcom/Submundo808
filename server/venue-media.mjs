// Store small compressed photos inline; reject arbitrary URLs and oversized content.
const VALID_IMAGE=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export function venueMediaFields(payload={},current={}){
 const result={};
 for(const [key,maxLength] of [['cover_image',100000],['logo_image',50000]]){
  const value=payload[key]===undefined?current[key]||'':payload[key];
  if(typeof value!=='string'||value.length>maxLength||(value!==''&&!VALID_IMAGE.test(value)))
   throw Error('Imagem do estabelecimento inválida ou muito grande.');
  result[key]=value;
 }
 return result;
}
