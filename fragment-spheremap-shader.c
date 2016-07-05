precision mediump float;

varying vec3 v_texCoord;
varying float v_br;
uniform float u_ratio;

#define tau 6.2831853071795864769252867665590

uniform sampler2D u_sampler;
uniform mat4 mob_mat;

void main() {
//  vec4 w=mob_mat*vec4(v_texCoord,1.0);
//  vec3 sph=normalize(vec3(w.x,w.y,w.z));
  vec3 sph=normalize(vec3(v_texCoord.x,v_texCoord.y,v_texCoord.z));
  vec4 w=mob_mat*vec4(sph,1.0);
  sph=vec3(w.x,w.y,w.z);
  sph=normalize(sph);
  float x=sph.x;
  float y=sph.y;
  float z=sph.z;
  float u,v,theta,r;
  /*theta=atan(y,x);
  r=sqrt((1.0+z)/2.0);
  u=cos(theta)*r;
  v=sin(theta)*r;*/
  r=sqrt(x*x+y*y+(z+1.0)*(z+1.0));
  u=x/r;
  v=y/r;
  u=(u+1.0)/2.0;
  v=(v+1.0)/2.0;
  v=1.0-v;
  vec4 temp=texture2D(u_sampler,vec2(u,v));
  gl_FragColor = vec4(v_br*temp.x, v_br*temp.y, v_br*temp.z, 1.0);
}
