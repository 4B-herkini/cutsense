# CutSense — AI 시연영상 자동 편집기

> 이 파일은 AI 세션 간 맥락을 유지하기 위한 약속 파일입니다.
> 새 세션에서 이 프로젝트를 이어서 작업할 때 반드시 이 파일을 먼저 읽어주세요.

---

## 프로젝트 정체성

- **이름**: CutSense
- **한줄 요약**: 음성 없는 화면 캡처 영상을 AI Vision이 보고 자막을 자동 생성하는 편집기
- **차별점**: 기존 편집기(CapCut, Vrew, DaVinci)는 음성→텍스트(STT) 기반. CutSense는 화면만 보고 자막 생성 — 이 기능은 현존하는 편집기에 없음
- **제작자**: 류병수 (크몽 계정: 4B나무)
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
│       ├── App.js           # 메인 앱 (~693줄, 상태 관리 + 핸들러)
│       ├── MenuBar.js       # 풀다운 메뉴바 (파일/편집/보기/AI/도움말)
│       ├── EditTab.js       # ✂️ 편집 탭
│       ├── SubtitleTab.js   # 💬 자막 탭
│       ├── AITab.js         # 🤖 AI 탭
│       ├── ExportTab.js     # 📦 내보내기 탭
│       ├── Timeline.js      # 타임라인 컴포넌트
│       ├── SettingsModal.js # 설정 모달
│       └── Toast.js         # 토스트 알림
├── uploads/                 # 업로드 영상 + 자막 JSON + 내보내기 결과
├── projects/                # 프로젝트 저장 (JSON)
├── code-review/             # 타 AI 검증용 소스 복사본 + 리뷰 결과
├── 타 ai 리뷰/              # Claude Opus, Gemini 리뷰 결과
├── start.bat                # Windows 실행 (debug.log 생성)
├── config.json              # AI 설정 (API 키 포함 — .gitignore 필수)
└── CLAUDE.md                # 이 파일
```

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

---

## 알려진 이슈 (타 AI 리뷰 결과 포함)

### ✅ 수정 완료 (2026-03-23 리뷰 패치)
1. ~~**eval() 보안 취약점**~~ → 안전한 문자열 split 파싱으로 교체 완료
2. ~~**Path Traversal**~~ → os.path.basename() 적용 완료
3. ~~**이벤트 루프 블로킹**~~ → run_in_threadpool 적용 완료
4. ~~**SRT 경로 따옴표**~~ → tempfile + 따옴표 제거 완료
5. ~~**SMART_INTERVAL 2초→3초**~~ → 비용 ~30% 절감 적용 완료

### 비용 추가 최적화 (미적용)
6. FFmpeg Scene Detection (`select='gt(scene,0.3)'`)으로 장면 전환 프레임만 추출 → API 80% 절감 가능 (향후)

### ✅ 구조 개선 완료
7. ~~프론트엔드 모듈화~~ → Babel standalone 외부 파일 로딩으로 10개 파일 분리 완료
8. ~~Android Studio Darcula 테마~~ → 전체 UI 색상 변환 완료
9. ~~PWA 설정~~ → manifest.json + sw.js + 아이콘 완료
10. ~~풀다운 메뉴바~~ → 파일/편집/보기/AI/도움말 5개 메뉴 완료
11. ~~Happiness Sans 폰트~~ → CDN woff2 적용 완료

### 향후 개선
12. 십자선 4분할 인터랙션 — 4영역 × 마우스 이벤트 = 8개 명령 매핑 (기획 중)
13. 10분+ 대용량 영상 대응 — extract_frames 일괄 추출 방식 전환

---

## 개발 컨벤션

### 사용자(류병수)와의 작업 규칙
- **반말 사용**, 직설적 피드백 선호, 에코챔버 경계
- **헤게모니 원칙**: AI가 "고쳤다"고 해도 사용자가 검증 전까지 실행하지 않음
- **비용 의식**: API 호출 전 반드시 예상 비용 표시, $5.50 시드로 시작
- **"너는 나야" 패턴**: 코드 수정 후 사용자 관점에서 자기 검증 실행

### 코드 작성 규칙
- Python: Pydantic v2 (`pattern=`, not `regex=`)
- FFmpeg: ffmpeg-python 대신 subprocess 직접 호출 (Windows 호환)
- 경로: Windows 백슬래시 주의, 항상 forward slash 변환
- requirements.txt: `>=` 버전 핀닝 (== 사용 금지)
- 포트: 9000 고정 (8000은 AITM)

### 파일별 수정 시 주의사항
- **index.html**: ~370줄 셸 파일. CSS 테마 + 컴포넌트 로딩만 담당
- **components/*.js**: Babel standalone 외부 로딩, import/export 없이 전역 함수로 작성
- **ai_service.py**: 2-Pass 프롬프트 수정 시 비용 영향 반드시 계산
- **video_processor.py**: subprocess 호출, Windows 경로, timeout 설정 확인
- **main.py**: Generator 패턴 (StopIteration.value), 새 엔드포인트 추가 시 CORS 확인
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
| 2026-03-23 | 리뷰 기반 보안/성능 패치 6건 적용 (eval, Path Traversal, threadpool, SRT, 3초 간격) |
| 2026-03-23 | PWA 설정 (manifest, sw.js, 아이콘) |
| 2026-03-23 | 프론트엔드 모듈화 — 2,100줄 → 10개 컴포넌트 파일 분리 |
| 2026-03-23 | Android Studio Darcula 테마 + Happiness Sans 폰트 적용 |
| 2026-03-23 | 풀다운 메뉴바 (파일/편집/보기/AI/도움말) + 상태바 추가 |
