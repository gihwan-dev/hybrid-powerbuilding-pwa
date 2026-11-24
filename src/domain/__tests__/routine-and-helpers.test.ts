import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_FOCUS_TOPICS, buildAiCoachingPrompt } from '../ai-prompt-builder';
import { buildDemoSeedState } from '../demo-seed';
import { build12WeekForecast } from '../e1rm-engine';
import { calculateCnsFatigue, getDayKeyFromIsoDate, getMondayIsoDate } from '../fatigue-engine';
import { calculateDotsScore, clamp, roundTo2_5, roundToHalf } from '../math';
import { calculatePlateBreakdown } from '../plate-calculator';
import {
  DAY_ORDER,
  DEFAULT_USER_PROFILE,
  getAllWeightExercises,
  ROUTINE_DAYS,
  scaleInitialWeightForOneRm,
} from '../routine-model-a';
import { calculateWeeklyMuscleVolume } from '../volume-engine';
import { buildWarmupSets } from '../warmup-builder';

describe('math utilities', () => {
  it('rounds to 2.5kg and 0.5kg without -0 artifacts', () => {
    expect(roundTo2_5(81.4)).toBe(82.5);
    expect(roundTo2_5(107.8)).toBe(107.5);
    expect(Object.is(roundTo2_5(-0), 0)).toBe(true);
    expect(roundToHalf(111.24)).toBe(111);
    expect(roundToHalf(111.26)).toBe(111.5);
    expect(Object.is(roundToHalf(-0), 0)).toBe(true);
    expect(Object.is(clamp(-0, 0, 100), 0)).toBe(true);
  });

  it('computes male IPF DOTS accurately', () => {
    expect(calculateDotsScore(65, 400)).toBe(317);
    expect(calculateDotsScore(0, 400)).toBe(0);
    expect(calculateDotsScore(65, 0)).toBe(0);
  });
});

describe('routine-model-a invariants', () => {
  it('matches DEFAULT_USER_PROFILE and 7-day structure', () => {
    expect(DEFAULT_USER_PROFILE).toEqual({
      heightCm: 164,
      weightKg: 65,
      bodyFatPct: 15,
      baseOneRm: { bench: 100, squat: 140, deadlift: 160, ohp: 65 },
    });
    expect(DAY_ORDER).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    expect(ROUTINE_DAYS.thu.recoveryChecklist).toHaveLength(4);
  });

  it('keeps repsMax <= 8 on every weight exercise', () => {
    const allExercises = getAllWeightExercises();
    expect(allExercises.length).toBeGreaterThan(15);
    for (const ex of allExercises) {
      expect(ex.repsMax).toBeLessThanOrEqual(8);
    }
  });

  it('preserves exact default weights when scaling with DEFAULT_USER_PROFILE', () => {
    for (const ex of getAllWeightExercises()) {
      expect(scaleInitialWeightForOneRm(ex, DEFAULT_USER_PROFILE.baseOneRm)).toBe(
        ex.defaultWeightKg,
      );
    }
  });
});

describe('plate-calculator & warmup-builder', () => {
  it('breaks down barbell weights greedily with 20kg bar', () => {
    const p90 = calculatePlateBreakdown(90);
    expect(p90.isExact).toBe(true);
    expect(p90.perSideWeightKg).toBe(35);
    expect(p90.platesPerSide).toEqual([
      { weightKg: 25, pairs: 1 },
      { weightKg: 10, pairs: 1 },
    ]);

    const p142_5 = calculatePlateBreakdown(142.5);
    expect(p142_5.isExact).toBe(true);
    expect(p142_5.perSideWeightKg).toBe(61.25);
    expect(p142_5.platesPerSide).toEqual([
      { weightKg: 25, pairs: 2 },
      { weightKg: 10, pairs: 1 },
      { weightKg: 1.25, pairs: 1 },
    ]);

    const pNonExact = calculatePlateBreakdown(61);
    expect(pNonExact.isExact).toBe(false);
    expect(pNonExact.achievableTotalKg).toBe(60);
    expect(pNonExact.remainderKg).toBe(1);

    const p20 = calculatePlateBreakdown(20);
    expect(p20.isBarOnly).toBe(true);
    expect(p20.isExact).toBe(true);
  });

  it('builds strictly increasing warmup sets below working weight', () => {
    expect(buildWarmupSets(20)).toEqual([]);
    const warmups = buildWarmupSets(122.5);
    expect(warmups.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < warmups.length; i += 1) {
      const current = warmups[i]!;
      expect(current.weightKg).toBeLessThan(122.5);
      expect(current.plateBreakdown).not.toBeNull();
      if (i > 0) {
        expect(current.weightKg).toBeGreaterThan(warmups[i - 1]!.weightKg);
      }
    }
  });
});

describe('volume-engine, ai-prompt-builder, and demo-seed', () => {
  it('calculates weekly muscle volume and builds clean Korean AI prompts without em dashes', () => {
    const refDate = '2026-11-25';
    const seed = buildDemoSeedState(refDate);

    expect(seed.weightLogs.length).toBeGreaterThanOrEqual(12);
    for (const log of seed.weightLogs) {
      expect(log.dateISO < refDate).toBe(true);
      expect(log.dayKey).toBe(getDayKeyFromIsoDate(log.dateISO));
    }
    for (const f45 of seed.f45Logs) {
      expect(f45.dateISO < refDate).toBe(true);
    }

    const weekStartISO = getMondayIsoDate(refDate);
    const volume = calculateWeeklyMuscleVolume({
      weekStartISO,
      weightLogs: seed.weightLogs,
    });
    expect(volume).toHaveLength(6);

    const deloadVolume = calculateWeeklyMuscleVolume({
      weekStartISO,
      weightLogs: seed.weightLogs,
      cycleWeek: 6,
    });
    expect(deloadVolume[0]?.targetMinSets).toBe(5);
    expect(deloadVolume[0]?.targetMaxSets).toBe(7);

    const cns = calculateCnsFatigue({
      referenceDateISO: refDate,
      cycleWeek: seed.currentCycleWeek,
      weightLogs: seed.weightLogs,
      f45Logs: seed.f45Logs,
      recoveryLogs: seed.recoveryLogs,
    });

    const forecast = build12WeekForecast({
      weightLogs: seed.weightLogs,
      baseOneRm: seed.userProfile.baseOneRm,
      currentCycleWeek: seed.currentCycleWeek,
    });

    for (const topic of AI_FOCUS_TOPICS) {
      const prompt = buildAiCoachingPrompt({
        referenceDateISO: refDate,
        cycleWeek: seed.currentCycleWeek,
        profile: seed.userProfile,
        cnsFatigue: cns,
        forecast,
        weeklyVolume: volume,
        recentWeightLogs: seed.weightLogs,
        recentF45Logs: seed.f45Logs,
        recentRecoveryLogs: seed.recoveryLogs,
        focusTopic: topic.id,
      });

      expect(prompt).toContain(topic.label);
      expect(prompt).not.toContain('—');
      expect(prompt).not.toContain('–');
      expect(prompt).not.toContain('· · ·');
      expect(prompt).not.toMatch(/하체 부하 (low|medium|high)/);
    }

    const multiPrompt = buildAiCoachingPrompt({
      referenceDateISO: refDate,
      cycleWeek: seed.currentCycleWeek,
      profile: seed.userProfile,
      cnsFatigue: cns,
      forecast,
      weeklyVolume: volume,
      recentWeightLogs: seed.weightLogs,
      recentF45Logs: seed.f45Logs,
      recentRecoveryLogs: seed.recoveryLogs,
      focusTopics: ['strength_plateau', 'f45_fatigue'],
    });
    expect(multiPrompt).toContain('1. [다음 주 중량 조정]');
    expect(multiPrompt).toContain('2. [F45 피로도 관리]');
  });

  it('guarantees zero React/DOM references and zero em dashes across all src/domain/*.ts files', () => {
    const domainDir = join(__dirname, '..');
    const files = readdirSync(domainDir).filter((file) => file.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(10);

    const forbiddenPatterns = [
      /\breact\b/i,
      /\breact-dom\b/i,
      /\blucide-react\b/i,
      /\bframer-motion\b/i,
      /\bwindow\b/,
      /\bdocument\b/,
      /\bnavigator\b/,
      /\blocalStorage\b/,
      /—/,
      /· · ·/,
    ];

    for (const file of files) {
      const content = readFileSync(join(domainDir, file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(content, `${file} matched forbidden pattern ${pattern}`).not.toMatch(
          pattern,
        );
      }
    }
  });
});
