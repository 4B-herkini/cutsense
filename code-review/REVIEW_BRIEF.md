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

## v0.3 → v0.4 변경사항 (4일 로드맵 완료)

### Day 1: FFmpeg 프레임 추출 최적화 ✅
- `extract_frames`: 프레임당 개별 호출(80회+) → `select` 필터 단일 호출
- 해상도 1280px → 1920px (원본보다 크면 원본 유지)
- select 실패 시 개별 추출 fallback 안전장치

### Day 2: 3-Pass Vision 아키텍처 ✅
- **Pass 1**: 컨텍스트 파악 (8 샘플, 유지)
- **Pass 2**: 장면 경계 감지 — 16프레임 배치, "언제 바뀌는지"만 판단
- **Pass 3**: 자막 생성 — 구간별 대표 프레임 1~2장, "뭐라고 쓸지"만 결정
- `_boundaries_to_scenes`: 경계→구간 변환 + 대표 프레임 선택
- 장면당 자막 null 허용 (불필요한 구간 자동 스킵)

### Day 3: 프롬프트 정밀 튜닝 ✅
- Pass 3 전용 `SUBTITLE_STYLE_BRIEFS` 추가 (전체 프롬프트 → 핵심 3줄 압축)
- "하지 마" → "이렇게 해" 위주 긍정 지시로 전환
- Pass 2 경계 감지 프롬프트 간결화

### Day 4: 보안 패치 ✅
- `validate_file_path()`: 모든 file_path API에 Path Traversal 방어 적용
- CORS: `allow_origins=["*"]` → localhost:9000만 허용
- 프론트엔드 API 키 노출 제거 (레거시 코드 `apiKey` 파라미터 삭제)

### 남은 과제
- 실제 영상으로 3-Pass 품질 벤치마크 (아직 테스트 못함)
- 데모 영상 촬영 (자막 품질 확인 후)

## 실행 환경
- OS: Windows 10/11
- Python: 3.10+
- FFmpeg: 시스템 설치 필요
- 포트: 9000
- API: Anthropic Claude Vision / xAI Grok Vision
