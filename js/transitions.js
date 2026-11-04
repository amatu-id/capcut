// Transition catalog. Each body is GLSL for: vec4 tr(vec2 uv) with p (0..1), A(uv), B(uv), res, and helpers from render.js (rand, noise, ease).
const T = (id, name, cat, code, d = 0.6) => ({ id, name, cat, code, d });

export const TRANSITIONS = [
  // Dasar
  T('fade', 'Larut', 'Dasar', 'return mix(A(uv),B(uv),p);', .7),
  T('black', 'Lewat Hitam', 'Dasar', 'return p<.5?mix(A(uv),vec4(0,0,0,1),p*2.):mix(vec4(0,0,0,1),B(uv),p*2.-1.);', .8),
  T('white', 'Lewat Putih', 'Dasar', 'return p<.5?mix(A(uv),vec4(1),p*2.):mix(vec4(1),B(uv),p*2.-1.);', .7),
  T('flash', 'Kilat', 'Dasar', 'float f=exp(-pow((p-.5)*7.,2.));vec4 c=p<.5?A(uv):B(uv);return vec4(c.rgb+f*1.3,1.);', .4),
  T('dip', 'Luma', 'Dasar', 'vec4 a=A(uv);float l=dot(a.rgb,vec3(.3,.59,.11));float s=smoothstep(l-.15,l+.15,p*1.3-.15);return mix(a,B(uv),s);', .8),
  T('dissolve', 'Pasir', 'Dasar', 'float n=noise(uv*res/6.);return mix(A(uv),B(uv),smoothstep(n-.05,n+.05,p*1.1-.05));', .8),
  T('blinds', 'Tirai', 'Dasar', 'float m=fract(uv.y*12.);return m<p?B(uv):A(uv);', .7),
  T('bars', 'Balok', 'Dasar', 'float m=fract(uv.x*10.);return step(m,p)>.5?B(uv):A(uv);', .7),
  // Geser
  T('pushl', 'Dorong Kiri', 'Geser', 'float e=ease(p);vec2 u=uv+vec2(e,0.);return u.x<1.?A(u):B(u-vec2(1.,0.));', .5),
  T('pushr', 'Dorong Kanan', 'Geser', 'float e=ease(p);vec2 u=uv-vec2(e,0.);return u.x>0.?A(u):B(u+vec2(1.,0.));', .5),
  T('pushu', 'Dorong Atas', 'Geser', 'float e=ease(p);vec2 u=uv-vec2(0.,e);return u.y>0.?A(u):B(u+vec2(0.,1.));', .5),
  T('pushd', 'Dorong Bawah', 'Geser', 'float e=ease(p);vec2 u=uv+vec2(0.,e);return u.y<1.?A(u):B(u-vec2(0.,1.));', .5),
  T('wipel', 'Sapu Kiri', 'Geser', 'return smoothstep(0.,.03,1.-uv.x-(1.-p*1.03))>.5?B(uv):A(uv);', .6),
  T('wiper', 'Sapu Kanan', 'Geser', 'return uv.x<p?B(uv):A(uv);', .6),
  T('wipeu', 'Sapu Atas', 'Geser', 'return uv.y<p?B(uv):A(uv);', .6),
  T('wiped', 'Sapu Bawah', 'Geser', 'return 1.-uv.y<p?B(uv):A(uv);', .6),
  T('diag', 'Sapu Diagonal', 'Geser', 'float d=(uv.x+uv.y)*.5;return mix(A(uv),B(uv),smoothstep(p*1.2-.1,p*1.2-.2+.08,d-.0)<.5?1.:0.);', .7),
  T('slideover', 'Tumpuk', 'Geser', 'float e=ease(p);vec2 u=uv-vec2(1.-e,0.);vec4 a=A(uv-vec2(e*.25,0.)*-1.);return (u.x>=0.)?B(u):vec4(a.rgb*(1.-e*.4),1.);', .6),
  T('split', 'Belah Tengah', 'Geser', 'float e=ease(p);float d=abs(uv.x-.5)*2.;if(d<e)return B(uv);float s=sign(uv.x-.5);return A(vec2(uv.x-s*e*.5,uv.y));', .7),
  T('splith', 'Belah Datar', 'Geser', 'float e=ease(p);float d=abs(uv.y-.5)*2.;if(d<e)return B(uv);float s=sign(uv.y-.5);return A(vec2(uv.x,uv.y-s*e*.5));', .7),
  // Zoom
  T('zoomin', 'Zoom Masuk', 'Zoom', 'vec2 c=uv-.5;if(p<.5){float z=1.-ease(p*2.)*.75;vec4 s=vec4(0);for(int i=0;i<8;i++){s+=A(c*(z-float(i)*.012*p*2.)+.5);}return s/8.;}float z=1.5-ease(p*2.-1.)*.5;vec4 s=vec4(0);for(int i=0;i<8;i++){s+=B(c*(z-float(i)*.012*(2.-p*2.))/1.+.5);}return s/8.;', .5),
  T('zoomout', 'Zoom Keluar', 'Zoom', 'vec2 c=uv-.5;if(p<.5){float z=1.+ease(p*2.)*1.2;vec4 s=vec4(0);for(int i=0;i<8;i++){s+=A(c*(z+float(i)*.03*p*2.)+.5);}return s/8.;}float z=.45+ease(p*2.-1.)*.55;vec4 s=vec4(0);for(int i=0;i<8;i++){s+=B(c*(z+float(i)*.03*(2.-p*2.))+.5);}return s/8.;', .5),
  T('crosszoom', 'Zoom Silang', 'Zoom', 'float st=sin(p*3.14159);vec2 c=uv-.5;vec4 s=vec4(0);for(int i=0;i<12;i++){float q=float(i)/12.;vec2 u=c*(1.-st*.45*q)+.5;s+=mix(A(u),B(u),smoothstep(.3,.7,p));}return s/12.;', .7),
  T('warp', 'Warp', 'Zoom', 'vec2 c=uv-.5;float r=length(c);float st=sin(p*3.14159);vec2 u=c*(1.-st*.7*(1.-r))+.5;return mix(A(u),B(u),smoothstep(.35,.65,p));', .6),
  T('punch', 'Tinju', 'Zoom', 'float st=sin(p*3.14159);vec2 u=(uv-.5)/(1.+st*.5)+.5;vec4 c=p<.5?A(u):B(u);return vec4(c.rgb+st*st*.5,1.);', .35),
  // Putar
  T('spin', 'Pusar', 'Putar', 'float e=ease(p);float a=e*6.2832*(p<.5?1.:1.);vec2 c=uv-.5;float st=sin(p*3.14159);float z=1.+st*.8;c*=z;c=mat2(cos(a),-sin(a),sin(a),cos(a))*c;vec2 u=abs(mod(c+.5,2.)-1.)*1.;u=1.-abs(1.-mod(c+.5,2.));return p<.5?A(u):B(u);', .7),
  T('roll', 'Gulir', 'Putar', 'float a=(1.-ease(p))*1.5708;vec2 c=(uv-.5)*vec2(res.x/res.y,1.);vec2 r=mat2(cos(a),-sin(a),sin(a),cos(a))*(c-vec2(-1.,-1.))+vec2(-1.,-1.);r/=vec2(res.x/res.y,1.);r+=.5;if(r.x>=0.&&r.x<=1.&&r.y>=0.&&r.y<=1.)return B(r);return A(uv);', .7),
  T('swirl', 'Pusaran', 'Putar', 'vec2 c=uv-.5;float r=length(c);float st=sin(p*3.14159);float a=st*5.*smoothstep(.75,0.,r);c=mat2(cos(a),-sin(a),sin(a),cos(a))*c;vec2 u=c+.5;return mix(A(u),B(u),smoothstep(.3,.7,p));', .8),
  T('flip3d', 'Balik 3D', 'Putar', 'float a=p*3.14159;float c=cos(a);vec2 q=uv-.5;float w=abs(c);if(w<.01)return vec4(0,0,0,1);float persp=1.+sin(a)*q.x*.6*(p<.5?1.:-1.);vec2 u=vec2(q.x/w,q.y/persp*1.);if(abs(u.x)>.5||abs(u.y)>.5)return vec4(0,0,0,1);return p<.5?A(u+.5):B(vec2(u.x,u.y)+.5);', .7),
  T('cube', 'Kubus', 'Putar', 'float e=ease(p);float x=uv.x;float s=sin(e*1.5708),c=cos(e*1.5708);float mid=c/(c+s+.0001);if(x<mid){float u=x/mid;float y=(uv.y-.5)/(1.-.25*s*(1.-u))+.5;if(y<0.||y>1.)return vec4(0,0,0,1);return A(vec2(u*.999+.0005,y)*vec2(1.,1.));}float u=(x-mid)/(1.-mid);float y=(uv.y-.5)/(1.-.25*c*u)+.5;if(y<0.||y>1.)return vec4(0,0,0,1);return B(vec2(u,y));', .7),
  // Blur
  T('blur', 'Blur', 'Blur', 'float st=sin(p*3.14159);vec4 s=vec4(0);float w=0.;for(int x=-3;x<=3;x++)for(int y=-3;y<=3;y++){vec2 o=vec2(x,y)*st*.012;s+=mix(A(uv+o),B(uv+o),smoothstep(.3,.7,p));w+=1.;}return s/w;', .6),
  T('whip', 'Cambuk', 'Blur', 'float st=sin(p*3.14159);vec4 s=vec4(0);for(int i=0;i<14;i++){vec2 o=vec2(float(i)/14.-.5,0.)*st*.55;vec2 u=fract(uv+o+vec2(ease(p)*2.,0.));s+=p<.5?A(u):B(u);}return s/14.;', .35),
  T('whipv', 'Cambuk Tegak', 'Blur', 'float st=sin(p*3.14159);vec4 s=vec4(0);for(int i=0;i<14;i++){vec2 o=vec2(0.,float(i)/14.-.5)*st*.55;vec2 u=fract(uv+o+vec2(0.,ease(p)*2.));s+=p<.5?A(u):B(u);}return s/14.;', .35),
  T('radial', 'Radial', 'Blur', 'vec2 c=uv-.5;float a=atan(c.y,c.x)/6.2832+.5;float s=smoothstep(a-.02,a+.02,p);return mix(A(uv),B(uv),s);', .7),
  T('lens', 'Lensa Fokus', 'Blur', 'float st=sin(p*3.14159);vec4 s=vec4(0);for(int i=0;i<16;i++){float a=float(i)*2.4;float r=sqrt(float(i)/16.)*st*.035;vec2 u=uv+vec2(cos(a),sin(a))*r;s+=mix(A(u),B(u),smoothstep(.35,.65,p));}return vec4(s.rgb/16.+st*.08,1.);', .7),
  // Bentuk
  T('circle', 'Lingkaran', 'Bentuk', 'vec2 c=(uv-.5)*vec2(res.x/res.y,1.);float r=length(c)/length(vec2(res.x/res.y,1.)*.5);return r<p?B(uv):A(uv);', .7),
  T('circleout', 'Iris Tutup', 'Bentuk', 'vec2 c=(uv-.5)*vec2(res.x/res.y,1.);float r=length(c)/length(vec2(res.x/res.y,1.)*.5);if(p<.5)return r<1.-p*2.?A(uv):vec4(0,0,0,1);return r<p*2.-1.?B(uv):vec4(0,0,0,1);', .8),
  T('diamond', 'Berlian', 'Bentuk', 'vec2 c=abs(uv-.5);return (c.x+c.y)<p?B(uv):A(uv);', .7),
  T('heart', 'Hati', 'Bentuk', 'vec2 c=(uv-vec2(.5,.45))*vec2(res.x/res.y,1.)*2.2/max(p*2.4,.001);c.y=-c.y;float a=c.x*c.x+pow(c.y-sqrt(abs(c.x))*.8,2.);return a<1.?B(uv):A(uv);', .8),
  T('star', 'Bintang', 'Bentuk', 'vec2 c=(uv-.5)*vec2(res.x/res.y,1.);float a=atan(c.x,c.y);float r=length(c);float k=cos(floor(.5+a*5./6.2832)*6.2832/5.-a)*r;return k<p*.9*(.6+.4*abs(sin(a*2.5)))?B(uv):A(uv);', .8),
  T('checker', 'Kotak Catur', 'Bentuk', 'vec2 g=floor(uv*vec2(10.,16.));float c=mod(g.x+g.y,2.);float s=c>.5?p*2.:p*2.-1.;return fract(uv.y*16.)<s?B(uv):A(uv);', .8),
  T('mosaic', 'Mosaik Acak', 'Bentuk', 'vec2 g=floor(uv*vec2(12.,20.));float r=rand(g);return r<p?B(uv):A(uv);', .8),
  T('hex', 'Sarang Lebah', 'Bentuk', 'vec2 s=vec2(1.,1.732);vec2 u=(uv-.5)*vec2(res.x/res.y,1.)*18.;vec2 a=mod(u,s)-s*.5;vec2 b=mod(u-s*.5,s)-s*.5;vec2 g=dot(a,a)<dot(b,b)?a:b;vec2 id=u-g;float d=length(id)/18.;float k=length(g)*1.15;return k<(p*2.4-d*1.3)?B(uv):A(uv);', .9),
  // Gaya
  T('glitch', 'Glitch', 'Gaya', 'float st=sin(p*3.14159);float b=floor(uv.y*18.);float r=rand(vec2(b,floor(p*20.)));float o=(r-.5)*.34*st*step(.45,r);vec2 u=vec2(fract(uv.x+o),uv.y);vec4 c=p<.5?A(u):B(u);float s=st*.04;vec4 ca=p<.5?A(u+vec2(s,0.)):B(u+vec2(s,0.));vec4 cb=p<.5?A(u-vec2(s,0.)):B(u-vec2(s,0.));return vec4(ca.r,c.g,cb.b,1.);', .4),
  T('rgb', 'Pisah RGB', 'Gaya', 'float st=sin(p*3.14159);vec2 o=vec2(st*.09,0.);vec4 r=mix(A(uv+o),B(uv+o),p),g=mix(A(uv),B(uv),p),b=mix(A(uv-o),B(uv-o),p);return vec4(r.r,g.g,b.b,1.);', .5),
  T('pixel', 'Piksel', 'Gaya', 'float st=sin(p*3.14159);float n=mix(1.,70.,st*st);if(n>1.5){vec2 g=vec2(n)/res;vec2 u=(floor(uv/g)+.5)*g;return mix(A(u),B(u),step(.5,p));}return mix(A(uv),B(uv),step(.5,p));', .6),
  T('wave', 'Gelombang', 'Gaya', 'float st=sin(p*3.14159);vec2 u=uv+vec2(sin(uv.y*22.+p*14.)*.05*st,0.);return mix(A(u),B(u),smoothstep(.3,.7,p));', .7),
  T('ripple', 'Riak Air', 'Gaya', 'vec2 c=uv-.5;float r=length(c);float st=sin(p*3.14159);vec2 u=uv+normalize(c+.0001)*sin(r*48.-p*22.)*.03*st;return mix(A(u),B(u),smoothstep(.2,.8,p));', .8),
  T('burn', 'Terbakar', 'Gaya', 'float n=noise(uv*res/28.);float m=p*1.3-.15;float e=smoothstep(m-.08,m,n)-smoothstep(m,m+.08,n);vec4 c=n<m?B(uv):A(uv);return vec4(c.rgb+e*vec3(1.6,.7,.15),1.);', .9),
  T('ink', 'Tinta', 'Gaya', 'float n=noise(uv*res/40.)*.5+noise(uv*res/14.)*.3;vec2 c=(uv-.5)*vec2(res.x/res.y,1.);float r=length(c)/length(vec2(res.x/res.y,1.)*.5);float k=smoothstep(p*1.8-.5,p*1.8-.46,r*.8+n*.5);return mix(B(uv),A(uv),k);', .9),
  T('leak', 'Bocor Cahaya', 'Gaya', 'float st=sin(p*3.14159);float l=smoothstep(.0,1.,1.-abs(uv.x-p*1.4+.2)*2.2)*st;vec4 c=mix(A(uv),B(uv),smoothstep(.35,.65,p));return vec4(c.rgb+l*vec3(1.5,.75,.28),1.);', .8),
  T('film', 'Gulung Film', 'Gaya', 'float e=ease(p);float y=fract(uv.y+e*3.);float k=floor(uv.y+e*3.);vec4 c=k<1.5?A(vec2(uv.x,y)):B(vec2(uv.x,y));float bar=smoothstep(.0,.015,y)*smoothstep(1.,.985,y);float sp=step(.06,uv.x)*step(uv.x,.94);return vec4(c.rgb*mix(bar,1.,1.-sin(p*3.14))*mix(1.,sp,sin(p*3.14)),1.);', .7),
  T('shake', 'Guncang', 'Gaya', 'float st=sin(p*3.14159);vec2 o=vec2(rand(vec2(floor(p*40.),1.))-.5,rand(vec2(floor(p*40.),2.))-.5)*.14*st;vec2 u=1.-abs(1.-mod(uv+o,2.));return p<.5?A(u):B(u);', .35),
  T('tv', 'TV Mati', 'Gaya', 'if(p<.5){float q=p*2.;float h=1.-ease(q);float d=abs(uv.y-.5);if(d>h*.5+.002)return vec4(0,0,0,1);return vec4(A(vec2(uv.x,(uv.y-.5)/max(h,.005)+.5)).rgb+q*q,1.);}float q=p*2.-1.;float h=ease(q);float d=abs(uv.y-.5);if(d>h*.5+.002)return vec4(0,0,0,1);return vec4(B(vec2(uv.x,(uv.y-.5)/max(h,.005)+.5)).rgb+(1.-q)*(1.-q),1.);', .7),
];
export const TRANSITION_CATS = [...new Set(TRANSITIONS.map((t) => t.cat))];
export const transitionById = (id) => TRANSITIONS.find((t) => t.id === id);
