// Hero 星球（React 岛）。WebGL 不可用、出错或用户偏好减少动态时，保留静态星球与 DOM 徽章列表。
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Capability } from '../../data/capabilities';
import { sideLabel } from '../../data/capabilities';
import { BADGE_DIRS, createControls, type Controls } from './planet/controls';
import { AGENT_COUNT } from './planet/Agents';
import type { SeamShape } from './planet/world';
import './planet.css';

const Stage = lazy(() => import('./planet/Stage'));

class Guard extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// 只做廉价的特性检查；真正创建上下文失败时由 Guard 捕获并回落到静态星球
const webglOk = () => typeof window.WebGLRenderingContext !== 'undefined';

export default function Planet({ capabilities }: { capabilities: Capability[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'pending' | 'live' | 'off'>('pending');
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState<Capability | null>(null);
  const [copied, setCopied] = useState(false);

  const ctl = useMemo<Controls | null>(() => {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(location.search).get('seam');
    const seam: SeamShape = q === 'line' ? 'line' : 's';
    return createControls(seam, matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // 等页面加载完、主线程空闲后再启动 3D，首屏文字和安装框先可用
  useEffect(() => {
    if (!webglOk()) return setMode('off');
    let idle = 0;
    const start = () => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle = ric(() => setMode('live'), { timeout: 2000 });
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      window.cancelIdleCallback?.(idle);
    };
  }, []);

  // 离屏暂停
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const markReady = useCallback(() => {
    document.querySelector('[data-planet-wrap]')?.setAttribute('data-live', '');
  }, []);
  const fail = useCallback(() => {
    setMode('off');
    document.querySelector('[data-planet-wrap]')?.removeAttribute('data-live');
  }, []);

  // 画布铺满 Hero；星球对齐页面上的舞台占位（[data-planet-wrap]），随布局变化重新测量
  useEffect(() => {
    const el = wrap.current;
    const target = document.querySelector<HTMLElement>('[data-planet-wrap]');
    if (!el || !target || !ctl) return;
    const measure = () => {
      const a = el.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const size = Math.min(b.width, b.height);
      ctl.frame = { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2, size };
      el.style.setProperty('--fx', `${ctl.frame.x}px`);
      el.style.setProperty('--fy', `${ctl.frame.y}px`);
      el.style.setProperty('--fs', `${size}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(target);
    return () => ro.disconnect();
  }, [ctl, mode]);

  const focus = useCallback(
    (cap: Capability | null) => {
      if (!ctl) return;
      setActive(cap);
      setCopied(false);
      const d = cap && BADGE_DIRS[cap.id];
      ctl.focus = d ? new THREE.Vector3(...d).normalize() : null;
      ctl.lastInput = performance.now() / 1000;
    },
    [ctl],
  );

  // 拖动、惯性、Ctrl/捏合缩放（普通滚轮留给页面滚动）
  useEffect(() => {
    const el = wrap.current;
    if (!el || !ctl || mode !== 'live') return;
    let last: { x: number; y: number; t: number } | null = null;
    let moved = 0;
    const now = () => performance.now() / 1000;
    const ndc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ctl.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      ctl.skipIntro = true;
      ctl.dragging = true;
      ctl.focus = null;
      ctl.lens = null;
      ctl.hoverId = -1;
      moved = 0;
      last = { x: e.clientX, y: e.clientY, t: now() };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      ndc(e);
      ctl.hovering = true;
      ctl.lastInput = now();
      if (!ctl.dragging || !last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      const dt = Math.max(now() - last.t, 1 / 240);
      moved += Math.abs(dx) + Math.abs(dy);
      const k = 0.0065;
      ctl.yaw += dx * k;
      ctl.pitch += dy * k;
      ctl.vel.set((dx * k) / dt, (dy * k) / dt).clampLength(0, 6);
      last = { x: e.clientX, y: e.clientY, t: now() };
    };
    const up = (e: PointerEvent) => {
      if (!ctl.dragging) return;
      ctl.dragging = false;
      ctl.lastInput = now();
      if (now() - (last?.t ?? 0) > 0.08) ctl.vel.set(0, 0);
      last = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      // 点击空白处收起卡片
      if (moved < 4) focus(null);
    };
    const leave = () => {
      ctl.hovering = false;
      ctl.lens = null;
      ctl.hoverId = -1;
    };
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      ctl.zoom = THREE.MathUtils.clamp(ctl.zoom * Math.exp(-e.deltaY * 0.01), 0.8, 1.6);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('wheel', wheel);
    };
  }, [ctl, mode, focus]);

  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && focus(null);
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, focus]);

  const anchorRef = (id: string) => (el: HTMLElement | null) => {
    if (!ctl) return;
    if (el) ctl.anchors.set(id, el);
    else ctl.anchors.delete(id);
  };

  const copy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const code = wrap.current?.querySelector('.pcard code');
      if (code) getSelection()?.selectAllChildren(code);
    }
  };

  if (mode !== 'live' || !ctl) return null;

  return (
    <div ref={wrap} className="planet3d" data-seam={ctl.seam}>
      <Guard onError={fail}>
        <Suspense fallback={null}>
          <Stage ctl={ctl} running={visible} onReady={markReady} />
        </Suspense>
      </Guard>
      {/* 3D 徽章与页面下方的能力导航重复，屏幕阅读器读后者即可 */}
      <div className="overlay" aria-hidden="true">
        {capabilities.map((c) => (
          <button
            key={c.id}
            ref={anchorRef(c.id)}
            className={`pbadge pixel ${c.side}`}
            tabIndex={-1}
            data-active={active?.id === c.id ? '' : undefined}
            onClick={() => focus(active?.id === c.id ? null : c)}
          >
            {c.name}
          </button>
        ))}
        {Array.from({ length: AGENT_COUNT }, (_, i) => (
          <span key={i} ref={anchorRef(`agent-${i}`)} className="ptag pixel" />
        ))}
      </div>
      {active && (
        <div className="pcard" role="dialog" aria-label={active.name}>
          <div className="pcard-head">
            <span className={`pside pixel ${active.side}`}>{sideLabel[active.side]}</span>
            <strong className="pixel">{active.name}</strong>
            <button className="pclose" aria-label="关闭" onClick={() => focus(null)}>
              ×
            </button>
          </div>
          <p>{active.summary}</p>
          <div className="pcmd">
            <code>{active.command}</code>
            <button className="pcopy pixel" onClick={copy} aria-label={`复制命令：${active.command}`}>
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <a className="pmore pixel" href={active.href}>
            查看详情 →
          </a>
        </div>
      )}
    </div>
  );
}
