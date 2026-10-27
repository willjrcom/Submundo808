const parse=(hex:string):[number,number,number]=>{
 if(!/^#[0-9a-fA-F]{6}$/.test(hex))throw Error('Cor hexadecimal inválida.');
 return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) as [number,number,number];
};
const channel=(v:number)=>{const s=v/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;};
export const luminance=(hex:string)=>{const [r,g,b]=parse(hex);return channel(r)*0.2126+channel(g)*0.7152+channel(b)*0.0722;};
export const contrastRatio=(a:string,b:string)=>{const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
export const accentTextColor=(background:string)=>contrastRatio(background,'#101010')>=contrastRatio(background,'#ffffff')?'#101010':'#ffffff';
const mixWhite=(hex:string,ratio:number)=>'#'+parse(hex).map(channel=>Math.round(channel*(1-ratio)+255*ratio).toString(16).padStart(2,'0')).join('');
// Garante contraste AA (4.5:1) para destaques sobre fundos escuros.
export const readableAccentOnDark=(accent:string,bg='#0b090f')=>{
 if(contrastRatio(accent,bg)>=4.5)return accent.toLowerCase();
 for(let i=1;i<=20;i++){const color=mixWhite(accent,i/20);if(contrastRatio(color,bg)>=4.5)return color;}
 return '#ffffff';
};
