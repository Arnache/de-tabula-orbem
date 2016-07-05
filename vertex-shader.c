attribute vec3 a_position;

varying vec3 v_texCoord;
varying float v_br;

uniform mat4 pos_mat_tr;
uniform mat4 pers_mat;
uniform vec3 source;
uniform float ambient;
uniform int mode;
uniform float sigma;

void main() {
  
  v_texCoord = a_position; // copy vec4 to vec3
  
  vec4 temp = vec4(a_position, 1.0)*pos_mat_tr;  
  
  if(ambient==1.0) v_br=1.0;
  else {
    vec3 normal = vec3(temp.x,temp.y,temp.z);
    normal = normalize(normal);
    vec3 src = source; // for testing purposes
    float ci=dot(normal,src); 
    if(ci<0.0) v_br=0.0;
    else {
      if(mode==1) {
      // Oren-Nayar shading
      float s2=sigma*sigma;
      float A=1.0-0.5*s2/(s2+0.57);
      float B=0.45*s2/(s2+0.09);
      vec3 obs=vec3(0.0,0.0,-1.0);
      float cr=dot(normal,obs);
      float cp=dot(src-ci*normal,obs-cr*normal);
      float a=min(ci,cr);
      float b=max(ci,cr);
      float t=sqrt(1.0-b*b)/b;
      v_br=ci*(A+B*max(0.0,cp)*sqrt(1.0-a*a)*t);
      // Lambert shading
      }
      else
        v_br=ci;
    }
    v_br=v_br*(1.0-ambient)+ambient*1.0;
  }
  
  gl_Position = pers_mat*temp;
}