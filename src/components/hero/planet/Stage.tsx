// Canvas 外壳：单独拆包，离屏时停帧
import { Canvas } from '@react-three/fiber';
import Scene from './Scene';
import type { Controls } from './controls';

export default function Stage({ ctl, running, onReady }: { ctl: Controls; running: boolean; onReady: () => void }) {
  return (
    <Canvas
      className="pcanvas"
      frameloop={running ? 'always' : 'never'}
      dpr={[1, 1.25]}
      camera={{ fov: 32, position: [0, 0.6, 36], near: 1, far: 200 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        requestAnimationFrame(onReady);
      }}
    >
      <Scene ctl={ctl} />
    </Canvas>
  );
}
