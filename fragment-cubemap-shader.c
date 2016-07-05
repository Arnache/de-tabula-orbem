/* cube map */
/* (this is partially done in the javascript part)
 * The rectangle is rescaled to have proportions hor,vert || 4x3
 * it is cut into twelve squares
 * an unfolded cube covers 6 of them (center of the cross on the left)
 * these squares are used to texture the cube
 * the cube is then centrally projected to the sphere
 */

precision mediump float;

varying vec3 v_texCoord;
varying float v_br;
uniform float u_ratio;

#define tau 6.2831853071795864769252867665590

uniform samplerCube u_sampler;
uniform mat4 mob_mat;

void main() {
  vec3 sph=normalize(vec3(v_texCoord.x,v_texCoord.y,v_texCoord.z));
  vec4 w=mob_mat*vec4(sph,1.0);
  sph=vec3(w.x,w.y,w.z);
  vec4 temp=textureCube(u_sampler,vec3(sph.x,sph.y,sph.z));
  gl_FragColor = vec4(v_br*temp.x, v_br*temp.y, v_br*temp.z, 1.0);
}
