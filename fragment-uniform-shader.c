#version 100

// Used when drawing the cylinder materialising the poles.

precision mediump float;

uniform vec4 color;

void main() {
  gl_FragColor = color;
}
