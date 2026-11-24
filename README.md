# 리프트로그 (Hybrid Powerbuilding)

F45 컨디셔닝과 주 4회 고중량 파워빌딩(8회 이하)을 6주 주기화(1~5주차 과부하, 6주차 자동 볼륨 디로드)로 함께 관리하는 개인 훈련 트래커예요. 오프라인 우선 PWA와 Capacitor 7 네이티브 Android 앱을 모두 지원해요.

## 바로 설치하기

- **웹 앱 (HTTPS PWA)**: https://gihwan-dev.github.io/hybrid-powerbuilding-pwa/
  - iPhone (Safari): 공유 버튼 -> 홈 화면에 추가
  - Android (Chrome): 메뉴 -> 앱 설치 또는 홈 화면에 추가
- **Android 설치 파일 (서명된 APK)**: https://github.com/gihwan-dev/hybrid-powerbuilding-pwa/releases/latest/download/power-hybrid-release.apk

## 주요 기능

- **오늘 탭 & 원-퍼넬 세트 기록**: 7일 주간 스트립, 자동 원판 계산(20kg 바 기준), 4단계 워밍업, `+`/`-` 스테퍼와 커스텀 숫자 키패드, RIR 입력, 백그라운드 시간차 기준 휴식 타이머와 차임벨·진동 알림을 제공해요.
- **대시보드**: 3대 합계 및 벤치·스쿼트·데드별 12주 e1RM 예측(신뢰구간 + 디로드 반동 모델), 0~100 신경계 피로도(CNS), 6개 근육군 주간 볼륨, 6주 주기화 타임라인 & DOTS 지수를 보여줘요.
- **AI 코치**: 최근 14일 훈련·피로·볼륨 요약 프롬프트를 원클릭으로 복사해 Claude/Gemini에 붙여넣거나, 개인 Gemini API 키를 연결해 앱 안에서 바로 3줄 요약을 받을 수 있어요.
- **백업 & 데이터 안전**: 로컬 스토리지(`apex400_state_v1`)에 Zod 스키마 검증 후 저장되며 JSON 내보내기·불러오기를 지원해요.

## 로컬 개발 및 검증

```bash
npm ci
npm test
npm run typecheck
npm run build
```
