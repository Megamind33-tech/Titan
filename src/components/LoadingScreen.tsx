import { Html, useProgress } from '@react-three/drei';

export default function LoadingScreen() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-4 bg-black/40 backdrop-blur-md p-8 rounded border border-white/10 shadow-2xl min-w-[240px]">
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
          <div 
            className="h-full bg-white/40 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-white/80 text-[10px] font-mono uppercase tracking-[0.3em] font-bold">INITIALIZING_SYSTEM</p>
          <p className="text-white/30 text-[8px] font-mono uppercase tracking-widest">{progress.toFixed(0)}%_COMPLETE</p>
        </div>
      </div>
    </Html>
  );
}
