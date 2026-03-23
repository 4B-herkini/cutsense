# CutSense v0.2 코드 검증 요청

## 프로젝트 개요
- **이름**: CutSense — AI 기반 시연영상 자동 편집기
- **핵심 기능**: Claude Vision API로 음성 없는 화면 캡처 영상을 분석해 자막 자동 생성 (2-Pass)
- **차별점**: 기존 편집기(CapCut, Vrew, DaVinci)는 STT 기반. CutSense는 화면만 보고 자막 생성
- **스택**: FastAPI (Python) + React 18 (CDN, Babel standalone) + FFmpeg
- **UI**: Android Studio Darcula 테마 + Happiness Sans 폰트
- **개발 방식**: 사용자(비전공 독학 개발자) + Claude AI 협업

## 파일 구조
```
code-review/
├── main.py              # FastAPI 서버 (API 엔드포인트 19개)
├── ai_service.py        # AI 서비스 (Claude/Grok Vision, 2-Pass 분석)
├── video_processor.py   # FFmpeg 영상 처리 (자르기, 자막 입히기, 내보내기)
├── requirements.txt     # Python 의존성
├── index.html           # 메인 셸 (~400줄, CSS Darcula 테마 + 컴포넌트 로딩)
├── components/          # React 컴포넌트 (Babel standalone 외부 로딩)
│   ├── App.js           # 메인 앱 (~693줄, 상태 관리 + 핸들러 + 렌더링)
│   ├── MenuBar.js       # 풀다운 메뉴바 (파일/편집/보기/AI/도움말)
│   ├── EditTab.js       # 편집 탭
│   ├── SubtitleTab.js   # 자막 편집 탭
│   ├── AITab.js         # AI 자막 생성 탭
│   ├── ExportTab.js     # 내보내기 탭
│   ├── Timeline.js      # 타임라인 컴포넌트
│   ├── SettingsModal.js # AI 설정 모달
│   └── Toast.js         # 토스트 알림
├── manifest.json        # PWA 매니페스트
├── sw.js                # Service Worker (network-first)
├── start.bat            # Windows 실행 스크립트
├── CLAUDE.md            # 프로젝트 컨텍스트 문서
└── REVIEW_BRIEF.md      # 이 파일
```

## 총 코드량: 4,031줄 (17개 소스 파일)
- 백엔드: 1,807줄 (main.py 707 + ai_service.py 500 + video_processor.py 600)
- 프론트엔드: 1,617줄 (index.html 402 + 컴포넌트 9개)
- 기타: 607줄 (start.bat, sw.js, manifest.json 등)

## 이전 리뷰에서 수정 완료된 항목
1. eval() 보안 취약점 → 안전한 문자열 split 파싱으로 교체
2. Path Traversal → os.path.basename() 적용
3. 이벤트 루프 블로킹 → run_in_threadpool 적용
4. SRT 경로 따옴표 → tempfile + 따옴표 제거
5. SMART_INTERVAL 2초→3초 → 비용 ~30% 절감

## 이번 리뷰 중점 검증 요청

### 1. 프론트엔드 모듈화 구조
- Babel standalone의 `<script type="text/babel" src="...">` 외부 파일 로딩 방식 안정성
- import/export 없이 전역 함수로 컴포넌트 작성 — 이 패턴의 문제점?
- 컴포넌트 간 의존성/로딩 순서 이슈 가능성

### 2. PWA 구현
- Service Worker (network-first) 전략 적절성
- 캐싱 대상 선정 적절성
- manifest.json 설정 검증

### 3. 보안 (재검증)
- CORS allow_origins=["*"] — 로컬 실행 환경에서의 적절성
- API 키 프론트엔드 비노출 확인
- config.json 경로 처리 안전성

### 4. UI/UX
- Darcula 테마 색상 체계 일관성 (#2B2B2B, #3C3F41, #CC7832, #A9B7C6)
- 풀다운 메뉴바 — hover-to-switch, click-outside-to-close 동작 안정성
- 십자선(crosshair) 오버레이 구현 상태

### 5. FFmpeg 처리 (재검증)
- burn_subtitles SRT 생성 + subprocess 안정성
- export_video 세로(9:16) 변환 filter_complex 정확성
- 대용량 영상(10분+) 타임아웃/메모리 문제

### 6. 비용 효율성
- 2-Pass Vision 분석: 3초 간격 프레임 추출
- 4분 영상 기준 예상 비용 ~$0.43
- 추가 최적화 가능성: FFmpeg Scene Detection으로 80% 절감 가능?

### 7. 아키텍처 확장성
- 현재 구조에서 유료화(워터마크, 인증) 추가 용이성
- 데스크탑 앱(Electron) 전환 가능성
- 십자선 4분할 인터랙션 (기획 중) 구현 시 구조적 문제점?

## 실행 환경
- OS: Windows 10/11
- Python: 3.10+
- FFmpeg: 시스템 설치 필요
- 포트: 9000
- API: Anthropic Claude Vision / xAI Grok Vision

## 참고
- 이 프로젝트는 크몽 포트폴리오용 시연 영상 편집을 자동화하기 위해 제작됨
- 사용자는 사출금형 설계 23년 경력의 AI 비전공 독학 개발자
- 향후 유료 배포 검토 중 (PWA 기반, 화면 캡처 시연 영상 전용 편집기)
