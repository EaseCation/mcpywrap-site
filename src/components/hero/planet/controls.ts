// DOM 层与 3D 场景共享的可变状态（不经过 React 渲染，避免每帧重渲染）
import * as THREE from 'three';
import type { SeamShape } from './world';

export interface Controls {
  /** 指针在画布内的 NDC 坐标 */
  pointer: THREE.Vector2;
  hovering: boolean;
  dragging: boolean;
  /** 最近一次用户操作的时间（秒），用于恢复自动旋转 */
  lastInput: number;
  /** 拖动角速度（弧度/秒）：x = 偏航，y = 俯仰 */
  vel: THREE.Vector2;
  /** 星球朝向：先绕 Y 偏航再绕 X 俯仰，保持南北极朝上 */
  yaw: number;
  pitch: number;
  /** 点击徽章后要转到正面的方向（星球局部坐标） */
  focus: THREE.Vector3 | null;
  /** 缩放（1 = 默认） */
  zoom: number;
  /** 跳过开场 */
  skipIntro: boolean;
  reducedMotion: boolean;
  seam: SeamShape;
  /** 透视镜中心（星球局部单位向量），null 表示指针不在星球上 */
  lens: THREE.Vector3 | null;
  /** 指针下的方块序号，-1 表示无 */
  hoverId: number;
  /** 徽章 / 标签的 DOM 元素，场景每帧写入位置 */
  anchors: Map<string, HTMLElement>;
  /** 跟随 3D 物体的锚点（Agent、卫星），key 与 anchors 对应 */
  objects: Map<string, THREE.Object3D>;
  /** 待处理的点击（NDC），场景在下一帧射线检测后清空；null 表示没有 */
  tap: THREE.Vector2 | null;
  /** 正在扩散的点击波纹：起点方向（星球局部单位向量）与开始时间（场景时钟秒，-1 表示下一帧开始） */
  ripples: { dir: THREE.Vector3; t0: number }[];
  /** 星球在画布中的位置与尺寸（像素，相对画布左上角）：中心 x/y 与边长 */
  frame: { x: number; y: number; size: number };
  /** 开场进度 0..1，DOM 层用来淡入徽章 */
  reveal: number;
}

export function createControls(seam: SeamShape, reducedMotion: boolean): Controls {
  return {
    pointer: new THREE.Vector2(9, 9),
    hovering: false,
    dragging: false,
    lastInput: -10,
    vel: new THREE.Vector2(),
    yaw: 0,
    pitch: 0.15,
    focus: null,
    zoom: 1,
    skipIntro: reducedMotion,
    reducedMotion,
    seam,
    lens: null,
    hoverId: -1,
    anchors: new Map(),
    objects: new Map(),
    tap: null,
    ripples: [],
    frame: { x: 0, y: 0, size: 0 },
    reveal: reducedMotion ? 1 : 0,
  };
}

/** 徽章在星球上的方向（局部坐标，会被归一化）。开发侧 x<0，游玩侧 x>0，交界线 x≈0 */
export const BADGE_DIRS: Record<string, [number, number, number]> = {
  cli: [-0.75, 0.5, 0.45],
  deps: [-0.85, -0.05, 0.55],
  scripts: [-0.55, 0.78, -0.1],
  package: [-0.7, -0.55, 0.35],
  runtime: [0.02, 0.62, 0.78],
  input: [0.02, 0.0, 1],
  capture: [0.02, -0.62, 0.78],
  worlds: [0.78, 0.48, 0.42],
  server: [0.88, -0.05, 0.5],
  clients: [0.68, -0.6, 0.4],
};
