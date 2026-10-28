/**
 * Align the bottom bar with the *visible* viewport on iOS Safari/WhatsApp.
 *
 * On mobile WebKit the layout viewport can be taller than the visual viewport
 * while the browser's address bar is expanding/collapsing. A hard-coded inset
 * cannot work for both states, and padding the nav with that inset lifts its
 * contents away from the browser edge.
 *
 * Reading VisualViewport is deliberately limited to one RAF per frame. The
 * fallback for browsers without this API is CSS fixed bottom: 0.
 */
export function getVisualBottomGap(layoutHeight:number,offsetTop:number,visualHeight:number):number {
 if(![layoutHeight,offsetTop,visualHeight].every(Number.isFinite)||layoutHeight<=0||visualHeight<=0)return 0;
 return Math.max(0,Math.min(layoutHeight,Math.round(layoutHeight-offsetTop-visualHeight)));
}

export function attachVisualViewportNavigation(win:Window,root:HTMLElement):()=>void {
 const viewport=win.visualViewport;
 if(!viewport)return ()=>{};
 let frame=0;
 const measure=()=>{
  frame=0;
  const bottomGap=getVisualBottomGap(win.innerHeight,viewport.offsetTop,viewport.height);
  root.style.setProperty('--submundo-visual-bottom-gap',bottomGap+'px');
 };
 const schedule=()=>{
  if(frame)return;
  frame=win.requestAnimationFrame(measure);
 };
 // Browser toolbar animations may fire either VisualViewport resize or scroll,
 // depending on the WebKit version and whether the page was opened in WhatsApp.
 viewport.addEventListener('resize',schedule,{passive:true});
 viewport.addEventListener('scroll',schedule,{passive:true});
 win.addEventListener('resize',schedule,{passive:true});
 win.addEventListener('scroll',schedule,{passive:true});
 win.addEventListener('orientationchange',schedule);
 win.addEventListener('pageshow',schedule);
 measure();
 return()=>{
  viewport.removeEventListener('resize',schedule);
  viewport.removeEventListener('scroll',schedule);
  win.removeEventListener('resize',schedule);
  win.removeEventListener('scroll',schedule);
  win.removeEventListener('orientationchange',schedule);
  win.removeEventListener('pageshow',schedule);
  if(frame)win.cancelAnimationFrame(frame);
  root.style.removeProperty('--submundo-visual-bottom-gap');
 };
}
