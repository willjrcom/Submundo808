/** iPadOS may identify itself as Macintosh when requesting desktop sites. */
export function isIosDevice():boolean {
 if(typeof navigator==='undefined')return false;
 return /iPhone|iPad|iPod/i.test(navigator.userAgent)
  ||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}

/** iOS Safari exposes navigator.standalone; other PWA browsers use display-mode. */
export function isPwaInstalled():boolean {
 if(typeof window==='undefined'||typeof navigator==='undefined')return false;
 return window.matchMedia('(display-mode: standalone)').matches
  ||window.matchMedia('(display-mode: fullscreen)').matches
  ||(navigator as Navigator&{standalone?:boolean}).standalone===true;
}

/** iOS web push works only from a Home Screen web app, not from Safari/WhatsApp tabs. */
export function requiresIosInstallationForPush():boolean {
 return isIosDevice()&&!isPwaInstalled();
}
