/** Fluxos de permissões isolados para testes sem um navegador real. */
export function permissionFailure(feature,error){
 const code=Number(error?.code||0);
 const name=String(error?.name||'');
 const denied=code===1||name==='NotAllowedError'||name==='PermissionDeniedError'||name==='SecurityError';
 if(denied)return {denied:true,message:feature==='location'
  ?'A localização foi bloqueada. Toque em Como liberar para alterar a permissão nas configurações do dispositivo ou navegador.'
  :feature==='camera'?'A câmera foi bloqueada. Toque em Como liberar para permitir o acesso nas configurações do dispositivo ou navegador.'
  :'As notificações foram bloqueadas. Toque em Como liberar para ajustar a permissão no dispositivo ou navegador.'};
 if(feature==='location'&&(code===3||name==='TimeoutError'))return {denied:false,message:'O GPS demorou para localizar você. Vá para um local com sinal melhor e tente novamente.'};
 if(feature==='location'&&code===2)return {denied:false,message:'Não foi possível obter sua posição. Confira se a localização do celular está ativada e tente novamente.'};
 if(feature==='camera'&&(name==='NotFoundError'||name==='DevicesNotFoundError'))return {denied:false,message:'Nenhuma câmera foi encontrada neste dispositivo.'};
 if(feature==='camera'&&(name==='NotReadableError'||name==='TrackStartError'))return {denied:false,message:'A câmera está ocupada em outro aplicativo. Feche-o e tente novamente.'};
 if(name==='AbortError')return {denied:false,message:'A operação foi interrompida. Tente novamente.'};
 return {denied:false,message:error instanceof Error&&error.message?error.message:'Não foi possível concluir a operação. Verifique sua conexão e tente novamente.'};
}
export function requestGpsPosition(geolocation){
 if(!geolocation?.getCurrentPosition)throw new Error('GPS indisponível neste navegador. Confira as configurações do aparelho.');
 return new Promise((resolve,reject)=>geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:18000,maximumAge:0}));
}
export async function requestCameraAccess(mediaDevices){
 if(!mediaDevices?.getUserMedia)throw new Error('A câmera não está disponível neste navegador. Abra o site em HTTPS.');
 const stream=await mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
 try{return true;}
 finally{stream?.getTracks?.().forEach(track=>track.stop());}
}
function decodeVapidKey(base64,decode){
 const value=base64.replace(/-/g,'+').replace(/_/g,'/');
 const decoded=decode(value.padEnd(Math.ceil(value.length/4)*4,'='));
 return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
export async function registerPush({notification,serviceWorker,pushSupported,request,decode=atob}){
 if(!notification||!serviceWorker||!pushSupported)throw new Error('Notificações push indisponíveis neste navegador. No iPhone, instale o aplicativo na Tela de Início.');
 if(notification.permission==='denied')throw Object.assign(new Error('A permissão de notificações está bloqueada.'),{name:'NotAllowedError'});
 // Chamar diretamente no gesto do usuário (antes do primeiro await de rede) é
 // essencial para o Web Push no iOS instalado.
 const permission=notification.permission==='granted'?'granted':await notification.requestPermission();
 if(permission!=='granted'){
  if(permission==='denied')throw Object.assign(new Error('A permissão de notificações foi negada.'),{name:'NotAllowedError'});
  throw new Error('A autorização de notificações foi cancelada. Você pode tentar novamente quando quiser.');
 }
 const response=await request('/api/push/config',{credentials:'same-origin'});
 const config=await response.json();
 if(!response.ok)throw new Error(config?.error||'Não foi possível consultar a configuração de notificações.');
 if(!config?.enabled||!config.publicKey)throw new Error('As notificações ainda não foram configuradas neste servidor.');
 const registration=await Promise.race([
  serviceWorker.ready,
  new Promise((_,reject)=>setTimeout(()=>reject(new Error('O aplicativo demorou para preparar notificações. Reabra-o e tente novamente.')),12000))
 ]);
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(config.publicKey,decode)});
 const res=await request('/api/push/subscribe',{
  method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({subscription:subscription.toJSON()})
 });
 const value=await res.json();
 if(!res.ok)throw new Error(value?.error||'Não foi possível registrar o dispositivo para receber avisos.');
 return subscription;
}
export async function requestNativeInstallation(event){
 if(!event?.prompt)throw new Error('Instalação automática indisponível. Abra o menu do navegador e escolha Instalar aplicativo.');
 await event.prompt();
 if(!event.userChoice)return 'pending';
 const result=await event.userChoice;
 return result?.outcome==='accepted'?'accepted':'dismissed';
}
