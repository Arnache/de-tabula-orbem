/*
This code is CC-BY-SA Arnaud Chéritat (2016)
it includes free code from the Internet, in particular
a library gl-matrix.js by Brandon Jones and Colin MacKenzie IV
*/

function sphereMapViewer() {

// Note: Everything is in a function, not a object (or class).
// Originally this is because code was on the global scope and
// it was pretty easy to encapsulate it this way.
// Another reason is that with an object/class we would have to append "this."
// in front of each variable, which makes the code unreadable.

// Some default values
var IMAX=120;
var JMAX=90; 
var DEFAULT_PROJ="Equi";

// useful constants
var pi=Math.PI;
var tau=2*pi;

// user settable parameters ( default values set in function init() )
var proj,turn,flip,ctrl,mwheel,mwsens
 ,persp,shading,ambient,shading_model
 ,bg_color,anim,shading_sigma,pole_theta
 ,pole_phi,show_grid,turn_speed,infinity
 ,fov,wheel,filename;

// a bunch of other global variables

var SIZE,SCALE;
var gl,canvas,offCanvas,image,img,mm_timer=null;
var texture,rotMat,pMat,pMat2,sVec,rotMat_0;
var mobMat;
// the compiled shader programs (each uses a vertex + a fragment shaders)
var programMerc,programEqui,programCyl,programSphe,programAzi,programCube,programUnif,programSter;
// vertex and index buffers for WebGL
var sphIndBuf,sphVertBuf,cylIndBuf,cylVertBuf,gridVertBuf,nbTri,nbTriCyl,nbLines,cubeVertBuf,cubeIndBuf;
//var positionLoc,samplerLoc,sourceLoc,ratioLoc,ambientLoc,modeLoc,sigmaLoc;
var orenNayar = {C1:0, C2:0, C3:0, C4:0};

// animation variables
var moving=false;
var animate=false;
var alpha_0=0,alpha=0;
var beta_0=0,beta=0;
var z_mouse_0={x:0,y:0},z_mouse={x:0,y:0},mp_0={x:0,y:0},mp_1={x:0,y:0},mp_m={x:0,y:0},mp_n={x:0,y:0},speed={x:0,y:0}, ms={x:0,y:0};
var time_0=0,time_1=0,time_a=0,time_m=0,time_n=0;

// data for input fields (meta-programming)
var fields = [
 {name:'file-select', element:'fileSelect', event:'onchange', callback:'file_sel'}
,{name:'size-field', element:'sizeField', event:'onchange', callback:'size_set', variable:'SIZE'}
,{name:'imax-field', element:'imaxField', event:'onchange', callback:'imax_set', variable:'IMAX'}
,{name:'jmax-field', element:'jmaxField', event:'onchange', callback:'jmax_set', variable:'JMAX'}
,{name:'persp-field', element:'perspField', event:'onchange', callback:'persp_set', variable:'persp'}
,{name:'flip-box', element:'flipBox', event:'onclick', callback:'set_flip', variable:'flip'}
,{name:'bg-chooser', element:'bgChooser', event:'onchange', callback:'bg_set', variable:'bg_color'}
,{name:'shad-field', element:'shadField', event:'onchange', callback:'ambient_set', variable:'ambient'}
,{name:'shad-sigma', element:'shadSigmaField', event:'onchange', callback:'sigma_set', variable:'shading_sigma'}
,{name:'shad-angle', element:'shadAngleField', event:'onchange', callback:'shad_angle_set', variable:'shading_angle'}
,{name:'anim-box', element:'animBox', event:'onclick', callback:'set_anim', variable:'anim'}
,{name:'pole-theta', element:'poleThetaField', event:'onchange', callback:'theta_set', variable:'pole_theta'}
,{name:'pole-phi', element:'polePhiField', event:'onchange', callback:'phi_set', variable:'pole_phi'}
,{name:'grid-box', element:'gridBox', event:'onclick', callback:'grid_set', variable:'show_grid'}
,{name:'anim-speed', element:'animSpeedField', event:'onchange', callback:'speed_set', variable:'turn_speed'}
,{name:'infinity-box', element:'infinityBox', event:'onclick', callback:'infinity_set', variable:'infinity'}
,{name:'fov-field', element:'fovField', event:'onchange', callback:'fov_set', variable:'fov'}
,{name:'wheel-box', element:'wheelBox', event:'onclick', callback:'wheel_set', variable:'wheel'}
,{name:'reset-mob', element:'resetMobBut', event:'onclick', callback:'reset_mob'}
,{name:'mwsens-field', element:'mwsensField', event:'onchange', callback:'mwsens_set', variable:'mwsens'}
]; // ,{name:'', element:'', event:'', callback:'', variable:''}


// copy a 2d point an object of type {x: ,y: }
function copy_p(p) {
  return {x: p.x, y: p.y};
}

function orthonormalize(m) { // CAUTION : assumes m is a mat4 with --no projection--
  // Gram-Schmidt
  var v0=vec3.fromValues(m[0],m[1],m[2]);
  var v1=vec3.fromValues(m[4],m[5],m[6]);
  var v2=vec3.fromValues(m[8],m[9],m[10]); 
  vec3.normalize(v0,v0); 
  vec3.scaleAndAdd(v1,v1,v0,-vec3.dot(v0,v1)); 
  vec3.normalize(v1,v1);
  vec3.scaleAndAdd(v2,v2,v0,-vec3.dot(v0,v2));
  vec3.scaleAndAdd(v2,v2,v1,-vec3.dot(v1,v2));
  vec3.normalize(v2,v2);
  for(var i=0; i<3; i++) {
    m[i]=v0[i];
    m[i+4]=v1[i];
    m[i+8]=v2[i];
    m[i+12]=0;
    m[4*i+3]=0;
  }
  m[15]=1;
}

function setRotMat() { // used in planetary control method only
  var c=Math.cos(alpha);
  var s=Math.sin(alpha);
  rotMat=mat4.create();
  var conv=tau/360;
  mat4.rotateY(rotMat,rotMat,(-pole_theta)*conv);
  mat4.rotateX(rotMat,rotMat,(pole_phi-90)*conv);
  mat4.rotateY(rotMat,rotMat,alpha);
  mat4.rotateX(rotMat,rotMat,-beta);
}

function setPMat() { // observer is at [0,0,-1/p]
  var p=persp;
  var q=Math.sqrt(1-p*p);
  pMat=mat4.clone([  // you --see-- it transposed !
    0.95*q,0,0,0
   ,0,0.95*q,0,0
   ,0,0,0.01*1,p
   ,0,0,0.01*1,1
  ]);
}

/*
function getMobMat(dir,s) {
  var x=dir[0];
  var y=dir[1];
  var z=dir[2];
  var sh=Math.sinh(s);
  var ch=Math.cosh(s);
  var w=ch-1;
  mobMat=mat4.clone([  
    1+w*x*x,   w*x*y,   w*x*z, sh*x
   ,  w*y*x, 1+w*y*y,   w*y*z, sh*y
   ,  w*z*x,   w*z*y, 1+w*z*z, sh*z
   ,   sh*x,    sh*y,    sh*z, ch
  ]);
}
*/

function reset_mob() {
  mobMat=mat4.clone([  
     1, 0, 0, 0
   , 0, 1, 0, 0
   , 0, 0, 1, 0
   , 0, 0, 0, 1
  ]);
  draw_all();
}

function setP2Mat() {
  var t=1/Math.tan(0.5*fov*tau/360);
  pMat2=mat4.clone([  // you --see-- it transposed !
    t,0,0,0
   ,0,t,0,0
   ,0,0,1,1
   ,0,0,-0.01,0
  ]);
}

function setSVec() {
  sVec=vec3.create();
  if(shading=="oblique") {
    var a=tau*shading_angle/360;
    var c=Math.cos(a);
    var s=Math.sin(a);
    vec3.set(sVec,0.707106*s,0.707106*s,-c); 
  } 
  else {
    vec3.set(sVec,0,0,-1); 
  }
}

/*
function math_to_phys(p) {
  return({
    x: SIZE.x/2 + SCALE*p.x
   ,y: SIZE.y/2 - SCALE*p.y
  });
}
*/

function phys_to_math(p) {
  return({
    x: (p.x-SIZE/2)/SCALE
   ,y: (SIZE/2-p.y)/SCALE
  });
}

/* input field callbacks  */

function file_sel(e) {
  var tmppath = URL.createObjectURL(fileSelect.files[0]);
  image.src=tmppath;
}

function grid_set() {
  show_grid = gridBox.checked;
  draw_all();
}

function speed_set(e) {
  var txt=animSpeedField.value;
  var ns=parseFloat(txt);
  if(!isNaN(ns)) {
    turn_speed=ns;
  }
  if(anim && !animate && ctrl=='planet') {
    if(turn_speed!=0) {
      start_animation();
    } else {
      animate=false;
    }
  }
  animSpeedField.value=turn_speed;
}

function bg_set(e) {
  var txt=bgChooser.value;
  var r=parseInt(txt.substring(1,3),16);
  var g=parseInt(txt.substring(3,5),16);
  var b=parseInt(txt.substring(5,7),16);
  bg_color={r:r/255,g:g/255,b:b/255};
  gl.clearColor(bg_color.r, bg_color.g, bg_color.b, 1.0);
  draw_all();
}

function size_set(e) {
  var txt=sizeField.value;
  var ns=parseInt(txt,10);
  if(!isNaN(ns)) {
    if(ns>=10 && ns <= 4000) {
      SIZE=ns;
      SCALE=ns/2;
      canvas.width=ns;
      canvas.height=ns;
      makeCylinder();
    }
  }
  sizeField.value=SIZE;
  draw_all();
}

function imax_set(e) {
  var txt=imaxField.value;
  var ns=parseInt(txt,10);
  if(!isNaN(ns)) {
    if(ns>=3 && ns <= 250 && ns!=IMAX) { // mesh size limit (nb of triangles) : 2^16
      IMAX=ns;
      makeSphere();
    }
  }
  imaxField.value=IMAX;
  draw_all();
}

function jmax_set(e) {
  var txt=jmaxField.value;
  var ns=parseInt(txt,10);
  if(!isNaN(ns)) {
    if(ns>=2 && ns <= 250 && ns!=JMAX) {
      JMAX=ns;
      makeSphere();
    }
  }
  jmaxField.value=JMAX;
  draw_all();
}

function theta_set(e) {
  var txt=poleThetaField.value;
  var ns=parseFloat(txt);
  if(!isNaN(ns)) {
    pole_theta=ns;
  }
  poleThetaField.value=pole_theta;
  if(ctrl=='planet') {
    alpha=0;
    beta=0;
    setRotMat();
    draw_all();
  }
}

function phi_set(e) {
  var txt=polePhiField.value;
  var ns=parseFloat(txt);
  if(!isNaN(ns)) {
    pole_phi=ns;
  }
  polePhiField.value=pole_phi;
  if(ctrl=='planet') {
    alpha=0;
    beta=0;
    setRotMat();
    draw_all();
  }
}

function persp_set(e) {
  var txt=perspField.value;
  var ns=parseFloat(txt);
  if(ns!=persp) set_persp(ns);
/*  if(!isNaN(ns)) {
    if(ns>=0 && ns <1 && ns!=persp) {
      persp=ns;
    }
  }
  perspField.value=persp;
  setPMat();*/
  draw_all();
}

function ambient_set(e) {
  var txt=shadField.value;
  var ns=parseFloat(txt);
  if(!isNaN(ns)) {
    if(ns>=0 && ns <=1 && ns!=ambient) {
      ambient=ns;
    }
  }
  shadField.value=ambient;
  draw_all();
}

function sigma_set(e) {
  var txt=shadSigmaField.value;
  var ns=parseFloat(txt);
  if(!isNaN(ns)) {
    if(ns>=0 && ns!=shading_sigma) {
      set_sigma(shading_sigma);
    }
  }
  shadSigmaField.value=shading_sigma;
  draw_all();
}

function shad_angle_set(e) {
  var txt=shadAngleField.value;
  var ns=parseFloat(txt);
  if(!isNaN(ns) && isFinite(ns)) {
    if(ns!=shading_angle) {
      shading_angle=ns;
      setSVec();
    }
  }
  shadAngleField.value=shading_angle;
  draw_all();
}

function infinity_set(e) {
  infinity = infinityBox.checked;
  draw_all();
}

function wheel_set(e) {
  wheel = wheelBox.checked;
}

function fov_set(e) {
  var txt=fovField.value;
  var ns=parseFloat(txt);
  if(ns!=fov) set_fov(ns);
  draw_all();
}


function mwsens_set(e) {
  var txt=mwsensField.value;
  var ns=parseFloat(txt);
  if(!isNaN(ns)) {
    if(ns>=1E-6 && ns <= 1E6) {
      mwsens=ns;
    }
  }
  mwsensField.value=mwsens;
}

/* Mouse events */

function getMousePos(evt) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

function call_mm(e) {
  if(moving) {
    z_mouse=phys_to_math(getMousePos(e));
    mp_1=copy_p(mp_0); 
    mp_0=getMousePos(e); 
    time_1=time_0;
    time_0=window.performance.now();
    if(time_0>time_n+50) {
      time_m=time_n;
      time_n=time_0;
      mp_m=copy_p(mp_n);
      mp_n=copy_p(mp_0);
    }
    if(ctrl=='planet') {
      alpha=alpha_0+z_mouse.x-z_mouse_0.x;
      beta=beta_0+z_mouse.y-z_mouse_0.y;
      setRotMat();
    }
    else if(ctrl=='free') {
      var dx=z_mouse.x-z_mouse_0.x;
      var dy=z_mouse.y-z_mouse_0.y;
      mat4.rotateY(rotMat,rotMat_0,dx);
      mat4.rotateX(rotMat,rotMat,-dy);
      orthonormalize(rotMat);
    }

    draw_all();
  }
}

function mouse_move(e) {
  if(moving) {
    if(mm_timer) { clearTimeout(mm_timer); mm_timer=null; }
    call_mm(e);
    mm_timer=setTimeout(call_mm,50,e);
  }
}

function mouse_down(e) {
  animate=false;
  z_mouse_0=phys_to_math(getMousePos(e));
  mp_0=getMousePos(e);
  mp_1=copy_p(mp_0);
  if(ctrl=='planet') {
    alpha_0=alpha;
    beta_0=beta;
  }
  else if(ctrl=='free') {
    rotMat_0=mat4.clone(rotMat);
  }
  moving=true;
}

function mouse_up(e) {
  if(moving) {
    moving=false;
    
    if(!animate && anim) {
      var test;
      if(ctrl=='free') test = (mp_0.x != mp_1.x) || (mp_0.y != mp_1.y);
      if(ctrl=='planet') test = mp_0.x != mp_1.x;
      if(!test) return;
      var zn=phys_to_math(mp_n);
      var zm=phys_to_math(mp_m);
      var dt=(time_n-time_m)/1000;
      speed = {x: (zn.x-zm.x)/dt/3, y: (zn.y-zm.y)/dt/3};
      if(ctrl=='planet') {
        turn_speed = speed.x*360/tau;
        animSpeedField.value = turn_speed;
      }
      else {
      }    
      start_animation();
    }
  }
}

function mouse_wheel(e) {
  if(!wheel) return;
  var dm=-e.deltaY*mwsens;
  if(e.deltaMode==WheelEvent.DOM_DELTA_PIXEL) dy /= 1;
  if(e.deltaMode==WheelEvent.DOM_DELTA_LINE) dy /= 100;
  if(e.deltaMode==WheelEvent.DOM_DELTA_PAGE) dy /= 1000;
  
  if(mwheel == "persp") {
    if(infinity) {
      var x=Math.tan(fov*tau/360/2);
      x *= Math.exp(dm/100);
      set_fov(2*Math.atan(x)*360/tau);
    }
    else {
      var x=-Math.log(1-persp);
      x -= dm/500;
      set_persp(1-Math.exp(-x));
    }
  }
  if(mwheel == "mob") {
    var dy = dm/200;
    
//    rotMat_0=mat4.clone(rotMat);
//    mobMat_0=mat4.clone(mobMat);

    var sh=Math.sinh(dy);
    var ch=Math.cosh(dy);
    var mt=mat4.clone([
      1,0,0,0
     ,0,1,0,0
     ,0,0,ch,-sh
     ,0,0,-sh,ch
    ]);

    tR=mat4.create();
    mat4.transpose(tR,rotMat);

    mat4.multiply(mobMat,mobMat,rotMat);
    mat4.multiply(mobMat,mobMat,mt);
    mat4.multiply(mobMat,mobMat,tR);
//    cure mobMat?
  }
  draw_all();
  return false; // prevent window scroll
}

/* Other */

function set_sigma(s) {
  shading_sigma=s;
  var s2=s*s;
  /* 
  //precise model
  orenNayar.C1=1.0-0.5*s2/(s2+0.33);
  orenNayar.C2=0.45*s2/(s2+0.09);
  orenNayar.C3=0.125*s2/(s2+0.09);
  orenNayar.C4=0.17*s2/(s2+0.13);
  */
  orenNayar.C1=1.0-0.5*s2/(s2+0.57);
  orenNayar.C2=0.45*s2/(s2+0.09);
}

function set_fov(val) {
  if(fov==val) return;
  fov = val;
  if(isNaN(fov)) fov=45;
  if(fov<1) fov=1;
  if(fov>179) fov=179;
  fovField.value=fov;
  setP2Mat();
}

function set_persp(val) {
  if(persp==val) return;
  persp = val;
  if(isNaN(persp)) persp=0.1;
  if(persp<0) persp=0;
  if(persp>0.999) persp=0.999;
  perspField.value=persp;
  setPMat();
}

function start_animation() {
  time_a=window.performance.now(); 
  animate=true; requestAnimationFrame(tick);
}

function tick() {
  if(animate) requestAnimationFrame(tick);
  var time_temp=window.performance.now(); 
  var delta = (time_temp-time_a)/1000;
  time_a=time_temp;
  if(ctrl=='planet') {
    alpha += turn_speed*tau/360*delta;
    setRotMat();
  } else {
        mat4.rotateY(rotMat,rotMat,speed.x*delta);
        mat4.rotateX(rotMat,rotMat,-speed.y*delta);
//    mat4.multiply(rotMat,rotMat,anim_mat);
    orthonormalize(rotMat);
  }
  draw_all();
}

function makeTexture() {
  var ct=offCanvas.getContext("2d");
  if(turn=='0' || turn=='180') {
    offCanvas.width=image.width;
    offCanvas.height=image.height;
  }
  else {
    offCanvas.width=image.height;
    offCanvas.height=image.width;
  } 
  if(proj=='Cube') {
    var x=Math.max(Math.floor(offCanvas.width/4),Math.floor(offCanvas.height/3));
    offCanvas.width=4*x;
    offCanvas.height=3*x;
  }
  ct.translate(offCanvas.width/2,offCanvas.height/2);
  if(flip) ct.scale(-1,1);
  if(turn=='180') ct.scale(-1,-1);
  if(turn=='90') ct.rotate(tau/4);
  if(turn=='270') ct.rotate(-tau/4);
  if(turn=='0' || turn=='180') ct.translate(-offCanvas.width/2,-offCanvas.height/2);
  else ct.translate(-offCanvas.height/2,-offCanvas.width/2);
  if(proj=='Cube')
    ct.drawImage(image,0,0,offCanvas.width,offCanvas.height);
  else
    ct.drawImage(image,0,0);

  gl.deleteTexture(texture);
  texture=gl.createTexture();
  if(proj=='Cube') {
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    //gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var imgData;
    var x=Math.floor(offCanvas.width/4);
    var o=[{i:1,j:2},{i:1,j:0},{i:0,j:1},{i:2,j:1},{i:1,j:1},{i:1,j:3}];
    for(var i=0; i<6; i++) {
      imgData=ct.getImageData(x*o[i].j,x*o[i].i,x,x);
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+i, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgData);
    }
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
  }
  else {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  //  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  //  gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); //Prevents s-coordinate wrapping (repeating).
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); //Prevents t-coordinate wrapping (repeating).
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}

function makeCylinder() {
  if(cylVertBuf) gl.deleteBuffer(cylVertBuf);
  if(cylIndBuf) gl.deleteBuffer(cylIndBuf);

  var vert=[];
  var x,y,z,theta,h;
  var R=1.2;
  var r=1.5/SCALE;
  var IMAX2=12;
  var ct=0;
  for(var j=0; j<=1; j++) {
    h=-R+2*R*j;
    for(var i=0; i<IMAX2; i++) {
      theta=tau*i/IMAX2; 
      // if(j % 2 == 1) theta += 0.5/IMAX;
      x=Math.cos(theta)*r;
      y=h;
      z=Math.sin(theta)*r;
      vert.push(x,y,z);
      ct++;
    }
  }
  vert.push(0,-R,0);
  vert.push(0,R,0);
  cylVertBuf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cylVertBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null); // not strictly needed
  
  var ind=[];
  nbTriCyl=0;
  for(var i=0; i<IMAX2; i++) {
    ind.push(i,(i+1)%IMAX2,IMAX2+i);
    nbTriCyl++;
    ind.push((i+1)%IMAX2,IMAX2+((i+1)%IMAX2),IMAX2+i);
    nbTriCyl++;
    ind.push(ct,(i+1)%IMAX2,i);
    nbTriCyl++;
    ind.push(ct+1,IMAX2+i,IMAX2+(i+1)%IMAX2);
    nbTriCyl++;
  }
  cylIndBuf=gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cylIndBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ind), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // not strictly needed
}

function makeSphere() {
  var vert=[];
  var x,y,z,theta,phi,s,c;
  for(var j=0; j<=JMAX; j++) {
    phi=pi*(j/JMAX-0.5);
    phi=pi/2*Math.sin(phi); // trick to enhance resolution at poles.
    c=Math.cos(phi);
    s=Math.sin(phi);
    for(var i=0; i<IMAX; i++) {
      theta=tau*i/IMAX; 
      // if(j % 2 == 1) theta += 0.5/IMAX;
      x=c*Math.cos(theta);
      y=s;
      z=c*Math.sin(theta);
      vert.push(x,y,z);
    }
  }
  if(!sphVertBuf) sphVertBuf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphVertBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null); // not strictly needed
  
  var ind=[];
  nbTri=0;
  for(var j=0; j<JMAX; j++) {
    for(var i=0; i<IMAX; i++) {
      if(j>0) {
        ind.push(j*IMAX+i,j*IMAX+((i+1)%IMAX),(j+1)*IMAX+i);
        nbTri++;
      }
      if(j<JMAX) {
        ind.push(j*IMAX+((i+1)%IMAX),(j+1)*IMAX+((i+1)%IMAX),(j+1)*IMAX+i);
        nbTri++;
      }
    }
  }
  if(!sphIndBuf) sphIndBuf=gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphIndBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ind), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // not strictly needed
}

function makeCube() {
  var R=2;
  var vert=[
    -R,-R,-R
   ,-R,-R,R
   ,-R,R,-R
   ,-R,R,R
   ,R,-R,-R
   ,R,-R,R
   ,R,R,-R
   ,R,R,R
  ];
  var ind=[
    0,2,6 , 0,6,4
   ,4,6,7 , 4,7,5
   ,5,7,3 , 5,3,1
   ,1,3,2 , 1,2,0
   ,2,3,6 , 7,6,3
   ,1,0,5 , 4,5,0
  ];
  cubeVertBuf=gl.createBuffer();
  cubeIndBuf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null); // not strictly needed
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ind), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // not strictly needed
}

function makeGrid() {
  var GRID_P=8;
  var GRID_R=120;
  var GRID_M=12;
  var r=1.001;
  var vert=[];
  var x,y,z,theta,phi,s,c;
  nbLines=0;
  for(var j=1; j<GRID_P; j++) { // parallels
    phi=pi*(j/GRID_P-0.5);
    c=Math.cos(phi);
    s=Math.sin(phi);
    for(var i=0; i<2*GRID_R; i++) {
      theta=tau*i/(2*GRID_R);
      x=r*c*Math.cos(theta);
      y=r*s;
      z=r*c*Math.sin(theta);
      vert.push(x,y,z);
     
      theta=tau*(i+1)/(2*GRID_R); 
      x=r*c*Math.cos(theta);
      y=r*s;
      z=r*c*Math.sin(theta);
      vert.push(x,y,z);
      
      nbLines++;
    }
  }
  for(var i=0; i<GRID_M; i++) {
    theta=tau*i/GRID_M; 
    c=Math.cos(theta);
    s=Math.sin(theta);
    for(var j=0; j<GRID_R; j++) { // meridians
      phi=pi*(j/GRID_R-0.5);
      x=r*Math.cos(phi)*c;
      y=r*Math.sin(phi);
      z=r*Math.cos(phi)*s;
      vert.push(x,y,z);
     
      phi=pi*((j+1)/GRID_R-0.5);
      x=r*Math.cos(phi)*c;
      y=r*Math.sin(phi);
      z=r*Math.cos(phi)*s;
      vert.push(x,y,z);
      
      nbLines++;
    }
  }
  gridVertBuf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridVertBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
}

function createVertexShader(str) {
  var shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, str);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(gl.getShaderInfoLog(shader));
      return null;
  }
  return shader;
}

function createFragmentShader(str) {
  var shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, str);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(gl.getShaderInfoLog(shader));
      return null;
  }
  return shader;
}
    
function createPrograms() {
  var str;
  
  str=readTextFile("vertex-shader.c");
  var vertexShader = createVertexShader(str);
  str=readTextFile("fragment-stereographic-shader.c");
  var fragmentStereographicShader = createFragmentShader(str);
  str=readTextFile("fragment-mercator-shader.c");
  var fragmentMercatorShader = createFragmentShader(str);
  str=readTextFile("fragment-equirect-shader.c");
  var fragmentEquirectShader = createFragmentShader(str);
  str=readTextFile("fragment-cylindric-shader.c");
  var fragmentCylindricShader = createFragmentShader(str);
  str=readTextFile("fragment-spheremap-shader.c");
  var fragmentSpheremapShader = createFragmentShader(str);
  str=readTextFile("fragment-azi-shader.c");
  var fragmentAziShader = createFragmentShader(str);
  str=readTextFile("fragment-cubemap-shader.c");
  var fragmentCubeShader = createFragmentShader(str);
  str=readTextFile("fragment-uniform-shader.c");
  var fragmentUnifShader = createFragmentShader(str);
  
  programSter = gl.createProgram();
  gl.attachShader(programSter, vertexShader);
  gl.attachShader(programSter, fragmentStereographicShader);
  gl.linkProgram(programSter);
  
  programMerc = gl.createProgram();
  gl.attachShader(programMerc, vertexShader);
  gl.attachShader(programMerc, fragmentMercatorShader);
  gl.linkProgram(programMerc);
  
  programEqui = gl.createProgram();
  gl.attachShader(programEqui, vertexShader);
  gl.attachShader(programEqui, fragmentEquirectShader);
  gl.linkProgram(programEqui);

  programCyl = gl.createProgram();
  gl.attachShader(programCyl, vertexShader);
  gl.attachShader(programCyl, fragmentCylindricShader);
  gl.linkProgram(programCyl);

  programSphe = gl.createProgram();
  gl.attachShader(programSphe, vertexShader);
  gl.attachShader(programSphe, fragmentSpheremapShader);
  gl.linkProgram(programSphe);

  programAzi = gl.createProgram();
  gl.attachShader(programAzi, vertexShader);
  gl.attachShader(programAzi, fragmentAziShader);
  gl.linkProgram(programAzi);

  programCube = gl.createProgram();
  gl.attachShader(programCube, vertexShader);
  gl.attachShader(programCube, fragmentCubeShader);
  gl.linkProgram(programCube);

  programUnif = gl.createProgram();
  gl.attachShader(programUnif, vertexShader);
  gl.attachShader(programUnif, fragmentUnifShader);
  gl.linkProgram(programUnif);
  
  //  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
}

function readTextFile(file,dest) {
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false); // false veut dire synchrone
    rawFile.send(null);
    if(rawFile.status === 200 || rawFile.status == 0)
    {
        var allText = rawFile.responseText; 
        // console.log(allText.slice(0));
        return allText.slice(0); // copy
    }
}

function set_anim(a) {
  anim=animBox.checked;
  if(!anim) animate=false;
  else if(ctrl=='planet' && !animate && turn_speed != 0) start_animation();
  draw_all();
}

function sel_prog(pr) {
  var prog=programEqui; // by reference
  switch(pr) {
    case 'Ster': 
      prog=programSter;
      break;
    case 'Merc': 
      prog=programMerc;
      break;
    case 'Equi': 
      prog=programEqui;
      break;
    case 'Cyl': 
      prog=programCyl;
      break;
    case 'Sphe': 
      prog=programSphe;
      break;
    case 'Azi': 
      prog=programAzi;
      break;
    case 'Cube': 
      prog=programCube;
      break;
    case 'Unif': 
      prog=programUnif;
      break;
  }
  gl.useProgram(prog);
  return(prog); // this is Javascript so returns a reference
}

function set_shader(pr) {
  var prog=sel_prog(pr);
//  var t1=window.performance.now();
  positionLoc = gl.getAttribLocation(prog, "a_position"); 
  samplerLoc = gl.getUniformLocation(prog, "u_sampler");
  posMatLoc = gl.getUniformLocation(prog, "pos_mat_tr");
  mobMatLoc = gl.getUniformLocation(prog, "mob_mat");
  persMatLoc = gl.getUniformLocation(prog, "pers_mat");
  sourceLoc = gl.getUniformLocation(prog, "source");
  ambientLoc = gl.getUniformLocation(prog, "ambient");
  sigmaLoc = gl.getUniformLocation(prog, "sigma");
  modeLoc = gl.getUniformLocation(prog, "mode");
  c1Loc = gl.getUniformLocation(prog, "c1");
  c2Loc = gl.getUniformLocation(prog, "c2");
  c3Loc = gl.getUniformLocation(prog, "c3");
  c4Loc = gl.getUniformLocation(prog, "c4");
  if(pr=='Unif') {
    colorLoc = gl.getUniformLocation(prog, "color");
  }
  else {
    ratioLoc = gl.getUniformLocation(prog, "u_ratio");
  }
  gl.enableVertexAttribArray(positionLoc);
//  var t2=window.performance.now();
//  console.log(t2-t1);
    //  if(image) draw_all();
}

function set_turn(ro) {
  if(ro!=turn) {
    turn=ro;
    makeTexture();
    draw_all();
  }
}

function set_flip() {
  flip = flipBox.checked;
  makeTexture();
  draw_all();
}

function set_ctrl(ct) {
  if(ct!=ctrl) {
    ctrl=ct;
    if(ct=='planet') {
      alpha=0;
      beta=0;
      setRotMat();
      draw_all();
    }
    else
      animate=false;
  }
}

function set_mwheel(mw) {
  mwheel=mw;
}

function set_shad(sh) {
  if(sh!=shading) {
    shading=sh;
    setSVec();
    draw_all();
  }
}

function set_shad_model(sm) {
  if(sm!=shading_model) {
    shading_model=sm;
    draw_all();
  }
}

function draw_all() {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

//  gl.uniform2f(zLoc,z0.re,z0.im);
  
  gl.activeTexture(gl.TEXTURE0);
  if(proj=='Cube') gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
  else gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(samplerLoc, 0);
  
  gl.uniformMatrix4fv(posMatLoc,false,rotMat);
  gl.uniformMatrix4fv(mobMatLoc,false,mobMat);
  if(infinity) {
    gl.uniformMatrix4fv(persMatLoc,false,pMat2);
    gl.uniform1f(ambientLoc, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertBuf);
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndBuf);
    gl.drawElements(gl.TRIANGLES, 3*12, gl.UNSIGNED_SHORT, 0);
  }
  else {gl.uniformMatrix4fv(persMatLoc,false,pMat);
    gl.uniform3fv(sourceLoc,sVec);
    gl.uniform1f(ratioLoc, offCanvas.height/offCanvas.width); 
    gl.uniform1f(ambientLoc, ambient);
//    gl.uniform1i(modeLoc, shading_model=="Oren-Nayar" ? 1 : 0);
    if(shading_model=="Oren-Nayar") {
      gl.uniform1i(modeLoc, 1);
      gl.uniform1f(c1Loc, orenNayar.C1);
      gl.uniform1f(c2Loc, orenNayar.C2);
      gl.uniform1f(c3Loc, orenNayar.C3);
      gl.uniform1f(c4Loc, orenNayar.C4);
    }
    else
      gl.uniform1i(modeLoc, 0);
    gl.uniform1f(sigmaLoc, shading_sigma);
    gl.bindBuffer(gl.ARRAY_BUFFER, sphVertBuf);
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphIndBuf);
    gl.drawElements(gl.TRIANGLES, 3*nbTri, gl.UNSIGNED_SHORT, 0);
  }
  
  if(show_grid) {
    set_shader('Unif');
    gl.uniformMatrix4fv(posMatLoc,false,rotMat);
    gl.uniform4f(colorLoc, 1.0, 1.0, 1.0, 0.33); 
    if(infinity) {
      gl.uniformMatrix4fv(persMatLoc,false,pMat2);
      gl.uniform1f(ambientLoc, 1);
    }
    else {
      gl.uniformMatrix4fv(persMatLoc,false,pMat);
      gl.uniform3fv(sourceLoc,sVec); 
      gl.uniform1f(ambientLoc, ambient);
      if(shading_model=="Oren-Nayar") {
        gl.uniform1i(modeLoc, 1);
        gl.uniform1f(c1Loc, orenNayar.C1);
        gl.uniform1f(c2Loc, orenNayar.C2);
        gl.uniform1f(c3Loc, orenNayar.C3);
        gl.uniform1f(c4Loc, orenNayar.C4);
      }
      else
        gl.uniform1i(modeLoc, 0);
      gl.uniform1f(sigmaLoc, shading_sigma);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gridVertBuf);
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
    // no support for line thickness different from 1 in browsers in 2016
    gl.drawArrays(gl.LINES, 0, 2*nbLines);
/*  var tempBuf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tempBuf);
  var R=1.1;
  var c0=Math.cos(pole_theta*tau/360)
     ,s0=Math.sin(pole_theta*tau/360)
     ,c1=Math.cos(pole_phi*tau/360)
     ,s1=Math.sin(pole_phi*tau/360);
  var vert=[R*s0*c1,R*s1,-R*c0*c1
           ,-R*s0*c1,-R*s1,R*c0*c1];*/
    if(!infinity) {
      var temp=mat4.create();
      mat4.rotateX(temp,temp,(90-pole_phi)*tau/360);
      mat4.rotateY(temp,temp,pole_theta*tau/360);
      mat4.multiply(temp,temp,rotMat);
      gl.uniformMatrix4fv(posMatLoc,false,temp);
      gl.uniform4f(colorLoc, 1.0, 1.0, 0.0, 1.0); 
//  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vert), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, cylVertBuf);
      gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
//  gl.drawArrays(gl.LINES, 0, 2);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cylIndBuf);
      gl.drawElements(gl.TRIANGLES, 3*nbTriCyl, gl.UNSIGNED_SHORT, 0);
//  gl.bindBuffer(gl.ARRAY_BUFFER, null);
//  gl.deleteBuffer(tempBuf);
    }
    set_shader(proj);
  }

  
  
  
  // Wait for finish
  gl.finish();
//  if(proj=='Cube') gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
//  else gl.bindTexture(gl.TEXTURE_2D, null);

  return;
}

function set_value(src,def) {
  if(typeof src === 'undefined') return def;
  else return src;
}

function init(lecanvas,parameters) {
  canvas=lecanvas;

  if(parameters) {
    proj=set_value(parameters.projection,DEFAULT_PROJ);
    filename=set_value(parameters.filename,"");
  }
    
  offCanvas=document.createElement('canvas');
  
  SIZE=canvas.height;
  SCALE=SIZE/2;
  
  for(i in fields) { list=fields[i];
    window[list.element]=document.getElementById(list.name);
    window[list.element][list.event]=eval(list.callback); // Security hole @@@
  }
  
  // default values
  
  infinity=false;
  show_grid=false;
  alpha=0;
  alpha=beta;
  ctrl="planet";
  mwheel="persp";
  mwsens=1;
  turn=0;
  anim=true;
  flip=false;
  flipBox.checked=flip;
  persp=0.1;
  bg_color={r:0,g:0,b:0};
  shading="oblique";
  ambient=0.0;
  shading_angle=35;
  set_sigma(0.5);
  shading_model="Oren-Nayar";
  pole_theta=0;
  pole_phi=90;
  turn_speed=0;
  fov=45;
  wheel=true;

  mobMat=mat4.create();
  setRotMat();
  setPMat();
  setP2Mat();
  setSVec();

  canvas.onmousedown=mouse_down;
  canvas.onmousemove=mouse_move;
  canvas.onmouseup=mouse_up;
  canvas.onmouseout=mouse_up;
  canvas.onwheel=mouse_wheel;
  var radiobuts;
  radiobuts=document.getElementsByName("type"); 
  for(var i=0; i<radiobuts.length; i++) {
    radiobuts[i].onclick= function(evt) { proj=this.value; set_shader(proj); makeTexture(); if(image) draw_all();};
    if(radiobuts[i].value==proj) radiobuts[i].checked=true;
  }
  radiobuts=document.getElementsByName("turn"); 
  for(var i=0; i<radiobuts.length; i++) {
    radiobuts[i].onclick= function(evt) { set_turn(this.value); };
    if(radiobuts[i].value=='0') radiobuts[i].checked=true;
  }
  radiobuts=document.getElementsByName("ctrl"); 
  for(var i=0; i<radiobuts.length; i++) {
    radiobuts[i].onclick= function(evt) { set_ctrl(this.value); };
    if(radiobuts[i].value==ctrl) radiobuts[i].checked=true;
  }
  radiobuts=document.getElementsByName("mwheel"); 
  for(var i=0; i<radiobuts.length; i++) {
    radiobuts[i].onclick= function(evt) { set_mwheel(this.value); };
    if(radiobuts[i].value==mwheel) radiobuts[i].checked=true;
  }
  radiobuts=document.getElementsByName("shad"); 
  for(var i=0; i<radiobuts.length; i++) {
    radiobuts[i].onclick= function(evt) { set_shad(this.value); };
    if(radiobuts[i].value==shading) radiobuts[i].checked=true;
  }
  radiobuts=document.getElementsByName("shad-model"); 
  for(var i=0; i<radiobuts.length; i++) {
    radiobuts[i].onclick= function(evt) { set_shad_model(this.value); };
    if(radiobuts[i].value==shading_model) radiobuts[i].checked=true;
  }
  
  for(i in fields) { list=fields[i];
    if(list.variable) {
      if(window[list.element].type=='checkbox')     
        prop = 'checked' 
      else
        prop = 'value'
      window[list.element][prop]=eval(list.variable); // Security hole @@@
    }
  }

  gl=canvas.getContext("webgl",{preserveDrawingBuffer: true});
  createPrograms();
  makeSphere();
  makeCube();
  makeCylinder();
  makeGrid();

  gl.clearColor(bg_color.r, bg_color.g, bg_color.b, 1.0);
  gl.enable(gl.DEPTH_TEST|gl.LINE_SMOOTH);
  gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  gl.enable(gl.CULL_FACE);
   
  image = new Image();
  image.onload = function() { set_shader(proj); makeTexture(); draw_all(); }
  image.src = filename;
  
//  draw_all();
}

return init;

}