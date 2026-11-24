import type { CSSProperties, ReactNode } from 'react';
import { clamp } from '../../domain/math';

export interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  progress: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function ProgressRing({
  size = 220,
  strokeWidth = 10,
  progress,
  className = '',
  style,
  children,
}: ProgressRingProps) {
  const safeProgress = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
  const center = size / 2;
  const radius = Math.max(1, center - strokeWidth / 2);
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeProgress);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#E5E8EB"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#3182F6"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-200 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center tabular-nums">
        {children}
      </div>
    </div>
  );
}
