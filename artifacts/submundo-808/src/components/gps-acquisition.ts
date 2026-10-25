// Uma tentativa explícita e com prazo definido de obter a primeira posição.
// IMPORTANTE: chamar startInitialGps diretamente no onClick, ANTES de await/fetch.
// Chrome/Android decide se mostra o prompt; a aplicação não pode forçá-lo quando
// a permissão está bloqueada ou já foi concedida.
export const GPS_STARTUP_TIMEOUT_MS=24000;
export type GpsAcquisitionError={code:number;message?:string};
type GeolocationProvider=Pick<Geolocation,'getCurrentPosition'>;
type CallbackOptions={
 onSuccess:(position:GeolocationPosition)=>void;
 onError:(error:GpsAcquisitionError)=>void;
};
export function gpsErrorText(error:GpsAcquisitionError):string{
 switch(error.code){
  case 1:return 'Localização bloqueada. Abra as permissões deste site no navegador e selecione Permitir. Confira também a permissão de localização do navegador no Android.';
  case 2:return 'O Android não conseguiu determinar sua posição. Confira se a localização do aparelho está ligada e tente em um local com sinal.';
  case 3:return 'O GPS demorou para responder. Confira a localização do Android e toque em Ativar localização para tentar novamente.';
  default:return 'Não foi possível iniciar a localização neste aparelho.';
 }
}
export function startInitialGps(
 geolocation:GeolocationProvider,
 callbacks:CallbackOptions,
 schedule:Pick<typeof globalThis,'setTimeout'|'clearTimeout'>=globalThis
):()=>void{
 let completed=false;
 let timer:ReturnType<typeof setTimeout>|null=null;
 const finish=()=>{completed=true;if(timer!==null){schedule.clearTimeout(timer);timer=null;}};
 timer=schedule.setTimeout(()=>{
  if(completed)return;
  finish();
  callbacks.onError({code:3,message:'Tempo limite de aquisição de GPS'});
 },GPS_STARTUP_TIMEOUT_MS);
 try{
  geolocation.getCurrentPosition(
   position=>{if(completed)return;finish();callbacks.onSuccess(position);},
   error=>{if(completed)return;finish();callbacks.onError(error);},
   // A primeira localização usa também rede/Wi-Fi, útil em locais fechados.
   // O rastreamento contínuo posterior solicita maior precisão ao sistema.
   {enableHighAccuracy:false,maximumAge:0,timeout:15000}
  );
 }catch(error){
  if(!completed){finish();callbacks.onError({code:0,message:String(error)});}
 }
 return ()=>{if(!completed)finish();};
}
