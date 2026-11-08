/** Contratos das rotinas de permissão testadas no Node e usadas pelo React. */
export type PermissionFeedback={denied:boolean;message:string};
export function permissionFailure(feature:'location'|'camera'|'notifications'|'installation',error:unknown):PermissionFeedback;
export function requestGpsPosition(geolocation:Geolocation|null|undefined):Promise<GeolocationPosition>;
export function requestCameraAccess(mediaDevices:MediaDevices|undefined):Promise<boolean>;
export function registerPush(options:{
 notification:typeof Notification|null;
 serviceWorker:ServiceWorkerContainer|null;
 pushSupported:boolean;
 request:typeof fetch;
 decode?:(value:string)=>string;
}):Promise<PushSubscription>;
export function requestNativeInstallation(event:{
 prompt:()=>Promise<void>;
 userChoice?:Promise<{outcome:string}>;
}|null):Promise<'pending'|'accepted'|'dismissed'>;
