import { clamp } from './math';
import type {
  CnsFatigueFactor,
  CnsFatigueResult,
  CycleWeek,
  DayKey,
  F45SessionLog,
  RecoveryCheckLog,
  WeightSessionLog,
} from './types';

const MS_PER_DAY = 86_400_000;

const UTC_DAY_TO_KEY: readonly DayKey[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

export function parseIsoDateToUtcDays(dateISO: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO.trim());
  if (!match) {
    throw new Error(`Invalid ISO date string: ${dateISO}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day);
  return Math.floor(utcMs / MS_PER_DAY);
}

export function formatUtcDaysToIsoDate(utcDays: number): string {
  const date = new Date(utcDays * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function diffIsoDays(fromISO: string, toISO: string): number {
  return parseIsoDateToUtcDays(toISO) - parseIsoDateToUtcDays(fromISO);
}

export function addIsoDays(dateISO: string, deltaDays: number): string {
  return formatUtcDaysToIsoDate(parseIsoDateToUtcDays(dateISO) + deltaDays);
}

export function getDayKeyFromIsoDate(dateISO: string): DayKey {
  const utcDays = parseIsoDateToUtcDays(dateISO);
  const jsWeekday = new Date(utcDays * MS_PER_DAY).getUTCDay();
  const dayKey = UTC_DAY_TO_KEY[jsWeekday];
  return dayKey ?? 'mon';
}

export function getMondayIsoDate(dateISO: string): string {
  const utcDays = parseIsoDateToUtcDays(dateISO);
  const jsWeekday = new Date(utcDays * MS_PER_DAY).getUTCDay();
  const daysSinceMonday = (jsWeekday + 6) % 7;
  return formatUtcDaysToIsoDate(utcDays - daysSinceMonday);
}

export interface CalculateCnsFatigueInput {
  referenceDateISO: string;
  cycleWeek: CycleWeek;
  weightLogs: WeightSessionLog[];
  f45Logs: F45SessionLog[];
  recoveryLogs: RecoveryCheckLog[];
}

export function calculateCnsFatigue(
  input: CalculateCnsFatigueInput,
): CnsFatigueResult {
  const { referenceDateISO, cycleWeek, weightLogs, f45Logs, recoveryLogs } = input;
  const referenceDays = parseIsoDateToUtcDays(referenceDateISO);

  let rawScore = 30;
  const factors: CnsFatigueFactor[] = [];

  // 1. Recent F45 sessions within 0..3 days
  const sortedF45 = [...f45Logs].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  for (const f45 of sortedF45) {
    const f45Days = parseIsoDateToUtcDays(f45.dateISO);
    const deltaDays = referenceDays - f45Days;
    if (deltaDays < 0 || deltaDays > 3) continue;

    const rpeScore = Math.round(clamp(f45.rpe, 1, 10) * 2.2);
    const legPenalty =
      f45.lowerBodyImpact === 'high'
        ? 6
        : f45.lowerBodyImpact === 'medium'
          ? 2
          : 0;
    const f45Delta = rpeScore + legPenalty;
    rawScore += f45Delta;

    const impactNote =
      f45.lowerBodyImpact === 'high'
        ? '하체 고부하'
        : f45.lowerBodyImpact === 'medium'
          ? '하체 중간 부하'
          : '하체 저부하';

    factors.push({
      id: `f45_${f45.id}`,
      label: `${f45.classTitle} (${deltaDays === 0 ? '오늘' : `${deltaDays}일 전`})`,
      delta: f45Delta,
      impact: 'increase',
      detail: `RPE ${f45.rpe} 및 ${impactNote} 자극으로 피로가 반영됐어요`,
    });
  }

  // 2. Recent heavy weight sessions within 0..6 days with avg RIR < 1.0
  const recentRirs: number[] = [];
  for (const log of weightLogs) {
    const logDays = parseIsoDateToUtcDays(log.dateISO);
    const deltaDays = referenceDays - logDays;
    if (deltaDays < 0 || deltaDays > 6) continue;

    for (const ex of log.exercises) {
      for (const set of ex.sets) {
        if (!set.completed || set.rir === null) continue;
        recentRirs.push(set.rir);
      }
    }
  }

  if (recentRirs.length > 0) {
    const avgRir = recentRirs.reduce((sum, rir) => sum + rir, 0) / recentRirs.length;
    if (avgRir < 1.0) {
      const rirDelta = clamp(Math.round(18 - clamp(avgRir, 0, 1) * 8), 10, 18);
      rawScore += rirDelta;
      factors.push({
        id: 'low_rir_intensity',
        label: `최근 웨이트 평균 RIR ${avgRir.toFixed(1)}`,
        delta: rirDelta,
        impact: 'increase',
        detail: '한계 지점(RIR 1 미만)에 가까운 고강도 세트가 누적됐어요',
      });
    }
  }

  // 3. Consecutive training streak >= 4 days (weight + F45)
  const trainedDays = new Set<number>();
  for (const log of weightLogs) {
    const d = parseIsoDateToUtcDays(log.dateISO);
    if (d <= referenceDays) trainedDays.add(d);
  }
  for (const f45 of f45Logs) {
    const d = parseIsoDateToUtcDays(f45.dateISO);
    if (d <= referenceDays) trainedDays.add(d);
  }

  let streak = 0;
  let cursorDay = trainedDays.has(referenceDays) ? referenceDays : referenceDays - 1;
  while (trainedDays.has(cursorDay)) {
    streak += 1;
    cursorDay -= 1;
  }

  if (streak >= 4) {
    rawScore += 8;
    factors.push({
      id: 'consecutive_training_days',
      label: `연속 훈련 ${streak}일`,
      delta: 8,
      impact: 'increase',
      detail: '4일 이상 연속 훈련으로 신경계 피로가 쌓였어요',
    });
  }

  // 4. Recovery checklist completion within 0..6 days
  const uniqueCheckedIds = new Set<string>();
  for (const recovery of recoveryLogs) {
    const recDays = parseIsoDateToUtcDays(recovery.dateISO);
    const deltaDays = referenceDays - recDays;
    if (deltaDays < 0 || deltaDays > 6) continue;
    for (const itemId of recovery.checkedItemIds) {
      uniqueCheckedIds.add(itemId);
    }
  }

  if (uniqueCheckedIds.size > 0) {
    const recoveryDelta = -Math.min(20, uniqueCheckedIds.size * 5);
    rawScore += recoveryDelta;
    factors.push({
      id: 'recovery_checklist',
      label: `회복 체크 ${uniqueCheckedIds.size}개 완료`,
      delta: recoveryDelta,
      impact: 'decrease',
      detail: '수면과 영양 관리로 중추신경계 피로를 낮췄어요',
    });
  }

  // 5. Week 6 Deload reduction
  if (cycleWeek === 6) {
    rawScore -= 10;
    factors.push({
      id: 'cycle_week_6_deload',
      label: '6주차 디로드 주간',
      delta: -10,
      impact: 'decrease',
      detail: '볼륨과 강도를 낮추는 디로드 주간이라 피로 부담이 줄어요',
    });
  }

  const score = clamp(Math.round(rawScore), 0, 100);
  const shouldSuggestBackoffTrim = score >= 80;

  if (score >= 80) {
    return {
      score,
      status: 'overload',
      statusLabel: '고피로 주의',
      headline: '신경계 피로가 높은 편이에요',
      advice: '오늘은 백오프 1세트를 줄이고 탑세트 RIR 여유를 꼭 남겨 주세요',
      shouldSuggestBackoffTrim,
      factors,
    };
  }

  if (score >= 55) {
    return {
      score,
      status: 'caution',
      statusLabel: '피로 보통',
      headline: '적정 범위 안에서 피로가 쌓이고 있어요',
      advice: '워밍업과 휴식 시간을 넉넉히 지키며 목표 RIR을 맞춰 진행해요',
      shouldSuggestBackoffTrim,
      factors,
    };
  }

  return {
    score,
    status: 'optimal',
    statusLabel: '컨디션 최적',
    headline: '고중량 탑세트를 시도하기 좋은 상태예요',
    advice: '계획된 중량과 목표 RIR을 자신 있게 밀어붙여 보세요',
    shouldSuggestBackoffTrim,
    factors,
  };
}
