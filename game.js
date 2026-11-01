/* Nightshift Drive - game logic. Needs THREE r128 loaded first. Optional: window.NSD_CONFIG, window.NSD_CLOUD (see firebase-sync.js). */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const CFG=window.NSD_CONFIG||{};
if(!window.THREE){ $('nogl').hidden=false; return; }
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
const C=h=>new THREE.Color(h).convertSRGBToLinear();
const angDiff=(a,b)=>((a-b+Math.PI)%TAU+TAU)%TAU-Math.PI;
const fmtTime=ms=>{const m=Math.floor(ms/60000),s=(ms%60000)/1000;return m+':'+(s<10?'0':'')+s.toFixed(2);};
const fmtC=n=>Math.round(n).toLocaleString('en-US');
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ================= data ================= */
const PAINTS=[
  {n:'Graphite',c:0x3b4048},{n:'Pearl',c:0xdde2e8},{n:'Midnight',c:0x14316b},{n:'Ember',c:0xe8571a},
  {n:'Cyan',c:0x0aa6d6},{n:'Crimson',c:0x9d1c2c},{n:'Moss',c:0x2c5a43},{n:'Taxi',c:0xf2b705}
];
const FINISH=[['metal','Metallic'],['matte','Matte'],['neon','Neon']];
const GLOW={blue:0x1ec8ff,orange:0xff7a1a};
const RIMS=[
  {n:'Sport',sp:5,th:.11,col:0xaab2bd,svg:'#aab2bd',price:0},
  {n:'Mesh',sp:12,th:.05,col:0x5d6470,svg:'#7b8390',price:400},
  {n:'Gold',sp:8,th:.08,col:0xd7a84a,svg:'#d7a84a',price:800}
];
const TIRES=[
  {n:'Street',grip:1,stripe:null,price:0},
  {n:'Sport',grip:1.06,stripe:0xff7a1a,price:600},
  {n:'Track',grip:1.12,stripe:0x1ec8ff,price:1200}
];
const ENG=[['speed','Speed'],['accel','Accel'],['handling','Handling']];
const ENG_MAX=5;
const engPrice=lvl=>200*(lvl+1);

/* ================= car builders ================= */
function arch(cx,r,y0,n){const o=[];for(let i=0;i<=n;i++){const a=Math.PI-i*Math.PI/n;o.push([cx+r*Math.cos(a),y0+r*Math.sin(a)]);}return o;}
function extrude(pts,width,bevel,mat,x){
  const sh=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],p[1])));
  const g=new THREE.ExtrudeGeometry(sh,{depth:width,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:1,steps:1});
  g.translate(0,0,-width/2);g.rotateY(-Math.PI/2);
  const m=new THREE.Mesh(g,mat);if(x)m.position.x=x;return m;
}
function box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m;}
function cyl(r,len,mat,x,y,z,axis){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,24),mat);if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;m.position.set(x,y,z);return m;}

function applyPaint(m,idx,fin){
  const p=m.paint;
  p.color.copy(C(PAINTS[idx].c));
  if(fin==='matte'){p.metalness=.2;p.roughness=.8;p.clearcoat=0;p.emissive.setRGB(0,0,0);}
  else if(fin==='neon'){p.metalness=.35;p.roughness=.3;p.clearcoat=1;p.emissive.copy(C(PAINTS[idx].c)).multiplyScalar(.55);}
  else{p.metalness=.68;p.roughness=.26;p.clearcoat=1;p.emissive.setRGB(0,0,0);}
}
function makeMats(g){
  const m={
    paint:new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:.68,roughness:.26,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.7}),
    glass:new THREE.MeshPhysicalMaterial({color:C(0x06080b),metalness:.3,roughness:.04,clearcoat:1,clearcoatRoughness:.02,envMapIntensity:2.4}),
    trim:new THREE.MeshStandardMaterial({color:C(0x0c0d10),roughness:.55,metalness:.3,envMapIntensity:.6}),
    tire:new THREE.MeshStandardMaterial({color:C(0x0b0c0e),roughness:.92,metalness:0}),
    rim:new THREE.MeshStandardMaterial({color:C(RIMS[g.rim].col),roughness:.28,metalness:.95,envMapIntensity:1.4}),
    head:new THREE.MeshBasicMaterial({color:C(0xf4f8ff).multiplyScalar(1.6)}),
    tail:new THREE.MeshBasicMaterial({color:C(0xff2a1a).multiplyScalar(.45)}),
    glow:new THREE.MeshBasicMaterial({color:C(GLOW[g.glow]).multiplyScalar(1.6)})
  };
  applyPaint(m,g.paint,g.fin);
  return m;
}

function buildHatch(body,m){
  const hb=[[-2.12,.32]].concat(arch(-1.3,.43,.32,10),arch(1.3,.43,.32,10),[[2.05,.32],[2.18,.52],[2.16,.74],[1.55,.88],[.95,.94],[-1.85,.94],[-2.14,.80],[-2.18,.55]]);
  body.add(extrude(hb,1.68,.06,m.paint));
  body.add(extrude([[.98,.94],[.36,1.36],[-1.0,1.38],[-1.95,.96]],1.48,.04,m.glass));
  body.add(extrude([[.34,1.35],[-1.02,1.37],[-1.04,1.42],[.28,1.40]],1.50,.03,m.paint));
  [-1,1].forEach(s=>{
    body.add(extrude([[.98,.93],[.36,1.37],[.46,1.37],[1.08,.93]],.07,.02,m.paint,s*.76));
    body.add(extrude([[-.98,1.37],[-1.96,.94],[-1.84,.94],[-.88,1.37]],.07,.02,m.paint,s*.76));
    body.add(box(.07,.08,1.7,m.trim,s*.9,.36,0));
    body.add(box(.38,.09,.08,m.head,s*.6,.70,2.23));
    body.add(box(.5,.09,.06,m.tail,s*.6,.78,-2.23));
    body.add(box(.14,.1,.2,m.paint,s*.94,1.0,.7));
  });
  body.add(box(.86,.14,.06,m.trim,0,.52,2.22));
  body.add(box(1.1,.1,.06,m.trim,0,.40,2.22));
  body.add(box(1.3,.04,.28,m.paint,0,1.0,-2.08));
  return{wx:.8,r:.34,w:.24,axle:1.3,len:4.5,wid:1.8,chunky:false,tailZ:-2.26,tailY:.78,tailX:.6};
}
function buildSuv(body,m){
  const sb=[[-1.98,.50]].concat(arch(-1.25,.50,.50,10),arch(1.25,.50,.50,10),[[1.98,.50],[2.05,.70],[2.02,1.04],[1.2,1.10],[-1.9,1.10],[-2.04,1.00],[-2.05,.70]]);
  body.add(extrude(sb,1.82,.06,m.paint));
  body.add(extrude([[1.12,1.10],[.96,1.78],[-1.86,1.78],[-1.92,1.10]],1.62,.04,m.glass));
  body.add(box(1.7,.08,2.9,m.paint,0,1.82,-.45));
  [-1,1].forEach(s=>{
    body.add(extrude([[1.12,1.10],[.96,1.79],[.84,1.79],[1.0,1.10]],.08,.02,m.paint,s*.82));
    body.add(box(.08,.68,.12,m.paint,s*.82,1.45,-.35));
    body.add(box(.08,.68,.16,m.paint,s*.82,1.45,-1.84));
    body.add(box(.12,.1,1.2,m.trim,s*.97,1.03,1.25));
    body.add(box(.12,.1,1.2,m.trim,s*.97,1.03,-1.25));
    body.add(cyl(.17,.1,m.head,s*.62,.86,2.12,'z'));
    const bz=new THREE.Mesh(new THREE.TorusGeometry(.19,.035,8,24),m.trim);bz.position.set(s*.62,.86,2.17);body.add(bz);
    body.add(box(.1,.34,.06,m.tail,s*.82,.95,-2.1));
    body.add(box(.12,.16,.18,m.trim,s*1.0,1.35,.9));
    body.add(box(.05,.05,2.6,m.trim,s*.62,1.9,-.45));
  });
  body.add(box(.8,.3,.05,m.trim,0,.86,2.1));
  for(let i=-2;i<=2;i++)body.add(box(.07,.26,.07,m.paint,i*.16,.86,2.13));
  body.add(box(1.96,.2,.22,m.trim,0,.56,2.05));
  body.add(box(1.96,.2,.2,m.trim,0,.56,-2.05));
  [.6,-.45,-1.5].forEach(z=>body.add(box(1.3,.05,.05,m.trim,0,1.9,z)));
  body.add(box(1.0,.07,.09,m.head,0,1.88,.9));
  body.add(cyl(.4,.2,m.tire,0,1.15,-2.25,'z'));body.add(cyl(.2,.22,m.rim,0,1.15,-2.25,'z'));
  return{wx:.9,r:.44,w:.32,axle:1.25,len:4.1,wid:1.95,chunky:true,tailZ:-2.16,tailY:.95,tailX:.82};
}
/* generic side-profile car: body outline + glass cabin, shared by the sedans and coupes */
function profileCar(body,m,P){
  const y0=P.y0,c=P.cab;
  const pts=[[-P.len/2+.08,y0]].concat(arch(-P.axle,P.ar,y0,10),arch(P.axle,P.ar,y0,10),[[P.len/2-.08,y0]],P.top);
  body.add(extrude(pts,P.wid,.06,m.paint));
  body.add(extrude(c,P.cw,.04,m.glass));
  body.add(extrude([c[1],c[2],[c[2][0],c[2][1]+.05],[c[1][0],c[1][1]+.05]],P.cw+.02,.03,m.paint));
  [-1,1].forEach(s=>{
    const x=s*(P.cw/2);
    body.add(extrude([c[0],c[1],[c[1][0]+.1,c[1][1]],[c[0][0]+.12,c[0][1]]],.07,.02,m.paint,x));
    body.add(extrude([c[3],c[2],[c[2][0]+.1,c[2][1]],[c[3][0]+.14,c[3][1]]],.07,.02,m.paint,x));
    body.add(box(P.hw,.09,.08,m.head,s*P.hx,P.hy,P.len/2));
    body.add(box(P.hw+.1,.09,.06,m.tail,s*P.tx,P.ty,-P.len/2));
    body.add(box(.14,.1,.2,m.paint,s*(P.wid/2+.04),c[0][1]+.1,c[0][0]-.15));
    body.add(box(.07,.08,P.len*.34,m.trim,s*(P.wid/2-.02),y0+.06,0));
  });
  body.add(box(P.wid*.45,.14,.06,m.trim,0,P.hy-.12,P.len/2));
  if(P.extra)P.extra(body,m,P);
  return{wx:P.wx,r:P.r,w:P.w,axle:P.axle,len:P.len,wid:P.wid,chunky:false,tailZ:-P.len/2-.04,tailY:P.ty,tailX:P.tx};
}
const P_SEDAN={len:4.5,wid:1.76,r:.33,w:.22,wx:.78,axle:1.35,ar:.42,y0:.3,
  top:[[2.2,.5],[2.22,.68],[1.9,.77],[1.0,.84],[-1.9,.86],[-2.2,.82],[-2.24,.55]],
  cab:[[.95,.84],[.35,1.38],[-.85,1.38],[-1.55,.86]],cw:1.5,hy:.7,hw:.34,hx:.56,ty:.78,tx:.56};
const buildSedan=(b,m)=>profileCar(b,m,P_SEDAN);
const buildTaxi=(b,m)=>profileCar(b,m,Object.assign({},P_SEDAN,{extra:(bd,mm)=>{
  const sign=new THREE.MeshBasicMaterial({color:C(0xffc83a).multiplyScalar(1.6)});
  bd.add(box(.56,.15,.22,sign,0,1.47,-.15));bd.add(box(.6,.04,.26,mm.trim,0,1.4,-.15));
}}));
const buildVolt=(b,m)=>profileCar(b,m,{len:4.6,wid:1.9,r:.35,w:.27,wx:.86,axle:1.4,ar:.46,y0:.28,
  top:[[2.3,.44],[2.34,.58],[2.0,.76],[1.0,.86],[.4,.9],[-1.6,.92],[-2.2,.88],[-2.32,.64]],
  cab:[[.6,.88],[-.1,1.22],[-1.2,1.24],[-1.9,.92]],cw:1.55,hy:.64,hw:.5,hx:.62,ty:.82,tx:.6,
  extra:(bd,mm)=>{[-1,1].forEach(s=>{bd.add(box(.06,.22,.9,mm.trim,s*.96,.54,.9));});bd.add(box(1.3,.05,.34,mm.paint,0,1.0,-2.2));}});
const buildR8=(b,m)=>profileCar(b,m,{len:4.5,wid:1.95,r:.35,w:.28,wx:.88,axle:1.35,ar:.46,y0:.3,
  top:[[2.25,.42],[2.3,.56],[1.85,.78],[.8,.86],[.4,.9],[-1.7,.92],[-2.22,.88],[-2.28,.62]],
  cab:[[.7,.88],[.05,1.24],[-1.1,1.24],[-1.8,.92]],cw:1.6,hy:.66,hw:.46,hx:.64,ty:.82,tx:.62,
  extra:(bd,mm)=>{[-1,1].forEach(s=>{bd.add(box(.08,.34,1.3,mm.trim,s*.98,.6,-.1));});bd.add(box(1.5,.04,.3,mm.trim,0,1.02,-2.18));}});
const buildBull=(b,m)=>profileCar(b,m,{len:4.8,wid:2.0,r:.37,w:.3,wx:.92,axle:1.45,ar:.48,y0:.27,
  top:[[2.4,.4],[2.44,.5],[2.1,.76],[1.0,.84],[.2,.86],[-1.5,.94],[-2.35,.9],[-2.42,.6]],
  cab:[[.85,.84],[.05,1.2],[-.8,1.22],[-1.5,.96]],cw:1.62,hy:.6,hw:.44,hx:.7,ty:.84,tx:.66,
  extra:(bd,mm)=>{
    bd.add(box(1.8,.05,.5,mm.trim,0,1.2,-2.32));
    [-1,1].forEach(s=>{bd.add(box(.05,.3,.56,mm.trim,s*.9,1.08,-2.32));bd.add(box(.06,.32,.1,mm.trim,s*.5,1.0,-2.3));bd.add(box(.08,.2,1.1,mm.trim,s*1.0,.55,-.2));});
    bd.add(box(1.9,.04,.4,mm.trim,0,.3,2.5));
  }});
const buildPhantom=(b,m)=>profileCar(b,m,{len:5.4,wid:2.0,r:.4,w:.3,wx:.88,axle:1.7,ar:.5,y0:.34,
  top:[[2.7,.6],[2.74,.82],[2.6,1.04],[1.7,1.12],[1.2,1.16],[-2.45,1.18],[-2.72,1.04],[-2.74,.64]],
  cab:[[1.2,1.16],[.85,1.68],[-1.55,1.68],[-2.1,1.18]],cw:1.7,hy:.98,hw:.28,hx:.78,ty:1.02,tx:.8,
  extra:(bd,mm)=>{
    bd.add(box(.72,.66,.08,mm.rim,0,.92,2.72));
    for(let i=-3;i<=3;i++)bd.add(box(.03,.6,.1,mm.trim,i*.09,.92,2.74));
    bd.add(box(.05,.16,.05,mm.rim,0,1.26,2.5));
  }});

function buildWheel(spin,sp,m,g,lite){
  const r=sp.r,w=sp.w,rim=RIMS[g.rim],tire=TIRES[g.tire];
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(r,r,w,28),m.tire);tr.rotation.z=Math.PI/2;spin.add(tr);
  const rm=new THREE.Mesh(new THREE.CylinderGeometry(r*.66,r*.66,w*1.02,24),m.rim);rm.rotation.z=Math.PI/2;spin.add(rm);
  if(lite)return;
  for(let i=0;i<rim.sp;i++){const s=new THREE.Mesh(new THREE.BoxGeometry(w*1.06,r*1.12,r*rim.th),m.trim);s.rotation.x=i*Math.PI/rim.sp;spin.add(s);}
  [-1,1].forEach(sx=>{
    const ring=new THREE.Mesh(new THREE.TorusGeometry(r*.7,r*.035,6,28),m.glow);ring.rotation.y=Math.PI/2;ring.position.x=sx*w*.52;spin.add(ring);
    if(tire.stripe){const st=new THREE.Mesh(new THREE.TorusGeometry(r*.86,r*.025,6,32),new THREE.MeshBasicMaterial({color:C(tire.stripe).multiplyScalar(1.4)}));st.rotation.y=Math.PI/2;st.position.x=sx*w*.51;spin.add(st);}
  });
  if(sp.chunky){for(let i=0;i<20;i++){const a=i*TAU/20;const b=new THREE.Mesh(new THREE.BoxGeometry(w*1.02,r*.14,r*.2),m.tire);b.position.set(0,Math.cos(a)*r*.99,Math.sin(a)*r*.99);b.rotation.x=a;spin.add(b);}}
}

/* catalog. ph = driving model: vmax m/s, accel m/s2, brake m/s2, mu grip, steer = max wheel angle (rad) */
const CARS=[
  {id:'kite',name:'KITE GT',tag:'Compact hatchback',price:0,paint:0,build:buildHatch,
   ph:{vmax:58,accel:9.8,brake:31,mu:1.28,muOff:.55,offDrag:.55,steer:.62,L:2.6,latK:10,roll:1,camDist:7.4,camH:2.7,rev:10}},
  {id:'ridge',name:'RIDGE 4X4',tag:'Boxy off-road SUV',price:3500,paint:6,build:buildSuv,
   ph:{vmax:48,accel:8.0,brake:27,mu:1.05,muOff:.82,offDrag:.28,steer:.56,L:2.7,latK:8.5,roll:1.7,camDist:8.6,camH:3.3,rev:9}},
  {id:'dhaka',name:'DHAKA DAILY',tag:'Everyday sedan',price:1500,paint:1,build:buildSedan,
   ph:{vmax:46,accel:7.4,brake:26,mu:1.08,muOff:.6,offDrag:.5,steer:.6,L:2.7,latK:9,roll:1.3,camDist:7.8,camH:2.9,rev:9}},
  {id:'metro',name:'METRO CAB',tag:'City taxi',price:2000,paint:7,build:buildTaxi,
   ph:{vmax:48,accel:7.8,brake:27,mu:1.1,muOff:.6,offDrag:.5,steer:.6,L:2.7,latK:9,roll:1.3,camDist:7.8,camH:3.0,rev:9}},
  {id:'volt',name:'VOLT I9',tag:'Hybrid sports coupe',price:12000,paint:4,build:buildVolt,
   ph:{vmax:62,accel:10.8,brake:33,mu:1.36,muOff:.5,offDrag:.6,steer:.6,L:2.8,latK:10.5,roll:.9,camDist:7.8,camH:2.6,rev:10}},
  {id:'reight',name:'R-EIGHT',tag:'Mid-engine coupe',price:16000,paint:5,build:buildR8,
   ph:{vmax:66,accel:11.6,brake:34,mu:1.42,muOff:.5,offDrag:.6,steer:.6,L:2.7,latK:11,roll:.8,camDist:7.8,camH:2.6,rev:10}},
  {id:'bull',name:'RAGING BULL',tag:'Wedge supercar',price:24000,paint:3,build:buildBull,
   ph:{vmax:72,accel:12.4,brake:36,mu:1.5,muOff:.45,offDrag:.65,steer:.56,L:2.9,latK:11.5,roll:.7,camDist:8.2,camH:2.6,rev:10}},
  {id:'phantom',name:'PHANTOM ROYALE',tag:'Luxury limousine',price:30000,paint:2,build:buildPhantom,
   ph:{vmax:56,accel:9.0,brake:29,mu:1.14,muOff:.55,offDrag:.5,steer:.5,L:3.4,latK:9,roll:1.4,camDist:9.4,camH:3.3,rev:9}}
];
const CAR_BY={};CARS.forEach(c=>{CAR_BY[c.id]=c;});

/* ================= saved state ================= */
const KEY='nightshift-drive-v2';
const defGarage=def=>({paint:def.paint,fin:'metal',glow:'blue',rim:0,tire:0,unl:{rim:[0],tire:[0]},eng:{speed:0,accel:0,handling:0}});
function cleanGarage(def,g){
  const d=defGarage(def);if(!g||typeof g!=='object')return d;
  const out=Object.assign(d,g);
  out.paint=clamp(out.paint|0,0,PAINTS.length-1);
  if(!FINISH.some(f=>f[0]===out.fin))out.fin='metal';
  if(!GLOW[out.glow])out.glow='blue';
  out.rim=clamp(out.rim|0,0,RIMS.length-1);out.tire=clamp(out.tire|0,0,TIRES.length-1);
  out.unl=Object.assign({rim:[0],tire:[0]},g.unl||{});
  if(out.unl.rim.indexOf(out.rim)<0)out.unl.rim.push(out.rim);
  if(out.unl.tire.indexOf(out.tire)<0)out.unl.tire.push(out.tire);
  out.eng=Object.assign({speed:0,accel:0,handling:0},g.eng||{});
  ENG.forEach(e=>{out.eng[e[0]]=clamp(out.eng[e[0]]|0,0,ENG_MAX);});
  return out;
}
const S={sel:'kite',name:'PLAYER',credits:5000,owned:{},stats:{races:0,best:{}},sound:true,quality:'high',units:'kmh',sens:100,touch:null,steer:'wheel',flip:false};
try{
  const raw=localStorage.getItem(KEY);
  if(raw){
    const j=JSON.parse(raw);
    ['sel','name','sound','quality','units','sens','touch','steer','flip'].forEach(k=>{if(j[k]!==undefined)S[k]=j[k];});
    if(typeof j.credits==='number'&&j.credits>=0)S.credits=Math.floor(j.credits);
    if(j.stats&&typeof j.stats==='object'){S.stats.races=j.stats.races|0;S.stats.best=Object.assign({},j.stats.best||{});}
    if(j.owned&&typeof j.owned==='object')Object.keys(j.owned).forEach(id=>{if(CAR_BY[id])S.owned[id]=cleanGarage(CAR_BY[id],j.owned[id]);});
  }
}catch(e){}
if(!S.owned.kite)S.owned.kite=defGarage(CAR_BY.kite);
if(!S.owned[S.sel])S.sel='kite';
if(['wheel','tilt','buttons'].indexOf(S.steer)<0)S.steer='wheel';
if(S.touch===null)S.touch=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
S.name=String(S.name||'PLAYER').slice(0,14);
const garageOf=id=>S.owned[id]||defGarage(CAR_BY[id]);

/* cloud sync (optional, see firebase-sync.js) */
let cloudUser=null,cloudTimer=0,cloudOn=false;
function snapshot(){return JSON.parse(JSON.stringify({name:S.name,credits:S.credits,sel:S.sel,stats:S.stats,owned:S.owned}));}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}
  if(cloudUser&&window.NSD_CLOUD){clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>{window.NSD_CLOUD.push(cloudUser.uid,snapshot(),cloudUser).catch(()=>toast('Cloud save failed. Check your connection.'));},1500);}
}
function mergeCloud(cd){
  if(!cd)return false;
  if(typeof cd.credits==='number'&&cd.credits>=0)S.credits=Math.floor(cd.credits);
  if(cd.name)S.name=String(cd.name).slice(0,14);
  if(cd.stats){S.stats.races=Math.max(S.stats.races,cd.stats.races|0);const b=cd.stats.best||{};Object.keys(b).forEach(id=>{if(!S.stats.best[id]||b[id]<S.stats.best[id])S.stats.best[id]=b[id];});}
  if(cd.owned)Object.keys(cd.owned).forEach(id=>{if(CAR_BY[id])S.owned[id]=cleanGarage(CAR_BY[id],cd.owned[id]);});
  if(cd.sel&&S.owned[cd.sel])S.sel=cd.sel;
  return true;
}
function onCloudUser(user){
  if(!user){cloudUser=null;renderProfile();return;}
  cloudUser=user;renderProfile();
  window.NSD_CLOUD.pull(user.uid).then(cd=>{
    if(cd){mergeCloud(cd);viewId=S.sel;toast('Progress loaded from your account');}
    else toast('Signed in. Your progress is now saved to the cloud.');
    try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}
    window.NSD_CLOUD.push(user.uid,snapshot(),user).catch(()=>{});
    renderAll();rebuildShowCar();setupMenu();
  }).catch(()=>toast('Could not reach cloud save. Playing offline.'));
}
function hookCloud(){if(cloudOn||!window.NSD_CLOUD)return;cloudOn=true;window.NSD_CLOUD.onAuth(onCloudUser);}

/* ================= renderer ================= */
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:$('gl'),antialias:true,powerPreference:'high-performance'});}
catch(e){$('nogl').hidden=false;return;}
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.1;
const MAXA=renderer.capabilities.getMaxAnisotropy();
const pmrem=new THREE.PMREMGenerator(renderer);
let W=1,H=1;

function ctex(w,h,draw,rep){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
  if(rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=MAXA;return t;
}
const glowTex=ctex(128,128,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.25,'rgba(255,255,255,.45)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
const shadowTex=ctex(128,128,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);r.addColorStop(0,'rgba(0,0,0,.8)');r.addColorStop(.6,'rgba(0,0,0,.38)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
const smokeTex=ctex(64,64,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);r.addColorStop(0,'rgba(210,214,220,.9)');r.addColorStop(1,'rgba(210,214,220,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
function glowSprite(hex,size,op){
  const m=new THREE.SpriteMaterial({map:glowTex,color:C(hex),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:op==null?1:op,fog:false});
  const s=new THREE.Sprite(m);s.scale.set(size,size,1);return s;
}

function buildCar(id,g,lite){
  const def=CAR_BY[id],m=makeMats(g);
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const sp=def.build(body,m);
  const wheels=[];
  [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(a=>{
    const wr=new THREE.Group();wr.position.set(a[0]*sp.wx,sp.r,a[1]*sp.axle);
    const spin=new THREE.Group();wr.add(spin);buildWheel(spin,sp,m,g,lite);root.add(wr);
    wheels.push({root:wr,spin:spin,front:a[1]>0});
  });
  const ug=new THREE.Mesh(new THREE.PlaneGeometry(sp.wid*2.5,sp.len*1.5),new THREE.MeshBasicMaterial({map:glowTex,color:C(GLOW[g.glow]),transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
  ug.rotation.x=-Math.PI/2;ug.position.y=.05;ug.renderOrder=3;root.add(ug);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(sp.wid*1.5,sp.len*1.18),new THREE.MeshBasicMaterial({map:shadowTex,color:0x000000,transparent:true,depthWrite:false}));
  sh.rotation.x=-Math.PI/2;sh.position.y=.03;sh.renderOrder=2;root.add(sh);
  const tg=[-1,1].map(s=>{const t=glowSprite(0xff2a1a,1.5,.35);t.position.set(s*sp.tailX,sp.tailY,sp.tailZ);root.add(t);return t;});
  return{root:root,body:body,wheels:wheels,m:m,ug:ug,tg:tg,sp:sp,id:id};
}
function setGlow(o,k){o.m.glow.color.copy(C(GLOW[k])).multiplyScalar(1.6);o.ug.material.color.copy(C(GLOW[k]));}
/* merges the static body meshes of a car by material, so a car costs a handful of draw calls instead of dozens */
function mergeBody(o){
  try{
    o.root.updateMatrixWorld(true);
    const groups=new Map(),kill=[];
    o.body.traverse(ch=>{if(ch.isMesh&&ch.geometry&&ch.parent===o.body){if(!groups.has(ch.material))groups.set(ch.material,[]);groups.get(ch.material).push(ch);kill.push(ch);}});
    if(!kill.length)return;
    const made=[];
    groups.forEach((meshes,mat)=>{
      let total=0;
      const parts=meshes.map(m=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);total+=g.attributes.position.count;return g;});
      const pos=new Float32Array(total*3),nor=new Float32Array(total*3);let off=0;
      parts.forEach(g=>{pos.set(g.attributes.position.array,off*3);nor.set(g.attributes.normal.array,off*3);off+=g.attributes.position.count;g.dispose();});
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));
      made.push(new THREE.Mesh(geo,mat));
    });
    kill.forEach(m=>{o.body.remove(m);m.geometry.dispose();});
    made.forEach(m=>o.body.add(m));
  }catch(e){}
}
function tailLight(o,k){o.m.tail.color.copy(C(0xff2a1a)).multiplyScalar(.45+k*1.6);o.tg.forEach(t=>{t.material.opacity=.3+k*.7;});}

/* ================= showroom ================= */
const showScene=new THREE.Scene();
showScene.background=C(0x0a0b0d);
const showCam=new THREE.PerspectiveCamera(32,1,.5,200);
const turn=new THREE.Group();showScene.add(turn);
let showCar=null,drag=null,offY=.08,offX=0,offXt=0;
(function buildShowroom(){
  const env=new THREE.Group();
  const wallTex=ctex(8,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#07080a');gr.addColorStop(.55,'#1b1e23');gr.addColorStop(1,'#111317');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(26,26,24,48,1,true),new THREE.MeshBasicMaterial({map:wallTex,side:THREE.BackSide,fog:false}));
  wall.position.y=10;env.add(wall);
  const cols=[0x1ec8ff,0xff7a1a,0xffffff,0x1ec8ff,0xff7a1a,0xffffff,0x1ec8ff,0xff7a1a,0xffffff,0x1ec8ff,0xff7a1a,0xffffff,0x1ec8ff];
  cols.forEach((c,i)=>{
    const a=(211.8-72+i*12)*Math.PI/180;
    const mt=new THREE.MeshBasicMaterial({color:C(c).multiplyScalar(c===0xffffff?1.8:2.4),fog:false});
    const s=new THREE.Mesh(new THREE.BoxGeometry(.16,i%3===1?7:12,.16),mt);
    s.position.set(Math.sin(a)*17,i%3===1?4.5:7,Math.cos(a)*17);env.add(s);
  });
  const mkRing=(r,c,k)=>{const t=new THREE.Mesh(new THREE.TorusGeometry(r,.05,8,128),new THREE.MeshBasicMaterial({color:C(c).multiplyScalar(k),fog:false}));t.rotation.x=Math.PI/2;t.position.y=.03;env.add(t);};
  mkRing(6.2,0x1ec8ff,2.4);mkRing(6.7,0xff7a1a,1.5);
  [3,-3].forEach(z=>{const sb=new THREE.Mesh(new THREE.BoxGeometry(10,.2,2.4),new THREE.MeshBasicMaterial({color:new THREE.Color(3,3,3.2),fog:false}));sb.position.set(0,9,z);env.add(sb);});
  const tmp=new THREE.Scene();tmp.add(env);
  showScene.environment=pmrem.fromScene(tmp,0).texture;
  showScene.add(env);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(26,64),new THREE.MeshStandardMaterial({color:C(0x0a0b0e),roughness:.16,metalness:.7,transparent:true,opacity:.8,envMapIntensity:.9}));
  floor.rotation.x=-Math.PI/2;floor.renderOrder=-2;showScene.add(floor);
  showScene.add(new THREE.HemisphereLight(C(0x7a8aa8),C(0x101114),.5));
  const key=new THREE.DirectionalLight(C(0xffffff),.9);key.position.set(4,8,6);showScene.add(key);
  const rb=new THREE.PointLight(C(0x1ec8ff),1.5,18);rb.position.set(-6,2.6,-4);showScene.add(rb);
  const ro=new THREE.PointLight(C(0xff7a1a),1.3,18);ro.position.set(6,2.2,-5);showScene.add(ro);
})();
let viewId=S.sel;
function rebuildShowCar(){
  if(showCar){turn.remove(showCar.root);turn.remove(showCar.mirror);}
  const o=buildCar(viewId,garageOf(viewId));
  const mir=o.root.clone();mir.scale.y=-1;
  turn.add(o.root);turn.add(mir);o.mirror=mir;showCar=o;
}
function layoutShow(){
  const asp=W/H;
  const dist=asp>=1.5?11.2:Math.min(20,11.2*Math.pow(1.5/asp,.7));
  showCam.position.copy(new THREE.Vector3(.62,.2,1).normalize().multiplyScalar(dist));
  showCam.lookAt(0,.7,0);showCam.aspect=asp;showCam.updateProjectionMatrix();
}

/* thumbnails for the dealership, rendered once from the real models */
const THUMB={};let thumbsStarted=false;
function makeThumbs(){
  if(thumbsStarted)return;thumbsStarted=true;
  let rt,sc,cam,cv,cx,buf;
  try{
    rt=new THREE.WebGLRenderTarget(320,180,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    rt.texture.encoding=THREE.sRGBEncoding;
    sc=new THREE.Scene();sc.background=C(0x14161a);sc.environment=showScene.environment;
    sc.add(new THREE.HemisphereLight(C(0x7a8aa8),C(0x101114),.8));
    const k=new THREE.DirectionalLight(C(0xffffff),1.0);k.position.set(4,8,6);sc.add(k);
    cam=new THREE.PerspectiveCamera(30,16/9,.5,100);
    cv=document.createElement('canvas');cv.width=320;cv.height=180;cx=cv.getContext('2d');
    buf=new Uint8Array(320*180*4);
  }catch(e){return;}
  let i=0;
  (function step(){
    if(i>=CARS.length){try{rt.dispose();}catch(e){}return;}
    const def=CARS[i++];
    try{
      const o=buildCar(def.id,defGarage(def));o.root.rotation.y=.5;sc.add(o.root);
      const d=o.sp.len*1.75;
      cam.position.set(d*.55,d*.2,d*.85);cam.lookAt(0,.6,0);
      renderer.setRenderTarget(rt);renderer.render(sc,cam);renderer.setRenderTarget(null);
      renderer.readRenderTargetPixels(rt,0,0,320,180,buf);
      const img=cx.createImageData(320,180);
      for(let y=0;y<180;y++){img.data.set(buf.subarray((179-y)*320*4,(180-y)*320*4),y*320*4);}
      let lit=0;for(let k=0;k<buf.length;k+=97){lit=Math.max(lit,buf[k]);}
      cx.putImageData(img,0,0);if(lit>12)THUMB[def.id]=cv.toDataURL('image/jpeg',.82);
      sc.remove(o.root);
    }catch(e){renderer.setRenderTarget(null);}
    renderDealer();
    setTimeout(step,30);
  })();
}

/* ================= race: track data ================= */
const N=700;
let PX,PZ,TX,TZ,NX,NZ,DS,LEN,raceBuilt=false;
const raceScene=new THREE.Scene();
const raceCam=new THREE.PerspectiveCamera(62,1,.5,2000);
let skyMesh=null,raceCar=null,smokePool=[];
let vProf=null,ais=[],coinMesh=null,coinList=[],coinDm=null,coinGot=0,finishCount=0;
const PLAYER_SLOT=3,AI_NAMES=['ZED','KIRA','MAX','LUNA','RAJ'];
function gridSlot(slot){return{back:9+(slot>>1)*9,lat:(slot&1)?3.6:-3.6};}

function buildSamples(){
  const k=1.3;
  const CP=[[0,0],[85,-12],[170,-18],[235,28],[240,110],[185,170],[105,158],[45,205],[-40,232],[-125,205],[-152,130],[-102,72],[-132,2],[-80,-52]];
  const curve=new THREE.CatmullRomCurve3(CP.map(p=>new THREE.Vector3(p[0]*k,0,p[1]*k)),true,'centripetal');
  curve.arcLengthDivisions=4000;
  LEN=curve.getLength();DS=LEN/N;
  PX=new Float32Array(N);PZ=new Float32Array(N);TX=new Float32Array(N);TZ=new Float32Array(N);NX=new Float32Array(N);NZ=new Float32Array(N);
  for(let i=0;i<N;i++){
    const t=i/N,p=curve.getPointAt(t),tg=curve.getTangentAt(t);const l=Math.hypot(tg.x,tg.z);
    PX[i]=p.x;PZ[i]=p.z;TX[i]=tg.x/l;TZ[i]=tg.z/l;NX[i]=TZ[i];NZ[i]=-TX[i];
  }
}
/* corner speed limit for every track sample, smoothed so AI cars brake early and accelerate out of turns */
function buildSpeedProfile(){
  vProf=new Float32Array(N);
  for(let i=0;i<N;i++){
    const a=(i-4+N)%N,b=(i+4)%N;
    const dth=Math.abs(angDiff(Math.atan2(TX[b],TZ[b]),Math.atan2(TX[a],TZ[a])));
    const k=dth/(8*DS);
    vProf[i]=k<1e-4?90:Math.sqrt(1.15*9.81/k);
  }
  for(let pass=0;pass<3;pass++){
    for(let i=N-1;i>=0;i--){const n=(i+1)%N;vProf[i]=Math.min(vProf[i],Math.sqrt(vProf[n]*vProf[n]+2*26*DS));}
    for(let i=0;i<N;i++){const p=(i-1+N)%N;vProf[i]=Math.min(vProf[i],Math.sqrt(vProf[p]*vProf[p]+2*10*DS));}
  }
}
function ribbon(offL,offR,y,vTarget,flipU){
  const n=N+1,vs=LEN/Math.max(1,Math.round(LEN/vTarget));
  const pos=new Float32Array(n*6),uv=new Float32Array(n*4),idx=[];
  for(let i=0;i<n;i++){
    const k=i%N,o=i*2,v=i*DS/vs;
    pos[o*3]=PX[k]+NX[k]*offL;pos[o*3+1]=y;pos[o*3+2]=PZ[k]+NZ[k]*offL;
    pos[o*3+3]=PX[k]+NX[k]*offR;pos[o*3+4]=y;pos[o*3+5]=PZ[k]+NZ[k]*offR;
    uv[o*2]=flipU?0:1;uv[o*2+1]=v;uv[o*2+2]=flipU?1:0;uv[o*2+3]=v;
    if(i<N){const a=o,b=o+1,c=o+2,d=o+3;idx.push(a,b,c,b,d,c);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function wallRibbon(off,y0,y1){
  const n=N+1,pos=new Float32Array(n*6),idx=[];
  for(let i=0;i<n;i++){
    const k=i%N,o=i*2;
    pos[o*3]=PX[k]+NX[k]*off;pos[o*3+1]=y0;pos[o*3+2]=PZ[k]+NZ[k]*off;
    pos[o*3+3]=PX[k]+NX[k]*off;pos[o*3+4]=y1;pos[o*3+5]=PZ[k]+NZ[k]*off;
    if(i<N){const a=o,b=o+1,c=o+2,d=o+3;idx.push(a,b,c,b,d,c);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function textTex(text,color,w,h,px,bg){
  return ctex(w,h,(g,cw,ch)=>{
    g.fillStyle=bg||'#0b0d10';g.fillRect(0,0,cw,ch);
    g.font='700 '+px+'px "Chakra Petch",Barlow,sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.shadowColor=color;g.shadowBlur=28;g.fillStyle=color;g.fillText(text,cw/2,ch/2+2);g.fillText(text,cw/2,ch/2+2);
  });
}
function mk(geo,mat,ro){const m=new THREE.Mesh(geo,mat);if(ro!=null)m.renderOrder=ro;return m;}
function polyMat(opts,f,u){opts.polygonOffset=true;opts.polygonOffsetFactor=f;opts.polygonOffsetUnits=u;return opts;}

function buildRace(){
  if(raceBuilt)return;
  buildSamples();buildSpeedProfile();
  const R0=rng(11);

  const skyTex=ctex(1024,512,(g,w,h)=>{
    const gr=g.createLinearGradient(0,0,0,h);
    gr.addColorStop(0,'#03050a');gr.addColorStop(.3,'#0a1226');gr.addColorStop(.43,'#1d2147');gr.addColorStop(.485,'#6a2f4a');gr.addColorStop(.5,'#ff7a1a');gr.addColorStop(.515,'#8a3d1c');gr.addColorStop(.56,'#0b0d12');gr.addColorStop(1,'#050608');
    g.fillStyle=gr;g.fillRect(0,0,w,h);
    let rg=g.createRadialGradient(w*.25,h*.5,0,w*.25,h*.5,w*.22);rg.addColorStop(0,'rgba(255,140,60,.75)');rg.addColorStop(1,'rgba(255,140,60,0)');g.fillStyle=rg;g.fillRect(0,h*.2,w,h*.6);
    rg=g.createRadialGradient(w*.72,h*.5,0,w*.72,h*.5,w*.2);rg.addColorStop(0,'rgba(30,200,255,.5)');rg.addColorStop(1,'rgba(30,200,255,0)');g.fillStyle=rg;g.fillRect(0,h*.2,w,h*.6);
    const r=rng(7);
    for(let i=0;i<520;i++){g.fillStyle='rgba(255,255,255,'+(.2+r()*.7).toFixed(2)+')';g.fillRect(r()*w,r()*h*.42,r()<.1?2:1,1);}
    for(let i=0;i<16;i++){g.fillStyle='rgba(130,150,210,'+(.03+r()*.05).toFixed(3)+')';g.fillRect(r()*w*.6,h*(.1+r()*.32),w*(.2+r()*.4),2+r()*4);}
  });
  raceScene.environment=pmrem.fromEquirectangular(skyTex).texture;
  skyMesh=new THREE.Mesh(new THREE.SphereGeometry(900,32,16),new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,fog:false,depthWrite:false}));
  skyMesh.renderOrder=-10;raceScene.add(skyMesh);
  raceScene.fog=new THREE.FogExp2(C(0x1a1424),.00115);

  raceScene.add(new THREE.HemisphereLight(C(0x5a70a0),C(0x16181c),.75));
  const sun=new THREE.DirectionalLight(C(0xffa066),1.1);sun.position.set(-200,120,-100);raceScene.add(sun);

  const gTex=ctex(128,128,(g,w,h)=>{g.fillStyle='#0f1418';g.fillRect(0,0,w,h);const r=rng(3);for(let i=0;i<900;i++){g.fillStyle='rgba(120,150,150,'+(r()*.07).toFixed(3)+')';g.fillRect(r()*w,r()*h,2,2);}},true);
  gTex.repeat.set(300,300);
  const ground=mk(new THREE.PlaneGeometry(4000,4000),new THREE.MeshStandardMaterial({map:gTex,roughness:1,metalness:0,envMapIntensity:.2}));
  ground.rotation.x=-Math.PI/2;raceScene.add(ground);

  const roadTex=ctex(256,512,(g,w,h)=>{
    g.fillStyle='#2a2d33';g.fillRect(0,0,w,h);const r=rng(5);
    for(let i=0;i<9000;i++){g.fillStyle=(r()<.5?'rgba(255,255,255,':'rgba(0,0,0,')+(.03+r()*.06).toFixed(3)+')';g.fillRect(r()*w,r()*h,1+r()*2,1+r()*2);}
    g.fillStyle='rgba(0,0,0,.14)';g.fillRect(w*.26,0,w*.12,h);g.fillRect(w*.62,0,w*.12,h);
    g.fillStyle='rgba(235,238,244,.88)';g.fillRect(w*.035,0,w*.02,h);g.fillRect(w*.945,0,w*.02,h);
    g.fillStyle='rgba(235,238,244,.9)';g.fillRect(w*.495,0,w*.012,h*.5);
  },true);
  raceScene.add(mk(ribbon(8,-8,.02,16),new THREE.MeshStandardMaterial(polyMat({map:roadTex,roughness:.88,metalness:0,envMapIntensity:.35},-2,-2))));
  const kTex=ctex(16,64,(g,w,h)=>{g.fillStyle='#ff7a1a';g.fillRect(0,0,w,h/2);g.fillStyle='#e9edf2';g.fillRect(0,h/2,w,h/2);},true);
  const kMat=new THREE.MeshStandardMaterial(polyMat({map:kTex,roughness:.7,envMapIntensity:.3},-3,-3));
  raceScene.add(mk(ribbon(9.4,8,.03,4),kMat));raceScene.add(mk(ribbon(-8,-9.4,.03,4),kMat));
  const grTex=ctex(128,128,(g,w,h)=>{g.fillStyle='#4b4a44';g.fillRect(0,0,w,h);const r=rng(9);for(let i=0;i<1400;i++){g.fillStyle=(r()<.5?'rgba(255,240,210,':'rgba(0,0,0,')+(.05+r()*.12).toFixed(3)+')';g.fillRect(r()*w,r()*h,2,2);}},true);
  const grMat=new THREE.MeshStandardMaterial(polyMat({map:grTex,roughness:1,envMapIntensity:.2},-1,-1));
  raceScene.add(mk(ribbon(14.4,9.4,.01,6),grMat));raceScene.add(mk(ribbon(-9.4,-14.4,.01,6),grMat));

  const wallMat=new THREE.MeshStandardMaterial({color:C(0x2a2e35),roughness:.8,metalness:.1,side:THREE.DoubleSide,envMapIntensity:.3});
  raceScene.add(mk(wallRibbon(14.4,0,1.0),wallMat));raceScene.add(mk(wallRibbon(-14.4,0,1.0),wallMat));
  raceScene.add(mk(ribbon(15.2,14.4,1.0,10),wallMat));raceScene.add(mk(ribbon(-14.4,-15.2,1.0,10),wallMat));
  const nB=new THREE.MeshBasicMaterial(polyMat({color:C(0x1ec8ff).multiplyScalar(2.2)},-5,-5)),nO=new THREE.MeshBasicMaterial(polyMat({color:C(0xff7a1a).multiplyScalar(2.2)},-5,-5));
  raceScene.add(mk(ribbon(14.75,14.45,1.02,10),nB));raceScene.add(mk(ribbon(-14.45,-14.75,1.02,10),nO));
  const gradTex=ctex(64,4,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,0);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(255,255,255,1)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const poolMat=c=>new THREE.MeshBasicMaterial(polyMat({map:gradTex,color:C(c),transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false,fog:false},-4,-4));
  raceScene.add(mk(ribbon(14.4,11.2,.05,10),poolMat(0x1ec8ff),1));
  raceScene.add(mk(ribbon(-11.2,-14.4,.05,10,true),poolMat(0xff7a1a),1));

  const chk=ctex(128,32,(g)=>{for(let x=0;x<16;x++)for(let y=0;y<4;y++){g.fillStyle=(x+y)%2?'#0b0c0e':'#f2f4f7';g.fillRect(x*8,y*8,8,8);}});
  const sl=mk(new THREE.PlaneGeometry(16,2.4),new THREE.MeshBasicMaterial(polyMat({map:chk},-4,-4)));
  sl.rotation.x=-Math.PI/2;
  const startG=new THREE.Group();startG.position.set(PX[0],0,PZ[0]);startG.rotation.y=Math.atan2(TX[0],TZ[0]);
  sl.position.y=.04;startG.add(sl);
  const gm=new THREE.MeshStandardMaterial({color:C(0x1b1e23),roughness:.6,metalness:.4});
  [-10.4,10.4].forEach(x=>{const p=mk(new THREE.CylinderGeometry(.38,.38,8,12),gm);p.position.set(x,4,0);startG.add(p);const nl=mk(new THREE.BoxGeometry(.1,7.4,.1),new THREE.MeshBasicMaterial({color:C(x<0?0x1ec8ff:0xff7a1a).multiplyScalar(2)}));nl.position.set(x,4,.4);startG.add(nl);});
  const beam=mk(new THREE.BoxGeometry(21.4,1.7,.7),gm);beam.position.set(0,7.6,0);startG.add(beam);
  const signMat=new THREE.MeshBasicMaterial({map:textTex('START  /  FINISH','#1ec8ff',1024,96,64),fog:false});
  [.37,-.37].forEach((z,i)=>{const sg=mk(new THREE.PlaneGeometry(20.4,1.5),signMat);sg.position.set(0,7.6,z);if(i)sg.rotation.y=Math.PI;startG.add(sg);});
  const strip=mk(new THREE.BoxGeometry(21.4,.12,.8),new THREE.MeshBasicMaterial({color:C(0xff7a1a).multiplyScalar(2.2)}));strip.position.set(0,6.7,0);startG.add(strip);
  raceScene.add(startG);

  const poleGeo=new THREE.CylinderGeometry(.12,.16,9,8);
  for(let i=8,c=0;i<N;i+=20,c++){
    const s=c%2?-1:1,off=s*16.8;
    const px=PX[i]+NX[i]*off,pz=PZ[i]+NZ[i]*off;
    const pole=mk(poleGeo,gm);pole.position.set(px,4.5,pz);raceScene.add(pole);
    const hx=px-NX[i]*s*1.6,hz=pz-NZ[i]*s*1.6;
    const col=s>0?0x66c9ff:0xffa24a;
    const head=glowSprite(col,9,.95);head.position.set(hx,9.1,hz);raceScene.add(head);
    const arm=mk(new THREE.BoxGeometry(.12,.12,1.7),gm);arm.position.set(px-NX[i]*s*.8,9,pz-NZ[i]*s*.8);arm.rotation.y=Math.atan2(NX[i],NZ[i]);raceScene.add(arm);
    const pool=glowSprite(col,26,.22);pool.position.set(PX[i]+NX[i]*s*9,.6,PZ[i]+NZ[i]*s*9);raceScene.add(pool);
  }

  [[110,'NIGHTSHIFT','#1ec8ff',1],[340,'LATE APEX','#ff7a1a',-1],[530,'DRIVE','#1ec8ff',1]].forEach(a=>{
    const i=a[0],s=a[3],off=s*21;
    const g=new THREE.Group();g.position.set(PX[i]+NX[i]*off,0,PZ[i]+NZ[i]*off);
    g.rotation.y=Math.atan2(-NX[i]*s,-NZ[i]*s);
    const board=mk(new THREE.PlaneGeometry(16,4.2),new THREE.MeshBasicMaterial({map:textTex(a[1],a[2],1024,270,150),fog:false,side:THREE.DoubleSide}));board.position.y=7;g.add(board);
    [-6,6].forEach(x=>{const p=mk(new THREE.BoxGeometry(.3,5,.3),gm);p.position.set(x,2.5,-.2);g.add(p);});
    raceScene.add(g);
  });

  const winTex=ctex(64,128,(g,w,h)=>{
    g.fillStyle='#090c12';g.fillRect(0,0,w,h);const r=rng(21);const pal=['#ffd9a0','#9fdcff','#ff9a5a','#cfe6ff'];
    for(let y=0;y<16;y++)for(let x=0;x<6;x++){if(r()<.38){g.fillStyle=pal[(r()*pal.length)|0];g.globalAlpha=.5+r()*.5;g.fillRect(4+x*10,5+y*7.6,5,4);}}
    g.globalAlpha=1;
  });
  const bGeo=new THREE.BoxGeometry(1,1,1);bGeo.translate(0,.5,0);
  const bld=new THREE.InstancedMesh(bGeo,new THREE.MeshBasicMaterial({map:winTex,color:C(0xb8c4e0)}),150);
  const dm=new THREE.Object3D(),cx=40*1.3,cz=90*1.3;
  for(let i=0;i<150;i++){
    const a=R0()*TAU,rr=520+R0()*430;
    dm.position.set(cx+Math.cos(a)*rr,0,cz+Math.sin(a)*rr);
    dm.scale.set(30+R0()*50,50+Math.pow(R0(),2)*240,30+R0()*50);dm.rotation.y=R0()*3;dm.updateMatrix();bld.setMatrixAt(i,dm.matrix);
  }
  raceScene.add(bld);

  for(let i=0;i<28;i++){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,transparent:true,opacity:0,depthWrite:false}));
    sp.visible=false;sp.userData={life:9,max:1};raceScene.add(sp);smokePool.push(sp);
  }
  const COIN_N=57,lanes=[-5,0,5,0,-3,3];
  coinList=[];
  for(let k=0;k<COIN_N;k++){
    const idx=(40+Math.round(k*(N-60)/COIN_N))%N,lat=lanes[Math.floor(k/3)%lanes.length];
    coinList.push({x:PX[idx]+NX[idx]*lat,z:PZ[idx]+NZ[idx]*lat,on:true});
  }
  coinMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.9,.9,.16,22),new THREE.MeshStandardMaterial({color:C(0xffc83a),emissive:C(0xff9a1a).multiplyScalar(.7),metalness:.85,roughness:.25,envMapIntensity:1.2}),COIN_N);
  coinMesh.frustumCulled=false;coinDm=new THREE.Object3D();
  raceScene.add(coinMesh);
  buildMini();
  raceBuilt=true;
}

/* minimap */
const mini=$('mini'),mg=mini.getContext('2d');let miniBase=null,miniT=null;
function buildMini(){
  const s=192,pad=18;let a=1e9,b=-1e9,c=1e9,d=-1e9;
  for(let i=0;i<N;i++){a=Math.min(a,PX[i]);b=Math.max(b,PX[i]);c=Math.min(c,PZ[i]);d=Math.max(d,PZ[i]);}
  const sc=Math.min((s-pad*2)/(b-a),(s-pad*2)/(d-c));
  const ox=(s-(b-a)*sc)/2-a*sc,oz=(s-(d-c)*sc)/2-c*sc;miniT={sc:sc,ox:ox,oz:oz};
  const cv=document.createElement('canvas');cv.width=cv.height=s;const g=cv.getContext('2d');
  g.lineJoin='round';g.lineCap='round';g.beginPath();
  for(let i=0;i<N;i++){const x=PX[i]*sc+ox,y=PZ[i]*sc+oz;if(i)g.lineTo(x,y);else g.moveTo(x,y);}
  g.closePath();g.strokeStyle='rgba(10,11,13,.6)';g.lineWidth=14;g.stroke();
  g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=9;g.stroke();
  g.strokeStyle='#8d97a5';g.lineWidth=2.4;g.stroke();
  g.fillStyle='#ff7a1a';g.beginPath();g.arc(PX[0]*sc+ox,PZ[0]*sc+oz,5,0,TAU);g.fill();
  miniBase=cv;
}
function drawMini(){
  if(!miniBase)return;
  mg.clearRect(0,0,192,192);mg.drawImage(miniBase,0,0);
  ais.forEach(a=>{if(a.x===undefined)return;mg.fillStyle='#ff7a1a';mg.beginPath();mg.arc(a.x*miniT.sc+miniT.ox,a.z*miniT.sc+miniT.oz,4,0,TAU);mg.fill();});
  const x=car.x*miniT.sc+miniT.ox,y=car.z*miniT.sc+miniT.oz;
  mg.fillStyle='#1ec8ff';mg.strokeStyle='#fff';mg.lineWidth=2;mg.beginPath();mg.arc(x,y,6,0,TAU);mg.fill();mg.stroke();
}

/* ================= audio ================= */
let AC=null;const AU={};
function audioInit(){
  if(AC){if(AC.state==='suspended')AC.resume();return;}
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
    AC=new Ctx();AU.master=AC.createGain();AU.master.gain.value=S.sound?1:0;AU.master.connect(AC.destination);
    AU.o1=AC.createOscillator();AU.o1.type='sawtooth';AU.o2=AC.createOscillator();AU.o2.type='square';
    AU.f=AC.createBiquadFilter();AU.f.type='lowpass';AU.f.frequency.value=600;AU.f.Q.value=1.2;
    AU.eg=AC.createGain();AU.eg.gain.value=0;
    const m1=AC.createGain(),m2=AC.createGain();m1.gain.value=.5;m2.gain.value=.25;
    AU.o1.connect(m1);AU.o2.connect(m2);m1.connect(AU.f);m2.connect(AU.f);AU.f.connect(AU.eg);AU.eg.connect(AU.master);
    AU.o1.start();AU.o2.start();
    const len=AC.sampleRate*2,buf=AC.createBuffer(1,len,AC.sampleRate),dd=buf.getChannelData(0);
    for(let i=0;i<len;i++)dd[i]=Math.random()*2-1;AU.buf=buf;
    const ns=AC.createBufferSource();ns.buffer=buf;ns.loop=true;
    AU.bp=AC.createBiquadFilter();AU.bp.type='bandpass';AU.bp.frequency.value=1500;AU.bp.Q.value=.9;
    AU.sg=AC.createGain();AU.sg.gain.value=0;ns.connect(AU.bp);AU.bp.connect(AU.sg);AU.sg.connect(AU.master);ns.start();
  }catch(e){AC=null;}
}
function beep(f,d,v){
  if(!AC||!S.sound)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();
  o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v||.15,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(AU.master);o.start(t);o.stop(t+d+.02);
}
function click(){beep(900,.05,.08);}
let lastHit=0;
function thump(k){
  if(!AC||!S.sound)return;const now=performance.now();if(now-lastHit<150)return;lastHit=now;
  const t=AC.currentTime,s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();
  s.buffer=AU.buf;f.type='lowpass';f.frequency.value=380;g.gain.setValueAtTime(.5*k,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);
  s.connect(f);f.connect(g);g.connect(AU.master);s.start(t,Math.random());s.stop(t+.4);
}
const TH=[0,50,85,120,160,200];
function gearOf(kmh){let g=1;for(let k=1;k<TH.length;k++)if(kmh>=TH[k])g=k+1;return g;}
function engineAudio(kmh,thr,on,skid){
  if(!AC)return;const t=AC.currentTime,g=gearOf(kmh);
  let rpm;
  if(kmh<3)rpm=900+thr*3500;
  else{const lo=TH[g-1],hi=g<6?TH[g]:300;rpm=1000+clamp((kmh-lo)/(hi-lo),0,1)*5600+thr*600;}
  AU.o1.frequency.setTargetAtTime(rpm/60*2,t,.04);AU.o2.frequency.setTargetAtTime(rpm/60,t,.04);
  AU.f.frequency.setTargetAtTime(500+rpm*.35,t,.05);
  AU.eg.gain.setTargetAtTime(on?.07+.08*thr:0,t,.06);
  AU.sg.gain.setTargetAtTime(on?clamp(skid,0,1)*.16:0,t,.05);
}
function setMaster(){if(AC)AU.master.gain.value=S.sound?1:0;}

/* ================= race state, input, physics ================= */
const R={mode:'menu',prev:'menu',clock:0,lapStart:null,lap:0,laps:3,prog:0,lapTimes:[],cd:0,cdN:4,acc:0,finishT:0,wrong:false,newBest:false,rewarded:false,place:0};
const car={x:0,z:0,h:0,vx:0,vz:0,steer:0,sa:0,near:0,last:0,lat:0,yaw:0,al:0,pitch:0,roll:0,shake:0,slip:0,def:null,obj:null,camH:0,fov:62,smokeT:0,vF:0};
const inp={left:false,right:false,gas:false,brake:false,hand:false};
const SHOW=m=>m==='menu'||m==='settings';

function physFor(id,g){
  const p=Object.assign({},CAR_BY[id].ph),e=g.eng,t=TIRES[g.tire];
  p.vmax*=1+.035*e.speed;p.accel*=1+.05*e.accel;p.mu*=t.grip*(1+.025*e.handling);p.steer*=1+.02*e.handling;
  return p;
}
function nearest(x,z,full){
  let best=1e12,bi=car.near;
  if(full){for(let i=0;i<N;i++){const dx=x-PX[i],dz=z-PZ[i],d=dx*dx+dz*dz;if(d<best){best=d;bi=i;}}}
  else{for(let k=-14;k<=14;k++){const i=(car.near+k+N)%N,dx=x-PX[i],dz=z-PZ[i],d=dx*dx+dz*dz;if(d<best){best=d;bi=i;}}}
  return bi;
}
function placeCar(idx,lat){
  lat=lat||0;const k=((idx%N)+N)%N;car.x=PX[k]+NX[k]*lat;car.z=PZ[k]+NZ[k]*lat;car.h=Math.atan2(TX[k],TZ[k]);car.vx=car.vz=0;car.steer=0;car.sa=0;car.near=k;car.last=k;car.lat=lat;car.yaw=0;car.al=0;
  car.camH=car.h;
}
function physStep(dt,ctl){
  const d=car.def.ph,g=9.81;
  let f0=Math.sin(car.h),f1=Math.cos(car.h),l0=f1,l1=-f0;
  let vF=car.vx*f0+car.vz*f1,vL=car.vx*l0+car.vz*l1;
  const off=Math.abs(car.lat)>9.4;
  let mu=d.mu*(off?d.muOff:1);
  const hand=ctl.hand&&Math.abs(vF)>6;
  if(hand)mu*=.45;
  if(ctl.brk>0&&vF>3)mu*=1-.22*ctl.brk;
  let a=0;
  if(ctl.thr>0)a+=ctl.thr*d.accel*Math.min(1.4,Math.max(0,1-vF/d.vmax))*(off?.7:1);
  if(ctl.brk>0){
    if(vF>.8){vF-=Math.min(vF,d.brake*ctl.brk*dt);}
    else a-=ctl.brk*d.accel*.6*clamp(1+vF/d.rev,0,1);
  }
  if(ctl.thr===0&&ctl.brk===0){const eb=Math.min(Math.abs(vF),1.6*dt);vF-=Math.sign(vF)*eb;}
  a-=.0009*vF*Math.abs(vF);
  if(off)a-=vF*d.offDrag;
  if(hand)a-=Math.sign(vF)*5;
  vF+=a*dt;
  const maxS=clamp(Math.atan(d.L*mu*g*1.1/Math.max(vF*vF,3)),.04,d.steer);
  car.sa=ctl.steerIn*maxS;
  let yaw=vF*Math.tan(car.sa)/d.L;
  if(hand)yaw*=1.55;
  car.yaw=yaw;
  let vx=f0*vF+l0*vL,vz=f1*vF+l1*vL;
  car.h+=yaw*dt;
  f0=Math.sin(car.h);f1=Math.cos(car.h);l0=f1;l1=-f0;
  vF=vx*f0+vz*f1;vL=vx*l0+vz*l1;
  const aL=clamp(-vL*d.latK*(hand?.45:1),-mu*g,mu*g);
  let nvL=vL+aL*dt;if(vL*nvL<0)nvL=0;
  vF-=Math.abs(nvL-vL)*.06*Math.sign(vF);vL=nvL;
  car.al=aL;car.slip=Math.abs(vL);car.vF=vF;
  vx=f0*vF+l0*vL;vz=f1*vF+l1*vL;
  car.x+=vx*dt;car.z+=vz*dt;car.vx=vx;car.vz=vz;
  car.near=nearest(car.x,car.z,false);
  const i=car.near;
  let lat=(car.x-PX[i])*NX[i]+(car.z-PZ[i])*NZ[i];
  const LIM=13.3;
  if(Math.abs(lat)>LIM){
    const s=Math.sign(lat),pen=Math.abs(lat)-LIM;
    car.x-=NX[i]*s*pen;car.z-=NZ[i]*s*pen;lat=s*LIM;
    const vn=(car.vx*NX[i]+car.vz*NZ[i])*s;
    if(vn>0){
      car.vx-=1.18*vn*NX[i]*s;car.vz-=1.18*vn*NZ[i]*s;car.vx*=.93;car.vz*=.93;
      if(vn>5){car.shake=Math.max(car.shake,clamp(vn/18,.15,1));thump(clamp(vn/15,.2,1));}
    }
    const th=Math.atan2(TX[i],TZ[i]),fwd=(car.vx*TX[i]+car.vz*TZ[i])>=0;
    car.h+=angDiff(fwd?th:th+Math.PI,car.h)*Math.min(1,3*dt);
  }
  car.lat=lat;
}

/* ================= tilt steering ================= */
let tiltOn=false,tiltSeen=false,tiltRaw=null,tiltBase=null,tiltAng=0;
function onTilt(e){
  if(e.beta==null||e.gamma==null)return;
  tiltSeen=true;
  const b=e.beta*Math.PI/180,g=e.gamma*Math.PI/180;
  const dx=Math.sin(g)*Math.cos(b),dy=-Math.sin(b);
  if(Math.hypot(dx,dy)<.25)return;
  tiltRaw=Math.atan2(dx,-dy);
  if(tiltBase===null)tiltBase=tiltRaw;
}
function calibrateTilt(){if(tiltRaw!==null){tiltBase=tiltRaw;tiltAng=0;}}
function enableTilt(){
  if(tiltOn)return;
  const D=window.DeviceOrientationEvent;
  const start=()=>{
    tiltOn=true;addEventListener('deviceorientation',onTilt);
    setTimeout(()=>{if(!tiltSeen){if(S.steer==='tilt'){S.steer='wheel';save();applyTouchUI();}toast('No motion data here, so controls went back to the steering wheel. Tilt works when you open the game link directly in Safari or Chrome.');}else toast('Controls: Tilt phone');},2200);
  };
  if(!D){S.steer='wheel';save();applyTouchUI();toast('This device has no motion sensor. Using the steering wheel.');return;}
  if(typeof D.requestPermission==='function'){
    D.requestPermission().then(r=>{if(r==='granted')start();else{S.steer='wheel';save();applyTouchUI();toast('Motion access was denied, so the steering wheel is on. On iPhone: Settings > Safari > Motion & Orientation Access.');}}).catch(()=>toast('Could not ask for motion access. Tap Tilt again.'));
  }else start();
}

/* ================= steering wheel ================= */
const MAXW=1.9;let wAng=0,wDrag=null;
const wheelEl=$('wheel'),wheelSvg=$('wheelSvg');
wheelEl.addEventListener('pointerdown',e=>{
  if(S.steer!=='wheel')return;
  e.preventDefault();
  const r=wheelEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  wDrag={id:e.pointerId,cx:cx,cy:cy,a0:Math.atan2(e.clientY-cy,e.clientX-cx),base:wAng};
  try{wheelEl.setPointerCapture(e.pointerId);}catch(_){}
});
wheelEl.addEventListener('pointermove',e=>{
  if(!wDrag||e.pointerId!==wDrag.id)return;
  const a=Math.atan2(e.clientY-wDrag.cy,e.clientX-wDrag.cx);
  wAng=clamp(wDrag.base+angDiff(a,wDrag.a0),-MAXW,MAXW);
});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>wheelEl.addEventListener(ev,()=>{wDrag=null;}));
wheelEl.addEventListener('contextmenu',e=>e.preventDefault());

/* ================= HUD helpers ================= */
const banner=$('banner');let bannerT=0;
function say(text,cls,ms){
  banner.textContent=text;banner.className='banner show '+(cls||'');bannerT=ms||900;
  banner.style.animation='none';void banner.offsetWidth;banner.style.animation='';
}
function setHud(){
  $('spdUnit').textContent=S.units==='kmh'?'km/h':'mph';
  const b=S.stats.best[S.sel];$('bestTime').textContent=b?fmtTime(b):'--:--';
}
let lastSpd=-1,lastLapTxt='',lastGear='',lastPos='',lastCoin=-1;
function updateHud(){
  const sp=Math.hypot(car.vx,car.vz),kmh=sp*3.6,shown=Math.round(S.units==='kmh'?kmh:kmh*.621371);
  if(shown!==lastSpd){lastSpd=shown;$('spd').textContent=shown;}
  const gr=car.vF<-1?'R':(sp<.6?'N':String(gearOf(kmh)));
  if(gr!==lastGear){lastGear=gr;$('gear').textContent=gr;}
  const lt=R.lapStart==null?'0:00.00':fmtTime(R.clock-R.lapStart);
  if(lt!==lastLapTxt){lastLapTxt=lt;$('lapTime').textContent=lt;}
  $('lapNum').textContent=Math.max(0,Math.min(R.lap,R.laps))+'/'+R.laps;
  const pos=(R.mode==='finished'&&R.place?R.place:rankNow())+'/'+(ais.length+1);
  if(pos!==lastPos){lastPos=pos;$('posTxt').textContent=pos;}
  if(coinGot!==lastCoin){lastCoin=coinGot;$('coinTxt').textContent=coinGot;}
}

/* ================= race flow ================= */
function makeAIs(){
  ais.forEach(a=>raceScene.remove(a.o.root));ais=[];
  const ids=CARS.map(c=>c.id).filter(id=>id!==S.sel);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=ids[i];ids[i]=ids[j];ids[j]=t;}
  const slots=[0,1,2,4,5],lanes=[-5,-2.5,0,2.5,5];
  for(let i=lanes.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=lanes[i];lanes[i]=lanes[j];lanes[j]=t;}
  for(let k=0;k<5;k++){
    const def=CAR_BY[ids[k%ids.length]],g=defGarage(def);
    g.paint=Math.floor(Math.random()*PAINTS.length);g.glow=Math.random()<.5?'blue':'orange';
    const o=buildCar(def.id,g,true);mergeBody(o);raceScene.add(o.root);
    const gs=gridSlot(slots[k]);
    ais.push({o:o,name:AI_NAMES[k],skill:.9+Math.random()*.09,top:50+Math.random()*10,back:gs.back,lane:gs.lat,laneT:lanes[k],lat:gs.lat,s:-gs.back,v:0,h:0,fin:0});
  }
}
function updateAI(dt){
  const run=R.mode==='race'||R.mode==='finished',ps=R.prog*DS;
  for(let k=0;k<ais.length;k++){
    const a=ais[k];
    const idx=((a.s/DS)%N+N)%N,i0=Math.floor(idx)%N,f=idx-Math.floor(idx),i1=(i0+1)%N;
    let target=Math.min(vProf[i0],a.top)*a.skill;
    target*=1+clamp((ps-a.s)/3000,-.05,.07);
    for(let j=0;j<ais.length;j++){if(j===k)continue;const b=ais[j],gap=b.s-a.s;if(gap>0&&gap<15&&Math.abs(b.lat-a.lat)<2.8)target=Math.min(target,b.v*.97);}
    const pg=ps-a.s;if(pg>0&&pg<15&&Math.abs(car.lat-a.lat)<2.8)target=Math.min(target,Math.max(Math.hypot(car.vx,car.vz)*.97,6));
    if(run)a.v+=clamp(target-a.v,-26*dt,10*dt);else a.v=0;
    a.s+=a.v*dt;
    a.lat=clamp(lerp(a.lane,a.laneT,clamp(a.s/220,0,1))+Math.sin(a.s*.015+k*2)*.9,-8,8);
    a.x=lerp(PX[i0],PX[i1],f)+NX[i0]*a.lat;a.z=lerp(PZ[i0],PZ[i1],f)+NZ[i0]*a.lat;
    a.h=Math.atan2(lerp(TX[i0],TX[i1],f),lerp(TZ[i0],TZ[i1],f));
    a.o.root.position.set(a.x,0,a.z);a.o.root.rotation.y=a.h;
    a.o.wheels.forEach(w=>{w.spin.rotation.x+=a.v*dt/a.o.sp.r;});
    tailLight(a.o,target<a.v-1?1:0);
    if(a.fin===0&&a.s>=R.laps*LEN)a.fin=++finishCount;
  }
}
function collideAI(){
  const f0=Math.sin(car.h),f1=Math.cos(car.h);
  for(let k=0;k<ais.length;k++){
    const a=ais[k],dx=car.x-a.x,dz=car.z-a.z;
    if(dx*dx+dz*dz>30)continue;
    const dl=dx*f0+dz*f1,dw=dx*f1-dz*f0,pl=4.4-Math.abs(dl),pw=2.1-Math.abs(dw);
    if(pl<=0||pw<=0)continue;
    let nx,nz,pen;
    if(pw<pl){const s=dw>=0?1:-1;nx=f1*s;nz=-f0*s;pen=pw;}else{const s=dl>=0?1:-1;nx=f0*s;nz=f1*s;pen=pl;}
    car.x+=nx*pen*.55;car.z+=nz*pen*.55;
    const avx=Math.sin(a.h)*a.v,avz=Math.cos(a.h)*a.v,rel=(car.vx-avx)*nx+(car.vz-avz)*nz;
    if(rel<0){
      car.vx-=1.15*rel*nx;car.vz-=1.15*rel*nz;
      const along=-(nx*Math.sin(a.h)+nz*Math.cos(a.h));
      a.v=Math.max(0,a.v+(-rel)*.4*along);
      if(-rel>3){car.shake=Math.max(car.shake,clamp(-rel/16,.1,.7));thump(clamp(-rel/14,.2,.8));}
    }
  }
}
function updateCoins(t,collect){
  if(!coinMesh)return;
  const dm=coinDm;
  for(let k=0;k<coinList.length;k++){
    const c=coinList[k];
    if(c.on&&collect){const dx=car.x-c.x,dz=car.z-c.z;if(dx*dx+dz*dz<7.5){c.on=false;coinGot++;beep(1250+Math.min(coinGot,20)*20,.09,.1);}}
    if(c.on){dm.position.set(c.x,1.25+Math.sin(t*3+k)*.18,c.z);dm.rotation.set(0,t*3+k,Math.PI/2,'YXZ');dm.scale.set(1,1,1);}
    else{dm.position.set(c.x,-50,c.z);dm.scale.set(.001,.001,.001);}
    dm.updateMatrix();coinMesh.setMatrixAt(k,dm.matrix);
  }
  coinMesh.instanceMatrix.needsUpdate=true;
}
function rankNow(){const ps=R.prog*DS;let r=1;for(let k=0;k<ais.length;k++)if(ais[k].s>ps)r++;return r;}

function startRace(){
  audioInit();toggleProfile(false);toggleStation(false);
  buildRace();
  if(raceCar){raceScene.remove(raceCar.root);}
  const g=garageOf(S.sel);
  raceCar=buildCar(S.sel,g);
  mergeBody(raceCar);
  raceCar.m.paint.envMapIntensity=2.3;raceCar.m.glass.envMapIntensity=3;
  const spot=new THREE.SpotLight(C(0xe6f2ff),1.6,80,.5,.5,1);spot.position.set(0,.9,2.1);raceCar.root.add(spot);
  spot.target.position.set(0,.3,22);raceCar.root.add(spot.target);
  raceScene.add(raceCar.root);
  car.def={ph:physFor(S.sel,g)};car.obj=raceCar;
  makeAIs();
  resetRace();
}
function resetRace(){
  const gs=gridSlot(PLAYER_SLOT),steps=Math.round(gs.back/DS),sIdx=(N-steps)%N;
  placeCar(sIdx,gs.lat);
  car.near=sIdx;car.last=sIdx;
  R.clock=0;R.lapStart=null;R.lap=0;R.prog=-steps;R.lapTimes=[];R.acc=0;R.cd=3.4;R.cdN=4;R.wrong=false;R.newBest=false;R.rewarded=false;R.place=0;R.finishT=0;
  coinGot=0;finishCount=0;coinList.forEach(c=>{c.on=true;});
  ais.forEach(a=>{a.s=-a.back;a.v=0;a.fin=0;a.lat=a.lane;});
  car.shake=0;lastSpd=-1;lastLapTxt='';lastPos='';lastCoin=-1;calibrateTilt();
  R.mode='countdown';
  smokePool.forEach(s=>{s.visible=false;s.userData.life=9;});
  showOnly(['hud']);setHud();applyTouchUI();
  banner.className='banner';
  updateAI(0);updateCoins(0,false);
  updateHud();
}
function showOnly(list){['menu','settings','hud','pause','result'].forEach(k=>{$(k).hidden=list.indexOf(k)<0;});}
function toMenu(){
  R.mode='menu';
  if(raceCar){raceScene.remove(raceCar.root);}
  ais.forEach(a=>raceScene.remove(a.o.root));ais=[];
  if(AC&&AU.eg)engineAudio(0,0,false,0);
  viewId=S.sel;rebuildShowCar();setupMenu();renderAll();showOnly(['menu']);
}
function pauseRace(){
  if(R.mode!=='race'&&R.mode!=='countdown')return;
  R.prev=R.mode;R.mode='paused';$('pCal').hidden=S.steer!=='tilt';showOnly(['hud','pause']);
  if(AC&&AU.eg)engineAudio(0,0,false,0);
}
function resumeRace(){if(R.mode!=='paused')return;R.mode=R.prev;showOnly(['hud']);}
function finishRace(){
  R.mode='finished';R.finishT=0;R.place=finishCount+1;
  say('FINISH  P'+R.place,'',1800);beep(880,.5,.14);
}
function showResult(){
  const total=R.lapTimes.reduce((a,b)=>a+b,0);
  const PR=[1500,1000,700,500,350,250],placeCr=PR[R.place-1]||250,coinCr=coinGot*25,bestCr=R.newBest?300:0,reward=placeCr+coinCr+bestCr;
  if(!R.rewarded){R.rewarded=true;S.credits+=reward;S.stats.races++;save();}
  $('rTotal').textContent=fmtTime(total);
  $('rNew').textContent=R.newBest?'New best lap':'';
  $('rList').innerHTML='<div><span>Position</span><b>'+R.place+' / '+(ais.length+1)+'</b></div>'+R.lapTimes.map((t,i)=>'<div><span>Lap '+(i+1)+'</span><b>'+fmtTime(t)+'</b></div>').join('')+'<div><span>Coins '+coinGot+'</span><b>+'+fmtC(coinCr)+'</b></div>';
  $('rReward').textContent='+'+fmtC(reward)+' credits';
  showOnly(['hud','result']);
}
function lapDone(){
  const t=R.clock-R.lapStart;R.lapTimes.push(t);
  if(!S.stats.best[S.sel]||t<S.stats.best[S.sel]){S.stats.best[S.sel]=t;R.newBest=true;save();setHud();}
  if(R.lap>=R.laps){finishRace();return;}
  say('LAP '+(R.lap+1)+'  '+fmtTime(t),'sm',1600);beep(660,.2,.12);
  R.lap++;R.lapStart=R.clock;
}
function spawnSmoke(x,z){
  for(let i=0;i<smokePool.length;i++){const s=smokePool[i];if(!s.visible){s.visible=true;s.position.set(x,.35,z);s.userData.life=0;s.userData.max=.9;s.scale.set(1.2,1.2,1);s.material.opacity=.3;return;}}
}
function updateRace(dt){
  const d=car.def.ph;
  if(R.mode==='countdown'){
    R.cd-=dt;
    const n=R.cd>2.4?3:R.cd>1.4?2:R.cd>.4?1:0;
    if(n!==R.cdN){R.cdN=n;if(n>0){say(String(n),'',900);beep(440,.18,.14);}else{say('GO','warn',800);beep(880,.4,.16);R.mode='race';calibrateTilt();}}
  }
  const racing=R.mode==='race';
  if(racing||R.mode==='finished')R.clock+=dt*1000;
  const ctl={thr:0,brk:0,steerIn:0,hand:false};
  if(racing){ctl.thr=inp.gas?1:0;ctl.brk=inp.brake?1:0;ctl.hand=inp.hand;}
  else if(R.mode==='finished'){ctl.brk=.5;}

  /* steering: tilt, wheel angle when touched, or keys / L-R buttons */
  let tgt=0,rate;
  const keyT=(inp.left?1:0)-(inp.right?1:0);
  const tilting=S.steer==='tilt'&&tiltOn&&tiltBase!==null;
  if(tilting){
    if(tiltRaw!==null)tiltAng+=(angDiff(tiltRaw,tiltBase)-tiltAng)*Math.min(1,dt*12);
    let u=clamp(tiltAng/(.6/(S.sens/100)),-1,1);if(Math.abs(u)<.06)u=0;
    wAng=u*MAXW;
    tgt=racing?(keyT||-u):0;rate=16;
  }else if(racing&&wDrag){
    tgt=Math.abs(wAng)<.04?0:-wAng/MAXW;rate=14*(S.sens/100);
  }else{
    tgt=racing?keyT:0;
    rate=tgt===0?6.5:(car.steer*tgt<0?9:4.2*(S.sens/100));
  }
  car.steer+=clamp(tgt-car.steer,-rate*dt,rate*dt);
  ctl.steerIn=car.steer;
  if(!wDrag&&!tilting)wAng*=Math.exp(-dt*9);
  wheelSvg.style.transform='rotate('+(wAng*180/Math.PI).toFixed(1)+'deg)';

  const px=car.vx,pz=car.vz;
  R.acc+=dt;let n=0;
  while(R.acc>=1/120&&n<8){physStep(1/120,ctl);R.acc-=1/120;n++;}
  if(n===8)R.acc=0;
  const i=car.near;let dI=i-car.last;if(dI>N/2)dI-=N;else if(dI<-N/2)dI+=N;car.last=i;R.prog+=dI;
  if(racing){
    if(R.lapStart==null&&R.prog>=0){R.lapStart=R.clock;R.lap=1;say('LAP 1','sm',1200);}
    else if(R.lapStart!=null&&R.prog>=R.lap*N)lapDone();
    const along=car.vx*TX[i]+car.vz*TZ[i];
    R.wrong=along<-4;
    if(R.wrong&&bannerT<=0)say('WRONG WAY','warn sm',900);
  }
  if(R.mode==='finished'){R.finishT+=dt;if(R.finishT>1.8&&$('result').hidden)showResult();}

  updateAI(dt);collideAI();updateCoins(performance.now()/1000,racing);
  const o=car.obj,sp=Math.hypot(car.vx,car.vz),f0=Math.sin(car.h),f1=Math.cos(car.h);
  const aLong=(car.vx*f0+car.vz*f1-(px*f0+pz*f1))/Math.max(dt,.001);
  o.root.position.set(car.x,0,car.z);o.root.rotation.y=car.h;
  car.pitch=lerp(car.pitch,clamp(-aLong*.006,-.05,.05),Math.min(1,dt*8));
  car.roll=lerp(car.roll,clamp(car.yaw*car.vF*.0075*d.roll,-.09,.09),Math.min(1,dt*8));
  o.body.rotation.x=car.pitch;o.body.rotation.z=car.roll;
  o.wheels.forEach(w=>{w.spin.rotation.x+=car.vF*dt/o.sp.r;if(w.front)w.root.rotation.y=car.sa;});
  tailLight(o,(inp.brake&&racing)||car.vF<-1?1:0);
  const slipping=car.slip>3.4&&sp>8,hardBrake=inp.brake&&racing&&car.vF>14;
  car.smokeT-=dt;
  if((slipping||hardBrake)&&car.smokeT<=0){
    car.smokeT=.045;const bz=-o.sp.axle;
    [-1,1].forEach(s=>spawnSmoke(car.x+f0*bz+f1*s*o.sp.wx,car.z+f1*bz-f0*s*o.sp.wx));
  }
  smokePool.forEach(s=>{if(!s.visible)return;const u=s.userData;u.life+=dt;if(u.life>=u.max){s.visible=false;return;}const k=u.life/u.max;s.scale.setScalar(1.2+k*3.8);s.position.y+=dt*.7;s.material.opacity=.32*(1-k);});

  car.camH+=angDiff(car.h,car.camH)*Math.min(1,dt*5);
  const cs=Math.sin(car.camH),cc=Math.cos(car.camH),dist=d.camDist+sp*.035;
  car.shake=Math.max(0,car.shake-dt*2.2);
  const sh=car.shake*.35;
  raceCam.position.set(car.x-cs*dist+(Math.random()-.5)*sh,d.camH+(Math.random()-.5)*sh,car.z-cc*dist+(Math.random()-.5)*sh);
  raceCam.lookAt(car.x+cs*6,1.2,car.z+cc*6);
  const tf=60+sp*.32;car.fov=lerp(car.fov,tf,Math.min(1,dt*3));
  if(Math.abs(raceCam.fov-car.fov)>.05){raceCam.fov=car.fov;raceCam.updateProjectionMatrix();}
  skyMesh.position.copy(raceCam.position);

  updateHud();drawMini();
  if(bannerT>0){bannerT-=dt*1000;if(bannerT<=0)banner.className='banner';}
  engineAudio(sp*3.6,ctl.thr,true,(car.slip-2.5)/6);
}

/* ================= menu UI ================= */
let toastT=0;
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600);}
function setupMenu(){
  const def=CAR_BY[viewId],g=garageOf(viewId);
  $('mSub').textContent=def.name+'  -  '+PAINTS[g.paint].n;
}
function toggleProfile(force){
  const p=$('profilePanel'),open=force!==undefined?force:p.hidden;
  p.hidden=!open;$('bProfile').setAttribute('aria-expanded',open?'true':'false');
  if(open&&!$('stationPanel').hidden)toggleStation(false);
}
$('bProfile').addEventListener('click',()=>{click();toggleProfile();});
addEventListener('pointerdown',e=>{const p=$('profilePanel');if(!p.hidden&&!p.contains(e.target)&&!$('bProfile').contains(e.target))toggleProfile(false);});
function renderProfile(){
  const u=$('uname');if(document.activeElement!==u)u.value=S.name;
  $('cOwned').textContent=Object.keys(S.owned).length+' / '+CARS.length;
  $('cCredits').textContent=fmtC(S.credits);
  $('chipCr').textContent=fmtC(S.credits);
  [['avImg','avDef'],['fabImg','fabDef']].forEach(ids=>{
    const img=$(ids[0]),def=$(ids[1]);
    if(cloudUser&&cloudUser.photo){img.src=cloudUser.photo;img.hidden=false;def.style.display='none';}
    else{img.hidden=true;def.style.display='';}
  });
  $('loginTxt').textContent=cloudUser?(cloudUser.name||'Signed in'):'Login with Gmail';
  $('loginSub').textContent=cloudUser?(cloudUser.email||'Progress is saved to the cloud'):'Save progress, cars';
  $('bSignOut').hidden=!cloudUser;
}
function rimSVG(i){
  const r=RIMS[i],sp=r.sp,thin=i===1;let s='<svg class="ic" viewBox="-50 -50 100 100" aria-hidden="true"><circle r="46" fill="#0b0c0e"/><circle r="34" fill="none" stroke="'+r.svg+'" stroke-width="4"/>';
  for(let k=0;k<sp;k++){s+='<rect x="'+(thin?-1.2:-3)+'" y="-33" width="'+(thin?2.4:6)+'" height="30" fill="'+r.svg+'" transform="rotate('+(k*360/sp)+')"/>';}
  return s+'<circle r="6" fill="'+r.svg+'"/></svg>';
}
function statBars(id,g){
  const p=physFor(id,g);
  const v=[['Speed',p.vmax/90],['Accel',p.accel/16],['Handling',(p.mu*p.steer)/(1.65*.72)]];
  return v.map(x=>'<div class="bar"><span>'+x[0]+'</span><i><b style="width:'+Math.round(clamp(x[1],.05,1)*100)+'%"></b></i></div>').join('');
}
function renderCustom(){
  const g=S.owned[S.sel],def=CAR_BY[S.sel];
  let h='<div class="sec"><div class="lbl">Finish</div><div class="seg">'+FINISH.map(f=>'<button data-a="fin" data-v="'+f[0]+'"'+(g.fin===f[0]?' class="on"':'')+'>'+f[1]+'</button>').join('')+'</div></div>';
  h+='<div class="sec"><div class="lbl">Color <span>'+PAINTS[g.paint].n+'</span></div><div class="sws">'+PAINTS.map((p,i)=>'<button class="sw'+(g.paint===i?' on':'')+'" data-a="col" data-v="'+i+'" aria-label="'+p.n+'" style="background:#'+p.c.toString(16).padStart(6,'0')+'"></button>').join('')+'</div></div>';
  h+='<div class="sec"><div class="lbl">Rims</div><div class="opts">'+RIMS.map((r,i)=>{const own=g.unl.rim.indexOf(i)>=0;return '<button class="opt'+(g.rim===i?' on':'')+'" data-a="rim" data-v="'+i+'" aria-label="'+r.n+' rims">'+rimSVG(i)+'<span>'+r.n+'</span><span class="'+(own?'ok':'pr')+'">'+(own?(g.rim===i?'Fitted':'Owned'):fmtC(r.price))+'</span></button>';}).join('')+'</div></div>';
  h+='<div class="sec"><div class="lbl">Tires <span>grip +'+Math.round((TIRES[g.tire].grip-1)*100)+'%</span></div><div class="opts">'+TIRES.map((t,i)=>{const own=g.unl.tire.indexOf(i)>=0;return '<button class="opt'+(g.tire===i?' on':'')+'" data-a="tire" data-v="'+i+'"><span style="font-size:1.05rem;letter-spacing:.1em">'+(i===0?'○':i===1?'◎':'◉')+'</span><span>'+t.n+'</span><span class="'+(own?'ok':'pr')+'">'+(own?(g.tire===i?'Fitted':'Owned'):fmtC(t.price))+'</span></button>';}).join('')+'</div></div>';
  h+='<div class="sec"><div class="lbl">Engine</div>'+ENG.map(e=>{const lv=g.eng[e[0]],max=lv>=ENG_MAX;let pips='';for(let k=0;k<ENG_MAX;k++)pips+='<i'+(k<lv?' class="on"':'')+'></i>';return '<div class="eng"><span>'+e[1]+'</span><span class="pips">'+pips+'</span><button class="up" data-a="eng" data-v="'+e[0]+'"'+(max?' disabled':'')+'>'+(max?'MAX':'+ '+fmtC(engPrice(lv)))+'</button></div>';}).join('')+'</div>';
  h+='<div class="sec"><div class="lbl">Underglow</div><div class="seg"><button data-a="glow" data-v="blue"'+(g.glow==='blue'?' class="on"':'')+'>Blue</button><button data-a="glow" data-v="orange"'+(g.glow==='orange'?' class="on"':'')+'>Orange</button></div></div>';
  h+='<div class="sec"><div class="lbl">'+def.name+' <span>current build</span></div><div class="bars">'+statBars(S.sel,g)+'</div></div>';
  $('bodyCustom').innerHTML=h;
}
function renderDealer(){
  const h='<div class="grid2">'+CARS.map(c=>{
    const own=!!S.owned[c.id];
    return '<button class="card'+(viewId===c.id?' on':'')+'" data-id="'+c.id+'"><div class="th">'+(THUMB[c.id]?'<img alt="'+c.name+'" src="'+THUMB[c.id]+'">':'<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 15l1.6-5A2 2 0 0 1 6.5 8.6h11a2 2 0 0 1 1.9 1.4L21 15v3h-2.5M3 15v3h2.5M3 15h18"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg>')+'</div><span>'+c.name+'</span><span class="'+(own?'ow':'pr')+'">'+(own?(S.sel===c.id?'In use':'Owned'):fmtC(c.price)+' cr')+'</span></button>';
  }).join('')+'</div>';
  const scroll=$('bodyDealer').scrollTop;
  $('bodyDealer').innerHTML=h;$('bodyDealer').scrollTop=scroll;
  renderBuy();
}
function renderBuy(){
  const bar=$('buybar'),dealer=!$('bodyDealer').hidden;
  bar.hidden=!dealer;if(!dealer)return;
  const c=CAR_BY[viewId],own=!!S.owned[viewId];
  $('buyName').textContent=c.name;
  $('buyInfo').textContent=c.tag;
  const b=$('bBuy');
  if(own){b.textContent=S.sel===viewId?'Selected':'Select';b.disabled=S.sel===viewId;}
  else{b.textContent='Buy '+fmtC(c.price);b.disabled=false;}
}
function renderAll(){renderProfile();renderCustom();renderDealer();setupMenu();}
function toggleStation(force){
  const p=$('stationPanel'),open=force!==undefined?force:p.hidden;
  p.hidden=!open;$('bStation').setAttribute('aria-expanded',open?'true':'false');
  offXt=open?.17:0;
  if(open){toggleProfile(false);if(!$('bodyDealer').hidden)makeThumbs();}
}
function switchTab(t){
  const dealer=t==='dealer';
  $('tabCustom').classList.toggle('on',!dealer);$('tabDealer').classList.toggle('on',dealer);
  $('bodyCustom').hidden=dealer;$('bodyDealer').hidden=!dealer;
  if(!dealer&&viewId!==S.sel){viewId=S.sel;rebuildShowCar();setupMenu();}
  if(dealer)makeThumbs();
  renderBuy();
}
$('tabCustom').addEventListener('click',()=>{click();switchTab('custom');});
$('tabDealer').addEventListener('click',()=>{click();switchTab('dealer');});
$('bGarage').addEventListener('click',()=>{click();switchTab('custom');toggleStation(true);});
$('bDealer').addEventListener('click',()=>{click();switchTab('dealer');toggleStation(true);});
$('bStation').addEventListener('click',()=>{click();toggleStation();});
$('bStClose').addEventListener('click',()=>{click();toggleStation(false);});
addEventListener('pointerdown',e=>{const p=$('stationPanel');if(!p.hidden&&!p.contains(e.target)&&!$('bStation').contains(e.target)&&!e.target.closest('.row3')&&e.target.closest('#menu'))toggleStation(false);});

function spend(price){
  if(S.credits<price){toast('Not enough credits. You need '+fmtC(price-S.credits)+' more. Win races to earn credits.');return false;}
  S.credits-=price;return true;
}
$('bodyCustom').addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a,v=b.dataset.v,g=S.owned[S.sel];
  if(a==='fin'){g.fin=v;applyPaint(showCar.m,g.paint,g.fin);}
  else if(a==='col'){g.paint=+v;applyPaint(showCar.m,g.paint,g.fin);}
  else if(a==='glow'){g.glow=v;setGlow(showCar,v);}
  else if(a==='rim'||a==='tire'){
    const list=g.unl[a],i=+v,price=(a==='rim'?RIMS:TIRES)[i].price;
    if(list.indexOf(i)<0){if(!spend(price))return;list.push(i);toast((a==='rim'?RIMS:TIRES)[i].n+' '+(a==='rim'?'rims':'tires')+' unlocked');}
    g[a]=i;rebuildShowCar();
  }else if(a==='eng'){
    const lv=g.eng[v];if(lv>=ENG_MAX)return;
    if(!spend(engPrice(lv)))return;g.eng[v]=lv+1;toast('Engine upgraded');
  }
  click();save();renderAll();
});
$('bodyDealer').addEventListener('click',e=>{
  const c=e.target.closest('.card');if(!c)return;
  click();viewId=c.dataset.id;rebuildShowCar();setupMenu();renderDealer();
});
$('bBuy').addEventListener('click',()=>{
  const c=CAR_BY[viewId];
  if(S.owned[viewId]){S.sel=viewId;save();click();renderAll();return;}
  if(!spend(c.price))return;
  S.owned[viewId]=defGarage(c);S.sel=viewId;save();beep(660,.15,.12);toast(c.name+' is yours. Open Custom to personalise it.');
  renderAll();
});
$('uname').addEventListener('input',e=>{S.name=e.target.value.toUpperCase().slice(0,14)||'PLAYER';});
$('uname').addEventListener('change',()=>{save();});
$('uname').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur();e.stopPropagation();});
$('bLogin').addEventListener('click',()=>{
  click();
  if(!window.NSD_CLOUD){toast('Cloud save is not set up in this build. Add your Firebase keys (see README) to turn on Gmail login.');return;}
  if(cloudUser){toast('Signed in as '+(cloudUser.email||cloudUser.name));return;}
  window.NSD_CLOUD.signIn().catch(err=>{if(err&&err.code!=='auth/popup-closed-by-user'&&err.code!=='auth/cancelled-popup-request')toast('Sign-in failed. Check that this site is an authorized domain in Firebase.');});
});
$('bSignOut').addEventListener('click',()=>{if(window.NSD_CLOUD)window.NSD_CLOUD.signOut().then(()=>toast('Signed out. Progress stays on this device.'));});

/* settings */
function bindSeg(id,get,set){
  const el=$(id);
  const paint=()=>[].forEach.call(el.children,b=>b.classList.toggle('on',String(get())===b.dataset.v));
  [].forEach.call(el.children,b=>b.addEventListener('click',()=>{set(b.dataset.v);save();paint();click();}));
  paint();return paint;
}
let pendSteer=S.steer;
const cpBtns=[].slice.call(document.querySelectorAll('#ctlPick .cp'));
const CTL_NOTE={wheel:'Drag the on-screen wheel with your left thumb. Gas and brake are on the right.',buttons:'Two big arrow buttons appear on the left. Gas and brake are on the right.',tilt:'Hold the phone in landscape, upright. Tilt right to turn right, left to turn left. Needs motion access (works on the hosted game link).'};
function paintPick(){cpBtns.forEach(b=>{const on=b.dataset.v===pendSteer;b.classList.toggle('on',on);b.setAttribute('aria-checked',on?'true':'false');});$('ctlNote').textContent=CTL_NOTE[pendSteer];}
cpBtns.forEach(b=>b.addEventListener('click',()=>{pendSteer=b.dataset.v;paintPick();click();}));
const paintSettings=[
  bindSeg('segSound',()=>S.sound?'1':'0',v=>{S.sound=v==='1';setMaster();}),
  bindSeg('segQ',()=>S.quality,v=>{S.quality=v;applyQuality();}),
  bindSeg('segU',()=>S.units,v=>{S.units=v;setHud();lastSpd=-1;}),
  bindSeg('segT',()=>S.touch?'1':'0',v=>{S.touch=v==='1';applyTouchUI();}),
  ()=>{pendSteer=S.steer;paintPick();},
  bindSeg('segF',()=>S.flip?'1':'0',v=>{S.flip=v==='1';layoutStage();})
];
$('sens').value=S.sens;$('sensVal').textContent=S.sens+'%';
$('sens').addEventListener('input',e=>{S.sens=+e.target.value;$('sensVal').textContent=S.sens+'%';save();});
if(CFG.demo){$('bDemo').hidden=false;$('bDemo').addEventListener('click',()=>{S.credits+=10000;save();renderProfile();toast('+10,000 test credits added');click();});}
$('bSettings').addEventListener('click',()=>{click();R.mode='settings';paintSettings.forEach(f=>f());showOnly(['settings']);});
const STEER_NAME={wheel:'Steering wheel',buttons:'Arrow buttons',tilt:'Tilt phone'};
$('sDone').addEventListener('click',()=>{
  click();S.steer=pendSteer;save();applyTouchUI();
  if(S.steer==='tilt')enableTilt();else toast('Controls: '+STEER_NAME[S.steer]);
  R.mode='menu';showOnly(['menu']);
});
function withLoading(label,fn){
  const L=$('loading');$('loadTxt').textContent=label;L.hidden=false;L.classList.remove('out','run');void L.offsetWidth;L.classList.add('run');
  setTimeout(()=>{try{fn();}finally{setTimeout(()=>{L.classList.add('out');setTimeout(()=>{L.hidden=true;},420);},650);}},90);
}
$('bPlay').addEventListener('click',()=>{audioInit();click();withLoading('Getting the track ready',startRace);});
$('bPause').addEventListener('click',pauseRace);
$('bReset').addEventListener('click',()=>{if(R.mode==='race'||R.mode==='countdown')recoverCar();});
$('pResume').addEventListener('click',resumeRace);
$('pCal').addEventListener('click',()=>{calibrateTilt();toast('Tilt centred. Hold the phone the way you want to drive.');});
$('pRestart').addEventListener('click',()=>{R.mode='countdown';resetRace();});
$('pQuit').addEventListener('click',toMenu);
$('rAgain').addEventListener('click',resetRace);
$('rQuit').addEventListener('click',toMenu);
function recoverCar(){
  const i=nearest(car.x,car.z,true);car.near=i;car.last=i;
  car.x=PX[i];car.z=PZ[i];car.h=Math.atan2(TX[i],TZ[i]);car.vx=car.vz=0;car.lat=0;car.camH=car.h;car.steer=0;
}

/* ================= input ================= */
const KEYS={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'gas',KeyW:'gas',ArrowDown:'brake',KeyS:'brake',Space:'hand'};
addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT')return;
  if(KEYS[e.code]){inp[KEYS[e.code]]=true;if(!SHOW(R.mode))e.preventDefault();}
  if(e.repeat)return;
  if(e.code==='KeyR'&&(R.mode==='race'||R.mode==='countdown'))recoverCar();
  if(e.code==='KeyP'||e.code==='Escape'){if(R.mode==='paused')resumeRace();else pauseRace();}
});
addEventListener('keyup',e=>{if(KEYS[e.code])inp[KEYS[e.code]]=false;});
function bindHold(id,key){
  const el=$(id);
  const on=e=>{e.preventDefault();inp[key]=true;el.classList.add('on');try{el.setPointerCapture(e.pointerId);}catch(_){}};
  const off=()=>{inp[key]=false;el.classList.remove('on');};
  el.addEventListener('pointerdown',on);el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('lostpointercapture',off);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
bindHold('cLeft','left');bindHold('cRight','right');bindHold('cGas','gas');bindHold('cBrake','brake');
function applyTouchUI(){
  document.body.classList.toggle('no-touch',!S.touch);
  document.body.classList.toggle('steer-buttons',S.steer==='buttons');
  document.body.classList.toggle('steer-tilt',S.steer==='tilt');
  const tg=document.querySelector('.wheel .tag');if(tg)tg.textContent=S.steer==='tilt'?'TILT':'STEER';
}
function clearInput(){Object.keys(inp).forEach(k=>{inp[k]=false;});wDrag=null;document.querySelectorAll('.ctl.on').forEach(el=>el.classList.remove('on'));}
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pauseRace();}});
addEventListener('blur',clearInput);
const glc=$('gl');
const dragPos=e=>forced?(S.flip?-e.clientY:e.clientY):e.clientX;
glc.addEventListener('pointerdown',e=>{if(R.mode==='menu'){drag={x:dragPos(e),a:turn.rotation.y};try{glc.setPointerCapture(e.pointerId);}catch(_){}}});
glc.addEventListener('pointermove',e=>{if(drag)turn.rotation.y=drag.a+(dragPos(e)-drag.x)*.01;});
['pointerup','pointercancel'].forEach(ev=>glc.addEventListener(ev,()=>{drag=null;}));

/* ================= fullscreen + landscape lock ================= */
function lockLandscape(){
  try{if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(()=>{});}catch(e){}
}
function goFull(){
  const el=document.documentElement;
  try{
    if(!document.fullscreenElement&&el.requestFullscreen){
      const p=el.requestFullscreen({navigationUI:'hide'});
      if(p&&p.then)p.then(lockLandscape).catch(lockLandscape);else lockLandscape();
    }else lockLandscape();
  }catch(e){lockLandscape();}
}
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement)lockLandscape();});
lockLandscape();
let started=false;
function beginSession(){if(started)return;started=true;audioInit();goFull();}
addEventListener('pointerdown',beginSession);
addEventListener('keydown',beginSession);
addEventListener('click',()=>{if(S.steer==='tilt')enableTilt();});

/* ================= sizing + loop ================= */
function applyQuality(){
  const dpr=window.devicePixelRatio||1;
  renderer.setPixelRatio(S.quality==='high'?Math.min(dpr,S.touch?1.5:2):1);
  resize();
}
const stage=$('stage');let forced=false;
function layoutStage(){
  const iw=window.innerWidth,ih=window.innerHeight;
  const coarse=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
  forced=ih>iw&&(coarse||iw<700);
  const de=document.documentElement;
  de.classList.toggle('forced',forced);
  let w=iw,h=ih;
  de.classList.toggle('flip',forced&&!!S.flip);
  if(forced){w=ih;h=iw;stage.style.cssText='inset:auto;top:0;left:0;width:'+w+'px;height:'+h+'px;transform-origin:0 0;transform:'+(S.flip?'translateY('+ih+'px) rotate(-90deg)':'translateX('+iw+'px) rotate(90deg)');}
  else stage.style.cssText='';
  de.style.fontSize=Math.max(11,Math.min(h*.0385,w*.0178)).toFixed(2)+'px';
  de.classList.toggle('compact',w<760);
}
function resize(){
  layoutStage();
  W=Math.max(1,glc.clientWidth);H=Math.max(1,glc.clientHeight);
  renderer.setSize(W,H,false);
  raceCam.aspect=W/H;raceCam.updateProjectionMatrix();
  layoutShow();
}
addEventListener('resize',resize);
addEventListener('orientationchange',()=>setTimeout(resize,200));
let last=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(SHOW(R.mode)){
    if(!drag)turn.rotation.y+=dt*.35;
    offX+=(offXt-offX)*Math.min(1,dt*8);showCam.setViewOffset(W,H,Math.round(W*offX),Math.round(H*offY),W,H);
    renderer.render(showScene,showCam);
  }else{
    if(R.mode!=='paused')updateRace(dt);
    renderer.render(raceScene,raceCam);
  }
}

applyTouchUI();applyQuality();rebuildShowCar();renderAll();setHud();
hookCloud();addEventListener('nsd-cloud-ready',hookCloud);
setTimeout(makeThumbs,1200);
requestAnimationFrame(t=>{last=t;loop(t);});
(function(){const L=$('loading');L.classList.add('run');setTimeout(()=>{L.classList.add('out');setTimeout(()=>{L.hidden=true;},450);},Math.max(900,1700-performance.now()));})();
})();
