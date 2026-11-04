// The compositor. One WebGL2 pipeline draws every frame, so what the preview shows is what the export writes.
// Convention: in every texture and framebuffer v=0 is the top row. Only the final blit to the canvas flips.
import { mergeGrade } from './filters.js';
import { transitionById, TRANSITIONS } from './transitions.js';
import { effectById, EFFECTS } from './effects.js';
import { animState } from './anim.js';
import { renderText } from './text.js';
import { stickerSource } from './stickers.js';
import { propValue, srcAt, transitionAt, activeIn, mainTrack, isVisual } from './model.js';

const VS = `#version 300 es
in vec2 aP; uniform mat3 uM; out vec2 v;
void main(){ v=aP; vec3 q=uM*vec3(aP,1.); gl_Position=vec4(q.xy,0.,q.z); }`;
const VS_FULL = `#version 300 es
in vec2 aP; out vec2 v; uniform float uFlip;
void main(){ v=aP; vec2 q=aP*2.-1.; gl_Position=vec4(q.x,q.y*uFlip,0.,1.); }`;

const COMMON = `
float rand(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(rand(i),rand(i+vec2(1,0)),f.x),mix(rand(i+vec2(0,1)),rand(i+vec2(1,1)),f.x),f.y);}
float ease(float x){return x<.5?4.*x*x*x:1.-pow(-2.*x+2.,3.)/2.;}
`;

const FS_LAYER = `#version 300 es
precision highp float;
in vec2 v; out vec4 o;
uniform sampler2D uTex,uTex2;
uniform vec4 uUV; uniform int uRot; uniform float uOp,uMixF; uniform vec2 uSrcSize,uQuad;
uniform float uRadius,uCubic,uSharp,uClean,uTime;
uniform int uGrade;
uniform float uBri,uCon,uSat,uExp,uTemp,uTint,uHue,uHigh,uShad,uVib,uFade,uVig,uGrain,uMono,uSpl;
uniform vec3 uSsh,uShi;
uniform int uKey; uniform vec3 uKeyC; uniform float uKeyT,uKeyS,uKeySp;
uniform int uMask; uniform vec2 uMaskC,uMaskS; uniform float uMaskR,uMaskF,uMaskI;
${COMMON}
vec2 rotUV(vec2 s){ if(uRot==1) return vec2(s.y,1.-s.x); if(uRot==2) return 1.-s; if(uRot==3) return vec2(1.-s.y,s.x); return s; }
vec4 cubic(vec2 uv){ // Catmull-Rom: keeps edges when a small source is shown big
  vec2 ts=vec2(textureSize(uTex,0)),st=uv*ts-.5,f=fract(st),b=floor(st);
  vec2 w0=f*(-.5+f*(1.-.5*f)),w1=1.+f*f*(-2.5+1.5*f),w2=f*(.5+f*(2.-1.5*f)),w3=f*f*(-.5+.5*f);
  vec2 w12=w1+w2,o12=w2/w12,p0=(b-.5)/ts,p3=(b+2.5)/ts,p12=(b+.5+o12)/ts;
  vec4 c=vec4(0);
  c+=texture(uTex,vec2(p0.x,p0.y))*w0.x*w0.y+texture(uTex,vec2(p12.x,p0.y))*w12.x*w0.y+texture(uTex,vec2(p3.x,p0.y))*w3.x*w0.y;
  c+=texture(uTex,vec2(p0.x,p12.y))*w0.x*w12.y+texture(uTex,vec2(p12.x,p12.y))*w12.x*w12.y+texture(uTex,vec2(p3.x,p12.y))*w3.x*w12.y;
  c+=texture(uTex,vec2(p0.x,p3.y))*w0.x*w3.y+texture(uTex,vec2(p12.x,p3.y))*w12.x*w3.y+texture(uTex,vec2(p3.x,p3.y))*w3.x*w3.y;
  return clamp(c,0.,1.);
}
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 hueRot(vec3 c,float a){ float s=sin(a),k=cos(a); mat3 m=mat3(.299+.701*k+.168*s,.587-.587*k+.330*s,.114-.114*k-.497*s,.299-.299*k-.328*s,.587+.413*k+.035*s,.114-.114*k+.292*s,.299-.3*k+1.25*s,.587-.588*k-1.05*s,.114+.886*k-.203*s); return c*m; }
vec3 grade(vec3 c,vec2 uv){
  c*=pow(2.,uExp*1.5);
  c*=vec3(1.+uTemp*.26+uTint*.08,1.-uTint*.18,1.-uTemp*.26+uTint*.08);
  c+=uBri*.35;
  float l=clamp(luma(c),0.,1.);
  c+=uShad*.5*(1.-l)*(1.-l)*(1.-l)+uHigh*.42*l*l;
  c=(c-.5)*(1.+uCon*1.15)+.5;
  if(uHue!=0.) c=hueRot(c,uHue*.0174533);
  l=luma(c);
  c=mix(vec3(l),c,1.+uSat);
  if(uVib!=0.){ float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)); c=mix(vec3(l),c,1.+uVib*(1.-(mx-mn))); }
  c=mix(c,vec3(l),clamp(uMono,0.,1.));
  if(uSpl>0.){ l=clamp(luma(c),0.,1.); vec3 tone=mix(uSsh,uShi,smoothstep(.05,.85,l)); c=mix(c,mix(2.*c*tone,1.-2.*(1.-c)*(1.-tone),step(.5,l)),clamp(uSpl,0.,1.)); }
  c=c*(1.-uFade*.75)+uFade*.17;
  if(uVig>0.){ float d=length(uv-.5); c*=1.-smoothstep(.28,.82,d)*uVig; }
  if(uGrain>0.) c+=(rand(uv*vec2(1731.,947.)+fract(uTime)*91.)-.5)*uGrain*.5;
  return c;
}
float maskShape(vec2 uv){
  vec2 asp=uQuad/max(uQuad.x,uQuad.y);
  vec2 q=(uv-uMaskC)*asp; float a=uMaskR,cs=cos(a),sn=sin(a); q=mat2(cs,-sn,sn,cs)*q; q/=max(uMaskS,vec2(.0001));
  float d=1.;
  if(uMask==1) { vec2 e=abs(q)-.5; d=length(max(e,0.))+min(max(e.x,e.y),0.); }
  else if(uMask==2) d=length(q)-.5;
  else if(uMask==3) { vec2 h=q*2.2; h.y=-h.y-.1; float k=h.x*h.x+pow(h.y-sqrt(abs(h.x))*.8,2.); d=(sqrt(k)-1.)*.4; }
  else if(uMask==4) { float an=atan(q.x,-q.y); float r=length(q); float m=cos(floor(.5+an*5./6.2832)*6.2832/5.-an)*r; d=m-(.2+.3*abs(sin(an*2.5))); d=m-.32*(.55+.45*cos(mod(an,6.2832/5.)*5.)); }
  else if(uMask==5) d=q.y;
  else if(uMask==6) { d=abs(q.x)+abs(q.y)-.5; }
  else if(uMask==7) { vec2 w=abs(q); d=max(w.x*.866+w.y*.5,w.y)-.45; }
  else if(uMask==8) { d=abs(q.y)-.5; }
  float f=max(uMaskF,.002);
  float m=1.-smoothstep(-f,f,d);
  return mix(m,1.-m,uMaskI);
}
void main(){
  vec2 uv=uUV.xy+v*uUV.zw;
  vec2 suv=rotUV(uv);
  vec4 c=uCubic>0.?cubic(suv):texture(uTex,suv);
  if(uMixF>0.) c=mix(c,texture(uTex2,suv),uMixF);
  vec2 tx=1./uSrcSize;
  if(uClean>0.){ // edge-preserving smoothing for noisy, compressed sources
    vec3 s=c.rgb; float w=1.;
    for(int i=0;i<8;i++){ float a=float(i)*.7854; vec2 q=vec2(cos(a),sin(a))*tx*1.6; vec3 n=texture(uTex,suv+q).rgb; float k=exp(-dot(n-c.rgb,n-c.rgb)*60.); s+=n*k; w+=k; }
    c.rgb=mix(c.rgb,s/w,uClean);
  }
  if(uSharp>0.){ // contrast-adaptive sharpening
    vec3 a=texture(uTex,suv+vec2(tx.x,0.)).rgb,b=texture(uTex,suv-vec2(tx.x,0.)).rgb,d=texture(uTex,suv+vec2(0.,tx.y)).rgb,e=texture(uTex,suv-vec2(0.,tx.y)).rgb;
    vec3 mn=min(c.rgb,min(a,min(b,min(d,e)))),mx=max(c.rgb,max(a,max(b,max(d,e))));
    vec3 k=sqrt(clamp(min(mn,1.-mx)/max(mx,.001),0.,1.))*(-.125-.075*uSharp);
    c.rgb=clamp((c.rgb+(a+b+d+e)*k)/(1.+4.*k),0.,1.);
  }
  float al=c.a; vec3 rgb=al>.001?c.rgb/al:c.rgb;
  if(uKey==1){
    vec3 y1=vec3(.299*rgb.r+.587*rgb.g+.114*rgb.b,-.169*rgb.r-.331*rgb.g+.5*rgb.b,.5*rgb.r-.419*rgb.g-.081*rgb.b);
    vec3 y2=vec3(0.,-.169*uKeyC.r-.331*uKeyC.g+.5*uKeyC.b,.5*uKeyC.r-.419*uKeyC.g-.081*uKeyC.b);
    float d=length(y1.yz-y2.yz); float m=smoothstep(uKeyT,uKeyT+uKeyS+.001,d);
    al*=m;
    if(uKeySp>0.){ float l=luma(rgb); rgb=mix(rgb,mix(vec3(l),rgb,m),uKeySp); }
  }
  if(uGrade==1) rgb=grade(rgb,v);
  if(uMask>0) al*=maskShape(v);
  if(uRadius>0.){ vec2 px=(v-.5)*uQuad; vec2 q=abs(px)-(uQuad*.5-uRadius); float d=length(max(q,0.))+min(max(q.x,q.y),0.)-uRadius; al*=1.-smoothstep(-1.,1.,d); }
  al*=uOp;
  o=vec4(clamp(rgb,0.,1.)*al,al);
}`;

const FS_BLEND = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D uBase,uTop; uniform int uMode;
vec3 f(vec3 b,vec3 s){
  if(uMode==1) return b*s;
  if(uMode==2) return 1.-(1.-b)*(1.-s);
  if(uMode==3) return mix(2.*b*s,1.-2.*(1.-b)*(1.-s),step(.5,b));
  if(uMode==4) return min(b,s);
  if(uMode==5) return max(b,s);
  if(uMode==6) return min(b+s,vec3(1.));
  if(uMode==7) return mix(b-(1.-2.*s)*b*(1.-b),b+(2.*s-1.)*(sqrt(b)-b),step(.5,s));
  if(uMode==8) return mix(2.*b*s,1.-2.*(1.-b)*(1.-s),step(.5,s));
  if(uMode==9) return abs(b-s);
  if(uMode==10) return min(b/max(1.-s,.001),vec3(1.));
  if(uMode==11) return 1.-min((1.-b)/max(s,.001),vec3(1.));
  return s;
}
void main(){ vec4 b=texture(uBase,v),t=texture(uTop,v);
  vec3 bs=b.a>0.?b.rgb/b.a:b.rgb,ts=t.a>0.?t.rgb/t.a:t.rgb;
  o=vec4((1.-t.a)*b.rgb+(1.-b.a)*t.rgb+t.a*b.a*f(bs,ts),t.a+b.a-t.a*b.a); }`;

const FS_COPY = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D uT;
void main(){ o=texture(uT,v); }`;
const FS_BLUR = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D uT; uniform vec2 uD;
void main(){ vec4 s=texture(uT,v)*.227027; s+=(texture(uT,v+uD*1.3846)+texture(uT,v-uD*1.3846))*.316216; s+=(texture(uT,v+uD*3.2308)+texture(uT,v-uD*3.2308))*.070270; o=s; }`;

const fsTrans = (code) => `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D uA,uB; uniform float p; uniform vec2 res;
${COMMON}
vec4 A(vec2 u){return texture(uA,u);} vec4 B(vec2 u){return texture(uB,u);}
vec4 tr(vec2 uv){ ${code} }
void main(){ o=tr(v); }`;
const fsFx = (code) => `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D uT; uniform float t,prog,amt,p1,p2; uniform vec2 res;
${COMMON}
vec4 S(vec2 u){return texture(uT,u);}
vec4 fx(vec2 uv){ ${code} }
void main(){ o=fx(v); }`;

export const BLENDS = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['darken', 'Gelapkan'], ['lighten', 'Terangkan'], ['add', 'Tambah'], ['softlight', 'Soft Light'], ['hardlight', 'Hard Light'], ['difference', 'Selisih'], ['dodge', 'Dodge'], ['burn', 'Burn']];
const BLEND_ID = Object.fromEntries(BLENDS.map((b, i) => [b[0], i]));
export const MASKS = [['none', 'Tanpa', 0], ['rect', 'Persegi', 1], ['circle', 'Lingkaran', 2], ['heart', 'Hati', 3], ['star', 'Bintang', 4], ['split', 'Garis Bagi', 5], ['diamond', 'Berlian', 6], ['hex', 'Heksagon', 7], ['film', 'Pita Film', 8]];
const MASK_ID = Object.fromEntries(MASKS.map((m) => [m[0], m[2]]));

export class Compositor {
  constructor(canvas, { preserve = false, hq = false } = {}) {
    this.canvas = canvas; this.hq = hq;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: preserve, powerPreference: 'high-performance', desynchronized: false });
    if (!gl) throw new Error('Browser ini tidak mendukung WebGL2.');
    this.gl = gl;
    this.lost = false;
    canvas.addEventListener?.('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener?.('webglcontextrestored', () => { this.lost = false; this._init(); this.onrestore?.(); });
    this._init();
  }

  _init() {
    const gl = this.gl;
    this.prog = new Map(); this.textures = new Map(); this.pool = []; this.W = 0; this.H = 0;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.disable(gl.DEPTH_TEST);
    this.frameCount = 0;
  }

  dispose() {
    const gl = this.gl;
    for (const t of this.textures.values()) gl.deleteTexture(t.tex);
    for (const f of this.pool) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); }
    for (const p of this.prog.values()) gl.deleteProgram(p.p);
    this.textures.clear(); this.pool = []; this.prog.clear();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  _program(key, fs, vs = VS_FULL) {
    let p = this.prog.get(key);
    if (p) return p;
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader ' + key + ': ' + gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(pr, 0, 'aP');
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('Link ' + key + ': ' + gl.getProgramInfoLog(pr));
    p = { p: pr, u: new Map() };
    this.prog.set(key, p);
    return p;
  }
  _use(p) {
    const gl = this.gl;
    gl.useProgram(p.p);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.cur = p;
  }
  _loc(n) { const c = this.cur; let l = c.u.get(n); if (l === undefined) { l = this.gl.getUniformLocation(c.p, n); c.u.set(n, l); } return l; }
  _1f(n, v) { const l = this._loc(n); if (l) this.gl.uniform1f(l, v); }
  _1i(n, v) { const l = this._loc(n); if (l) this.gl.uniform1i(l, v); }
  _2f(n, a, b) { const l = this._loc(n); if (l) this.gl.uniform2f(l, a, b); }
  _3f(n, a) { const l = this._loc(n); if (l) this.gl.uniform3f(l, a[0], a[1], a[2]); }
  _4f(n, a, b, c, d) { const l = this._loc(n); if (l) this.gl.uniform4f(l, a, b, c, d); }
  _tex(n, unit, tex) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); this._1i(n, unit); }

  _fbo(w = this.W, h = this.H) {
    const gl = this.gl;
    const i = this.pool.findIndex((f) => f.free && f.w === w && f.h === h);
    if (i >= 0) { this.pool[i].free = false; return this.pool[i]; }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const f = { fbo, tex, w, h, free: false };
    this.pool.push(f);
    return f;
  }
  _free(...fs) { for (const f of fs) if (f) f.free = true; }
  _bind(f) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, f ? f.fbo : null); gl.viewport(0, 0, f ? f.w : this.canvas.width, f ? f.h : this.canvas.height); }
  _clear(f, r = 0, g = 0, b = 0, a = 0) { const gl = this.gl; this._bind(f); gl.clearColor(r, g, b, a); gl.clear(gl.COLOR_BUFFER_BIT); }
  _quad() { this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4); }

  /** Uploads a source into a cached texture. A stamp that did not change skips the upload. */
  _upload(key, src, stamp, mip = false) {
    const gl = this.gl;
    let t = this.textures.get(key);
    if (!t) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      t = { tex, stamp: undefined, used: 0 };
      this.textures.set(key, t);
    }
    t.used = this.frameCount;
    if (stamp !== undefined && t.stamp === stamp) return t.tex;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { if (t.stamp === undefined) return null; return t.tex; }
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    t.stamp = stamp;
    return t.tex;
  }
  _sweep() {
    if (this.frameCount % 240) return;
    for (const [k, t] of this.textures) if (this.frameCount - t.used > 600) { this.gl.deleteTexture(t.tex); this.textures.delete(k); }
  }

  _transform(c, t, P) {
    const u = t - c.start, a = animState(c.anim, Math.max(0, Math.min(c.dur, u)), c.dur);
    const gv = (k) => propValue(c, k, u);
    return { x: gv('x') + a.x, y: gv('y') + a.y, s: gv('s') * a.s, rot: gv('rot') + a.rot, rx: a.rx, ry: a.ry, op: gv('op') * a.op, blur: a.blur, P };
  }

  /** mat3 from the unit quad to clip space, with an optional 3D tilt seen through a mild perspective. */
  _matrix(cx, cy, w, h, rotDeg, rxDeg, ryDeg, W, H) {
    const rz = rotDeg * Math.PI / 180, rx = rxDeg * Math.PI / 180, ry = ryDeg * Math.PI / 180;
    const cz = Math.cos(rz), sz = Math.sin(rz), cxr = Math.cos(rx), sx = Math.sin(rx), cy2 = Math.cos(ry), sy = Math.sin(ry);
    const D = Math.max(W, H) * 1.4;
    const f = (px, py) => {
      const lx = w * (px - 0.5), ly = h * (py - 0.5);
      let X = cz * lx - sz * ly, Y = sz * lx + cz * ly, Z = 0;
      let y2 = cxr * Y - sx * Z, z2 = sx * Y + cxr * Z; Y = y2; Z = z2;
      const x3 = cy2 * X + sy * Z, z3 = -sy * X + cy2 * Z; X = x3; Z = z3;
      const wp = 1 - Z / D;
      return [((cx * wp + X) * 2) / W - wp, ((cy * wp + Y) * 2) / H - wp, wp];
    };
    const o = f(0, 0), a = f(1, 0), b = f(0, 1);
    return new Float32Array([a[0] - o[0], a[1] - o[1], a[2] - o[2], b[0] - o[0], b[1] - o[1], b[2] - o[2], o[0], o[1], o[2]]);
  }

  _setGrade(g) {
    const neutral = !g || g.neutral;
    this._1i('uGrade', neutral ? 0 : 1);
    if (neutral) { this._1f('uGrain', 0); return; }
    this._1f('uBri', g.bri); this._1f('uCon', g.con); this._1f('uSat', g.sat); this._1f('uExp', g.exp); this._1f('uTemp', g.temp); this._1f('uTint', g.tint); this._1f('uHue', g.hue);
    this._1f('uHigh', g.high); this._1f('uShad', g.shad); this._1f('uVib', g.vib); this._1f('uFade', g.fade); this._1f('uVig', g.vig); this._1f('uGrain', g.grain); this._1f('uMono', g.mono); this._1f('uSpl', g.spl);
    this._3f('uSsh', g.ssh); this._3f('uShi', g.shi);
  }

  /** Draws one textured quad through the layer shader. */
  _drawLayer(target, tex, o) {
    const gl = this.gl, p = this._program('layer', FS_LAYER, VS);
    this._bind(target); this._use(p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniformMatrix3fv(this._loc('uM'), false, o.m);
    this._tex('uTex', 0, tex);
    if (o.tex2) { this._tex('uTex2', 1, o.tex2); this._1f('uMixF', o.mixF); } else this._1f('uMixF', 0);
    const uv = o.uv || [0, 0, 1, 1];
    this._4f('uUV', uv[0], uv[1], uv[2], uv[3]);
    this._1i('uRot', o.rotQ || 0); this._1f('uOp', o.op ?? 1);
    this._2f('uSrcSize', o.sw || 1, o.sh || 1); this._2f('uQuad', o.qw || 1, o.qh || 1);
    this._1f('uRadius', o.radius || 0); this._1f('uCubic', o.cubic ? 1 : 0); this._1f('uSharp', o.sharp || 0); this._1f('uClean', o.clean || 0); this._1f('uTime', o.time || 0);
    this._setGrade(o.grade);
    const k = o.key;
    this._1i('uKey', k ? 1 : 0);
    if (k) { this._3f('uKeyC', k.rgb); this._1f('uKeyT', k.t); this._1f('uKeyS', k.s); this._1f('uKeySp', k.sp); }
    const mk = o.mask;
    this._1i('uMask', mk && MASK_ID[mk.type] ? MASK_ID[mk.type] : 0);
    if (mk) { this._2f('uMaskC', mk.x, mk.y); this._2f('uMaskS', mk.w, mk.h); this._1f('uMaskR', (mk.rot || 0) * Math.PI / 180); this._1f('uMaskF', mk.feather || 0); this._1f('uMaskI', mk.invert ? 1 : 0); }
    this._quad();
    gl.disable(gl.BLEND);
  }

  _copy(target, src) { const p = this._program('copy', FS_COPY); this._bind(target); this._use(p); this._1f('uFlip', target ? 1 : -1); this._tex('uT', 0, src.tex); this._quad(); }

  /** Downsamples and gaussian-blurs a framebuffer. Used for blurred backgrounds and blur animations. */
  _blur(src, amount, smallFactor = 4) {
    const w = Math.max(8, Math.round(src.w / smallFactor)), h = Math.max(8, Math.round(src.h / smallFactor));
    let a = this._fbo(w, h), b = this._fbo(w, h);
    this._copy(a, src);
    const p = this._program('blur', FS_BLUR);
    const iters = Math.max(1, Math.round(amount * 5));
    for (let i = 0; i < iters; i++) {
      for (const [d0, d1] of [[1, 0], [0, 1]]) {
        this._bind(b); this._use(p); this._1f('uFlip', 1); this._2f('uD', (d0 * (1 + i * 0.6)) / w, (d1 * (1 + i * 0.6)) / h); this._tex('uT', 0, a.tex); this._quad();
        [a, b] = [b, a];
      }
    }
    this._free(b);
    return a;
  }

  _fxPass(src, dst, fxId, t, prog, amt, p1, p2) {
    const def = effectById(fxId);
    if (!def) { this._copy(dst, src); return; }
    const p = this._program('fx:' + fxId, fsFx(def.code));
    this._bind(dst); this._use(p); this._1f('uFlip', 1); this._tex('uT', 0, src.tex);
    this._1f('t', t); this._1f('prog', prog); this._1f('amt', amt); this._1f('p1', p1 ?? .5); this._1f('p2', p2 ?? .5); this._2f('res', dst.w, dst.h);
    this._quad();
  }

  _transPass(a, b, dst, id, p01) {
    const def = transitionById(id) || TRANSITIONS[0];
    const p = this._program('tr:' + def.id, fsTrans(def.code));
    this._bind(dst); this._use(p); this._1f('uFlip', 1);
    this._tex('uA', 0, a.tex); this._tex('uB', 1, b.tex); this._1f('p', p01); this._2f('res', dst.w, dst.h);
    this._quad();
  }

  _blendPass(base, top, dst, mode) {
    const p = this._program('blend', FS_BLEND);
    this._bind(dst); this._use(p); this._1f('uFlip', 1);
    this._tex('uBase', 0, base.tex); this._tex('uTop', 1, top.tex); this._1i('uMode', BLEND_ID[mode] || 0);
    this._quad();
  }

  /** Resolves what pixels a clip shows right now. */
  _source(c, t, prov) {
    if (c.kind === 'video') {
      const f = prov.video(c, t);
      if (!f) return null;
      const tex = this._upload('v:' + c.id, f.src, f.stamp, this.hq && f.mip);
      if (!tex) return null;
      let tex2 = null, mixF = 0;
      if (f.next) { tex2 = this._upload('v2:' + c.id, f.next, f.nextStamp); mixF = f.mix || 0; }
      return { tex, w: f.w, h: f.h, rotQ: f.rot || 0, tex2, mixF };
    }
    if (c.kind === 'image') {
      const im = prov.image(c);
      if (!im) return null;
      const w = im.width, h = im.height;
      return { tex: this._upload('i:' + (im.__key || c.media), im, 1, true), w, h, rotQ: 0 };
    }
    if (c.kind === 'color') {
      const key = 'c:' + c.color + '|' + (c.color2 || '');
      if (!this.textures.has(key)) {
        const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
        const x = cv.getContext('2d');
        if (c.color2) { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, c.color); g.addColorStop(1, c.color2); x.fillStyle = g; } else x.fillStyle = c.color;
        x.fillRect(0, 0, 4, 256);
        this._upload(key, cv, 1);
      }
      return { tex: this._upload(key, null, 1), w: 4, h: 256, rotQ: 0, flat: true };
    }
    return null;
  }

  /** Draws a media or colour clip into target at its transform. */
  _drawMedia(c, t, target, s, P, tf, extra = {}) {
    const W = target.w, H = target.h, k = W / P.w;
    const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 };
    const portrait = s.rotQ === 1 || s.rotQ === 3;
    const dw = (portrait ? s.h : s.w) * (1 - cr.l - cr.r), dh = (portrait ? s.w : s.h) * (1 - cr.t - cr.b);
    let qw, qh;
    if (c.fit === 'stretch' || s.flat) { qw = P.w; qh = P.h; } else {
      const fs = c.fit === 'cover' ? Math.max(P.w / dw, P.h / dh) : Math.min(P.w / dw, P.h / dh);
      qw = dw * fs; qh = dh * fs;
    }
    qw *= tf.s * k; qh *= tf.s * k;
    const cx = W / 2 + tf.x * W, cy = H / 2 + tf.y * H;
    const m = this._matrix(cx, cy, qw, qh, tf.rot, tf.rx, tf.ry, W, H);
    let uv = [cr.l, cr.t, 1 - cr.l - cr.r, 1 - cr.t - cr.b];
    if (c.flipH) uv = [uv[0] + uv[2], uv[1], -uv[2], uv[3]];
    if (c.flipV) uv = [uv[0], uv[1] + uv[3], uv[2], -uv[3]];
    const small = qw > dw * 1.15;
    const sharpAmt = c.sharp || 0;
    const opt = {
      m, uv, rotQ: s.rotQ, op: tf.op, sw: s.w, sh: s.h, qw, qh, radius: (c.radius || 0) * Math.min(qw, qh) * 0.5,
      cubic: !s.flat && (sharpAmt > 0 || (this.hq && small)), sharp: sharpAmt, clean: c.cleanup || 0, time: t,
      grade: c.__grade, key: extra.key, mask: c.mask, tex2: s.tex2, mixF: s.mixF,
    };
    this._drawLayer(target, s.tex, opt);
  }

  _chroma(c) {
    if (!c.chroma || !c.chroma.color) return null;
    const hx = c.chroma.color.replace('#', ''), n = parseInt(hx, 16);
    return { rgb: [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], t: 0.04 + (c.chroma.amt ?? 0.3) * 0.34, s: 0.01 + (c.chroma.soft ?? 0.2) * 0.2, sp: c.chroma.spill ?? 0.5 };
  }

  _gradeOf(c) { return c.adjust || c.filter ? mergeGrade(c.adjust, c.filter) : null; }

  /** Everything needed to get one main or overlay media clip into its own framebuffer. */
  _mainLayer(P, c, t, prov) {
    const out = this._fbo();
    const k = out.w / P.w;
    const bg = P.bg || { type: 'color', color: '#000000' };
    const s = this._source(c, t, prov);
    this._clearColor(out, bg.type === 'blur' ? '#000000' : bg.color || '#000000');
    if (bg.type === 'image' && bg.media) {
      const im = prov.bgImage?.(bg.media);
      if (im) {
        const fs = Math.max(P.w / im.width, P.h / im.height);
        const qw = im.width * fs * k, qh = im.height * fs * k;
        this._drawLayer(out, this._upload('i:' + bg.media, im, 1, true), { m: this._matrix(out.w / 2, out.h / 2, qw, qh, 0, 0, 0, out.w, out.h), qw, qh, sw: im.width, sh: im.height });
      }
    } else if (bg.type === 'gradient') {
      const key = { kind: 'color', color: bg.color, color2: bg.color2 || '#000000', fit: 'stretch', id: 'bg' };
      const gs = this._source(key, t, prov);
      this._drawLayer(out, gs.tex, { m: this._matrix(out.w / 2, out.h / 2, out.w, out.h, 0, 0, 0, out.w, out.h), qw: out.w, qh: out.h, sw: 4, sh: 256 });
    } else if (bg.type === 'blur' && s && !s.flat && c.fit !== 'stretch') {
      const small = this._fbo(Math.max(8, out.w >> 2), Math.max(8, out.h >> 2));
      this._clear(small);
      const portrait = s.rotQ === 1 || s.rotQ === 3;
      const dw = portrait ? s.h : s.w, dh = portrait ? s.w : s.h;
      const fs = Math.max(P.w / dw, P.h / dh) * 1.08, kk = small.w / P.w;
      const qw = dw * fs * kk, qh = dh * fs * kk;
      this._drawLayer(small, s.tex, { m: this._matrix(small.w / 2, small.h / 2, qw, qh, 0, 0, 0, small.w, small.h), rotQ: s.rotQ, qw, qh, sw: s.w, sh: s.h });
      const blurred = this._blur(small, bg.blur ?? 0.6, 2);
      this._copy(out, blurred);
      this._free(small, blurred);
      // A touch darker, so the sharp picture stands out from its own blurred copy.
      this._drawLayer(out, this._solid('#000000'), { m: this._matrix(out.w / 2, out.h / 2, out.w, out.h, 0, 0, 0, out.w, out.h), op: 0.18, qw: out.w, qh: out.h });
    }
    if (s) this._drawClipPixels(P, c, t, s, out);
    return this._applyClipFx(c, t, out);
  }

  _solid(color) {
    const key = 'solid:' + color;
    if (!this.textures.has(key)) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 2;
      const x = cv.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 2, 2);
      this._upload(key, cv, 1);
    }
    return this._upload(key, null, 1);
  }
  _clearColor(f, hex) {
    const n = parseInt((hex || '#000000').replace('#', '').padEnd(6, '0').slice(0, 6), 16);
    this._clear(f, ((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1);
  }

  _drawClipPixels(P, c, t, s, target) {
    const tf = this._transform(c, t, P);
    c.__grade = this._gradeOf(c);
    if (tf.blur > 0.02) {
      const tmp = this._fbo(target.w, target.h);
      this._clear(tmp);
      this._drawMedia(c, t, tmp, s, P, tf, { key: this._chroma(c) });
      const bl = this._blur(tmp, tf.blur * 0.9, 2);
      this._compositeOver(target, bl);
      this._free(tmp, bl);
    } else this._drawMedia(c, t, target, s, P, tf, { key: this._chroma(c) });
    delete c.__grade;
  }

  _compositeOver(target, src) {
    const gl = this.gl, p = this._program('copy', FS_COPY);
    this._bind(target); this._use(p); this._1f('uFlip', 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this._tex('uT', 0, src.tex); this._quad();
    gl.disable(gl.BLEND);
  }

  _applyClipFx(c, t, layer) {
    let cur = layer;
    for (const f of c.fx || []) {
      const dst = this._fbo(cur.w, cur.h);
      this._fxPass(cur, dst, f.id, t - c.start, (t - c.start) / c.dur, f.amt ?? 1, f.p1, f.p2);
      this._free(cur);
      cur = dst;
    }
    return cur;
  }

  /** Text and stickers: a canvas raster placed at its transform. */
  _drawGraphic(P, c, t, comp, prov) {
    const k = comp.w / P.w, tf = this._transform(c, t, P), u = t - c.start;
    let src, w, h, stamp;
    if (c.kind === 'text') {
      const r = renderText(c, k, u, P.w);
      if (!r) return comp;
      src = r.canvas; w = r.w; h = r.h; stamp = r.key;
    } else {
      const r = stickerSource(c.sticker);
      if (!r) return comp;
      src = r.canvas; stamp = r.key;
      const base = Math.min(P.w, P.h) * 0.3;
      w = base * (r.aspect >= 1 ? 1 : r.aspect); h = base * (r.aspect >= 1 ? 1 / r.aspect : 1);
    }
    const tex = this._upload('g:' + c.id, src, stamp);
    if (!tex) return comp;
    const qw = w * tf.s * k, qh = h * tf.s * k, cx = comp.w / 2 + tf.x * comp.w, cy = comp.h / 2 + tf.y * comp.h;
    const opt = { m: this._matrix(cx, cy, qw, qh, tf.rot, tf.rx, tf.ry, comp.w, comp.h), op: tf.op, qw, qh, sw: src.width, sh: src.height, uv: c.flipH ? [1, 0, -1, 1] : undefined, mask: c.mask, grade: this._gradeOf(c) };
    return this._drawOver(comp, c, t, tex, opt, tf);
  }

  /** Puts a finished layer on the composition, through a blend-mode pass or clip effects only when needed. */
  _drawOver(comp, c, t, tex, opt, tf) {
    const needsPass = (c.blend && c.blend !== 'normal') || (c.fx && c.fx.length) || tf.blur > 0.02;
    if (!needsPass) { this._drawLayer(comp, tex, opt); return comp; }
    let layer = this._fbo(comp.w, comp.h);
    this._clear(layer);
    this._drawLayer(layer, tex, opt);
    if (tf.blur > 0.02) { const bl = this._blur(layer, tf.blur * 0.9, 2); this._free(layer); const up = this._fbo(comp.w, comp.h); this._copy(up, bl); this._free(bl); layer = up; }
    layer = this._applyClipFx(c, t, layer);
    return this._layerOnto(comp, layer, c.blend);
  }

  _layerOnto(comp, layer, blend) {
    if (!blend || blend === 'normal') { this._compositeOver(comp, layer); this._free(layer); return comp; }
    const dst = this._fbo(comp.w, comp.h);
    this._blendPass(comp, layer, dst, blend);
    this._free(comp, layer);
    return dst;
  }

  _drawOverlay(P, c, t, comp, prov) {
    const s = this._source(c, t, prov);
    if (!s) return comp;
    const tf = this._transform(c, t, P);
    if ((c.blend && c.blend !== 'normal') || (c.fx && c.fx.length) || tf.blur > 0.02) {
      let layer = this._fbo(comp.w, comp.h);
      this._clear(layer);
      this._drawClipPixels(P, c, t, s, layer);
      layer = this._applyClipFx(c, t, layer);
      return this._layerOnto(comp, layer, c.blend);
    }
    this._drawClipPixels(P, c, t, s, comp);
    return comp;
  }

  _gradePass(comp, grade, t) {
    if (!grade || grade.neutral) return comp;
    const dst = this._fbo(comp.w, comp.h);
    this._clear(dst);
    this._drawLayer(dst, comp.tex, { m: this._matrix(dst.w / 2, dst.h / 2, dst.w, dst.h, 0, 0, 0, dst.w, dst.h), grade, time: t, qw: dst.w, qh: dst.h, sw: dst.w, sh: dst.h });
    this._free(comp);
    return dst;
  }

  _watermark(P, comp, wm, t, prov) {
    const k = comp.w / P.w;
    let src, w, h, stamp;
    if (wm.kind === 'image') {
      const im = prov.bgImage?.(wm.media);
      if (!im) return;
      src = im; stamp = 1;
      const base = P.w * (wm.size ?? 0.2);
      w = base; h = base * (im.height / im.width);
    } else {
      const r = renderText({ ...wm.style, text: wm.text, id: 'wm', dur: 1, tanim: null }, k, 0, P.w);
      if (!r) return;
      src = r.canvas; stamp = r.key;
      const sc = (wm.size ?? 0.2) / 0.2;
      w = r.w * sc; h = r.h * sc;
    }
    const tex = this._upload(wm.kind === 'image' ? 'i:' + wm.media : 'wm:' + stamp, src, stamp, wm.kind === 'image');
    if (!tex) return;
    const qw = w * k, qh = h * k, op = wm.op ?? 0.6;
    const put = (x, y, rot = 0) => this._drawLayer(comp, tex, { m: this._matrix(x, y, qw, qh, rot, 0, 0, comp.w, comp.h), op, qw, qh, sw: src.width, sh: src.height });
    if (wm.pos === 'tile') {
      const stepX = qw * 1.7, stepY = Math.max(qh * 3.2, qw * 0.9);
      let row = 0;
      for (let y = -stepY; y < comp.h + stepY; y += stepY, row++) for (let x = -stepX + (row % 2) * stepX * 0.5; x < comp.w + stepX; x += stepX) put(x, y, -24);
      return;
    }
    const m = Math.min(comp.w, comp.h) * 0.04;
    const pos = wm.pos || 'br';
    const x = pos.includes('l') ? m + qw / 2 : pos.includes('r') ? comp.w - m - qw / 2 : comp.w / 2;
    const y = pos.includes('t') ? m + qh / 2 : pos.includes('b') ? comp.h - m - qh / 2 : comp.h / 2;
    put(x, y);
  }

  /** Renders the frame at timeline time t into the canvas. */
  render(P, t, prov, { width, height, flip = true } = {}) {
    if (this.lost) return;
    const gl = this.gl;
    const W = (width || this.canvas.width) | 0, H = (height || this.canvas.height) | 0;
    this.W = W; this.H = H;
    this.frameCount++;
    this._sweep();

    let comp;
    const main = mainTrack(P);
    const tr = transitionAt(P, t);
    if (tr) {
      const a = this._mainLayer(P, tr.a, t, prov), b = this._mainLayer(P, tr.b, t, prov);
      comp = this._fbo();
      this._transPass(a, b, comp, tr.trans.id, tr.p);
      this._free(a, b);
    } else {
      const c = main && activeIn(main, t);
      if (c) comp = this._mainLayer(P, c, t, prov);
      else { comp = this._fbo(); this._clearColor(comp, '#000000'); }
    }

    for (const track of P.tracks) {
      if (track.kind === 'main' || track.hidden) continue;
      const c = activeIn(track, t);
      if (!c) continue;
      if (c.kind === 'effect') {
        const dst = this._fbo();
        this._fxPass(comp, dst, c.effect, t - c.start, (t - c.start) / c.dur, c.amt ?? 1, c.p1, c.p2);
        this._free(comp); comp = dst;
      } else if (c.kind === 'filter') comp = this._gradePass(comp, mergeGrade(null, c.filter), t);
      else if (c.kind === 'adjust') comp = this._gradePass(comp, mergeGrade(c.adjust, null), t);
      else if (c.kind === 'text' || c.kind === 'sticker') comp = this._drawGraphic(P, c, t, comp, prov);
      else if (isVisual(c)) comp = this._drawOverlay(P, c, t, comp, prov);
    }
    if (P.watermark) this._watermark(P, comp, P.watermark, t, prov);

    // Final blit: flip to screen orientation.
    const p = this._program('copy', FS_COPY);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this._use(p); this._1f('uFlip', flip ? -1 : 1); this._tex('uT', 0, comp.tex); this._quad();
    this._free(comp);
  }
}

export { srcAt };
