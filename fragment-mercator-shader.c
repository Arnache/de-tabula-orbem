#version 100

/* Mercator's projection */
// conformal map from the sphere minus north and south pole to the bi-infinite cylinder
// main propery: loxodromes are straight
/* in the map's coordinate (x,y)
 * x-coord proportional to longitude
 * y-coord proportional to log(tan(tau/8+lat/2))
 * ! same proportion factor for x and y measured in pixels
 * (this is to preserve conformality)
 */

precision mediump float;

varying vec3 v_texCoord;
varying float v_br;
uniform float u_ratio;

#define tau 6.2831853071795864769252867665590

uniform sampler2D u_sampler;
uniform mat4 mob_mat;

void main() {
  vec3 sph=normalize(vec3(v_texCoord.x,v_texCoord.y,v_texCoord.z));
  vec4 w=mob_mat*vec4(sph,1.0);
  sph=vec3(w.x,w.y,w.z);
  sph=normalize(sph);
  float x=sph.x;
  float y=sph.y;
  float z=sph.z;
  float u,v,theta,phi;
  vec4 col;
  phi=asin(y);
  theta=atan(x,-z);
  v=log(tan(tau/8.0+phi/2.0));
  v=v/(u_ratio*tau/2.0);
  v=(v+1.0)/2.0;
  if(v<0.0 || v>1.0) 
    col = vec4(0.0,0.0,1.0,1.0);
  else {
    v=1.0-v;
    u=(theta*2.0/tau+1.0)/2.0;
    vec4 temp=texture2D(u_sampler,vec2(u,v));
    col= vec4(v_br*temp.x, v_br*temp.y, v_br*temp.z, 1.0);
  }
  gl_FragColor = col;
}
