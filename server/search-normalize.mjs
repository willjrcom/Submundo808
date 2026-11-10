/** Case- and accent-insensitive search; original text remains unchanged. */
export function normalizeSearch(value=''){
 return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
}
export function matchesSearch(values,query){
 const term=normalizeSearch(query);
 return !term||values.some(value=>normalizeSearch(value??'').includes(term));
}
