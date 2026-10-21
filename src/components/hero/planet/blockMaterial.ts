// 方块材质：同一套着色器表现两种状态。
// aPlay 0 = 开发态，1 = 游玩态（草地/泥土实心、暖光）；0.5 附近是翻转瞬间：方块弹起并闪亮绿。
// 开发态是一整片连续的深蓝面：格线由着色器画（细、暗），代码字形只在交界线附近密集，越往远端越稀、越暗，
// 让"代码在交界线上变成世界"一眼可读，也避免整个半球处处同样亮。
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
  // 两种状态都是满尺寸，表面连续；只在翻转瞬间轻微收缩
  vec3 pos = position * (1.0 - flip * 0.18);
  vec4 local = instanceMatrix * vec4(pos, 1.0);
  // 少量浮起的代码块：同一节奏缓慢浮动，只差一点相位
  float bob = 0.1 * sin(uTime * 0.9 + aSeed * 2.0) * step(0.01, aHover) * uMotion;
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
  float facing = max(dot(n, vViewW), 0.0);
  float rim = pow(1.0 - facing, 3.0);

  // 游玩态：草顶、泥土侧面，暖色方向光
  vec3 play = vTop > 0.7 ? tile(0.0, vUv) : tile(2.0, vUv) * 0.92;
  float lambert = max(dot(n, normalize(uSun)), 0.0);
  play *= vec3(0.32, 0.36, 0.48) + vec3(1.0, 0.86, 0.62) * lambert * 1.05;

  // 开发态：距交界线越近，代码越密越亮
  float near = exp(-abs(vSeam) * 2.4);               // 交界线 1 → 远端约 0.1
  // 线性空间值（输出时会转 sRGB）：约等于图标底色 #101c2b
  vec3 base = vec3(0.006, 0.013, 0.028) * (0.7 + 0.6 * facing);
  float hasCode = step(1.0 - near * 0.95, vSeed);     // 远端大多是空格子
  float codeTile = vSeed < 0.5 ? 3.0 : (vSeed < 0.9 ? 4.0 : 5.0);
  vec3 code = tile(codeTile, vUv);
  float glyph = step(0.2, code.g - code.b * 0.3) * hasCode; // 只取字形像素，丢掉贴图底色
  vec3 dev = mix(base, code, glyph * (0.35 + 0.65 * near));
  // 格线：每格一个像素宽，暗薄荷色；交界线附近更亮
  vec2 e2 = min(vUv, 1.0 - vUv);
  float edge = step(min(e2.x, e2.y), 1.0 / 16.0);
  // 格线颜色同样取线性值（≈ 薄荷 #70eac0）
  dev = mix(dev, vec3(0.16, 0.82, 0.53), edge * (0.12 + 0.55 * near));
  dev += vec3(0.02, 0.47, 0.38) * rim * 0.25;

  vec3 col = vPlay < 0.5 ? dev : play;

  // 交界线发光，随时间流动
  float seam = exp(-abs(vSeam) * 9.0);
  float wave = 0.6 + 0.4 * sin(uTime * 2.0 - vSeed * 12.0);
  col += vec3(0.49, 1.0, 0.42) * seam * 0.26 * wave;

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
