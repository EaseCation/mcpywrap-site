// 场景：星球组（方块、流动、两侧元素、Agent）+ 星空 + 平台卫星。
// 每帧：积分拖动/惯性/自动摆动 → 处理徽章聚焦 → 把锚点投影到 DOM。
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Blocks } from './Blocks';
import { Flow, DevProps, PlayProps, Sky, Dust } from './Extras';
import { Agents } from './Agents';
import { makeAtlas, tileTexture } from './atlas';
import { R, seamX } from './world';
import { BADGE_DIRS, type Controls } from './controls';

const INTRO = 1.8; // 开场总时长（秒）
const CAM_Z = 36;

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** 平台卫星：抽象的显示器 / 笔记本，不使用任何商标图形 */
function Satellite({ id, ctl, atlas, tilt, speed, phase, kind }: {
  id: string;
  ctl: Controls;
  atlas: THREE.Texture;
  tilt: number;
  speed: number;
  phase: number;
  kind: 'desk' | 'laptop';
}) {
  const ref = useRef<THREE.Group>(null);
  const screen = useMemo(() => tileTexture(atlas, 5), [atlas]);
  useEffect(() => {
    ctl.objects.set(id, ref.current!);
  }, [ctl, id]);
  useFrame(({ clock }) => {
    const t = (ctl.reducedMotion ? 0 : clock.elapsedTime) * speed + phase;
    const r = R + 5.2;
    const g = ref.current!;
    g.position.set(Math.cos(t) * r, Math.sin(t) * r * Math.sin(tilt), Math.sin(t) * r * Math.cos(tilt));
    g.rotation.y = -t + Math.PI / 2;
    g.scale.setScalar(ctl.reveal);
  });
  const frame = kind === 'desk' ? '#168b91' : '#b9c7cf';
  return (
    <group ref={ref}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.5, 1.0, 0.16]} />
        <meshLambertMaterial color={frame} />
      </mesh>
      <mesh position={[0, 0.25, 0.09]}>
        <planeGeometry args={[1.25, 0.78]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      {kind === 'desk' ? (
        <mesh position={[0, -0.42, 0]}>
          <boxGeometry args={[0.5, 0.34, 0.3]} />
          <meshLambertMaterial color={frame} />
        </mesh>
      ) : (
        <mesh position={[0, -0.3, 0.4]}>
          <boxGeometry args={[1.5, 0.08, 0.9]} />
          <meshLambertMaterial color={frame} />
        </mesh>
      )}
    </group>
  );
}

export default function Scene({ ctl }: { ctl: Controls }) {
  const planet = useRef<THREE.Group>(null);
  const atlas = useMemo(() => makeAtlas(), []);
  const introStart = useRef(-1);
  const appear = useRef(ctl.reducedMotion ? 1 : 0);
  const { camera, size } = useThree();

  // 徽章方向：交界线上的徽章按当前形状贴住曲线
  const dirs = useMemo(() => {
    const m = new Map<string, THREE.Vector3>();
    for (const [id, d] of Object.entries(BADGE_DIRS)) {
      const v = new THREE.Vector3(...d).normalize();
      if (Math.abs(d[0]) < 0.1) v.x = seamX(v.y, v.z, ctl.seam);
      m.set(id, v.normalize());
    }
    return m;
  }, [ctl.seam]);

  // 画布铺满 Hero：把一个以星球为中心、边长 frame.size 的"虚拟方形视口"偏移到画布里的对应位置
  const framed = useRef('');
  const frameCamera = () => {
    const cam = camera as THREE.PerspectiveCamera;
    const { x, y, size: fs } = ctl.frame;
    const s = fs > 0 ? fs : Math.min(size.width, size.height);
    const cx = fs > 0 ? x : size.width / 2;
    const cy = fs > 0 ? y : size.height / 2;
    const key = `${s}|${cx}|${cy}|${size.width}|${size.height}|${cam.aspect}`;
    if (key === framed.current) return;
    cam.aspect = 1;
    cam.setViewOffset(s, s, s / 2 - cx, s / 2 - cy, size.width, size.height);
    cam.updateProjectionMatrix();
    framed.current = `${s}|${cx}|${cy}|${size.width}|${size.height}|1`;
  };

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const camDir = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, rawDt) => {
    const t = clock.elapsedTime;
    const dt = Math.min(rawDt, 0.05);
    if (introStart.current < 0) introStart.current = t;
    const intro = ctl.skipIntro ? 1 : Math.min(1, (t - introStart.current) / INTRO);
    ctl.reveal = intro;
    appear.current = THREE.MathUtils.smoothstep(intro, 0.75, 1);

    // 旋转：聚焦 > 拖动惯性 > 自动摆动
    const idle = t - ctl.lastInput > 3;
    if (ctl.focus) {
      const f = ctl.focus;
      const yawT = Math.atan2(-f.x, f.z);
      const pitchT = THREE.MathUtils.clamp(Math.atan2(f.y, Math.hypot(f.x, f.z)), -0.9, 0.9);
      const k = 1 - Math.exp(-dt * 5);
      ctl.yaw += wrapPi(yawT - ctl.yaw) * k;
      ctl.pitch += (pitchT - ctl.pitch) * k;
      ctl.vel.set(0, 0);
    } else if (!ctl.dragging) {
      ctl.yaw += ctl.vel.x * dt;
      ctl.pitch += ctl.vel.y * dt;
      ctl.vel.multiplyScalar(Math.exp(-dt * 2.5));
      if (idle && !ctl.reducedMotion) {
        // 慢慢左右摆：一会儿偏向开发面，一会儿偏向游玩面
        const target = Math.sin(t * 0.12) * 0.7;
        ctl.yaw += wrapPi(target - ctl.yaw) * (1 - Math.exp(-dt * 0.35));
        ctl.pitch += (0.15 - ctl.pitch) * (1 - Math.exp(-dt * 0.5));
      }
    }
    ctl.pitch = THREE.MathUtils.clamp(ctl.pitch, -1.1, 1.1);
    const g = planet.current!;
    g.rotation.set(ctl.pitch, ctl.yaw, 0, 'XYZ');

    // 相机：缩放 + 指针视差
    const px = ctl.hovering && !ctl.reducedMotion ? ctl.pointer.x : 0;
    const py = ctl.hovering && !ctl.reducedMotion ? ctl.pointer.y : 0;
    const z = CAM_Z / ctl.zoom;
    camera.position.x += (px * 1.6 - camera.position.x) * (1 - Math.exp(-dt * 3));
    camera.position.y += (py * 1.2 + 0.6 - camera.position.y) * (1 - Math.exp(-dt * 3));
    camera.position.z += (z - camera.position.z) * (1 - Math.exp(-dt * 6));
    camera.lookAt(0, 0, 0);
    frameCamera();
    camera.updateMatrixWorld();

    // 锚点投影到 DOM
    g.updateMatrixWorld();
    for (const [id, el] of ctl.anchors) {
      let facing = 1;
      const dir = dirs.get(id);
      if (dir) {
        tmp.copy(dir).multiplyScalar(R + 1.6).applyMatrix4(g.matrixWorld);
      } else {
        const obj = ctl.objects.get(id);
        if (!obj) continue;
        obj.getWorldPosition(tmp);
        if (id.startsWith('agent')) tmp.y += 1.4 * appear.current;
      }
      camDir.copy(camera.position).sub(tmp).normalize();
      // 在星球背面就淡出：用"点在球心哪一侧"判断
      const out = tmp.clone().normalize();
      facing = out.dot(camDir);
      const behind = tmp.length() < R + 7 && facing < 0.05;
      const v = tmp.project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      const show = id.startsWith('agent') ? appear.current : intro;
      const op = behind ? 0 : THREE.MathUtils.clamp((facing + 0.05) * 3, 0, 1) * show;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      el.style.opacity = op.toFixed(2);
      el.style.pointerEvents = op > 0.4 ? 'auto' : 'none';
      el.style.zIndex = String(Math.round(facing * 100) + 100);
    }
  });

  return (
    <>
      <ambientLight intensity={0.9} color="#9fb6c8" />
      <directionalLight position={[10, 7, 8]} intensity={2.2} color="#ffe2b0" />
      <Sky />
      <Dust ctl={ctl} />
      <group ref={planet}>
        <Blocks ctl={ctl} atlas={atlas} shape={ctl.seam} introStart={introStart} />
        <Flow ctl={ctl} shape={ctl.seam} />
        <DevProps ctl={ctl} />
        <PlayProps ctl={ctl} />
        <Agents ctl={ctl} atlas={atlas} shape={ctl.seam} appear={appear} />
      </group>
      <Satellite id="windows" ctl={ctl} atlas={atlas} tilt={0.5} speed={0.16} phase={2.4} kind="desk" />
      <Satellite id="macos" ctl={ctl} atlas={atlas} tilt={-0.35} speed={0.16} phase={2.4 + Math.PI} kind="laptop" />
    </>
  );
}
