/* Lambert azimuthal equal-area (sometimes used in spheremaps) */
// Property: preserves area.
// Note: centered on a point on the equator instead of one of the poles.
/* the map is rescaled to be considered square,
 * then the biggest disk that fit in this square contains the map
 * in polar coordinates (r,theta) of this disk, with r normalized from 0 to 1:
 *  theta: is then the longitude
 *      r: is the distance through the sphere between the point represented
 *         by (r,theta) and the one represented by (0,0)
 * ! last: we rotate the sphere by 90 degrees to put the north pole at lat=0 and long=0
 * (reason: spheremaps usually like that (really?))
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
  float u,v,theta,r;
  r=sqrt(x*x+y*y+(z+1.0)*(z+1.0));
  u=x/r;
  v=y/r;
  u=(u+1.0)/2.0;
  v=(v+1.0)/2.0;
  v=1.0-v;
  vec4 temp=texture2D(u_sampler,vec2(u,v));
  gl_FragColor = vec4(v_br*temp.x, v_br*temp.y, v_br*temp.z, 1.0);
}
