import { Html, useProgress } from '@react-three/drei';

export default function LoadingScreen() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white text-sm font-medium">{progress.toFixed(0)}%</p>
      </div>
    </Html>
  );
}
