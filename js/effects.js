// Video effects. Each body is GLSL for: vec4 fx(vec2 uv) with S(uv) = source, t = seconds, prog = 0..1 through the effect, amt = strength, p1 p2 = user dials.
const E = (id, name, cat, code) => ({ id, name, cat, code });

export const EFFECTS = [
  // Gerak
  E('shake', 'Guncangan', 'Gerak', 'float k=floor(t*24.);vec2 o=(vec2(rand(vec2(k,1.)),rand(vec2(k,2.)))-.5)*.05*amt;return S((uv-.5)/(1.+.1*amt)+.5+o);'),
  E('handheld', 'Kamera Tangan', 'Gerak', 'vec2 o=vec2(sin(t*1.7)+sin(t*3.1)*.5,cos(t*1.3)+sin(t*2.3)*.5)*.009*amt;float a=sin(t*.9)*.008*amt;vec2 c=(uv-.5)/(1.+.05*amt);return S(mat2(cos(a),-sin(a),sin(a),cos(a))*c+.5+o);'),
  E('zoompulse', 'Denyut Zoom', 'Gerak', 'float b=fract(t*(1.+p1*3.));float z=1.+exp(-b*6.)*.16*amt;return S((uv-.5)/z+.5);'),
  E('slowzoom', 'Zoom Pelan', 'Gerak', 'float z=1.+prog*.28*amt;return S((uv-.5)/z+.5);'),
  E('zoomblur', 'Zoom Blur', 'Gerak', 'vec2 c=uv-.5;vec4 s=vec4(0);for(int i=0;i<16;i++){s+=S(c*(1.-float(i)*.012*amt)+.5);}return s/16.;'),
  E('motionblur', 'Blur Gerak', 'Gerak', 'vec4 s=vec4(0);vec2 d=vec2(cos(p1*6.28),sin(p1*6.28))*.05*amt;for(int i=0;i<14;i++){s+=S(uv+d*(float(i)/13.-.5));}return s/14.;'),
  E('wobble', 'Goyang Air', 'Gerak', 'vec2 o=vec2(sin(uv.y*16.+t*3.),cos(uv.x*14.+t*2.6))*.012*amt;return S(uv+o);'),
  E('sway', 'Mengayun', 'Gerak', 'float a=sin(t*2.)*.05*amt;vec2 c=(uv-.5)*vec2(res.x/res.y,1.);c=mat2(cos(a),-sin(a),sin(a),cos(a))*c/(1.+.14*amt);return S(c/vec2(res.x/res.y,1.)+.5);'),
  E('beatflash', 'Kilat Ketukan', 'Gerak', 'float b=fract(t*(1.+p1*3.));vec4 c=S(uv);return vec4(c.rgb+exp(-b*8.)*.5*amt,c.a);'),
  E('strobe', 'Strobo', 'Gerak', 'vec4 c=S(uv);float f=step(.5,fract(t*(4.+p1*10.)));return vec4(mix(c.rgb,c.rgb*1.8+.2,f*amt),c.a);'),
  // Glitch
  E('glitch', 'Glitch', 'Glitch', 'float k=floor(t*14.);float b=floor(uv.y*22.);float r=rand(vec2(b,k));float o=step(.82,r)*(r-.5)*.36*amt;vec2 u=vec2(fract(uv.x+o),uv.y);float s=.012*amt*(1.+step(.7,rand(vec2(k,7.)))*2.);vec4 c=S(u);return vec4(S(u+vec2(s,0.)).r,c.g,S(u-vec2(s,0.)).b,c.a);'),
  E('rgbsplit', 'Pisah RGB', 'Glitch', 'vec2 c=uv-.5;float s=(.012+p1*.03)*amt;vec4 m=S(uv);return vec4(S(uv+c*s*2.).r,m.g,S(uv-c*s*2.).b,m.a);'),
  E('vhs', 'VHS', 'Glitch', 'float l=sin(uv.y*res.y*.7)*.05*amt;float tr=step(.985,fract(uv.y*3.+t*.33))*.04*amt;float w=sin(uv.y*50.+t*9.)*.0016*amt;vec2 u=uv+vec2(w+tr,0.);float ca=.005*amt;vec4 c=S(u);c.r=S(u+vec2(ca,0.)).r;c.b=S(u-vec2(ca,0.)).b;c.rgb+=(rand(uv*res+t)-.5)*.14*amt-l;return vec4(c.rgb,c.a);'),
  E('datamosh', 'Rusak Data', 'Glitch', 'float k=floor(t*8.);vec2 g=floor(uv*vec2(14.,24.));float r=rand(g+k);vec2 o=step(.86,r)*(vec2(rand(g+1.),rand(g+2.))-.5)*.26*amt;vec4 c=S(uv+o);return vec4(c.rgb+step(.965,r)*.3*amt,c.a);'),
  E('scan', 'Garis Layar', 'Glitch', 'vec4 c=S(uv);float l=.5+.5*sin(uv.y*res.y*1.2);return vec4(c.rgb*(1.-l*.35*amt)+step(.997,fract(uv.y-t*.25))*.2*amt,c.a);'),
  E('tv', 'TV Tua', 'Glitch', 'vec2 q=uv-.5;float r2=dot(q,q);vec2 u=.5+q*(1.+r2*.32*amt);if(u.x<0.||u.x>1.||u.y<0.||u.y>1.)return vec4(0,0,0,1);vec4 c=S(u);float l=.86+.14*sin(u.y*res.y*.9+t*9.);float n=(rand(uv*res+t)-.5)*.1;return vec4((c.rgb*l+n)*(1.-r2*.9*amt),c.a);'),
  E('static', 'Semut TV', 'Glitch', 'vec4 c=S(uv);float n=rand(floor(uv*res/2.)+floor(t*30.));return vec4(mix(c.rgb,vec3(n),.35*amt),c.a);'),
  // Blur
  E('blur', 'Blur Halus', 'Blur', 'vec4 s=vec4(0);float w=0.;float r=(.004+p1*.02)*amt;for(int i=0;i<24;i++){float a=float(i)*2.4;float k=sqrt(float(i)/24.);s+=S(uv+vec2(cos(a),sin(a)*res.x/res.y)*k*r);w+=1.;}return s/w;'),
  E('tilt', 'Tilt Shift', 'Blur', 'float d=abs(uv.y-p1)*2.;float r=smoothstep(.15,.7,d)*.016*amt;vec4 s=vec4(0);for(int i=0;i<20;i++){float a=float(i)*2.4;float k=sqrt(float(i)/20.);s+=S(uv+vec2(cos(a),sin(a))*k*r);}return s/20.;'),
  E('bokeh', 'Bokeh', 'Blur', 'vec2 c=uv-.5;float d=length(c);float r=smoothstep(.2,.75,d)*.03*amt;vec4 s=vec4(0);for(int i=0;i<24;i++){float a=float(i)*2.4;float k=sqrt(float(i)/24.);s+=S(uv+vec2(cos(a),sin(a))*k*r);}return s/24.;'),
  E('dream', 'Mimpi', 'Blur', 'vec4 o=S(uv);vec4 s=vec4(0);for(int i=0;i<20;i++){float a=float(i)*2.4;float k=sqrt(float(i)/20.);s+=S(uv+vec2(cos(a),sin(a))*k*.022);}s/=20.;return vec4(mix(o.rgb,1.-(1.-o.rgb)*(1.-s.rgb*.75),amt),o.a);'),
  E('pixelate', 'Sensor Piksel', 'Blur', 'float n=mix(8.,60.,p1)*amt+1.;vec2 g=n/res;return S((floor(uv/g)+.5)*g);'),
  // Cahaya
  E('lightleak', 'Bocor Cahaya', 'Cahaya', 'vec4 c=S(uv);float x=uv.x+sin(t*.6)*.3;float l=smoothstep(.75,.0,abs(x-.15))*(.6+.4*sin(t+uv.y*3.));return vec4(1.-(1.-c.rgb)*(1.-l*vec3(1.,.5,.18)*amt*.9),c.a);'),
  E('glow', 'Pendar', 'Cahaya', 'vec4 o=S(uv);vec3 s=vec3(0);for(int i=0;i<24;i++){float a=float(i)*2.4;float k=sqrt(float(i)/24.);vec3 x=S(uv+vec2(cos(a),sin(a))*k*.03).rgb;s+=max(x-.55,0.);}s/=24.;return vec4(o.rgb+s*3.*amt,o.a);'),
  E('sunray', 'Sinar Matahari', 'Cahaya', 'vec4 o=S(uv);vec2 c=uv-vec2(p1,.1);float a=atan(c.y,c.x);float r=length(c);float ray=pow(.5+.5*sin(a*18.+t*.7+sin(a*7.)*3.),4.)*smoothstep(1.2,0.,r);return vec4(o.rgb+ray*vec3(1.,.86,.55)*.6*amt,o.a);'),
  E('flare', 'Suar Lensa', 'Cahaya', 'vec4 o=S(uv);vec2 l=vec2(p1+sin(t*.5)*.05,.25);vec2 c=(uv-l)*vec2(res.x/res.y,1.);float d=length(c);float f=.025/d+pow(max(0.,1.-abs(c.y)*22.),4.)*.3*smoothstep(.7,0.,abs(c.x));vec2 g=(uv-(1.-l))*vec2(res.x/res.y,1.);f+=smoothstep(.09,.08,length(g))*.08;return vec4(o.rgb+f*vec3(1.,.88,.7)*amt,o.a);'),
  E('sparkle', 'Kilau', 'Cahaya', 'vec4 o=S(uv);vec3 c=o.rgb;for(int i=0;i<3;i++){float sc=18.+float(i)*14.;vec2 q=uv*vec2(res.x/res.y,1.)*sc;vec2 g=floor(q);vec2 f=fract(q)-.5;float r=rand(g+float(i));if(r>.86){vec2 o2=(vec2(rand(g+3.),rand(g+5.))-.5)*.6;float tw=pow(.5+.5*sin(t*(2.+r*5.)+r*40.),6.);vec2 d=abs(f-o2);float s=.012/(d.x*d.y+.012)*smoothstep(.5,.0,length(f-o2));c+=s*tw*.55*amt;}}return vec4(c,o.a);'),
  E('neonedge', 'Tepi Neon', 'Cahaya', 'vec2 d=1.5/res;vec3 a=S(uv+vec2(d.x,0.)).rgb-S(uv-vec2(d.x,0.)).rgb;vec3 b=S(uv+vec2(0.,d.y)).rgb-S(uv-vec2(0.,d.y)).rgb;float e=length(a)+length(b);vec3 col=.5+.5*cos(6.28*(uv.x+uv.y+t*.25)+vec3(0.,2.1,4.2));vec4 o=S(uv);return vec4(mix(o.rgb,col*e*3.,amt),o.a);'),
  E('flash', 'Blitz Kamera', 'Cahaya', 'vec4 c=S(uv);float f=step(.97,rand(vec2(floor(t*12.),3.)));return vec4(c.rgb+f*.8*amt,c.a);'),
  E('vignette', 'Vignette', 'Cahaya', 'vec4 c=S(uv);float d=length(uv-.5);return vec4(c.rgb*(1.-smoothstep(.3,.8,d)*amt),c.a);'),
  // Partikel
  E('snow', 'Salju', 'Partikel', 'vec4 o=S(uv);vec3 c=o.rgb;vec2 a=vec2(res.x/res.y,1.);for(int i=0;i<4;i++){float sc=6.+float(i)*5.;vec2 q=uv*a*sc;q.y-=t*(1.+float(i)*.35)*.9*-1.*-1.;q.x+=sin(t*.5+float(i))*.4;q.y+=t*(.8+float(i)*.2);vec2 g=floor(q);vec2 f=fract(q)-.5;float r=rand(g+float(i)*7.);if(r>.55){vec2 p0=(vec2(rand(g+1.),rand(g+2.))-.5)*.7;c+=smoothstep(.07,.01,length(f-p0))*.85*amt;}}return vec4(c,o.a);'),
  E('rain', 'Hujan', 'Partikel', 'vec4 o=S(uv);vec3 c=o.rgb*(1.-.12*amt);for(int i=0;i<3;i++){vec2 q=vec2(uv.x*res.x/res.y*(36.+float(i)*20.)+uv.y*2.,uv.y*(3.+float(i))+t*(3.+float(i)));vec2 g=floor(q);vec2 f=fract(q);float r=rand(g+float(i));if(r>.7){c+=smoothstep(.06,.0,abs(f.x-.5))*smoothstep(0.,.4,f.y)*smoothstep(1.,.5,f.y)*.32*amt;}}return vec4(c,o.a);'),
  E('confetti', 'Konfeti', 'Partikel', 'vec4 o=S(uv);vec3 c=o.rgb;vec2 a=vec2(res.x/res.y,1.);for(int i=0;i<3;i++){float sc=9.+float(i)*7.;vec2 q=uv*a*sc+vec2(sin(t+float(i))*.4,t*(1.1+float(i)*.25));vec2 g=floor(q);vec2 f=fract(q)-.5;float r=rand(g+float(i)*3.);if(r>.62){float an=t*3.*r+r*40.;mat2 m=mat2(cos(an),-sin(an),sin(an),cos(an));vec2 u=m*(f-(vec2(rand(g+1.),rand(g+2.))-.5)*.5);vec3 col=.55+.45*cos(6.28*r*7.+vec3(0.,2.,4.));float s=step(abs(u.x),.11)*step(abs(u.y),.05+.05*abs(sin(an)));c=mix(c,col,s*amt);}}return vec4(c,o.a);'),
  E('hearts', 'Hati Melayang', 'Partikel', 'vec4 o=S(uv);vec3 c=o.rgb;vec2 a=vec2(res.x/res.y,1.);for(int i=0;i<2;i++){float sc=6.+float(i)*4.;vec2 q=uv*a*sc+vec2(sin(t*.7+float(i))*.3,t*(.7+float(i)*.15));vec2 g=floor(q);vec2 f=fract(q)-.5;float r=rand(g+float(i)+9.);if(r>.66){vec2 u=(f-(vec2(rand(g+1.),rand(g+2.))-.5)*.4)*6.;u.y=-u.y;float h=u.x*u.x+pow(u.y-sqrt(abs(u.x))*.8,2.);c=mix(c,vec3(1.,.28,.45),smoothstep(1.05,.9,h)*amt*.9);}}return vec4(c,o.a);'),
  E('bubbles', 'Gelembung', 'Partikel', 'vec4 o=S(uv);vec3 c=o.rgb;vec2 a=vec2(res.x/res.y,1.);for(int i=0;i<3;i++){float sc=6.+float(i)*4.;vec2 q=uv*a*sc+vec2(sin(t*.8+uv.y*4.)*.1,-t*-1.*(.5+float(i)*.2)*-1.);q.y+=t*(.5+float(i)*.2);vec2 g=floor(q);vec2 f=fract(q)-.5;float r=rand(g+float(i)*5.);if(r>.7){float d=length(f-(vec2(rand(g+1.),rand(g+2.))-.5)*.4);float rad=.1+r*.15-.1;c+=(smoothstep(rad,rad-.02,d)-smoothstep(rad-.02,rad-.05,d))*.6*amt;}}return vec4(c,o.a);'),
  E('fireflies', 'Kunang-kunang', 'Partikel', 'vec4 o=S(uv);vec3 c=o.rgb;vec2 a=vec2(res.x/res.y,1.);for(int i=0;i<2;i++){float sc=8.+float(i)*4.;vec2 q=uv*a*sc;vec2 g=floor(q);vec2 f=fract(q)-.5;float r=rand(g+float(i));if(r>.68){vec2 p0=vec2(sin(t*(.5+r)+r*20.),cos(t*(.4+r)+r*30.))*.28;float d=length(f-p0);c+=.012/(d*d+.012)*.25*vec3(1.,.9,.45)*(.5+.5*sin(t*3.+r*9.))*amt;}}return vec4(c,o.a);'),
  E('filmgrain', 'Bintik Film', 'Partikel', 'vec4 c=S(uv);float n=rand(uv*res/1.5+fract(t*24.)*91.)-.5;return vec4(c.rgb+n*.22*amt,c.a);'),
  E('oldfilm', 'Film Tua', 'Partikel', 'float k=floor(t*18.);vec2 u=uv+vec2(0.,(rand(vec2(k,3.))-.5)*.006*amt);vec4 c=S(u);float g=dot(c.rgb,vec3(.3,.59,.11));vec3 s=g*vec3(1.05,.92,.72);vec3 m=mix(c.rgb,s,amt);float sc=step(.992,rand(vec2(floor(uv.x*200.),k)))*.5;float dust=step(.9994,rand(floor(uv*res/3.)+k));float d=length(uv-.5);return vec4((m+sc*amt*.5+dust)*(.92+.08*rand(vec2(k,9.)))*(1.-smoothstep(.35,.85,d)*.7*amt),c.a);'),
  // Bingkai
  E('letterbox', 'Bar Sinematik', 'Bingkai', 'float h=.04+.1*amt*(.5+p1);vec4 c=S(uv);return (uv.y<h||uv.y>1.-h)?vec4(0,0,0,1):c;'),
  E('mirror', 'Cermin', 'Bingkai', 'return S(vec2(.5-abs(uv.x-.5),uv.y));'),
  E('mirrorv', 'Cermin Atas', 'Bingkai', 'return S(vec2(uv.x,.5-abs(uv.y-.5)));'),
  E('split2', 'Bagi 2', 'Bingkai', 'return S(vec2(uv.x,fract(uv.y*2.)*.5+.25));'),
  E('split3', 'Bagi 3', 'Bingkai', 'return S(vec2(uv.x,fract(uv.y*3.)/3.+.333));'),
  E('split4', 'Bagi 4', 'Bingkai', 'return S(fract(uv*2.));'),
  E('split9', 'Bagi 9', 'Bingkai', 'return S(fract(uv*3.));'),
  E('kaleido', 'Kaleidoskop', 'Bingkai', 'vec2 c=(uv-.5)*vec2(res.x/res.y,1.);float a=atan(c.y,c.x)+t*.2;float n=3.+floor(p1*6.);a=abs(mod(a,6.2832/n)-3.1416/n);float r=length(c);vec2 u=vec2(cos(a),sin(a))*r/vec2(res.x/res.y,1.)+.5;return mix(S(uv),S(u),amt);'),
  E('fisheye', 'Mata Ikan', 'Bingkai', 'vec2 q=uv-.5;float r=length(q);vec2 u=.5+q*(1.-amt*.55+r*r*amt*2.2);return S(clamp(u,0.,1.));'),
  E('dolly', 'Zoom 3D', 'Bingkai', 'vec2 c=uv-.5;float l=dot(S(uv).rgb,vec3(.3,.59,.11));float z=1.+prog*.2*amt*(.6+l*.8);return S(c/z+.5);'),
  E('filmframe', 'Bingkai Film', 'Bingkai', 'vec4 c=S(uv);vec2 g=vec2(fract(uv.y*18.),abs(uv.x-.5));float side=step(.455,g.y);float hole=side*step(abs(g.x-.5),.28)*step(abs(g.y-.478),.012);vec3 m=side>.5?mix(vec3(.04),vec3(.9),hole):c.rgb;return vec4(mix(c.rgb,m,amt),c.a);'),
  // Warna
  E('invert', 'Negatif', 'Warna', 'vec4 c=S(uv);return vec4(mix(c.rgb,1.-c.rgb,amt),c.a);'),
  E('posterize', 'Poster', 'Warna', 'vec4 c=S(uv);float n=mix(16.,3.,amt);return vec4(floor(c.rgb*n+.5)/n,c.a);'),
  E('thermal', 'Termal', 'Warna', 'vec4 c=S(uv);float g=dot(c.rgb,vec3(.3,.59,.11));vec3 m=.5+.5*cos(6.28*(g*.9+vec3(.55,.75,.95)));return vec4(mix(c.rgb,m,amt),c.a);'),
  E('rainbow', 'Pelangi', 'Warna', 'vec4 c=S(uv);vec3 h=.5+.5*cos(6.28*(uv.x+uv.y*.5+t*.3)+vec3(0.,2.1,4.2));return vec4(mix(c.rgb,c.rgb*h*1.8,amt*.8),c.a);'),
  E('colorpop', 'Warna Merah Saja', 'Warna', 'vec4 c=S(uv);float g=dot(c.rgb,vec3(.3,.59,.11));float m=smoothstep(.05,.22,c.r-max(c.g,c.b));return vec4(mix(c.rgb,mix(vec3(g),c.rgb,m),amt),c.a);'),
  E('halftone', 'Halftone', 'Warna', 'vec4 c=S(uv);float g=dot(c.rgb,vec3(.3,.59,.11));vec2 q=uv*res/(6.+p1*10.);float a=.785;q=mat2(cos(a),-sin(a),sin(a),cos(a))*q;float d=length(fract(q)-.5);float s=smoothstep(.0,.08,sqrt(1.-g)*.72-d);return vec4(mix(c.rgb,mix(c.rgb*1.1,vec3(.02),s),amt),c.a);'),
  E('sketch', 'Sketsa', 'Warna', 'vec2 d=1./res;float gx=0.,gy=0.;for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){float l=dot(S(uv+vec2(float(i),float(j))*d*1.5).rgb,vec3(.33));gx+=float(i)*l*(j==0?2.:1.);gy+=float(j)*l*(i==0?2.:1.);}float e=1.-clamp(length(vec2(gx,gy))*1.6,0.,1.);vec4 o=S(uv);return vec4(mix(o.rgb,vec3(e),amt),o.a);'),
  E('oilpaint', 'Lukisan', 'Warna', 'vec2 d=3./res;vec3 s=vec3(0);for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec3 c=S(uv+vec2(float(i),float(j))*d).rgb;s+=floor(c*7.+.5)/7.;}s/=25.;vec4 o=S(uv);return vec4(mix(o.rgb,s,amt),o.a);'),
];
export const EFFECT_CATS = [...new Set(EFFECTS.map((e) => e.cat))];
export const effectById = (id) => EFFECTS.find((e) => e.id === id);
