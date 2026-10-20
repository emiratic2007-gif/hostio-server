// Lumen demo · interactive 3D tooth (raymarched SDF, plain WebGL, no libraries).
// window.Zub3D.mount(canvas) -> { set(stateName), destroy() }
(() => {
"use strict";
const FS = `
precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec2 uRot;
uniform float uK, uC, uP, uY, uI, uO;   // kamenac, karijes, bol, zuti, implant, ortodoncija
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
float sdRB(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float sdTp(vec3 p,vec3 a,vec3 b,float ra,float rb){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
const vec3 PIT=vec3(.12,.6,.43);
vec3 toLocal(vec3 p){
  p.xz*=rot(uRot.x); p.yz*=rot(uRot.y);
  p.y+=.12;
  p.xy*=rot(-.32*uO);               // crooked tooth
  return p;
}
float crown(vec3 p){
  float c=sdRB(p-vec3(0.,.4,0.),vec3(.30,.14,.25),.29);
  float cu=min(min(length(p-vec3(-.22,.68,-.18)),length(p-vec3(.22,.7,-.18))),min(length(p-vec3(-.22,.69,.19)),length(p-vec3(.22,.67,.19))))-.2;
  c=smin(c,cu,.16);
  c=smax(c,-(length(p-vec3(0.,.93,0.))-.2),.1);
  c=smax(c,-sdCap(p,vec3(-.5,.9,0.),vec3(.5,.9,0.),.06),.08);
  c=smax(c,-sdCap(p,vec3(0.,.9,-.5),vec3(0.,.9,.5),.05),.08);           // central fossa
  return c;
}
float roots(vec3 p){
  float r1=sdTp(p,vec3(-.2,.12,.03),vec3(-.3,-.95,.08),.27,.07);
  float r2=sdTp(p,vec3(.21,.12,-.03),vec3(.31,-.92,-.08),.27,.07);
  float r3=sdTp(p,vec3(0.,.12,-.16),vec3(.02,-.82,-.32),.18,.05);
  return smin(smin(r1,r2,.12),r3,.12);
}
float screw(vec3 p){
  float s=sdTp(p,vec3(0.,.05,0.),vec3(0.,-1.,0.),.21,.12);
  s+=.028*(.5+.5*sin(p.y*46.+atan(p.z,p.x)));
  return smin(s,sdCap(p,vec3(0.,.22,0.),vec3(0.,.02,0.),.17),.04);
}
// returns distance, material in y (0 enamel, 1 dentin, 2 metal)
vec2 tooth(vec3 q){
  vec3 p=toLocal(q);
  float c=crown(p);
  float neck=sdTp(p,vec3(0.,.32,0.),vec3(0.,.02,0.),.47,.39);
  float d=smin(c,neck,.14);
  float r=roots(p), sc=screw(p);
  float rr=mix(r,sc,smoothstep(.0,1.,uI));
  d=smin(d,rr,.18*(1.-uI)+.02);
  d=smax(d,-(length(p-PIT)-.13*uC),.04);                    // cavity
  float band=smoothstep(.36,.12,p.y)*smoothstep(-.04,.1,p.y);
  d-=.022*uK*band*noise(p*14.);                                // tartar bumps
  float m=p.y<.12?1.:0.;
  if(uI>.5&&p.y<.2) m=2.;
  // orthodontic bracket + wire (in world space so the wire stays straight)
  vec3 w=q; w.xz*=rot(uRot.x); w.yz*=rot(uRot.y); w.y+=.12;
  float br=sdRB(w-vec3(0.,.43,.60+.0),vec3(.12,.1,.04),.02);
  float wi=sdCap(w,vec3(-.95,.43,.64),vec3(.95,.43,.64),.016);
  float o=min(br,wi)+(1.-uO)*2.;
  if(o<d){d=o;m=2.;}
  return vec2(d,m);
}
vec3 nrm(vec3 p){vec2 e=vec2(.0015,-.0015);
  return normalize(e.xyy*tooth(p+e.xyy).x+e.yyx*tooth(p+e.yyx).x+e.yxy*tooth(p+e.yxy).x+e.xxx*tooth(p+e.xxx).x);}
vec4 shade(vec3 ro, vec3 rd, float t, float mat, vec3 halo, float pulse){
  vec3 p=ro+rd*t, n=nrm(p), v=-rd, lp=toLocal(p);
  vec3 L1=normalize(vec3(.6,.75,.7)), L2=normalize(vec3(-.8,.15,.35)), L3=normalize(vec3(-.2,.4,-1.));
  vec3 enamel=mix(vec3(.97,.97,.95),vec3(.95,.83,.55),uY*.85);
  vec3 dentin=mix(vec3(.96,.89,.78),vec3(.9,.78,.55),uY*.6);
  vec3 base=mix(enamel,dentin,smoothstep(.2,.02,lp.y));
  float band=smoothstep(.38,.14,lp.y)*smoothstep(-.06,.1,lp.y);
  float tn=smoothstep(.35,.75,noise(lp*9.)*.7+noise(lp*23.)*.4);
  base=mix(base,vec3(.72,.56,.28),uK*band*tn);
  float cd=length(lp-PIT);
  base=mix(base,vec3(.12,.07,.04),uC*smoothstep(.22,.1,cd));
  base=mix(base,vec3(.5,.34,.18),uC*smoothstep(.34,.2,cd)*.7);
  float spec=60., ks=.85;
  if(mat>1.5){ base=vec3(.72,.76,.8); spec=90.; ks=1.4; }
  else if(lp.y<.12){ ks=.35; spec=24.; }
  float d1=clamp((dot(n,L1)+.35)/1.35,0.,1.), d2=clamp(dot(n,L2)*.5+.5,0.,1.);
  float sp=pow(max(dot(n,normalize(L1+v)),0.),spec)*ks;
  float fr=pow(1.-max(dot(n,v),0.),3.);
  float ao=clamp(tooth(p+n*.08).x/.08,0.,1.)*.5+.5;
  vec3 sss=vec3(1.,.82,.7)*(1.-d1)*.18;
  vec3 col=base*(.22+.85*d1+.18*d2)*ao+sss*base+sp*vec3(1.)+fr*vec3(.75,.88,1.)*.45;
  col+=pow(max(dot(n,L3),0.),2.)*vec3(.55,.95,.85)*.25;
  float pz=smoothstep(.55,.0,abs(lp.y-.1))*uP;
  col=mix(col,vec3(1.,.22,.28),pz*.7*pulse);
  col+=halo*.4;
  return vec4(pow(col,vec3(.92)),1.);
}
void main(){
  vec2 uv=(gl_FragCoord.xy*2.-uRes)/min(uRes.x,uRes.y);
  vec3 ro=vec3(0.,.75,2.75), ta=vec3(0.,-.02,0.);
  vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0.,1.,0.))), vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu*.5+uv.y*vv*.5+ww);
  float pw=1.6/min(uRes.x,uRes.y);
  float t=1.8, glow=0., hm=1e3, tm=0., mm=0.; vec2 h=vec2(1.,0.);
  for(int i=0;i<96;i++){
    h=tooth(ro+rd*t);
    glow+=exp(-h.x*9.)*.018;
    if(h.x<hm){hm=h.x;tm=t;mm=h.y;}
    if(h.x<.0015*t||t>5.) break;
    t+=h.x*.85;
  }
  float pulse=.55+.45*sin(uT*5.);
  vec3 halo=vec3(1.,.25,.3)*glow*uP*pulse*2.6;
  float ha=clamp(length(halo),0.,1.);
  if(t>5.){
    float cov=1.-clamp(hm/(pw*tm),0.,1.);              // soft edge: partial coverage near the silhouette
    if(cov>0.){ vec4 c=shade(ro,rd,tm,mm,halo,pulse); gl_FragColor=vec4(mix(halo,c.rgb,cov),max(cov,ha)); return; }
    gl_FragColor=vec4(halo,ha); return;
  }
  gl_FragColor=shade(ro,rd,t,h.y,halo,pulse);
}`;
const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
const STATES = { zdrav: {}, kamenac: { uK: 1 }, karijes: { uC: 1 }, bol: { uP: 1 }, zuti: { uY: 1 }, nedostaje: { uI: 1 }, kriv: { uO: 1 } };
const KEYS = ["uK", "uC", "uP", "uY", "uI", "uO"];

function mount(canvas, opts = {}) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const la = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const uRes = U("uRes"), uT = U("uT"), uRot = U("uRot"), uS = Object.fromEntries(KEYS.map(k => [k, U(k)]));
  const cur = Object.fromEntries(KEYS.map(k => [k, 0])), tgt = { ...cur };
  let yaw = .5, pitch = .18, vy = 0, focusT = 0, focusYaw = 0, drag = null, raf = 0, alive = true, visible = true, last = performance.now(), t0 = last;
  const quality = opts.quality || (matchMedia("(max-width:700px)").matches ? .75 : .85);
  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5) * quality;
    canvas.width = Math.max(2, Math.round(r.width * dpr)); canvas.height = Math.max(2, Math.round(r.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize(); addEventListener("resize", resize);
  const down = e => { drag = { x: e.clientX, y: e.clientY }; focusT = 0; canvas.setPointerCapture?.(e.pointerId); };
  const move = e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; yaw += dx * .012; vy = dx * .012; pitch = Math.max(-.5, Math.min(.7, pitch + dy * .006)); };
  const up = () => { drag = null; };
  canvas.addEventListener("pointerdown", down); addEventListener("pointermove", move); addEventListener("pointerup", up);
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) loop(); }) : null;
  io && io.observe(canvas);
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!drag) {
      if (now < focusT) yaw += (focusYaw - yaw) * Math.min(1, dt * 3.2);
      else { yaw += dt * .45 + vy; vy *= .92; }
    }
    KEYS.forEach(k => cur[k] += (tgt[k] - cur[k]) * Math.min(1, dt * 4));
    gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uT, (now - t0) / 1000); gl.uniform2f(uRot, yaw, pitch);
    KEYS.forEach(k => gl.uniform1f(uS[k], cur[k]));
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop() { cancelAnimationFrame(raf); if (!alive || !visible || document.hidden) return; raf = requestAnimationFrame(now => { frame(now); loop(); }); }
  document.addEventListener("visibilitychange", loop);
  loop();
  return {
    set(name) { const s = STATES[name] || {}; KEYS.forEach(k => tgt[k] = s[k] || 0); const tp = Math.PI * 2; focusYaw = Math.round((yaw + .35) / tp) * tp - .35; focusT = performance.now() + 3200; vy = 0; },
    renderOnce(now) { KEYS.forEach(k => cur[k] = tgt[k]); frame(now || performance.now()); },
    destroy() { alive = false; cancelAnimationFrame(raf); io && io.disconnect(); }
  };
}
window.Zub3D = { mount };
})();
