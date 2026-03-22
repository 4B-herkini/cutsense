# CutSense v1.0 — AI 시연영상 자동 편집기

## 프로젝트 개요
- 목적: 크몽 포트폴리오 시연 영상(화면 캡처) → 자동 편집 → 가로/세로 출력
- 제작자: 류병수 (4B-Lab)
- 기술스택: React (CDN) + FastAPI + FFmpeg + Claude/Grok API

## 폴더 구조
```
cutsense/
├── backend/
│   ├── main.py              # FastAPI 서버 (16개 엔드포인트)
│   ├── video_processor.py   # FFmpeg 영상 처리
│   ├── ai_service.py        # Claude/Grok API 연동
│   └── requirements.txt
├── frontend/
│   └── index.html           # React 단일 파일 (다크 UI)
├── uploads/                  # 업로드 영상 저장
├── outputs/                  # 편집 완료 영상 출력
├── start.bat                 # Windows 실행 스크립트
└── CLAUDE.md
```

## 실행 방법
1. Python 3.10+, FFmpeg 설치 필요
2. `start.bat` 더블클릭 (자동으로 venv 생성 + 의존성 설치 + 서버 실행)
3. 브라우저에서 http://localhost:8000 접속

## 핵심 기능
- 영상 업로드 (드래그앤드롭)
- 타임라인 기반 구간 자르기/합치기
- 자막/텍스트 오버레이 (스타일링 포함)
- AI 하이라이트 구간 추천 (Claude / Grok 선택)
- AI 훅 타이틀/서브타이틀 자동 생성
- AI 효과음/이펙트 추천
- 가로(16:9) + 세로(9:16) 동시 출력

## AI API 설정
- 설정 탭에서 provider(Claude/Grok) 선택 + API 키 입력
- config.json에 자동 저장

## 주의사항
- 한글 파일명 안전하게 처리됨 (UTF-8)
- FFmpeg가 PATH에 있어야 함
- uploads/, outputs/ 폴더는 자동 생성됨
