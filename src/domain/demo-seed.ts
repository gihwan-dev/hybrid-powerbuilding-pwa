import { calculateE1rm } from './e1rm-engine';
import { addIsoDays, getDayKeyFromIsoDate, getMondayIsoDate } from './fatigue-engine';
import { DEFAULT_USER_PROFILE } from './routine-model-a';
import type {
  CycleWeek,
  F45SessionLog,
  RecoveryCheckLog,
  UserProfile,
  WeightSessionLog,
} from './types';

export interface DemoSeedState {
  userProfile: UserProfile;
  currentCycleWeek: CycleWeek;
  weightLogs: WeightSessionLog[];
  f45Logs: F45SessionLog[];
  recoveryLogs: RecoveryCheckLog[];
}

export function buildDemoSeedState(referenceDateISO: string): DemoSeedState {
  const currentMonday = getMondayIsoDate(referenceDateISO);
  const week1Monday = addIsoDays(currentMonday, -21);
  const week2Monday = addIsoDays(currentMonday, -14);
  const week3Monday = addIsoDays(currentMonday, -7);
  const week4Monday = currentMonday;

  const weightLogs: WeightSessionLog[] = [];
  const f45Logs: F45SessionLog[] = [];
  const recoveryLogs: RecoveryCheckLog[] = [];

  const pushIfPast = <T extends { dateISO: string }>(
    target: T[],
    item: T,
  ) => {
    if (item.dateISO < referenceDateISO) {
      target.push(item);
    }
  };

  interface WeekSpec {
    mondayISO: string;
    cycleWeek: CycleWeek;
    benchTop: number;
    benchTopReps: number;
    benchTopRir: number;
    benchBackoff: number;
    squatTop: number;
    squatTopReps: number;
    squatTopRir: number;
    squatBackoff: number;
    ohpTop: number;
    ohpTopReps: number;
    ohpBackoff: number;
    deadliftTop: number;
    deadliftTopReps: number;
    deadliftBackoff: number;
    f45MonRpe: number;
    f45WedRpe: number;
  }

  const weeks: WeekSpec[] = [
    {
      mondayISO: week1Monday,
      cycleWeek: 1,
      benchTop: 85,
      benchTopReps: 5,
      benchTopRir: 2,
      benchBackoff: 75,
      squatTop: 117.5,
      squatTopReps: 5,
      squatTopRir: 2,
      squatBackoff: 102.5,
      ohpTop: 52.5,
      ohpTopReps: 5,
      ohpBackoff: 45,
      deadliftTop: 137.5,
      deadliftTopReps: 4,
      deadliftBackoff: 117.5,
      f45MonRpe: 7,
      f45WedRpe: 7,
    },
    {
      mondayISO: week2Monday,
      cycleWeek: 2,
      benchTop: 87.5,
      benchTopReps: 5,
      benchTopRir: 2,
      benchBackoff: 77.5,
      squatTop: 120,
      squatTopReps: 5,
      squatTopRir: 2,
      squatBackoff: 105,
      ohpTop: 52.5,
      ohpTopReps: 6,
      ohpBackoff: 45,
      deadliftTop: 140,
      deadliftTopReps: 4,
      deadliftBackoff: 120,
      f45MonRpe: 8,
      f45WedRpe: 7,
    },
    {
      mondayISO: week3Monday,
      cycleWeek: 3,
      benchTop: 90,
      benchTopReps: 4,
      benchTopRir: 2,
      benchBackoff: 80,
      squatTop: 122.5,
      squatTopReps: 4,
      squatTopRir: 1.5,
      squatBackoff: 107.5,
      ohpTop: 55,
      ohpTopReps: 5,
      ohpBackoff: 47.5,
      deadliftTop: 142.5,
      deadliftTopReps: 3,
      deadliftBackoff: 122.5,
      f45MonRpe: 8,
      f45WedRpe: 7,
    },
    {
      mondayISO: week4Monday,
      cycleWeek: 4,
      benchTop: 90,
      benchTopReps: 5,
      benchTopRir: 2,
      benchBackoff: 80,
      squatTop: 122.5,
      squatTopReps: 5,
      squatTopRir: 2,
      squatBackoff: 107.5,
      ohpTop: 55,
      ohpTopReps: 6,
      ohpBackoff: 47.5,
      deadliftTop: 142.5,
      deadliftTopReps: 4,
      deadliftBackoff: 122.5,
      f45MonRpe: 7,
      f45WedRpe: 7,
    },
  ];

  for (const spec of weeks) {
    const monISO = spec.mondayISO;
    const tueISO = addIsoDays(monISO, 1);
    const wedISO = addIsoDays(monISO, 2);
    const thuISO = addIsoDays(monISO, 3);
    const friISO = addIsoDays(monISO, 4);
    const satISO = addIsoDays(monISO, 5);
    const sunISO = addIsoDays(monISO, 6);

    pushIfPast(f45Logs, {
      id: `demo_f45_mon_${monISO}`,
      dateISO: monISO,
      dayKey: getDayKeyFromIsoDate(monISO),
      classTitle: 'F45 하이브리드',
      rpe: spec.f45MonRpe,
      lowerBodyImpact: 'medium',
      durationMinutes: 45,
    });

    pushIfPast(weightLogs, {
      id: `demo_weight_tue_${tueISO}`,
      dateISO: tueISO,
      dayKey: getDayKeyFromIsoDate(tueISO),
      cycleWeek: spec.cycleWeek,
      title: '상체 A',
      durationMinutes: 65,
      exercises: [
        {
          exerciseId: 'bench_top',
          exerciseName: '벤치프레스 (탑세트)',
          role: 'top',
          liftKey: 'bench',
          usedAlternative: false,
          sets: [
            {
              setNumber: 1,
              weightKg: spec.benchTop,
              actualReps: spec.benchTopReps,
              rir: spec.benchTopRir,
              completed: true,
              e1rmKg: calculateE1rm(spec.benchTop, spec.benchTopReps, spec.benchTopRir),
            },
          ],
        },
        {
          exerciseId: 'bench_backoff',
          exerciseName: '벤치프레스 (백오프)',
          role: 'backoff',
          liftKey: 'bench',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: spec.benchBackoff,
            actualReps: 6,
            rir: 1.5,
            completed: true,
            e1rmKg: calculateE1rm(spec.benchBackoff, 6, 1.5),
          })),
        },
        {
          exerciseId: 'pendlay_row',
          exerciseName: '펜들레이 로우',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3, 4].map((setNumber) => ({
            setNumber,
            weightKg: 70,
            actualReps: 6,
            rir: 1.5,
            completed: true,
          })),
        },
        {
          exerciseId: 'incline_db_press',
          exerciseName: '인클라인 덤벨 프레스',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: 28,
            actualReps: 7,
            rir: 1,
            completed: true,
          })),
        },
        {
          exerciseId: 'weighted_chinup',
          exerciseName: '중량 친업',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: 10,
            actualReps: 6,
            rir: 1.5,
            completed: true,
          })),
        },
        {
          exerciseId: 'suitcase_carry',
          exerciseName: '원암 수트케이스 캐리',
          role: 'carry',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: 22,
            actualReps: 1,
            distanceMeters: 35,
            rir: null,
            completed: true,
          })),
        },
      ],
    });

    pushIfPast(f45Logs, {
      id: `demo_f45_wed_${wedISO}`,
      dateISO: wedISO,
      dayKey: getDayKeyFromIsoDate(wedISO),
      classTitle: 'F45 카디오',
      rpe: spec.f45WedRpe,
      lowerBodyImpact: 'low',
      durationMinutes: 45,
    });

    pushIfPast(recoveryLogs, {
      id: `demo_recovery_thu_${thuISO}`,
      dateISO: thuISO,
      dayKey: getDayKeyFromIsoDate(thuISO),
      checkedItemIds: ['sleep_7h', 'carb_loading', 'protein_145', 'creatine_5g'],
    });

    pushIfPast(weightLogs, {
      id: `demo_weight_fri_${friISO}`,
      dateISO: friISO,
      dayKey: getDayKeyFromIsoDate(friISO),
      cycleWeek: spec.cycleWeek,
      title: '하체 A',
      durationMinutes: 70,
      exercises: [
        {
          exerciseId: 'squat_top',
          exerciseName: '백 스쿼트 (탑세트)',
          role: 'top',
          liftKey: 'squat',
          usedAlternative: false,
          sets: [
            {
              setNumber: 1,
              weightKg: spec.squatTop,
              actualReps: spec.squatTopReps,
              rir: spec.squatTopRir,
              completed: true,
              e1rmKg: calculateE1rm(spec.squatTop, spec.squatTopReps, spec.squatTopRir),
            },
          ],
        },
        {
          exerciseId: 'squat_backoff',
          exerciseName: '백 스쿼트 (백오프)',
          role: 'backoff',
          liftKey: 'squat',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: spec.squatBackoff,
            actualReps: 6,
            rir: 1.5,
            completed: true,
            e1rmKg: calculateE1rm(spec.squatBackoff, 6, 1.5),
          })),
        },
        {
          exerciseId: 'rdl',
          exerciseName: '루마니안 데드리프트',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: 105,
            actualReps: 7,
            rir: 2,
            completed: true,
          })),
        },
        {
          exerciseId: 'bulgarian_split_squat',
          exerciseName: '불가리안 스플릿 스쿼트',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: 20,
            actualReps: 7,
            rir: 1,
            completed: true,
          })),
        },
        {
          exerciseId: 'hanging_leg_raise',
          exerciseName: '행잉 레그 레이즈',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: 0,
            actualReps: 7,
            rir: 1,
            completed: true,
          })),
        },
      ],
    });

    pushIfPast(weightLogs, {
      id: `demo_weight_sat_${satISO}`,
      dateISO: satISO,
      dayKey: getDayKeyFromIsoDate(satISO),
      cycleWeek: spec.cycleWeek,
      title: '상체 B',
      durationMinutes: 65,
      exercises: [
        {
          exerciseId: 'speed_bench',
          exerciseName: '스피드 벤치프레스',
          role: 'primer',
          liftKey: 'bench',
          usedAlternative: false,
          sets: [1, 2, 3, 4].map((setNumber) => ({
            setNumber,
            weightKg: 57.5,
            actualReps: 3,
            rir: null,
            completed: true,
          })),
        },
        {
          exerciseId: 'ohp_top',
          exerciseName: '오버헤드 프레스 (탑세트)',
          role: 'top',
          liftKey: 'ohp',
          usedAlternative: false,
          sets: [
            {
              setNumber: 1,
              weightKg: spec.ohpTop,
              actualReps: spec.ohpTopReps,
              rir: 1.5,
              completed: true,
              e1rmKg: calculateE1rm(spec.ohpTop, spec.ohpTopReps, 1.5),
            },
          ],
        },
        {
          exerciseId: 'ohp_backoff',
          exerciseName: '오버헤드 프레스 (백오프)',
          role: 'backoff',
          liftKey: 'ohp',
          usedAlternative: false,
          sets: [1, 2].map((setNumber) => ({
            setNumber,
            weightKg: spec.ohpBackoff,
            actualReps: 7,
            rir: 1.5,
            completed: true,
            e1rmKg: calculateE1rm(spec.ohpBackoff, 7, 1.5),
          })),
        },
        {
          exerciseId: 'weighted_pullup',
          exerciseName: '중량 풀업',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3, 4].map((setNumber) => ({
            setNumber,
            weightKg: 10,
            actualReps: 6,
            rir: 1.5,
            completed: true,
          })),
        },
        {
          exerciseId: 'weighted_dips',
          exerciseName: '중량 딥스',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: 15,
            actualReps: 7,
            rir: 1,
            completed: true,
          })),
        },
        {
          exerciseId: 'incline_curl_cable_ext',
          exerciseName: '인클라인 컬 + 케이블 익스텐션',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: 14,
            actualReps: 7,
            rir: 1,
            completed: true,
          })),
        },
      ],
    });

    pushIfPast(weightLogs, {
      id: `demo_weight_sun_${sunISO}`,
      dateISO: sunISO,
      dayKey: getDayKeyFromIsoDate(sunISO),
      cycleWeek: spec.cycleWeek,
      title: '하체 B',
      durationMinutes: 65,
      exercises: [
        {
          exerciseId: 'trapbar_jump',
          exerciseName: '트랩바 점프 (파워)',
          role: 'primer',
          usedAlternative: false,
          sets: [1, 2, 3, 4].map((setNumber) => ({
            setNumber,
            weightKg: 20,
            actualReps: 3,
            rir: null,
            completed: true,
          })),
        },
        {
          exerciseId: 'deadlift_top',
          exerciseName: '컨벤셔널 데드리프트 (탑세트)',
          role: 'top',
          liftKey: 'deadlift',
          usedAlternative: false,
          sets: [
            {
              setNumber: 1,
              weightKg: spec.deadliftTop,
              actualReps: spec.deadliftTopReps,
              rir: 2,
              completed: true,
              e1rmKg: calculateE1rm(spec.deadliftTop, spec.deadliftTopReps, 2),
            },
          ],
        },
        {
          exerciseId: 'deadlift_backoff',
          exerciseName: '컨벤셔널 데드리프트 (백오프)',
          role: 'backoff',
          liftKey: 'deadlift',
          usedAlternative: false,
          sets: [1, 2].map((setNumber) => ({
            setNumber,
            weightKg: spec.deadliftBackoff,
            actualReps: 5,
            rir: 2,
            completed: true,
            e1rmKg: calculateE1rm(spec.deadliftBackoff, 5, 2),
          })),
        },
        {
          exerciseId: 'single_leg_rdl',
          exerciseName: '원레그 덤벨 RDL',
          role: 'accessory',
          usedAlternative: false,
          sets: [1, 2, 3].map((setNumber) => ({
            setNumber,
            weightKg: 20,
            actualReps: 7,
            rir: 1,
            completed: true,
          })),
        },
        {
          exerciseId: 'farmers_walk',
          exerciseName: '파머스 워크',
          role: 'carry',
          usedAlternative: false,
          sets: [1, 2, 3, 4].map((setNumber) => ({
            setNumber,
            weightKg: 30,
            actualReps: 1,
            distanceMeters: 25,
            rir: null,
            completed: true,
          })),
        },
      ],
    });
  }

  return {
    userProfile: {
      ...DEFAULT_USER_PROFILE,
      baseOneRm: { ...DEFAULT_USER_PROFILE.baseOneRm },
    },
    currentCycleWeek: 4,
    weightLogs,
    f45Logs,
    recoveryLogs,
  };
}
