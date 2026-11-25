import { BarChart3, Dumbbell, Smartphone, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toast } from './components/ui';
import { CoachView } from './features/coach';
import { DashboardView } from './features/dashboard';
import { SettingsDrawer } from './features/settings';
import {
  SessionCompleteView,
  TodayView,
  WorkoutSessionOverlay,
} from './features/today';
import { useWorkoutStore } from './store/workout-store';

type AppTab = 'today' | 'dashboard' | 'coach';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const APK_DOWNLOAD_URL =
  'https://github.com/gihwan-dev/hybrid-powerbuilding-pwa/releases/latest/download/power-hybrid-release.apk';

const NAV_ITEMS: readonly {
  id: AppTab;
  label: string;
  Icon: typeof Dumbbell;
}[] = [
  { id: 'today', label: '오늘', Icon: Dumbbell },
  { id: 'dashboard', label: '대시보드', Icon: BarChart3 },
  { id: 'coach', label: '코치', Icon: Sparkles },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const isWorkoutOverlayOpen = useWorkoutStore((s) => s.isWorkoutOverlayOpen);
  const lastCompletedSummary = useWorkoutStore((s) => s.lastCompletedSummary);
  const dismissCompletedSummary = useWorkoutStore(
    (s) => s.dismissCompletedSummary,
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return;
    try {
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
    } catch {
      // Ignore user cancellation or browser prompt errors
    } finally {
      setDeferredInstallPrompt(null);
    }
  };

  const showBottomNav = !isWorkoutOverlayOpen && !lastCompletedSummary;
  const effectiveSettingsOpen = isSettingsOpen && !isWorkoutOverlayOpen;
  const isBackgroundInert = isWorkoutOverlayOpen || effectiveSettingsOpen;

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  return (
    <div className="min-h-dvh bg-[#F2F4F6] text-[#191F28]">
      <div
        inert={isBackgroundInert || undefined}
        aria-hidden={isBackgroundInert || undefined}
      >
        <div className="mx-auto flex w-full max-w-4xl items-start justify-center gap-8 lg:px-6">
          <div className="w-full max-w-md min-w-0 flex-1">
            {lastCompletedSummary ? (
              <SessionCompleteView
                summary={lastCompletedSummary}
                onGoCoach={() => {
                  dismissCompletedSummary();
                  setActiveTab('coach');
                }}
                onDone={dismissCompletedSummary}
              />
            ) : activeTab === 'today' ? (
              <TodayView onOpenSettings={handleOpenSettings} />
            ) : activeTab === 'dashboard' ? (
              <DashboardView onOpenSettings={handleOpenSettings} />
            ) : (
              <CoachView onOpenSettings={handleOpenSettings} />
            )}
          </div>

          <aside
            aria-label="모바일 앱 설치 안내"
            className="hidden w-80 shrink-0 pt-6 lg:flex lg:flex-col"
          >
            <div className="rounded-[24px] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-4">
              <div className="space-y-1.5">
                <h2 className="text-[18px] font-bold tracking-tight text-[#191F28]">
                  모바일에서 더 편하게 기록해요
                </h2>
                <p className="text-[13px] leading-relaxed text-[#4E5968]">
                  리프트로그는 체육관에서 한 손으로 빠르게 세트를 완료하도록 모바일 화면에 맞춰 설계했어요.
                </p>
              </div>

              <div className="divide-y divide-[#F2F4F6] border-t border-[#F2F4F6] pt-3 text-[13px] leading-relaxed">
                <div className="pb-3">
                  <p className="font-bold text-[#191F28]">iPhone (Safari)</p>
                  <p className="mt-0.5 text-[#4E5968]">
                    하단 공유 버튼을 누른 뒤 홈 화면에 추가를 선택하면 앱처럼 바로 열 수 있어요.
                  </p>
                </div>
                <div className="pt-3">
                  <p className="font-bold text-[#191F28]">Android (Chrome)</p>
                  <p className="mt-0.5 text-[#4E5968]">
                    브라우저 메뉴에서 앱 설치를 누르거나 아래 APK 파일로 설치할 수 있어요.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {deferredInstallPrompt ? (
                  <button
                    type="button"
                    onClick={() => void handleInstallPwa()}
                    className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#1B64DA] px-4 text-[14px] font-bold text-white hover:bg-[#1552B8] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
                  >
                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                    <span>홈 화면에 앱 설치하기</span>
                  </button>
                ) : null}

                <a
                  href={APK_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#E8F3FF] px-4 text-[14px] font-bold text-[#1B64DA] hover:bg-[#D5E8FF] active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6]"
                >
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                  <span>Android 설치 파일(APK) 받기</span>
                </a>
              </div>
            </div>
          </aside>
        </div>

        {showBottomNav ? (
          <nav
            aria-label="주요 메뉴"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E8EB]/80 bg-white/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,0px)]"
          >
            <div className="mx-auto grid max-w-md grid-cols-3 gap-1 px-2 py-1.5">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setActiveTab(id)}
                    className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[14px] px-2 py-1 text-[12px] font-semibold active:scale-[0.97] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3182F6] ${
                      isActive
                        ? 'text-[#1B64DA]'
                        : 'text-[#4E5968] hover:text-[#191F28]'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}
      </div>

      <SettingsDrawer
        open={effectiveSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        canInstallPwa={Boolean(deferredInstallPrompt)}
        onInstallPwa={() => void handleInstallPwa()}
      />

      {isWorkoutOverlayOpen ? <WorkoutSessionOverlay /> : null}

      <Toast />
    </div>
  );
}
