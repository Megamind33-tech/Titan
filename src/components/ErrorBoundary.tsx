import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Html } from '@react-three/drei';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="bg-red-900/80 text-white p-3 rounded-lg border border-red-500 text-xs backdrop-blur-sm max-w-xs text-center">
            Error loading model. Please ensure it is a valid 3D model file (.glb, .gltf, .obj).
          </div>
        </Html>
      );
    }

    return <>{this.props.children}</>;
  }
}
