// 方块壳：InstancedMesh + 双态着色器。负责开场翻转、透视镜与 MC 式选中框。
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { buildWorld, type SeamShape } from './world';
import { makeBlockMaterial } from './blockMaterial';
import type { Controls } from './controls';

const LENS_COS = Math.cos(0.34); // 透视镜半径（弧度）
const FLIP_SPEED = 3.2; // 每秒翻转进度

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
    () => Float32Array.from(voxels, (v) => (v.d > 0 ? 0.35 + v.d * 1.0 + v.seed * 0.25 : Infinity)),
    [voxels],
  );

  const maxDelay = useMemo(() => delays.reduce((m, d) => (Number.isFinite(d) ? Math.max(m, d) : m), 0), [delays]);
  const settling = useRef(true);
  const lastLens = useRef('');

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
    const intro = ctl.skipIntro ? Infinity : t - introStart.current;
    const lens = ctl.dragging ? null : ctl.lens;
    // 静止时（开场结束、透视镜没动、没有方块在翻转）跳过逐块计算
    const lensKey = lens ? `${lens.x.toFixed(3)},${lens.y.toFixed(3)},${lens.z.toFixed(3)}` : '';
    const introDone = intro > maxDelay + 1;
    if (settling.current || !introDone || lensKey !== lastLens.current) {
      lastLens.current = lensKey;
      const step = ctl.reducedMotion ? 1 : Math.min(dt, 0.05) * FLIP_SPEED;
      let moving = false;
      for (let i = 0; i < count; i++) {
        const v = voxels[i];
        let target = intro >= delays[i] ? 1 : 0;
        if (lens && lens.x * v.n[0] + lens.y * v.n[1] + lens.z * v.n[2] > LENS_COS) target = 1 - target;
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
      <lineSegments ref={outline} geometry={edges} visible={false}>
        <lineBasicMaterial color="#f1fff9" transparent opacity={0.85} />
      </lineSegments>
    </>
  );
}
