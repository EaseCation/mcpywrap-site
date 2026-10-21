// 星球周边的抽象元素：
// - 交界线上的双向流（开发→游玩：代码方块；游玩→开发：日志/截图/返回值光点）
// - 开发侧：花括号、依赖管道、锁、ZIP；游玩侧：像素小人、方块云、心、准星
// - 星空与光晕（放在星球组外，不随星球转）
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { R, hash, seamPoint, type SeamShape } from './world';
import { spriteTexture, spriteAspect, type SpriteName } from './sprites';
import type { Controls } from './controls';

const v3 = (a: [number, number, number]) => new THREE.Vector3(...a).normalize();

/** 交界线两侧来回的小方块 */
export function Flow({ ctl, shape }: { ctl: Controls; shape: SeamShape }) {
  const N = 28;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const s = seamPoint(hash(i, 3, 7), shape);
        const back = i % 3 === 0; // 三分之一是回流的反馈
        const off = 0.55 + hash(i, 5, 1) * 0.35;
        const from = v3([s[0] - off, s[1], s[2]]);
        const to = v3([s[0] + off, s[1], s[2]]);
        return { a: back ? to : from, b: back ? from : to, back, phase: hash(i, 9, 2), speed: 0.18 + hash(i, 1, 4) * 0.12 };
      }),
    [shape],
  );
  useLayoutEffect(() => {
    const dev = new THREE.Color('#70eac0');
    const fb = new THREE.Color('#f2c94c');
    items.forEach((it, i) => mesh.current!.setColorAt(i, it.back ? fb : dev));
    mesh.current!.instanceColor!.needsUpdate = true;
  }, [items]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = ctl.reducedMotion ? 0.4 : clock.elapsedTime;
    items.forEach((it, i) => {
      const k = (t * it.speed + it.phase) % 1;
      p.copy(it.a).lerp(it.b, k).normalize();
      p.multiplyScalar(R + 1.4 + Math.sin(k * Math.PI) * 1.6);
      const size = 0.32 * Math.sin(k * Math.PI);
      s.setScalar(it.back ? size * 0.7 : size);
      mesh.current!.setMatrixAt(i, m.compose(p, q, s));
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** 面向相机的像素贴图 */
function Pix({ name, pos, size }: { name: SpriteName; pos: [number, number, number]; size: number }) {
  const tex = useMemo(() => spriteTexture(name), [name]);
  const a = spriteAspect(name);
  return (
    <sprite position={pos} scale={[size * a, size, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

const at = (dir: [number, number, number], r: number) => v3(dir).multiplyScalar(r).toArray() as [number, number, number];

/** 开发侧：依赖方块用管道相连，旁边漂着花括号、锁和 ZIP */
export function DevProps({ ctl }: { ctl: Controls }) {
  const group = useRef<THREE.Group>(null);
  const nodes = useMemo(
    () => [
      at([-0.9, 0.25, 0.35], R + 2.6),
      at([-0.75, -0.2, 0.62], R + 2.9),
      at([-0.95, -0.15, 0.05], R + 2.4),
    ],
    [],
  );
  const pipe = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const [a, b, c] = nodes;
    g.setFromPoints([a, b, b, c, c, a].map((p) => new THREE.Vector3(...p)));
    return g;
  }, [nodes]);
  useFrame(({ clock }) => {
    if (!ctl.reducedMotion) group.current!.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.12;
  });
  return (
    <group ref={group}>
      <lineSegments geometry={pipe}>
        <lineBasicMaterial color="#28b7a6" transparent opacity={0.7} />
      </lineSegments>
      {nodes.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.55, 0.55, 0.55]} />
          <meshBasicMaterial color={i === 0 ? '#70eac0' : '#168b91'} wireframe={i !== 0} toneMapped={false} />
        </mesh>
      ))}
      <Pix name="braces" pos={at([-0.6, 0.62, 0.55], R + 2.4)} size={0.9} />
      <Pix name="lock" pos={at([-0.98, 0.1, -0.2], R + 3.2)} size={0.7} />
      <Pix name="zip" pos={at([-0.6, -0.72, 0.4], R + 2.2)} size={0.55} />
    </group>
  );
}

/** 一个像素小人：头、身体、腿三块 */
function Player({ dir, shirt, ctl, seed }: { dir: [number, number, number]; shirt: string; ctl: Controls; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const n = useMemo(() => v3(dir), [dir]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), [n]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 10;
    const hop = ctl.reducedMotion ? 0 : Math.max(0, Math.sin(t * 2.2)) ** 6 * 0.35;
    ref.current!.position.copy(n).multiplyScalar(R + 1 + hop);
  });
  return (
    <group ref={ref} quaternion={quat}>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.22, 0.36, 0.14]} />
        <meshLambertMaterial color="#2f4a9a" />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.3, 0.34, 0.18]} />
        <meshLambertMaterial color={shirt} />
      </mesh>
      <mesh position={[0, 0.86, 0]}>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshLambertMaterial color="#e0b088" />
      </mesh>
    </group>
  );
}

export const PLAYER_DIRS: [number, number, number][] = [
  [0.55, 0.22, 0.8],
  [0.82, -0.32, 0.48],
  [0.92, 0.4, -0.05],
];

/** 游玩侧：小人、方块云、HUD 心与准星 */
export function PlayProps({ ctl }: { ctl: Controls }) {
  const clouds = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ctl.reducedMotion) clouds.current!.rotation.y += dt * 0.05;
  });
  const cloud = (dir: [number, number, number], k: number) => {
    const p = at(dir, R + 3.4);
    return (
      <group key={k} position={p}>
        {[
          [0, 0, 0, 1.4],
          [0.7, 0.12, 0.1, 0.9],
          [-0.6, 0.08, -0.1, 1],
        ].map(([x, y, z, w], i) => (
          <mesh key={i} position={[x, y, z]}>
            <boxGeometry args={[w, 0.34, 0.8]} />
            <meshLambertMaterial color="#f4f8f6" emissive="#7b8a96" />
          </mesh>
        ))}
      </group>
    );
  };
  return (
    <>
      {PLAYER_DIRS.map((d, i) => (
        <Player key={i} dir={d} shirt={['#28b7a6', '#e8504f', '#f2c94c'][i]} ctl={ctl} seed={i * 0.37} />
      ))}
      <group ref={clouds}>{[cloud([0.7, 0.7, 0.2], 0), cloud([0.8, 0.1, -0.6], 1), cloud([0.5, -0.5, 0.7], 2)]}</group>
      <Pix name="heart" pos={at([0.72, 0.72, 0.5], R + 2.2)} size={0.55} />
      <Pix name="heart" pos={at([0.8, 0.66, 0.42], R + 2.2)} size={0.55} />
      <Pix name="crosshair" pos={at([0.95, -0.08, 0.28], R + 2.6)} size={0.6} />
    </>
  );
}

/** 像素星空（不随星球转）；光晕由 DOM 层的全屏径向渐变负责，没有硬边 */
export function Sky() {
  const stars = useMemo(() => {
    // 画布铺满 Hero 后视野更宽：星星分布在星球后方一块宽平面层里
    const n = 900;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const z = -10 - hash(i, 5, 6) * 50;
      const spread = 36 - z * 0.9;
      a.set([(hash(i, 1, 2) * 2 - 1) * spread * 1.9, (hash(i, 3, 4) * 2 - 1) * spread, z], i * 3);
    }
    return a;
  }, []);
  return (
    <>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#9fd8c8" size={2} sizeAttenuation={false} transparent opacity={0.75} />
      </points>
    </>
  );
}

/** 全屏漂浮的像素尘埃：开发侧偏薄荷、游玩侧偏暖，缓慢上升并循环。位置在 GPU 上算，主线程每帧只更新时间 */
export function Dust({ ctl }: { ctl: Controls }) {
  const N = 260;
  const { pos, speed, col } = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const speed = new Float32Array(N);
    const col = new Float32Array(N * 3);
    const mint = new THREE.Color('#70eac0');
    const acid = new THREE.Color('#7dff6a');
    const warm = new THREE.Color('#f2c94c');
    for (let i = 0; i < N; i++) {
      const z = 6 - hash(i, 8, 1) * 26;
      const w = 30 - z * 0.7;
      const x = (hash(i, 2, 9) * 2 - 1) * w * 1.7;
      pos.set([x, (hash(i, 4, 3) * 2 - 1) * w, z], i * 3);
      speed[i] = 0.3 + hash(i, 6, 5) * 0.9;
      (x < -2 ? mint : x > 2 ? warm : acid).toArray(col, i * 3);
    }
    return { pos, speed, col };
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uSize: { value: 3 } },
        vertexShader: /* glsl */ `
          attribute float aSpeed;
          attribute vec3 color;
          uniform float uTime;
          uniform float uSize;
          varying vec3 vColor;
          void main() {
            float h = 30.0 - position.z * 0.7;
            float y = mod(position.y + uTime * aSpeed + h, 2.0 * h) - h;
            float x = position.x + sin(uTime * 0.3 + aSpeed * 50.0) * 0.6;
            vColor = color;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(x, y, position.z, 1.0);
            gl_PointSize = uSize;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          void main() {
            gl_FragColor = vec4(vColor, 0.55);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useFrame(({ clock, gl }) => {
    material.uniforms.uTime.value = ctl.reducedMotion ? 0 : clock.elapsedTime;
    material.uniforms.uSize.value = 3 * gl.getPixelRatio();
  });
  return (
    <points frustumCulled={false} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speed, 1]} />
        <bufferAttribute attach="attributes-color" args={[col, 3]} />
      </bufferGeometry>
    </points>
  );
}
