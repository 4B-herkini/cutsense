# CutSense v0.4 코드 검증 요청

## 프로젝트 개요
- **이름**: CutSense — AI 기반 시연영상 자동 편집기
- **핵심 기능**: Claude Vision API로 음성 없는 화면 캡처 영상을 분석해 자막 자동 생성 (2-Pass)
- **차별점**: 기존 편집기(CapCut, Vrew, DaVinci)는 STT 기반. CutSense는 화면만 보고 자막 생성
- **스택**: FastAPI (Python) + React 18 (CDN, Babel standalone) + FFmpeg
- **UI**: Android Studio Darcula 테마 + Happiness Sans 폰트
- **개발 방식**: 사용자(비전공 독학 개발자, 사출금형 설계 23년 경력) + Claude AI 협업

## 파일 구조
```
code-review/
├── main.py              # FastAPI 서버 (API 엔드포인트 20+개)
├── ai_service.py        # AI 서비스 (Claude/Grok Vision, 2-Pass 분석, 6개 자막 스타일)
├── video_processor.py   # FFmpeg 영상 처리 (자르기, 자막 입히기, 병합, 내보내기)
├── requirements.txt     # Python 의존성
├── index.html           # 메인 셸 (CSS Darcula 테마 + 컴포넌트 로딩)
├── components/          # React 컴포넌트 (Babel standalone 외부 로딩)
│   ├── App.js           # 메인 앱 (~2100줄, 상태 관리 + 핸들러 + 렌더링)
│   ├── MenuBar.js       # 풀다운 메뉴바
│   ├── EditTab.js       # 편집 탭 (컷 구간 관리)
│   ├── SubtitleTab.js   # 자막 편집 탭 (번호, 편집, 삭제, 싱크 미세조절)
│   ├── AITab.js         # AI 자막 생성 탭 (6개 스타일, Darcula 테마)
│   ├── ExportTab.js     # 내보내기 탭 (단일/멀티 영상 병합 지원)
│   ├── Timeline.js      # 타임라인 (자막 번호 마커, 클릭→점프)
│   ├── SettingsModal.js # AI 설정 모달 (API 키 저장/마스킹)
│   └── Toast.js         # 토스트 알림
├── manifest.json        # PWA 매니페스트
├── sw.js                # Service Worker (network-first)
├── start.bat            # Windows 실행 스크립트
├── CLAUDE.md            # 프로젝트 컨텍스트 문서
└── REVIEW_BRIEF.md      # 이 파일
```

## v0.2 → v0.3 주요 변경사항

### 신규 기능
1. **멀티 영상 병합 내보내기** (`/api/merge-export`)
   - 각 영상별 컷 편집 + 자막 개별 적용 후 하나로 병합
   - 백엔드에서 삭제 구간→보존 구간 반전, 자막 타임스탬프 역변환 처리
   - 단일/멀티 자동 분기 (handleExport에서 videoList.length로 판단)

2. **자막 싱크 미세조절**
   - 타임라인 마커 클릭 → 영상 점프 + 자막 탭 하이라이트
   - 자막 카드에서 ±1초, ±0.1초 버튼으로 start/end 미세 조절
   - 조절 시 영상도 해당 시점으로 실시간 점프

3. **자막 싱크 근본 수정**
   - 기존: 컷 영상 생성(ffmpeg c=copy, 키프레임 오차) → AI 분석 → 타임스탬프 매핑
   - 변경: 원본 영상에서 보존 구간 프레임만 직접 추출 → 매핑 불필요
   - `extract_frames(keep_segments=...)` 파라미터 추가
   - `/api/ai/vision-subtitles`에 `keep_segments` 전달 지원

4. **프로젝트 관리 전용 화면**
   - 기존 오른쪽 슬라이드 패널 → 중앙 모달 (560px)
   - 각 프로젝트 카드에 "열기" + "삭제" 버튼 항상 노출
   - 우클릭 컨텍스트 메뉴 제거 (불필요)

5. **네이티브 비디오 컨트롤 외부화**
   - `<video controls>` 제거 → 커스텀 볼륨 슬라이더 + 음소거 토글
   - 십자선 오버레이 `bottom: 0`으로 확장 (40px 경계 문제 해결)
   - 컷 조작과 볼륨/전체화면 충돌 완전 해소

6. **앱 느낌 향상**
   - `user-select: none` + `cursor: default` 전역 적용 (텍스트 커서 깜빡임 제거)
   - 전역 우클릭 브라우저 메뉴 차단 (`onContextMenu preventDefault`)
   - input/textarea만 선택 허용, 버튼은 pointer 커서

### 6개 AI 자막 스타일 (ai_service.py)
- `auto`: AI가 톤/밀도/길이 직접 판단
- `portfolio`: 포트폴리오 전문가 톤
- `training`: 사내 교육 강사 톤
- `client`: 클라이언트 프레젠터 톤
- `sns`: SNS 마케터 톤
- `qa`: QA 테스트 리포터 톤
- 공통: "한 번 스캔하지만, 열 번 본 것처럼 신중하게 판단해"

## 리뷰 중점 검증 요청

### 1. 멀티 영상 병합 파이프라인
- `/api/merge-export`에서 각 영상별 컷+자막 처리 후 concat → 중간 파일 정리 누락?
- 삭제 구간→보존 구간 반전 로직이 main.py와 프론트엔드(invertSegments) 양쪽에 존재 — 동기화 문제?
- 자막 타임스탬프 역변환(원본→컷) 정확성 검증

### 2. 자막 싱크 새 아키텍처
- `extract_frames(keep_segments=...)` — 보존 구간 경계에서 프레임 누락 가능성?
- AI가 보존 구간 사이 타임스탬프 점프를 인식하는지? (예: [10.0초] 다음 [40.0초])
- 내보내기 시 `mapOriginalToCutTime` 역변환 — 보존 구간 밖 자막 처리

### 3. 보안 (재검증)
- CORS allow_origins=["*"] — 로컬 환경 적절성
- API 키 마스킹 (`api_key_masked`) 구현 확인
- config.json 경로 안전성

### 4. 프론트엔드
- App.js 2100줄 — 분리 필요성? (상태 관리, 핸들러, 렌더링이 한 파일)
- Babel standalone의 전역 스코프 공유 안정성
- selectedSubtitleIdx 상태가 삭제/추가 시 올바르게 동기화되는지

### 5. FFmpeg 처리
- burn_subtitles SRT 생성 + subprocess 안정성
- concat_videos: 서로 다른 해상도/코덱 영상 병합 시 문제?
- 대용량 영상 타임아웃/메모리 (10분+ 영상 3개 병합)

### 6. 비용 효율성
- 2-Pass Vision: 5초 간격, 12프레임 배치
- 보존 구간만 프레임 추출 — 컷 편집이 많을수록 비용 절감
- 포스트프로세싱: 2.5초 미만 자막 제거, 1초 미만 갭 연결

## v0.3 → v0.4 현재 상태 및 개선 계획

### 현재 알려진 이슈
1. **AI 자막 불안정** — 싱크 틀어짐, 자막 내용 부정확
   - 원인 1: 프레임 추출 5초 간격 → 타임스탬프 정밀도 한계
   - 원인 2: Pass 2에서 장면 분석 + 자막 생성을 동시에 요구 → AI 과부하
   - 원인 3: 프레임 해상도 1280px → Vision API 인식 한계

2. **FFmpeg 프레임 추출 비효율** — 프레임당 개별 FFmpeg 프로세스 호출 (80회+)

3. **보안 미비** — Path Traversal 취약점, 프론트엔드 API 키 노출 가능성

### 4일 개선 로드맵 (확정)
| Day | 작업 | 핵심 |
|-----|------|------|
| 1 | FFmpeg 프레임 추출 최적화 | 80개 개별호출 → `-vf select` 단일호출, 해상도 1920px 테스트 |
| 2 | 3-Pass 아키텍처 설계 + 구현 | Pass 2 = 장면 경계 감지, Pass 3 = 자막 생성 (역할 분리) |
| 3 | 프롬프트 정밀 튜닝 + 테스트 | 스타일별 프롬프트 최적화, 자막 품질 벤치마크 |
| 4 | 보안 패치 + 데모 영상 | Path Traversal, API 키 보호, 포트폴리오 데모 촬영 |

### 3-Pass Vision 아키텍처 (Day 2 목표)
- **Pass 1**: 컨텍스트 파악 (8 샘플 프레임) — 현행 유지
- **Pass 2 (신규)**: 장면 경계 감지 — "이 프레임들에서 화면이 바뀌는 경계 시점만 알려줘"
- **Pass 3 (기존 Pass 2 분리)**: 자막 생성 — 감지된 장면 구간별로 자막 텍스트만 생성
- 장점: 각 Pass가 하나의 역할만 → AI 정확도 향상

## 실행 환경
- OS: Windows 10/11
- Python: 3.10+
- FFmpeg: 시스템 설치 필요
- 포트: 9000
- API: Anthropic Claude Vision / xAI Grok Vision
