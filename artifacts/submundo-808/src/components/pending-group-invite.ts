/** Keeps a group invitation through email login, registration and OAuth redirects.
 * The invite never authorizes membership by itself; joining remains explicit.
 */
export const PENDING_GROUP_INVITE_KEY='submundo-pending-group-invite-v1';
export const GROUP_INVITE_TTL_MS=48*60*60*1000;
const tokenPattern=/^[a-f0-9]{64}$/;

export function readGroupInviteToken(value:string):string {
 const input=value.trim();
 if(tokenPattern.test(input))return input;
 try{
  const url=new URL(input,typeof window==='undefined'?'https://submundo.invalid':window.location.origin);
  const token=url.searchParams.get('group_invite')||'';
  return tokenPattern.test(token)?token:'';
 }catch{return '';}
}
export function savePendingGroupInvite(tokenOrUrl:string,now=Date.now()):string {
 const token=readGroupInviteToken(tokenOrUrl);
 if(!token)return '';
 try{
  localStorage.setItem(PENDING_GROUP_INVITE_KEY,JSON.stringify({token,expiresAt:now+GROUP_INVITE_TTL_MS}));
  return token;
 }catch{return token;}
}
export function getPendingGroupInvite(now=Date.now()):string {
 try{
  const raw=localStorage.getItem(PENDING_GROUP_INVITE_KEY);
  if(!raw)return '';
  const payload=JSON.parse(raw) as {token?:unknown;expiresAt?:unknown};
  if(typeof payload.token==='string'&&tokenPattern.test(payload.token)&&
     typeof payload.expiresAt==='number'&&payload.expiresAt>now)return payload.token;
  localStorage.removeItem(PENDING_GROUP_INVITE_KEY);
 }catch{}
 return '';
}
export function captureGroupInviteFromUrl(search:string=window.location.search):string {
 const token=new URLSearchParams(search).get('group_invite')||'';
 return token?savePendingGroupInvite(token):getPendingGroupInvite();
}
export function clearPendingGroupInvite():void {
 try{localStorage.removeItem(PENDING_GROUP_INVITE_KEY);}catch{}
}
