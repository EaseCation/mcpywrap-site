// AI Agent：屏幕脸为 ">_" 的方块小机器人，沿交界线巡游。
// 动作与真实能力一一对应（只是表达，不代表"已验证"）：
//   observe    扫描光束      → runtime input observe
//   input run  拨动小人      → runtime input run
//   screenshot 快门闪光      → screenshot
//   runtime py 递下代码块    → runtime py / reload
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { R, seamPoint, type SeamShape } from './world';
import { tileTexture } from './atlas';
import type { Controls } from './controls';

export const ACTIONS = ['observe', 'input run', 'screenshot', 'runtime py'] as const;
const CYCLE = 3.2; // 每个动作持续秒数

const AGENTS = [
  { t0: 0.04, swing: 0.035, speed: 0.21 },
  { t0: 0.955, swing: 0.03, speed: 0.17 },
  { t0: 0.5, swing: 0.04, speed: 0.13 }, // 背面那位，转过去才看得到
];

interface Props {
  ctl: Controls;
  atlas: THREE.Texture;
  shape: SeamShape;
  /** 0..1：开场后出现 */
  appear: React.RefObject<number>;
}

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _pq = new THREE.Quaternion();

function Agent({ index, ctl, atlas, shape, appear }: Props & { index: number }) {
  const cfg = AGENTS[index];
  const root = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const block = useRef<THREE.Mesh>(null);
  const keys = useRef<THREE.Group>(null);
  const face = useMemo(() => tileTexture(atlas, 6), [atlas]);
  const codeTex = useMemo(() => tileTexture(atlas, 3), [atlas]);
  const bodyMats = useMemo(() => {
    const side = new THREE.MeshLambertMaterial({ color: '#28b7a6' });
    const front = new THREE.MeshBasicMaterial({ map: face, toneMapped: false });
    // BoxGeometry 面顺序：+x -x +y -y +z -z；+z 为脸
    return [side, side, new THREE.MeshLambertMaterial({ color: '#70eac0' }), side, front, side];
  }, [face]);

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    const g = root.current!;
    ctl.objects.set(`agent-${index}`, g);
    const k = appear.current;
    g.visible = k > 0.01;
    if (!g.visible) return;

    // 沿交界线来回走
    const motion = ctl.reducedMotion ? 0 : 1;
    const s = cfg.t0 + Math.sin(t * cfg.speed + index * 2) * cfg.swing * motion;
    const p = seamPoint(((s % 1) + 1) % 1, shape);
    _up.set(...p);
    const bob = Math.sin(t * 2 + index) * 0.12 * motion;
    g.position.copy(_up).multiplyScalar(R + 2.1 + bob);

    // 身体立在星球表面，脸尽量朝向相机
    const parent = g.parent!;
    parent.getWorldQuaternion(_pq);
    _cam.copy(camera.position);
    parent.worldToLocal(_cam);
    _fwd.copy(_cam).sub(g.position);
    _fwd.addScaledVector(_up, -_fwd.dot(_up)).normalize();
    _right.crossVectors(_up, _fwd).normalize();
    _m.makeBasis(_right, _up, _fwd);
    g.quaternion.setFromRotationMatrix(_m);
    g.scale.setScalar(k);

    // 当前动作
    const phase = ctl.reducedMotion ? 0.5 : (t / CYCLE + index * 1.37) % ACTIONS.length;
    const action = ctl.reducedMotion ? index % ACTIONS.length : Math.floor(phase);
    const f = phase - Math.floor(phase); // 0..1 动作进度
    const label = ctl.anchors.get(`agent-${index}`);
    if (label && label.dataset.action !== ACTIONS[action]) {
      label.dataset.action = ACTIONS[action];
      label.textContent = ACTIONS[action];
    }

    beam.current!.visible = action === 0;
    if (action === 0) {
      const m = beam.current!.material as THREE.MeshBasicMaterial;
      m.opacity = 0.22 + 0.18 * Math.sin(f * Math.PI * 4);
    }
    keys.current!.visible = action === 1;
    if (action === 1)
      keys.current!.children.forEach((c, i) => {
        const on = Math.floor(f * 6) % 3 === i;
        c.position.y = on ? -0.05 : 0;
        ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(on ? '#7dff6a' : '#f1fff9');
      });
    flash.current!.visible = action === 2 && f > 0.35 && f < 0.6;
    if (action === 2) flash.current!.scale.setScalar(0.4 + (f - 0.35) * 8);
    block.current!.visible = action === 3;
    if (action === 3) {
      block.current!.position.y = 1.1 - Math.max(0, f - 0.3) * 3.6;
      block.current!.rotation.y = f * Math.PI;
    }
  });

  return (
    <group ref={root}>
      {/* 身体 */}
      <mesh position={[0, 0.1, 0]} material={bodyMats}>
        <boxGeometry args={[0.8, 0.68, 0.6]} />
      </mesh>
      {/* 底座推进器 */}
      <mesh position={[0, -0.36, 0]}>
        <boxGeometry args={[0.44, 0.16, 0.36]} />
        <meshBasicMaterial color="#168b91" />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[0.24, 0.1, 0.2]} />
        <meshBasicMaterial color="#7dff6a" toneMapped={false} />
      </mesh>
      {/* 天线 */}
      <mesh position={[0.24, 0.58, 0]}>
        <boxGeometry args={[0.06, 0.28, 0.06]} />
        <meshBasicMaterial color="#f1fff9" />
      </mesh>
      <mesh position={[0.24, 0.76, 0]}>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
        <meshBasicMaterial color="#7dff6a" toneMapped={false} />
      </mesh>
      {/* observe：向下的扫描光束 */}
      <mesh ref={beam} position={[0, -1.15, 0]} visible={false}>
        <coneGeometry args={[0.9, 1.4, 4, 1, true]} />
        <meshBasicMaterial color="#7dff6a" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* input run：三颗按键依次按下 */}
      <group ref={keys} position={[0, -0.75, 0.42]} visible={false}>
        {[-0.24, 0, 0.24].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.18, 0.1, 0.18]} />
            <meshBasicMaterial color="#f1fff9" toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* screenshot：快门闪光 */}
      <mesh ref={flash} position={[0, 0.1, 0.32]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#f1fff9" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* runtime py：递下一块代码 */}
      <mesh ref={block} visible={false}>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshBasicMaterial map={codeTex} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Agents(props: Props) {
  return (
    <>
      {AGENTS.map((_, i) => (
        <Agent key={i} index={i} {...props} />
      ))}
    </>
  );
}

export const AGENT_COUNT = AGENTS.length;
