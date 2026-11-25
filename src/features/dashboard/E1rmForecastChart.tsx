import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { ForecastPoint, LiftForecastSummary } from '../../domain/types';

export interface E1rmForecastChartProps {
  summary: LiftForecastSummary;
}

const SVG_WIDTH = 360;
const SVG_HEIGHT = 210;
const PAD_LEFT = 48;
const PAD_RIGHT = 14;
const PAD_TOP = 24;
const PAD_BOTTOM = 26;
const PLOT_WIDTH = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;

const QUICK_WEEKS = [
  { offset: 0, label: '현재' },
  { offset: 4, label: '4주' },
  { offset: 8, label: '8주' },
  { offset: 12, label: '12주' },
] as const;

function computeYDomain(summary: LiftForecastSummary): {
  minY: number;
  maxY: number;
} {
  const values: number[] = [summary.currentKg];
  for (const hp of summary.historyPoints) {
    values.push(hp.actualKg);
  }
  for (const pt of summary.points) {
    values.push(pt.lowerBoundKg, pt.projectedKg, pt.upperBoundKg);
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(4, rawMax - rawMin);
  const pad = Math.max(2, span * 0.15);

  const minY = Math.max(0, Math.floor((rawMin - pad) / 5) * 5);
  let maxY = Math.ceil((rawMax + pad) / 5) * 5;
  if (maxY <= minY) {
    maxY = minY + 10;
  }

  return { minY, maxY };
}

export function E1rmForecastChart({ summary }: E1rmForecastChartProps) {
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);
  const isDraggingRef = useRef(false);

  const selectedPoint: ForecastPoint | undefined =
    summary.points.find((p) => p.weekOffset === selectedWeekOffset) ??
    summary.points[summary.points.length - 1] ??
    summary.points[0];

  const minWeek =
    summary.historyPoints.length > 0
      ? Math.min(0, ...summary.historyPoints.map((p) => p.weekOffset))
      : 0;
  const maxWeek = 12;
  const weekSpan = Math.max(12, maxWeek - minWeek);

  const { minY, maxY } = computeYDomain(summary);
  const ySpan = Math.max(1, maxY - minY);

  const toX = (weekOffset: number): number =>
    PAD_LEFT + ((weekOffset - minWeek) / weekSpan) * PLOT_WIDTH;

  const toY = (kg: number): number =>
    PAD_TOP + (1 - (kg - minY) / ySpan) * PLOT_HEIGHT;

  const gridValues = [0, 1 / 3, 2 / 3, 1].map(
    (ratio) => minY + ySpan * ratio,
  );

  // Confidence band polygon across predicted points 0..12
  const upperBandCoords = summary.points.map(
    (pt) => `${toX(pt.weekOffset).toFixed(1)},${toY(pt.upperBoundKg).toFixed(1)}`,
  );
  const lowerBandCoords = [...summary.points]
    .reverse()
    .map(
      (pt) =>
        `${toX(pt.weekOffset).toFixed(1)},${toY(pt.lowerBoundKg).toFixed(1)}`,
    );
  const polygonPoints =
    summary.points.length >= 2
      ? [...upperBandCoords, ...lowerBandCoords].join(' ')
      : '';

  // Historical points connecting smoothly to current Week 0
  const connectedHistory = [...summary.historyPoints].sort(
    (a, b) => a.weekOffset - b.weekOffset,
  );
  const lastHistory = connectedHistory[connectedHistory.length - 1];
  if (lastHistory && lastHistory.weekOffset < 0) {
    connectedHistory.push({
      dateISO: 'current',
      weekOffset: 0,
      actualKg: summary.currentKg,
    });
  }

  const historyPolyline = connectedHistory
    .map((pt) => `${toX(pt.weekOffset).toFixed(1)},${toY(pt.actualKg).toFixed(1)}`)
    .join(' ');

  const forecastPolyline = summary.points
    .map(
      (pt) =>
        `${toX(pt.weekOffset).toFixed(1)},${toY(pt.projectedKg).toFixed(1)}`,
    )
    .join(' ');

  const deloadPoints = summary.points.filter((pt) => pt.isDeloadWeek);

  const earliestHistoryOffset =
    connectedHistory[0] && connectedHistory[0].weekOffset < 0
      ? connectedHistory[0].weekOffset
      : null;

  const xAxisTicks: { offset: number; label: string }[] = [];
  if (
    earliestHistoryOffset !== null &&
    toX(0) - toX(earliestHistoryOffset) >= 34
  ) {
    xAxisTicks.push({
      offset: earliestHistoryOffset,
      label: `${earliestHistoryOffset}주`,
    });
  }
  xAxisTicks.push(
    { offset: 0, label: '현재' },
    { offset: 4, label: '4주' },
    { offset: 8, label: '8주' },
    { offset: 12, label: '12주' },
  );

  const selectNearestPoint = (event: PointerEvent<SVGSVGElement>) => {
    if (summary.points.length === 0 || !Number.isFinite(event.clientX)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const renderedWidth = rect.width > 0 ? rect.width : SVG_WIDTH;
    const svgX = ((event.clientX - rect.left) / renderedWidth) * SVG_WIDTH;

    let closest = summary.points[0];
    let minDistance = Number.POSITIVE_INFINITY;
    for (const pt of summary.points) {
      const dist = Math.abs(toX(pt.weekOffset) - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closest = pt;
      }
    }
    if (closest) {
      setSelectedWeekOffset(closest.weekOffset);
    }
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore pointer capture errors in headless environments
    }
    selectNearestPoint(event);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    selectNearestPoint(event);
  };

  const handlePointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = false;
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore pointer release errors
    }
  };

  const handleChartKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (summary.points.length === 0) return;
    const currentIdx = Math.max(
      0,
      summary.points.findIndex((p) => p.weekOffset === selectedWeekOffset),
    );
    let nextIdx: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      nextIdx = Math.min(summary.points.length - 1, currentIdx + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      nextIdx = Math.max(0, currentIdx - 1);
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = summary.points.length - 1;
    }
    if (nextIdx !== null) {
      event.preventDefault();
      const target = summary.points[nextIdx];
      if (target) {
        setSelectedWeekOffset(target.weekOffset);
      }
    }
  };

  const selectedValueText = selectedPoint
    ? selectedPoint.weekOffset === 0
      ? `현재 ${selectedPoint.projectedKg}kg`
      : `${selectedPoint.weekOffset}주 후 예상 ${selectedPoint.projectedKg}kg`
    : '현재';

  return (
    <div className="space-y-3">
      {selectedPoint ? (
        <div
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-[14px] bg-[#F2F4F6] px-3.5 py-2.5 text-[13px] font-semibold text-[#191F28] tabular-nums"
        >
          <span className="whitespace-nowrap">
            {selectedPoint.weekOffset === 0
              ? `선택 시점: 현재${selectedPoint.isDeloadWeek ? ' (디로드)' : ''}`
              : `선택 시점: ${selectedPoint.weekOffset}주 후${selectedPoint.isDeloadWeek ? ' (디로드)' : ''}`}
          </span>
          {selectedPoint.weekOffset === 0 ? (
            <span className="whitespace-nowrap font-bold text-[#1B64DA]">
              현재 {selectedPoint.projectedKg}kg
            </span>
          ) : (
            <span className="whitespace-nowrap font-bold text-[#1B64DA]">
              예상 {selectedPoint.projectedKg}kg{' '}
              <span className="font-medium text-[#4E5968]">
                ({selectedPoint.lowerBoundKg}~{selectedPoint.upperBoundKg}kg)
              </span>
            </span>
          )}
        </div>
      ) : null}

      <div
        role="slider"
        tabIndex={0}
        aria-label={`${summary.label} 12주 e1RM 예측 시점 선택`}
        aria-valuemin={0}
        aria-valuemax={12}
        aria-valuenow={selectedPoint?.weekOffset ?? 0}
        aria-valuetext={selectedValueText}
        onKeyDown={handleChartKeyDown}
        className="w-full overflow-hidden rounded-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
      >
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          aria-label={`${summary.label} 12주 e1RM 예측 차트`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
          className="aspect-[360/210] h-auto w-full cursor-pointer select-none touch-pan-y"
        >
          {gridValues.map((val, idx) => {
            const y = toY(val);
            return (
              <g key={idx}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={SVG_WIDTH - PAD_RIGHT}
                  y2={y}
                  stroke={idx === 0 ? '#E5E8EB' : '#F2F4F6'}
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={12}
                  fill="#4E5968"
                  className="text-[12px] tabular-nums"
                >
                  {Math.round(val)}kg
                </text>
              </g>
            );
          })}

          {polygonPoints ? (
            <polygon
              points={polygonPoints}
              fill="#3182F6"
              fillOpacity={0.12}
            />
          ) : null}

          {deloadPoints.map((pt) => {
            const x = toX(pt.weekOffset);
            const anchor =
              x < PAD_LEFT + 22
                ? 'start'
                : x > SVG_WIDTH - PAD_RIGHT - 22
                  ? 'end'
                  : 'middle';
            return (
              <g key={`deload_${pt.weekOffset}`}>
                <line
                  x1={x}
                  y1={PAD_TOP}
                  x2={x}
                  y2={PAD_TOP + PLOT_HEIGHT}
                  stroke="#027A48"
                  strokeWidth={1.25}
                  strokeDasharray="3 3"
                  strokeOpacity={0.75}
                />
                <text
                  x={x}
                  y={PAD_TOP - 7}
                  textAnchor={anchor}
                  fontSize={12}
                  fontWeight={600}
                  fill="#027A48"
                  className="text-[12px] tabular-nums"
                >
                  디로드
                </text>
              </g>
            );
          })}

          {selectedPoint ? (
            <line
              x1={toX(selectedPoint.weekOffset)}
              y1={PAD_TOP}
              x2={toX(selectedPoint.weekOffset)}
              y2={PAD_TOP + PLOT_HEIGHT}
              stroke="#1B64DA"
              strokeWidth={1.25}
              strokeOpacity={0.45}
            />
          ) : null}

          {connectedHistory.length >= 2 ? (
            <polyline
              fill="none"
              stroke="#191F28"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={historyPolyline}
            />
          ) : null}

          {summary.points.length >= 2 ? (
            <polyline
              fill="none"
              stroke="#1B64DA"
              strokeWidth={2.25}
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={forecastPolyline}
            />
          ) : null}

          {connectedHistory.map((pt) => (
            <circle
              key={`hist_${pt.dateISO}_${pt.weekOffset}`}
              cx={toX(pt.weekOffset)}
              cy={toY(pt.actualKg)}
              r={4}
              fill="#191F28"
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
          ))}

          {summary.points.map((pt) => {
            const isSelected = selectedPoint?.weekOffset === pt.weekOffset;
            return (
              <circle
                key={`pred_${pt.weekOffset}`}
                cx={toX(pt.weekOffset)}
                cy={toY(pt.projectedKg)}
                r={isSelected ? 5.5 : 3.5}
                fill={isSelected ? '#1B64DA' : '#FFFFFF'}
                stroke="#1B64DA"
                strokeWidth={2}
              />
            );
          })}

          {xAxisTicks.map((tick) => {
            const x = toX(tick.offset);
            const anchor =
              x > SVG_WIDTH - PAD_RIGHT - 16
                ? 'end'
                : x < PAD_LEFT + 12
                  ? 'start'
                  : 'middle';
            return (
              <text
                key={`xtick_${tick.offset}`}
                x={x}
                y={SVG_HEIGHT - 6}
                textAnchor={anchor}
                fontSize={12}
                fill="#4E5968"
                className="text-[12px] tabular-nums"
              >
                {tick.label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {QUICK_WEEKS.map((item) => {
          const isActive = selectedWeekOffset === item.offset;
          return (
            <button
              key={item.offset}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSelectedWeekOffset(item.offset)}
              className={`min-h-12 min-w-0 cursor-pointer whitespace-nowrap rounded-[14px] px-1.5 text-[13px] font-bold tabular-nums active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                isActive
                  ? 'bg-[#1B64DA] text-white hover:bg-[#1552B8]'
                  : 'bg-[#F2F4F6] text-[#4E5968] hover:bg-[#E5E8EB]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
