import { describe, expect, it } from 'vitest';
import {
  build12WeekForecast,
  calculateE1rm,
  extractCurrentLiftE1rms,
} from '../e1rm-engine';
import { DEFAULT_USER_PROFILE } from '../routine-model-a';
import type { WeightSessionLog } from '../types';

describe('e1rm-engine', () => {
  describe('calculateE1rm', () => {
    it('returns 0 for non-positive or non-finite inputs', () => {
      expect(calculateE1rm(0, 5, 2)).toBe(0);
      expect(calculateE1rm(-80, 5, 2)).toBe(0);
      expect(calculateE1rm(100, 0, 2)).toBe(0);
      expect(calculateE1rm(100, -3, 2)).toBe(0);
      expect(calculateE1rm(Number.NaN, 5, 2)).toBe(0);
      expect(calculateE1rm(100, Number.POSITIVE_INFINITY, 2)).toBe(0);
    });

    it('returns half-kg rounded weight when effective reps <= 1', () => {
      expect(calculateE1rm(100, 1, 0)).toBe(100);
      expect(calculateE1rm(100.2, 1, -2)).toBe(100);
      expect(calculateE1rm(142.3, 1, 0)).toBe(142.5);
    });

    it('calculates Epley e1RM including non-negative RIR and rounds to 0.5kg', () => {
      // 90 * (1 + (5 + 2) / 30) = 90 * 37 / 30 = 111.0
      expect(calculateE1rm(90, 5, 2)).toBe(111);
      // 122.5 * (1 + (5 + 1.5) / 30) = 122.5 * 36.5 / 30 = 149.0416... -> 149.0
      expect(calculateE1rm(122.5, 5, 1.5)).toBe(149);
      // Negative RIR clamped to 0: 100 * (1 + 3 / 30) = 110
      expect(calculateE1rm(100, 3, -1)).toBe(110);
    });
  });

  describe('extractCurrentLiftE1rms', () => {
    it('falls back to baseOneRm when no logs exist', () => {
      const result = extractCurrentLiftE1rms([], DEFAULT_USER_PROFILE.baseOneRm);
      expect(result).toEqual(DEFAULT_USER_PROFILE.baseOneRm);
    });

    it('ignores primer sets and incomplete sets, taking latest session peak per lift', () => {
      const logs: WeightSessionLog[] = [
        {
          id: 'w1',
          dateISO: '2026-11-03',
          dayKey: 'tue',
          cycleWeek: 1,
          title: '상체 A',
          exercises: [
            {
              exerciseId: 'bench_top',
              exerciseName: '벤치프레스 (탑세트)',
              role: 'top',
              liftKey: 'bench',
              usedAlternative: false,
              sets: [
                { setNumber: 1, weightKg: 90, actualReps: 5, rir: 2, completed: true },
              ],
            },
          ],
        },
        {
          id: 'w2',
          dateISO: '2026-11-07',
          dayKey: 'sat',
          cycleWeek: 1,
          title: '상체 B',
          exercises: [
            {
              exerciseId: 'speed_bench',
              exerciseName: '스피드 벤치프레스',
              role: 'primer',
              liftKey: 'bench',
              usedAlternative: false,
              sets: [
                { setNumber: 1, weightKg: 57.5, actualReps: 3, rir: null, completed: true },
              ],
            },
            {
              exerciseId: 'ohp_top',
              exerciseName: '오버헤드 프레스 (탑세트)',
              role: 'top',
              liftKey: 'ohp',
              usedAlternative: false,
              sets: [
                { setNumber: 1, weightKg: 55, actualReps: 5, rir: 2, completed: true },
                { setNumber: 2, weightKg: 999, actualReps: 5, rir: 2, completed: false },
              ],
            },
          ],
        },
      ];

      const result = extractCurrentLiftE1rms(logs, DEFAULT_USER_PROFILE.baseOneRm);
      expect(result.bench).toBe(111); // speed_bench primer did not overwrite bench_top
      expect(result.ohp).toBe(68); // 55 * (1 + 7/30) = 67.83 -> 68.0; incomplete 999kg ignored
      expect(result.squat).toBe(140);
      expect(result.deadlift).toBe(160);
    });
  });

  describe('build12WeekForecast', () => {
    it('uses baseline +0.33%/wk progression and computes DOTS when insufficient trend logs', () => {
      const forecast = build12WeekForecast({
        weightLogs: [],
        baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
        currentCycleWeek: 1,
        bodyweightKg: 65,
      });

      expect(forecast.hasEnoughTrendData).toBe(false);
      expect(forecast.currentSbdTotalKg).toBe(400);
      expect(forecast.dotsCurrent).toBe(317);
      expect(forecast.series.total.points).toHaveLength(13);

      // Week 6 (index 5) and Week 12 (index 11) in cycle week 1 start:
      // offset 0 -> cycleWeek 1, offset 5 -> cycleWeek 6 (deload), offset 11 -> cycleWeek 6 (deload)
      const p4 = forecast.series.bench.points[4]!;
      const p5 = forecast.series.bench.points[5]!;
      const p6 = forecast.series.bench.points[6]!;
      expect(p5.isDeloadWeek).toBe(true);
      expect(p5.projectedKg).toBe(p4.projectedKg); // 0x deload flattening
      // Post-deload step (index 6, cycleWeek 1) gets 1.35x slope jump > single normal step
      expect(p6.projectedKg - p5.projectedKg).toBeGreaterThanOrEqual(
        p4.projectedKg - forecast.series.bench.points[3]!.projectedKg,
      );
      expect(forecast.projected12WeekSbdTotalKg).toBeGreaterThan(
        forecast.currentSbdTotalKg,
      );
      expect(forecast.dotsProjected12Week).toBeGreaterThan(forecast.dotsCurrent);
    });

    it('uses OLS regression across >= 2 distinct weeks and clamps slope to [-1.0, 1.5]', () => {
      const extremeSpikeLogs: WeightSessionLog[] = [
        {
          id: 'l1',
          dateISO: '2026-11-03',
          dayKey: 'tue',
          cycleWeek: 1,
          title: '상체 A',
          exercises: [
            {
              exerciseId: 'bench_top',
              exerciseName: '벤치프레스 (탑세트)',
              role: 'top',
              liftKey: 'bench',
              usedAlternative: false,
              sets: [
                { setNumber: 1, weightKg: 80, actualReps: 5, rir: 2, completed: true },
              ],
            },
          ],
        },
        {
          id: 'l2',
          dateISO: '2026-11-10',
          dayKey: 'tue',
          cycleWeek: 2,
          title: '상체 A',
          exercises: [
            {
              exerciseId: 'bench_top',
              exerciseName: '벤치프레스 (탑세트)',
              role: 'top',
              liftKey: 'bench',
              usedAlternative: false,
              sets: [
                { setNumber: 1, weightKg: 110, actualReps: 5, rir: 2, completed: true },
              ],
            },
          ],
        },
      ];

      const forecast = build12WeekForecast({
        weightLogs: extremeSpikeLogs,
        baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
        currentCycleWeek: 2,
      });

      expect(forecast.hasEnoughTrendData).toBe(true);
      expect(forecast.series.bench.weeklySlopeKg).toBe(1.5);

      const extremeDropLogs: WeightSessionLog[] = [
        {
          id: 'd1',
          dateISO: '2026-11-03',
          dayKey: 'fri',
          cycleWeek: 1,
          title: '하체 A',
          exercises: [
            {
              exerciseId: 'squat_top',
              exerciseName: '백 스쿼트 (탑세트)',
              role: 'top',
              liftKey: 'squat',
              usedAlternative: false,
              sets: [
                { setNumber: 1, weightKg: 140, actualReps: 5, rir: 2, completed: true },
              ],
            },
          ],
        },
        {
          id: 'd2',
          dateISO: '2026-11-10',
          dayKey: 'fri',
          cycleWeek: 2,
          title: '하체 A',
          exercises: [
            {
              exerciseId: 'squat_top',
              exerciseName: '백 스쿼트 (탑세트)',
              role: 'top',
              liftKey: 'squat',
              usedAlternative: false,
              sets: [
                { setNumber: 1, weightKg: 100, actualReps: 5, rir: 2, completed: true },
              ],
            },
          ],
        },
      ];

      const dropForecast = build12WeekForecast({
        weightLogs: extremeDropLogs,
        baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
        currentCycleWeek: 2,
      });

      expect(dropForecast.series.squat.weeklySlopeKg).toBe(-1);
    });

    it('exposes chronological historyPoints for single lifts and SBD total', () => {
      const logs: WeightSessionLog[] = [
        {
          id: 'h1',
          dateISO: '2026-11-10',
          dayKey: 'tue',
          cycleWeek: 1,
          title: '상체 A',
          exercises: [
            {
              exerciseId: 'bench_top',
              exerciseName: '벤치프레스 (탑세트)',
              role: 'top',
              liftKey: 'bench',
              usedAlternative: false,
              sets: [{ setNumber: 1, weightKg: 90, actualReps: 5, rir: 2, completed: true }],
            },
          ],
        },
        {
          id: 'h2',
          dateISO: '2026-11-17',
          dayKey: 'tue',
          cycleWeek: 2,
          title: '상체 A',
          exercises: [
            {
              exerciseId: 'bench_top',
              exerciseName: '벤치프레스 (탑세트)',
              role: 'top',
              liftKey: 'bench',
              usedAlternative: false,
              sets: [{ setNumber: 1, weightKg: 92.5, actualReps: 5, rir: 2, completed: true }],
            },
          ],
        },
      ];

      const forecast = build12WeekForecast({
        weightLogs: logs,
        baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
        currentCycleWeek: 2,
      });

      expect(forecast.series.bench.historyPoints).toEqual([
        { dateISO: '2026-11-09', weekOffset: -1, actualKg: 111 },
        { dateISO: '2026-11-16', weekOffset: 0, actualKg: 114 },
      ]);
      expect(forecast.series.total.historyPoints).toEqual([
        { dateISO: '2026-11-09', weekOffset: -1, actualKg: 411 },
        { dateISO: '2026-11-16', weekOffset: 0, actualKg: 414 },
      ]);
    });

    it('widens confidence bounds monotonically over 12 weeks', () => {
      const forecast = build12WeekForecast({
        weightLogs: [],
        baseOneRm: DEFAULT_USER_PROFILE.baseOneRm,
        currentCycleWeek: 3,
      });

      const points = forecast.series.total.points;
      expect(points[0]!.upperBoundKg - points[0]!.lowerBoundKg).toBe(0);
      for (let i = 1; i < points.length; i += 1) {
        const prevBand = points[i - 1]!.upperBoundKg - points[i - 1]!.lowerBoundKg;
        const currBand = points[i]!.upperBoundKg - points[i]!.lowerBoundKg;
        expect(currBand).toBeGreaterThanOrEqual(prevBand);
        expect(points[i]!.lowerBoundKg).toBeLessThanOrEqual(points[i]!.projectedKg);
        expect(points[i]!.upperBoundKg).toBeGreaterThanOrEqual(points[i]!.projectedKg);
      }
    });
  });
});
