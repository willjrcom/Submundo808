// Tour imports and older venues may store the full address without its structured fields.
type VenueAddressRecord={address?:string;city?:string;postal_code?:string;street?:string;neighborhood?:string};
export function venueLocation(item:VenueAddressRecord|null){
 const full=(item?.address||'').trim();
 const city=(item?.city||'').trim();
 const cityOffset=city?full.toLocaleLowerCase('pt-BR').lastIndexOf((', '+city).toLocaleLowerCase('pt-BR')):-1;
 const streetAndDistrict=cityOffset>=0?full.slice(0,cityOffset).trim():'';
 const districtOffset=streetAndDistrict.lastIndexOf(' - ');
 const inferredStreet=districtOffset>=0?streetAndDistrict.slice(0,districtOffset).trim():streetAndDistrict;
 const inferredDistrict=districtOffset>=0?streetAndDistrict.slice(districtOffset+3).trim():'';
 const inferredPostal=full.match(/\b\d{5}-?\d{3}\b/)?.[0]||'';
 return {
  postalCode:item?.postal_code||inferredPostal,
  street:item?.street||inferredStreet,
  neighborhood:item?.neighborhood||inferredDistrict
 };
}
export function completeVenueAddress(street:string,neighborhood:string,city:string,postalCode:string,previous:string){
 if(!street.trim())return previous;
 const country=previous.match(/,\s*(Brasil|Brazil)\s*$/i)?.[1]||'';
 return [street.trim()+(neighborhood.trim()?' - '+neighborhood.trim():''),city.trim(),postalCode.trim(),country].filter(Boolean).join(', ');
}
