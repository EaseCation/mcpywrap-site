// 方块材质：同一套着色器表现两种状态。
// aPlay 0 = 开发态（深蓝代码面 + 薄荷描边，悬浮、略小），1 = 游玩态（草地/泥土实心、暖光）。
// 0.5 附近是翻转瞬间：方块弹起并闪亮绿。
import * as THREE from 'three';
import { TILES } from './atlas';

const vertex = /* glsl */ `
attribute float aPlay;
attribute float aSeed;
attribute float aSeam;
attribute float aHover;
attribute vec3 aDir;
uniform float uTime;
uniform float uMotion;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewW;
varying float vPlay;
varying float vSeed;
varying float vSeam;
varying float vTop;

void main() {
  float p = clamp(aPlay, 0.0, 1.0);
  float sp = smoothstep(0.0, 1.0, p);
  float flip = sin(p * 3.14159);
  vec3 pos = position * mix(0.78, 1.0, sp);
  vec4 local = instanceMatrix * vec4(pos, 1.0);
  float bob = 0.08 * sin(uTime * 1.3 + aSeed * 40.0) * step(0.01, aHover) * uMotion;
  local.xyz += aDir * ((aHover + bob) * (1.0 - sp) + flip * 0.35);
  vec4 world = modelMatrix * local;
  vec3 n = normalize(mat3(instanceMatrix) * normal);
  vNormalW = normalize(mat3(modelMatrix) * n);
  vTop = dot(n, aDir);
  vViewW = normalize(cameraPosition - world.xyz);
  vUv = uv;
  vPlay = p;
  vSeed = aSeed;
  vSeam = aSeam;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragment = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uSun;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewW;
varying float vPlay;
varying float vSeed;
varying float vSeam;
varying float vTop;

vec3 tile(float i, vec2 uv) {
  uv = (floor(uv * 8.0) + 0.5) / 8.0;
  return texture2D(uAtlas, vec2((i + uv.x) / ${TILES.toFixed(1)}, uv.y)).rgb;
}

void main() {
  vec3 n = normalize(vNormalW);
  float rim = pow(1.0 - max(dot(n, vViewW), 0.0), 3.0);

  // 游玩态：草顶、泥土侧面，暖色方向光
  vec3 play = vTop > 0.7 ? tile(0.0, vUv) : tile(2.0, vUv) * 0.92;
  float lambert = max(dot(n, normalize(uSun)), 0.0);
  play *= vec3(0.32, 0.36, 0.48) + vec3(1.0, 0.86, 0.62) * lambert * 1.05;

  // 开发态：代码面 + 一像素描边，冷色自发光
  float codeTile = vSeed < 0.4 ? 3.0 : (vSeed < 0.8 ? 4.0 : 5.0);
  vec3 dev = tile(codeTile, vUv);
  vec2 e2 = min(vUv, 1.0 - vUv);
  float edge = step(min(e2.x, e2.y), 0.125);
  float facing = 0.55 + 0.45 * max(dot(n, vViewW), 0.0);
  dev = mix(dev * facing, vec3(0.44, 0.92, 0.75), edge * 0.9);
  dev += vec3(0.16, 0.72, 0.65) * rim * 0.35;

  vec3 col = vPlay < 0.5 ? dev : play;

  // 交界线附近发光，随时间流动
  float seam = exp(-abs(vSeam) * 9.0);
  float wave = 0.6 + 0.4 * sin(uTime * 2.0 - vSeed * 12.0);
  col += vec3(0.49, 1.0, 0.42) * seam * 0.28 * wave;

  // 翻转瞬间闪亮绿
  col += vec3(0.49, 1.0, 0.42) * sin(vPlay * 3.14159) * 0.75;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function makeBlockMaterial(atlas: THREE.Texture) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uAtlas: { value: atlas },
      uSun: { value: new THREE.Vector3(0.9, 0.6, 0.7) },
      uTime: { value: 0 },
      uMotion: { value: 1 },
    },
  });
}
