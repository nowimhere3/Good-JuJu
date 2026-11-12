// Presentation only: selection, shuffle bags and persistence stay in main/library.
import {DEFAULT_DURATION,resolveDirection,resolveEffect,revealGeometry} from './reveal-settings.js';
export const REVEAL_DURATION=DEFAULT_DURATION;
export const EFFECT_PRESETS={
  light:{leading:5,particles:9,length:.08,glow:.22,size:4,shape:'star'},
  classic:{leading:8,particles:18,length:.16,glow:.42,size:6,shape:'mixed'},
  super:{leading:14,particles:34,length:.24,glow:.72,size:8,shape:'star'},
  stardust:{leading:10,particles:46,length:.32,glow:.4,size:5,shape:'dust'},
  prismatic:{leading:12,particles:30,length:.22,glow:.5,size:6,shape:'mixed'},
  comet:{leading:10,particles:24,length:.28,glow:.55,size:6,shape:'comet'}
};
export function captureFace(face){
  const snapshot=document.createElement('div');
  snapshot.className='sparkle-previous';
  const contents=document.createElement('div');contents.className='sparkle-face';
  for(const child of face.children)contents.append(child.cloneNode(true));
  snapshot.append(contents);
  const text=face.querySelector('.digital-face');
  if(text)snapshot.dataset.faceScrollTop=String(text.scrollTop);
  return snapshot;
}
export async function prepareFace(card,signal,side='front'){
  if(card.kind!=='physical')return;
  signal?.throwIfAborted();
  const image=new Image();image.src=card[side];
  await new Promise((resolve,reject)=>{
    const abort=()=>{image.src='';reject(new DOMException('Draw superseded by another action.','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    image.decode().then(resolve,reject).finally(()=>signal?.removeEventListener('abort',abort));
  });
}
export function startSparkleReveal(surface,snapshot,options={}){
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  if(motion.matches||document.hidden||!surface.animate)return {finished:Promise.resolve(),cancel(){}};
  const layer=document.createElement('div');layer.className='sparkle-transition';
  const direction=resolveDirection(options.direction),duration=options.duration??REVEAL_DURATION;
  const effect=resolveEffect(options.effect),preset=EFFECT_PRESETS[effect];
  layer.dataset.direction=direction;layer.dataset.effect=effect;
  layer.style.setProperty('--wave-glow',preset.glow);
  const geometry=revealGeometry(surface.clientWidth,surface.clientHeight,direction);
  layer.setAttribute('aria-hidden','true');layer.inert=true;
  const wave=document.createElement('div');wave.className='sparkle-wave';
  wave.style.width=`${geometry.lineWidth}px`;
  const halo=document.createElement('div');halo.className='sparkle-halo';wave.append(halo);
  const glints=[],particles=[],trailLength=Math.hypot(surface.clientWidth,surface.clientHeight)*preset.length;
  const noise=i=>((Math.sin(i*127.1+effect.length*311.7)*43758.5453)%1+1)%1;
  const tint=i=>effect==='prismatic'?['#ffe1a1','#d6c0f0','#acdcd3','#fff9ed'][i%4]:effect==='super'?'#ffe0a0':'#fff8df';
  for(let i=0;i<preset.leading;i++){
    const glint=document.createElement('span');glint.className='sparkle-glint';
    if(effect==='comet')glint.classList.add('mini-comet');
    glint.style.left=`${39+((i+.5)/preset.leading)*22}%`;glint.style.top=`${12+noise(i)*8}px`;
    glint.style.setProperty('--glint-size',`${preset.size+noise(i+8)*3}px`);glint.style.setProperty('--sparkle-color',tint(i));
    wave.append(glint);glints.push(glint);
  }
  // In the rotated wave coordinate system +Y always points into the passed/revealed area.
  for(let i=0;i<preset.particles;i++){
    const particle=document.createElement('span'),distance=(i+.5)/preset.particles;
    particle.className=`sparkle-particle ${preset.shape==='comet'?'mini-comet':preset.shape==='star'||(preset.shape==='mixed'&&i%3===0)?'tail-star':'tail-dust'}`;
    particle.style.left=`${39+noise(i+40)*22}%`;particle.style.top=`${19+distance*trailLength}px`;
    const size={light:[.9,1.6],classic:[1.6,1.8],super:[2.2,2.4],stardust:[1,1.8],prismatic:[1.6,1.9],comet:[2,1.5]}[effect];
    particle.style.setProperty('--sparkle-color',tint(i+1));particle.style.setProperty('--particle-size',`${size[0]+noise(i+90)*size[1]}px`);
    wave.append(particle);particles.push({element:particle,distance,peak:.12+noise(i+120)*.3});
  }
  layer.append(snapshot,wave);surface.append(layer);
  const text=snapshot.querySelector('.digital-face');
  if(text)text.scrollTop=Number(snapshot.dataset.faceScrollTop||0);
  const timing={duration,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'};
  const animations=[
    snapshot.animate([{clipPath:geometry.from.clip},{clipPath:geometry.to.clip}],timing),
    wave.animate([{transform:geometry.from.transform,opacity:0},{opacity:1,offset:.08},{opacity:.9,offset:.88},{transform:geometry.to.transform,opacity:0}],timing),
    ...glints.map((el,i)=>el.animate([{opacity:.15,transform:'scale(.5) rotate(10deg)'},{opacity:i%2?.7:.95,transform:'scale(1) rotate(10deg)',offset:.25},{opacity:.2,transform:'scale(.55) rotate(10deg)',offset:.55},{opacity:.8,transform:'scale(.9) rotate(10deg)',offset:.8},{opacity:0,transform:'scale(.4) rotate(10deg)'}],{duration,delay:0,fill:'both',easing:'ease-in-out'})),
    ...particles.map(({element,distance,peak})=>{
      const brightness={light:.3,classic:.65,super:.9,stardust:.75,prismatic:.7,comet:.8}[effect];
      return element.animate([{opacity:0,transform:'translateY(-3px) scale(.9)'},{opacity:(1-distance)**.8*brightness,transform:'translateY(0) scale(1)',offset:peak},{opacity:(1-distance)*brightness*.45,transform:`translateY(${4+distance*7}px) scale(.5)`,offset:.72},{opacity:0,transform:`translateY(${8+distance*10}px) scale(.1)`}],{duration,fill:'both',easing:'ease-out'});
    })
  ];
  let cleaned=false;
  function cleanup(){
    if(cleaned)return;cleaned=true;
    layer.remove();for(const animation of animations)animation.cancel();
    motion.removeEventListener('change',onMotion);document.removeEventListener('visibilitychange',onVisibility);
    window.removeEventListener('resize',cleanup);
  }
  function onMotion(){if(motion.matches)cleanup();}
  function onVisibility(){if(document.hidden)cleanup();}
  motion.addEventListener('change',onMotion);document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('resize',cleanup);
  const finished=Promise.allSettled(animations.map(animation=>animation.finished)).then(cleanup);
  return {finished,cancel:cleanup};
}
