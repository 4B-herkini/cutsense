# CutSense 코드 검증 요청

## 프로젝트 개요
- **이름**: CutSense — AI 기반 비디오 에디터
- **핵심 기능**: Claude Vision API로 음성 없는 화면 캡처 영상을 분석해 자막 자동 생성
- **스택**: FastAPI (Python) + React (single HTML, CDN) + FFmpeg
- **개발 기간**: 2시간 (2026-03-23 새벽)
- **개발 방식**: 사용자(비전공 독학 개발자) + Claude AI 협업

## 파일 구조
```
code-review/
├── main.py              # FastAPI 서버 (엔드포인트 16개+)
├── ai_service.py        # AI 서비스 (Claude/Grok Vision, 2-Pass 분석)
├── video_processor.py   # FFmpeg 영상 처리 (자르기, 자막 입히기, 내보내기)
├── requirements.txt     # Python 의존성
├── index.html           # React 프론트엔드 (싱글 파일, ~2100줄)
├── start.bat            # Windows 실행 스크립트
├── CLAUDE.md            # 프로젝트 컨텍스트 문서
└── REVIEW_BRIEF.md      # 이 파일
```

## 검증 요청 사항

### 1. 치명적 버그
- Windows 환경에서 FFmpeg subtitle filter 경로 처리 정상 동작 여부
- subprocess 호출 시 경로 이스케이프가 모든 케이스에서 안전한지
- Generator return value가 StopIteration으로 올바르게 캡처되는지

### 2. API 비용 효율성
- 2-Pass Vision 분석의 토큰 사용량 최적화 여부
- 배치 사이즈(6프레임)와 샘플 수(8장)의 적절성
- 4분 영상 기준 예상 비용이 $0.50 이내인지

### 3. 보안
- API 키가 프론트엔드에 노출되지 않는지
- config.json 경로 처리의 안전성
- CORS 설정 (현재 allow_origins=["*"])의 로컬 실행 환경 적절성

### 4. 프론트엔드
- React CDN (production build) + Babel 런타임 컴파일의 성능
- 상태 관리 (videoFile, subtitles, uploadedFilePath) 일관성
- 새로고침 시 자동 복원 로직의 안정성

### 5. FFmpeg 처리
- burn_subtitles의 SRT 생성 + subprocess 실행 안정성
- export_video의 세로(9:16) 변환 filter_complex 정확성
- 대용량 영상(10분+) 처리 시 타임아웃/메모리 문제

### 6. 아키텍처
- 싱글 파일 프론트엔드의 유지보수성
- 서버 사이드 상태 관리 (JSON 파일) 방식의 적절성
- 현재 구조에서 데스크탑 앱(Electron 등)으로 전환 가능성

## 실행 환경
- OS: Windows 10/11
- Python: 3.10+
- FFmpeg: 시스템 설치 필요
- 포트: 9000 (8000은 AITM 프로젝트가 선점)
- API: Anthropic Claude Vision / xAI Grok Vision

## 참고
- 이 프로젝트는 크몽 포트폴리오용 시연 영상 편집을 자동화하기 위해 제작됨
- 사용자는 사출금형 설계 23년 경력의 AI 비전공 독학 개발자
- "수업료 39센트" — Vision API 테스트 중 프론트엔드 버그로 토큰 손실 경험 있음
