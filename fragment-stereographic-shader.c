/* Stereographic projection */
// Unique plane (a version with two hemispheres may be programmed in the future)
// Property: conformal
/* in the map's coordinate (x,y)
 * x-coord is proportional to X/(1-Z)
 * y-coord is proportional to X/(1-Z)
 * where (X,Y,Z) are the coordinates in 3D of the sphere of radius one
 *   and Z-axis goes through poles
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
  vec4 col;
  sph=vec3(w.x,w.y,w.z);
  sph=normalize(sph);
  float x=sph.x;
  float y=sph.y;
  float z=sph.z;
  float u=u_ratio*x/(1.-z);
  float v=y/(1.-z);
  u=(u+1.)/2.;
  v=(v+1.)/2.;
  if(u<0. || u>1. || v<0. || v>1.) {
    col = vec4(0.0,0.0,1.0,1.0);
  }
  else {
    vec4 temp=texture2D(u_sampler,vec2(u,v));
    col=vec4(v_br*temp.x, v_br*temp.y, v_br*temp.z, 1.0);
  }
  gl_FragColor = col;
}
