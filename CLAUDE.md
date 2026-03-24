# CutSense — AI 시연영상 자동 편집기

> 이 파일은 AI 세션 간 맥락을 유지하기 위한 약속 파일입니다.
> 새 세션에서 이 프로젝트를 이어서 작업할 때 반드시 이 파일을 먼저 읽어주세요.

---

## 프로젝트 정체성

- **이름**: CutSense
- **한줄 요약**: 음성 없는 화면 캡처 영상을 AI Vision이 보고 자막을 자동 생성하는 편집기
- **차별점**: 기존 편집기(CapCut, Vrew, DaVinci)는 음성→텍스트(STT) 기반. CutSense는 화면만 보고 자막 생성 — 이 기능은 현존하는 편집기에 없음
- **제작자**: 류병수 (크몽 계정: 4B나무), 48세, 사출금형 설계 23년 경력
- **용도**: 크몽 포트폴리오(AITM, StockScanner, Persilotto) 시연 영상 자동 편집
- **개발 방식**: 사용자(비전공 독학 개발자) + AI 협업, "AI 헤게모니 방법론" 적용

---

## 기술 스택

- **백엔드**: FastAPI (Python 3.10+), uvicorn
- **프론트엔드**: React 18 (CDN), Babel standalone (컴포넌트 외부 파일 로딩), Tailwind CSS CDN
- **UI 테마**: Android Studio Darcula (#2B2B2B, #3C3F41, #CC7832, #A9B7C6)
- **폰트**: Happiness Sans (현대 해피니스 산스, CDN woff2)
- **PWA**: manifest.json + Service Worker → 크롬 설치 가능
- **영상 처리**: FFmpeg (subprocess 직접 호출, Windows 호환)
- **AI**: Anthropic Claude Vision API (2-Pass 분석) / xAI Grok Vision API
- **포트**: 9000 (8000은 AITM 프로젝트가 선점)
- **실행**: start.bat → venv 자동 생성 → 의존성 설치 → uvicorn 실행

---

## 폴더 구조

```
cutsense/
├── backend/
│   ├── main.py              # FastAPI 서버 (엔드포인트 16개+)
│   ├── ai_service.py        # AI 서비스 (2-Pass Vision 분석)
│   ├── video_processor.py   # FFmpeg 영상 처리 (subprocess)
│   └── requirements.txt     # >= 버전 핀닝
├── frontend/
│   ├── index.html           # 메인 셸 (~370줄, CSS + 컴포넌트 로딩)
│   ├── manifest.json        # PWA 매니페스트
│   ├── sw.js                # Service Worker (network-first)
│   ├── icons/               # PWA 아이콘 (192x192, 512x512)
│   └── components/          # React 컴포넌트 (Babel standalone)
│       ├── App.js           # 메인 앱 (~1700줄, 상태 관리 + 핸들러)
│       ├── MenuBar.js       # 풀다운 메뉴바 (파일/편집/보기/AI/도움말)
│       ├── EditTab.js       # ✂️ 편집 탭 (프리뷰, 미세조절, 스톱워치)
│       ├── SubtitleTab.js   # 💬 자막 탭
│       ├── AITab.js         # 🤖 AI 탭
│       ├── ExportTab.js     # 📦 내보내기 탭 (커스텀 파일명)
│       ├── Timeline.js      # 타임라인 컴포넌트
│       ├── SettingsModal.js # 설정 모달
│       └── Toast.js         # 토스트 알림
├── uploads/                 # 업로드 영상 + 자막 JSON + 내보내기 결과
├── projects/                # 프로젝트 저장 (JSON)
├── code-review/             # 타 AI 검증용 소스 복사본 + 리뷰 결과
├── 타 ai 리뷰/              # Claude Opus, Gemini 리뷰 결과
├── start.bat                # Windows 실행 (debug.log 생성)
├── push.bat                 # git add -A → commit → push origin master
├── config.json              # AI 설정 (API 키 포함 — .gitignore 필수)
└── CLAUDE.md                # 이 파일
```

---

## 핵심 UX: 마우스 인터랙션 모델 (확정)

### 마우스 + 키보드 매핑
| 입력 | 동작 |
|------|------|
| **좌클릭 1번째** | 제거 구간 시작 (Cut START) + 스톱워치 시작 |
| **좌클릭 2번째** | 제거 구간 끝 (Cut END) + 스톱워치 점멸 2초 |
| **우클릭** | 배속 순환 (1.0 → 0.5 → 0.3 → 0.25 → 1.0) |
| **← →** | 5초 점프 |
| **Space** | 재생/일시정지 |
| **더블클릭** | 사용하지 않음 (제거됨) |

### 컷 로직 = "제거" 방식 (중요!)
- **사용자가 찍은 구간 = 잘라서 버릴 부분**
- 나머지가 살아남아서 합쳐짐
- `invertSegments()` 함수로 삭제→보존 구간 반전 후 백엔드 전송
- 예: 60초 영상에서 10~20초, 35~45초 찍으면 → 0~10, 20~35, 45~60이 결과물

### 컷 스톱워치
- 컷 진행 중: 빨간 배경 `✂ 0.0s` 실시간 카운트 (50ms 간격)
- 컷 완료: 초록 배경 `✓ 3.2s` 점멸 2초 후 사라짐
- `pointerEvents: none` — 점멸 중에도 다음 컷 즉시 가능

### 프리뷰 재생 시스템
- 편집 탭의 ▶ Preview 버튼으로 보존될 구간만 순서대로 재생
- 프리뷰 중 타임라인 클릭 → 해당 보존 구간부터 프리뷰 이어가기 (중지 아님)
- 프리뷰 중 좌클릭 → 가장 가까운 컷 경계로 스냅 이동
- 프리뷰 중 Space/재생버튼 → 프리뷰 중지 후 일반 모드
- 각 구간 펼치면 ▶ 이 구간만 재생 버튼

### 구간 미세 조절
- 각 구간 클릭하면 아코디언 펼침
- Start/End 각각 ±1s, ±0.1s 버튼
- 조절 시 비디오도 해당 시간으로 자동 이동

---

## 프로젝트 시스템

### 프로젝트 생성 게이트
- 영상을 넣으려면 프로젝트가 필수 (드래그/클릭 → 프로젝트 없으면 모달 팝업)
- 모달: 프로젝트 이름 입력 + Single/Multi 선택
- 프로젝트 패널: 상태바 프로젝트명 클릭 또는 메뉴 → 오른쪽 슬라이드 패널

### 자동 저장 + F5 복원
- **자동 저장**: 2초 debounce, projectName/segments/subtitles/videoList/activeVideoIndex 변경 감지
- **F5 복원**: 페이지 로드 시 프로젝트 목록 → updated_at 최신순 → 자동 복원
- 복원은 inline fetch (handleOpenProject 클로저 문제 방지)

### 멀티 영상
- videoList 배열로 관리, 드래그로 순서 변경 가능
- 영상 전환 시 현재 영상의 cuts/subtitles를 videoList에 저장 후 전환

---

## 내보내기 파이프라인

### 3단계 Export (확정)
1. **구간 제거**: segments → invertSegments() → 보존 구간만 cut API로 추출
2. **자막 입히기**: subtitles → burn API로 자막 오버레이
3. **최종 인코딩**: format + quality + output_name으로 최종 파일 생성

### 커스텀 파일명
- ExportTab에서 파일명 입력 가능
- 한글 파일명: RFC 5987 `filename*=UTF-8''` 인코딩으로 다운로드 처리

### 빠른 잘라내기
- 편집 탭의 "선택 구간 제거 & 내보내기" → 구간만 빠르게 처리 (자막/화질 설정 없이)

---

## 확정된 워크플로우 순서 (미구현 포함)

```
1. 영상 로드 → 프로젝트 생성
2. 불필요한 부분 컷 (좌클릭 시작/끝)
3. 프리뷰로 확인 → 미세 조절 (±1s/±0.1s)
4. [미구현] 컷 확정 → 서버에서 임시 컷 영상 생성 (디스크 저장)
5. [미구현] 임시 컷 영상에 AI Vision 자막 생성 (컷 기준 타임스탬프)
6. 내보내기 (구간제거 + 자막 + 화질 → 최종 파일)
```

**핵심 원칙**: 영상 길이를 먼저 확정한 후 AI를 입힌다.
AI 자막은 원본이 아닌 컷 적용된 영상 기준이어야 맥락이 살고 타임스탬프가 정확함.

---

## 핵심 기능: 2-Pass Vision AI 자막 생성

### 작동 방식
1. FFmpeg으로 영상에서 3초 간격 프레임 추출
2. **Pass 1**: 8장 샘플링 → AI가 영상 전체 맥락 파악 (어떤 앱인지, 뭘 시연하는지)
3. **Pass 2**: 6프레임씩 배치 → 맥락 기반으로 장면 전환 감지 + 센스 있는 자막 생성
4. 자동 병합: 동일/유사 자막 합침
5. 서버 사이드 JSON 저장 (새로고침 시 자동 복원)

### 자막 프롬프트 스타일
- 딱딱한 설명 X → 시청자에게 말하듯 자연스럽게
- 좋은 예: "대시보드 한눈에 쫙~ 진행률이 보이네요"
- 나쁜 예: "메인 대시보드 화면입니다"
- 15~25자 이내, 가벼운 유머 허용

### 비용
- 4분 영상 기준: ~$0.43 (Claude Sonnet, 3초 간격)
- 실행 전 confirm() 팝업으로 예상 비용 표시

### API 키 저장
- 앱 내 ⚙️ AI 설정에서 입력 → `config.json`에 디스크 저장
- 서버 재시작/F5 해도 유지됨 (config.json에서 읽어옴)
- config.json은 .gitignore 필수

---

## 풀스크린 처리

- 첫 클릭 시 자동 풀스크린 진입 (브라우저 보안 정책 때문에 사용자 제스처 필요)
- ESC로 빠져나가면 상태바에 "Fullscreen" 복귀 버튼 표시
- **매 클릭마다 풀스크린 시도하면 안 됨** — 모든 버튼 이벤트를 먹어서 앱이 먹통 됨

---

## 알려진 이슈

### ✅ 수정 완료
1. ~~eval() 보안 취약점~~ → 안전한 문자열 split 파싱
2. ~~Path Traversal~~ → os.path.basename() 적용
3. ~~이벤트 루프 블로킹~~ → run_in_threadpool 적용
4. ~~SRT 경로 따옴표~~ → tempfile + 따옴표 제거
5. ~~SMART_INTERVAL 2초→3초~~ → 비용 ~30% 절감
6. ~~빈 화면 (duplicate const handleNewProject)~~ → 중복 선언 제거
7. ~~풀스크린이 버튼 클릭 먹음~~ → 첫 클릭만 + 상태바 버튼
8. ~~Export에서 컷 미적용~~ → 3단계 파이프라인 (cut → subtitle → export)
9. ~~싱글/더블클릭 충돌~~ → 배속을 우클릭으로 분리, 더블클릭 제거
10. ~~구간 시간 00:00 표시~~ → startTime/start 폴백 패턴
11. ~~한글 파일명 다운로드 에러~~ → RFC 5987 UTF-8 인코딩
12. ~~프리뷰 중 타임라인 충돌~~ → 타임라인 클릭 시 프리뷰 이어가기
13. ~~F5 자동 복원 안됨~~ → inline fetch로 클로저 문제 해결

### 미구현 (확정된 방향)
14. 컷 확정 → 서버 임시 영상 생성 → AI 자막은 컷 영상 기준으로 동작
15. FFmpeg Scene Detection으로 API 비용 80% 절감 가능
16. 10분+ 대용량 영상 대응

---

## 개발 컨벤션

### 사용자(류병수)와의 작업 규칙
- **반말 사용**, 직설적 피드백 선호, 에코챔버 경계
- **헤게모니 원칙**: AI가 "고쳤다"고 해도 사용자가 검증 전까지 실행하지 않음
- **비용 의식**: API 호출 전 반드시 예상 비용 표시, $5.50 시드로 시작
- **"너는 나야" 패턴**: 코드 수정 후 사용자 관점에서 자기 검증 실행
- **사용자가 요청하지 않은 기능을 맘대로 구현하지 않기** — 확인 먼저

### 코드 작성 규칙
- Python: Pydantic v2 (`pattern=`, not `regex=`)
- FFmpeg: ffmpeg-python 대신 subprocess 직접 호출 (Windows 호환)
- 경로: Windows 백슬래시 주의, 항상 forward slash 변환
- requirements.txt: `>=` 버전 핀닝 (== 사용 금지)
- 포트: 9000 고정 (8000은 AITM)
- segments 프로퍼티: `{startTime, endTime}` (React state) — 읽을 때 `seg.startTime || seg.start` 폴백 패턴 사용

### 파일별 수정 시 주의사항
- **App.js**: ~1700줄. 모든 상태 + 핸들러. 수정 시 중복 const 선언 주의
- **EditTab.js**: 프리뷰/미세조절/스톱워치 포함. onUpdateSegment, onPreview, isPreviewPlaying props 필수
- **ExportTab.js**: segmentCount, outputName 포함. 커스텀 파일명 지원
- **index.html**: ~370줄 셸. CSS 테마 + 컴포넌트 로딩. cutBlink, cutPulse, slideIn 키프레임 포함
- **components/*.js**: Babel standalone 외부 로딩, import/export 없이 전역 함수로 작성
- **ai_service.py**: 2-Pass 프롬프트 수정 시 비용 영향 반드시 계산. config.json으로 API 키 영속 저장
- **video_processor.py**: subprocess 호출, Windows 경로, timeout 설정 확인
- **main.py**: Generator 패턴 (StopIteration.value), 한글 파일명은 RFC 5987 인코딩
- **config.json**: API 키 포함 — 절대 git commit 금지

---

## 리뷰어별 피드백 요약

### Claude Opus 4.6
- eval() 보안 취약점 발견
- 2-Pass 설계 "인상적" 평가
- 비용 시뮬레이션 구체적 ($0.64)
- Electron 전환 가이드 제공

### Google Gemini
- 이벤트 루프 블로킹 발견 (Opus 놓침)
- Path Traversal 보안 발견 (Opus 놓침)
- Scene Detection 비용 최적화 제안
- "소프트웨어의 체력이 약하다" — 구조 개선 촉구

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-03-23 | v0.1 — 파일럿 생성 (2시간 개발) |
| 2026-03-23 | Vision AI 자막 생성 성공, 수업료 39센트 |
| 2026-03-23 | 2-Pass 스마트 분석으로 업그레이드 |
| 2026-03-23 | "너는 나야" 자기 검증 → 12개 버그 발견/수정 |
| 2026-03-23 | 내보내기 플로우 6개 버그 수정 (URL, 경로, Generator 등) |
| 2026-03-23 | 타 AI 크로스 리뷰 (Opus + Gemini) → 추가 이슈 5건 확인 |
| 2026-03-23 | 리뷰 기반 보안/성능 패치 6건 적용 |
| 2026-03-23 | PWA + 모듈화 + Darcula 테마 + 메뉴바 |
| 2026-03-23 | v0.2 — 대규모 UX 개선 |
| 2026-03-23 | 컷 로직 반전 (보존→제거), 우클릭 배속, 더블클릭 제거 |
| 2026-03-23 | 프로젝트 시스템 (생성 모달, 패널, 자동 저장, F5 복원) |
| 2026-03-23 | 3단계 내보내기 파이프라인, 커스텀 파일명, 한글 인코딩 |
| 2026-03-23 | 프리뷰 재생, 미세 조절 (±1s/±0.1s), 컷 스톱워치 |
| 2026-03-23 | 프리뷰-타임라인 충돌 수정, 경계 스냅 클릭 |
| 2026-03-23 | 워크플로우 확정: 컷 확정 → 임시영상 → AI 자막 (미구현) |
