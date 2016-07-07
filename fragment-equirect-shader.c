#version 100

/* Equirectangular projection (a.k.a. equidistant cylindrical) */
// Straightforward (long,lat) coordinate system
/* in the map's coordinate (x,y)
 * x-coord is proportional to longitude
 * y-coord to latitude
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
  phi=asin(y);
  theta=atan(x,-z);
  u=theta*2.0/tau;
  u=(u+1.0)/2.0;
  v=phi/(tau/4.0);
  v=(v+1.0)/2.0;
  v=1.0-v;
  vec4 temp=texture2D(u_sampler,vec2(u,v));
  gl_FragColor = vec4(v_br*temp.x, v_br*temp.y, v_br*temp.z, 1.0);
}
