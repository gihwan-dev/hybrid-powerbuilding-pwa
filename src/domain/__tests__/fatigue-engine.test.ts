import { describe, expect, it } from 'vitest';
import {
  addIsoDays,
  calculateCnsFatigue,
  diffIsoDays,
  formatUtcDaysToIsoDate,
  getDayKeyFromIsoDate,
  getMondayIsoDate,
  parseIsoDateToUtcDays,
} from '../fatigue-engine';
import type { F45SessionLog, RecoveryCheckLog, WeightSessionLog } from '../types';

describe('fatigue-engine', () => {
  describe('UTC ISO date arithmetic', () => {
    it('parses, formats, adds, diffs, and computes weekday/Monday cleanly in UTC', () => {
      const days = parseIsoDateToUtcDays('2026-03-01');
      expect(formatUtcDaysToIsoDate(days)).toBe('2026-03-01');
      expect(addIsoDays('2024-02-28', 1)).toBe('2024-02-29'); // leap year
      expect(addIsoDays('2024-02-29', 1)).toBe('2024-03-01');
      expect(diffIsoDays('2026-11-20', '2026-11-25')).toBe(5);
      expect(getDayKeyFromIsoDate('2026-11-23')).toBe('mon');
      expect(getDayKeyFromIsoDate('2026-11-25')).toBe('wed');
      expect(getDayKeyFromIsoDate('2026-11-29')).toBe('sun');
      expect(getMondayIsoDate('2026-11-25')).toBe('2026-11-23');
      expect(getMondayIsoDate('2026-11-29')).toBe('2026-11-23');
    });
  });

  describe('calculateCnsFatigue', () => {
    it('returns base score 30 and optimal status when no logs exist', () => {
      const result = calculateCnsFatigue({
        referenceDateISO: '2026-11-25',
        cycleWeek: 2,
        weightLogs: [],
        f45Logs: [],
        recoveryLogs: [],
      });

      expect(result.score).toBe(30);
      expect(result.status).toBe('optimal');
      expect(result.shouldSuggestBackoffTrim).toBe(false);
      expect(result.factors).toHaveLength(0);
    });

    it('adds recent F45 RPE + leg impact within 0..3 days and ignores 4+ days ago', () => {
      const f45Logs: F45SessionLog[] = [
        {
          id: 'f1',
          dateISO: '2026-11-23', // 2 days ago
          dayKey: 'mon',
          classTitle: 'F45 하이브리드',
          rpe: 9,
          lowerBodyImpact: 'high',
        },
        {
          id: 'f2',
          dateISO: '2026-11-20', // 5 days ago -> ignored
          dayKey: 'fri',
          classTitle: 'F45 카디오',
          rpe: 10,
          lowerBodyImpact: 'high',
        },
      ];

      const result = calculateCnsFatigue({
        referenceDateISO: '2026-11-25',
        cycleWeek: 3,
        weightLogs: [],
        f45Logs,
        recoveryLogs: [],
      });

      // Base 30 + round(9 * 2.2) = 20 + high(6) = 56
      expect(result.score).toBe(56);
      expect(result.status).toBe('caution');
      expect(result.shouldSuggestBackoffTrim).toBe(false);
    });

    it('detects high CNS overload (>= 80) from heavy low-RIR weights, F45, and 4+ consecutive days', () => {
      const makeWeightDay = (id: string, dateISO: string, dayKey: 'sat' | 'sun' | 'tue'): WeightSessionLog => ({
        id,
        dateISO,
        dayKey,
        cycleWeek: 4,
        title: '훈련',
        exercises: [
          {
            exerciseId: 'squat_top',
            exerciseName: '백 스쿼트 (탑세트)',
            role: 'top',
            liftKey: 'squat',
            usedAlternative: false,
            sets: [{ setNumber: 1, weightKg: 125, actualReps: 4, rir: 0, completed: true }],
          },
        ],
      });

      const weightLogs: WeightSessionLog[] = [
        makeWeightDay('w1', '2026-11-21', 'sat'),
        makeWeightDay('w2', '2026-11-22', 'sun'),
        makeWeightDay('w3', '2026-11-24', 'tue'),
      ];

      const f45Logs: F45SessionLog[] = [
        {
          id: 'f1',
          dateISO: '2026-11-23', // mon -> sat/sun/mon/tue/wed = 5 consecutive days!
          dayKey: 'mon',
          classTitle: 'F45 하이브리드',
          rpe: 9,
          lowerBodyImpact: 'high',
        },
        {
          id: 'f2',
          dateISO: '2026-11-25', // wed
          dayKey: 'wed',
          classTitle: 'F45 카디오',
          rpe: 8,
          lowerBodyImpact: 'medium',
        },
      ];

      const result = calculateCnsFatigue({
        referenceDateISO: '2026-11-25',
        cycleWeek: 4,
        weightLogs,
        f45Logs,
        recoveryLogs: [],
      });

      // Base 30 + f1(26) + f2(20) + avgRIR=0(+18) + streak5(+8) -> 102 -> clamped 100
      expect(result.score).toBe(100);
      expect(result.status).toBe('overload');
      expect(result.shouldSuggestBackoffTrim).toBe(true);
    });

    it('applies recovery checklist reduction (-5 per item max -20) and Week 6 deload (-10)', () => {
      const recoveryLogs: RecoveryCheckLog[] = [
        {
          id: 'r1',
          dateISO: '2026-11-24',
          dayKey: 'thu',
          checkedItemIds: ['sleep_7h', 'carb_loading', 'protein_145', 'creatine_5g', 'extra_ignored_cap'],
        },
      ];

      const result = calculateCnsFatigue({
        referenceDateISO: '2026-11-25',
        cycleWeek: 6,
        weightLogs: [],
        f45Logs: [],
        recoveryLogs,
      });

      // Base 30 - 20 (max recovery cap) - 10 (week 6 deload) = 0
      expect(result.score).toBe(0);
      expect(result.status).toBe('optimal');
    });
  });
});
