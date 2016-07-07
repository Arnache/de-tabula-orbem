#version 100

precision mediump float;

attribute vec3 a_position;

varying vec3 v_texCoord;
varying float v_br;

uniform mat4 pos_mat_tr;
uniform mat4 pers_mat;
uniform vec3 source;
uniform float ambient;
uniform int mode;
uniform float sigma;

uniform float c1;
uniform float c2;
//uniform float c3;
//uniform float c4;

void main() {
  
  v_texCoord = a_position;
  
  vec4 temp = vec4(a_position, 1.0)*pos_mat_tr;  // computes tr(rotMat)*vertex
  
  if(ambient==1.0) v_br=1.0;
  else {
    vec3 w = vec3(temp.x,temp.y,temp.z); // w=world position of the vertex
    vec3 normal = normalize(w); // normal to the sphere at w
    float ci=dot(normal,source); // cos(theta_i)
    if(ci<0.0) v_br=0.0;
    else {
      if(mode==1) {
        // Oren-Nayar shading
        
        // Fast, less precise
        float persp = pers_mat[3][2];
        vec3 obs=normalize(vec3(0.0,0.0,-1.0)-persp*w);
        float cr=dot(normal,obs); // cos(theta_r)
        float cp=dot(normalize(source-ci*normal),normalize(obs-cr*normal)); // cos(phi_i-phi_r)
        float a=min(ci,cr); // cos(alpha)
        float b=max(ci,cr); // cos(beta)
        float t=sqrt(1.0-b*b)/b; // tan(beta)
        float s=sqrt(1.0-a*a); // sin(alpha)
        v_br=ci*(c1+c2*max(0.0,cp)*s*t);
        /*
        
        // Less fast, more precise
        float persp = pers_mat[2][3];
        vec3 obs=normalize(vec3(0.0,0.0,-1.0)-persp*w);
        float cr=dot(normal,obs); // cos(theta_r)
        float ca=min(ci,cr); // cos(alpha)
        float cb=max(ci,cr); // cos(beta)
        float alpha=acos(ca);
        float beta=acos(cb);
        float tb=tan(beta);
        float sa=sin(alpha);
        float cp=dot(normalize(source-ci*normal),normalize(obs-cr*normal)); //         float s2=sigma*sigma;
        float s2=sigma*sigma;
        float b1=beta*0.63661977236758;
        float ab1=alpha*beta*0.40528473456936;
        float du;
        if(cp>=0.) 
          du=sa;
        else
          du=sa-b1*b1*b1;
        float tab=tan((alpha+beta)/2.);
        v_br = ci * (   c1 + c2*cp*tb*du + c3*(1.-abs(cp))*tab*ab1*ab1 +
                      + c4*(1.-cp*b1*b1) <- problem here: the color depends non-linearly
                      on the texture color (it is a degree 2 polynomial)
                      which means we must transmit two parameters to the fragment shader
                     );
        */
      }
      else // Lambert shading
        v_br=ci;
    }
    v_br=v_br*(1.0-ambient)+ambient*1.0;
  }
  
  gl_Position = pers_mat*temp;
}