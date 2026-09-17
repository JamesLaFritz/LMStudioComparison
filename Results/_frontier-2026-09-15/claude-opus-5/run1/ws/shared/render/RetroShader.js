// Full-screen "retro CRT" pass: chromatic aberration (stronger at the edges), vignette with a
// tintable colour, subtle scanlines, animated film grain, and a screen-flash mix. Runs on the
// HDR buffer after bloom and before the OutputPass.
import { Vector2, Vector3, Vector4 } from 'three';

export const RetroShader = {
  name: 'RetroShader',

  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uAberration: { value: 0.0012 },
    uVignette: { value: 0.38 },
    uVignetteColor: { value: new Vector3(0.0, 0.0, 0.0) },
    uScanlines: { value: 0.05 },
    uGrain: { value: 0.035 },
    uFlash: { value: new Vector4(1, 1, 1, 0) },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uAberration;
    uniform float uVignette;
    uniform vec3 uVignetteColor;
    uniform float uScanlines;
    uniform float uGrain;
    uniform vec4 uFlash;
    varying vec2 vUv;

    float hash12( vec2 p ) {
      vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
      p3 += dot( p3, p3.yzx + 33.33 );
      return fract( ( p3.x + p3.y ) * p3.z );
    }

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot( d, d );

      // Chromatic aberration: radial channel split, growing toward the edges.
      float ca = uAberration * ( 1.0 + 2.0 * r2 );
      vec3 col;
      col.r = texture2D( tDiffuse, uv + d * ca ).r;
      col.g = texture2D( tDiffuse, uv ).g;
      col.b = texture2D( tDiffuse, uv - d * ca ).b;

      // Scanlines: gentle horizontal modulation locked to device pixels.
      float scan = 1.0 - uScanlines * ( 0.5 + 0.5 * sin( uv.y * uResolution.y * 1.5 ) );
      col *= scan;

      // Vignette toward a tintable colour (red when the invasion presses in).
      float vig = uVignette * smoothstep( 0.35, 1.2, sqrt( r2 ) * 1.4 );
      col = mix( col, uVignetteColor, vig );

      // Film grain, animated.
      float grain = ( hash12( uv * uResolution + fract( uTime ) * 1000.0 ) - 0.5 ) * uGrain;
      col += grain;

      // Screen flash.
      col = mix( col, uFlash.rgb, clamp( uFlash.a, 0.0, 1.0 ) );

      gl_FragColor = vec4( col, 1.0 );
    }
  `,
};
