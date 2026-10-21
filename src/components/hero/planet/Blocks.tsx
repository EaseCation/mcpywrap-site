// 方块壳：InstancedMesh + 双态着色器。负责开场翻转、透视镜与 MC 式选中框。
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { R, buildWorld, type SeamShape } from './world';
import { makeBlockMaterial } from './blockMaterial';
import { commandFor } from './commands';
import type { Controls } from './controls';

const LENS_COS = Math.cos(0.34); // 透视镜半径（弧度）
const FLIP_SPEED = 3.2; // 每秒翻转进度
// 点击波纹：从点击处沿球面扩散的一圈，经过的方块短暂翻到另一种状态
const RIPPLE_SPEED = 2.2; // 弧度/秒
const RIPPLE_WIDTH = 0.22; // 波带宽度（弧度）
const RIPPLE_LIFE = 1.3; // 秒
const NEVER = 1e9; // 开发侧方块的开场延迟：永不翻转（不能用 Infinity，跳过开场时会与之相等）

interface Props {
  ctl: Controls;
  atlas: THREE.Texture;
  shape: SeamShape;
  /** 开场开始时间（秒，useFrame 的 clock） */
  introStart: React.RefObject<number>;
}

export function Blocks({ ctl, atlas, shape, introStart }: Props) {
  const voxels = useMemo(() => buildWorld(shape), [shape]);
  const count = voxels.length;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const outline = useRef<THREE.LineSegments>(null);
  const material = useMemo(() => makeBlockMaterial(atlas), [atlas]);
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const attr = (size: number, fill: (i: number) => number[]) => {
      const a = new Float32Array(count * size);
      for (let i = 0; i < count; i++) a.set(fill(i), i * size);
      return new THREE.InstancedBufferAttribute(a, size);
    };
    g.setAttribute('aPlay', attr(1, () => [0]));
    g.setAttribute('aSeed', attr(1, (i) => [voxels[i].seed]));
    g.setAttribute('aSeam', attr(1, (i) => [voxels[i].d]));
    g.setAttribute('aHover', attr(1, (i) => [voxels[i].d < 0 ? voxels[i].hover : 0]));
    g.setAttribute('aDir', attr(3, (i) => voxels[i].n));
    return g;
  }, [voxels, count]);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.06, 1.06, 1.06)), []);

  // 每个方块翻转到游玩态的开场延迟
  const delays = useMemo(
    () => Float32Array.from(voxels, (v) => (v.d > 0 ? 0.35 + v.d * 1.0 + v.seed * 0.25 : NEVER)),
    [voxels],
  );

  const maxDelay = useMemo(() => delays.reduce((m, d) => (d < NEVER ? Math.max(m, d) : m), 0), [delays]);
  const { raycaster, camera } = useThree();
  const tag = useRef<THREE.Object3D>(null);
  const settling = useRef(true);
  const lastLens = useRef('');

  useLayoutEffect(() => {
    ctl.objects.set('ripple', tag.current!);
    return () => void ctl.objects.delete('ripple');
  }, [ctl]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    voxels.forEach((v, i) => mesh.current!.setMatrixAt(i, m.makeTranslation(v.x, v.y, v.z)));
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [voxels]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    material.uniforms.uTime.value = t;
    material.uniforms.uMotion.value = ctl.reducedMotion ? 0 : 1;
    const play = geometry.getAttribute('aPlay') as THREE.InstancedBufferAttribute;
    const arr = play.array as Float32Array;
    // 跳过开场 = 开场已结束：游玩侧全部到位，开发侧保持不变
    const intro = ctl.skipIntro ? maxDelay + 10 : t - introStart.current;
    const lens = ctl.dragging ? null : ctl.lens;

    // 点击：射线找到被点的方块，从那里发出波纹，并在点击处弹出该区域的一条命令
    if (ctl.tap) {
      raycaster.setFromCamera(ctl.tap, camera);
      const hit = raycaster.intersectObject(mesh.current!, false)[0];
      ctl.tap = null;
      if (hit?.instanceId !== undefined) {
        const v = voxels[hit.instanceId];
        const dir = new THREE.Vector3(...v.n);
        ctl.ripples.push({ dir, t0: t });
        if (ctl.ripples.length > 4) ctl.ripples.shift();
        tag.current!.position.copy(dir).multiplyScalar(R + 2.2);
        const el = ctl.anchors.get('ripple');
        const txt = el?.firstElementChild as HTMLElement | null;
        if (el && txt) {
          const cmd = commandFor(v.d);
          el.dataset.side = cmd.side;
          txt.textContent = cmd.text;
          txt.classList.remove('go');
          void txt.offsetWidth; // 重启动画
          txt.classList.add('go');
        }
      }
    }
    ctl.ripples = ctl.ripples.filter((r) => t - r.t0 < RIPPLE_LIFE);
    const rippling = ctl.ripples.length > 0;
    // 静止时（开场结束、透视镜没动、没有方块在翻转）跳过逐块计算
    const lensKey = lens ? `${lens.x.toFixed(3)},${lens.y.toFixed(3)},${lens.z.toFixed(3)}` : '';
    const introDone = intro > maxDelay + 1;
    if (settling.current || rippling || !introDone || lensKey !== lastLens.current) {
      lastLens.current = lensKey;
      // 波纹经过时翻得更快，才能在波带掠过的瞬间看清翻面
      const speed = rippling ? FLIP_SPEED * 2.4 : FLIP_SPEED;
      const step = ctl.reducedMotion ? 1 : Math.min(dt, 0.05) * speed;
      let moving = false;
      for (let i = 0; i < count; i++) {
        const v = voxels[i];
        let target = intro >= delays[i] ? 1 : 0;
        if (lens && lens.x * v.n[0] + lens.y * v.n[1] + lens.z * v.n[2] > LENS_COS) target = 1 - target;
        for (const r of ctl.ripples) {
          const ang = Math.acos(Math.min(1, Math.max(-1, r.dir.x * v.n[0] + r.dir.y * v.n[1] + r.dir.z * v.n[2])));
          // 减少动态：不做扩散动画，点击处附近整片静态翻转一会儿
          const front = ctl.reducedMotion ? 0.3 : (t - r.t0) * RIPPLE_SPEED;
          if (Math.abs(ang - front) < RIPPLE_WIDTH || (ctl.reducedMotion && ang < front)) {
            target = 1 - target;
            break;
          }
        }
        const cur = arr[i];
        if (cur !== target) {
          arr[i] = cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);
          moving = true;
        }
      }
      settling.current = moving;
      if (moving) play.needsUpdate = true;
    }

    // MC 式选中框
    const o = outline.current!;
    if (ctl.hoverId >= 0 && !ctl.dragging) {
      const v = voxels[ctl.hoverId];
      const p = arr[ctl.hoverId];
      const lift = (1 - p) * (v.d < 0 ? v.hover : 0) + Math.sin(p * Math.PI) * 0.35;
      o.position.set(v.x + v.n[0] * lift, v.y + v.n[1] * lift, v.z + v.n[2] * lift);
      o.scale.setScalar(1 - Math.sin(p * Math.PI) * 0.18);
      o.visible = true;
    } else o.visible = false;
  });

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (ctl.dragging || e.instanceId === undefined) return;
    e.stopPropagation();
    ctl.hoverId = e.instanceId;
    const parent = mesh.current!.parent!;
    ctl.lens = parent.worldToLocal(e.point.clone()).normalize();
  };
  const onOut = () => {
    ctl.hoverId = -1;
    ctl.lens = null;
  };

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[geometry, material, count]}
        onPointerMove={onMove}
        onPointerOut={onOut}
      />
      {/* 点击命令标签的 3D 锚点（DOM 标签每帧投影到这里） */}
      <object3D ref={tag} />
      <lineSegments ref={outline} geometry={edges} visible={false}>
        <lineBasicMaterial color="#f1fff9" transparent opacity={0.85} />
      </lineSegments>
    </>
  );
}
