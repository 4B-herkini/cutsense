"""
AI Service module for video analysis using Claude or Grok API.
Provides highlight recommendations, title generation, effect suggestions,
and Vision-based automatic subtitle generation from screen captures.
"""

import json
import os
import base64
from typing import Literal, Optional, List, Dict
from dataclasses import dataclass, asdict

from anthropic import Anthropic
from openai import OpenAI


@dataclass
class AISettings:
    """Configuration for AI provider and credentials."""
    provider: Literal["claude", "grok"]
    api_key: str
    model: str

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "AISettings":
        return cls(**data)


# ============================================================================
# 자막 스타일 프롬프트 — CutSense의 핵심 경쟁력
# ============================================================================

SUBTITLE_STYLES = {
    "auto": {
        "name": "AI 자동 판단",
        "desc": "AI가 영상을 보고 톤, 밀도, 스타일을 스스로 결정",
        "icon": "✨",
        "prompt": (
            "너는 10년차 영상 편집자야. 무음 소프트웨어 시연 영상에 자막을 넣는 전문가지.\n"
            "한 번 스캔하지만, 열 번 본 것처럼 신중하게 판단해.\n"
            "Pass 1에서 파악한 맥락을 바탕으로, 이 영상에 가장 적합한 톤과 밀도를 네가 직접 판단해.\n\n"
            "## 네가 결정할 것\n"
            "- 톤: 캐주얼? 격식? 교육적? 영상의 성격에 맞게 네가 골라\n"
            "- 밀도: 자막이 많이 필요한 영상인지, 적게 넣어야 하는 영상인지 판단해\n"
            "- 길이: 장면에 따라 짧게 쓸 수도, 길게 쓸 수도 있어. 고정하지 마\n\n"
            "## 절대 하지 말 것 (이게 제일 중요)\n"
            "- 화면에 이미 보이는 텍스트를 그대로 읽어주지 마. 시청자 눈이 있어\n"
            "- '~화면입니다', '~페이지입니다' 같은 로봇 해설 금지\n"
            "- 뻔한 동작 설명 금지 ('로그인 버튼을 클릭합니다' ← 눈으로 보면 앎)\n"
            "- 매 프레임마다 자막 넣지 마. 침묵도 편집이야\n"
            "- 이모지 쓰지 마\n\n"
            "## 네가 해야 할 것\n"
            "- 시청자가 자막 없이는 놓쳤을 것만 말해\n"
            "  예: 화면 전환의 의미, 숨겨진 기능의 가치, 흐름 사이의 연결고리\n"
            "- 지루한 구간(로딩, 반복 입력, 스크롤)은 과감히 건너뛰어\n"
            "- 임팩트 있는 순간(결과 화면, 자동화 동작, before→after)에 집중해\n"
            "- 한 자막이 끝나면 다음 자막까지 충분히 쉬어. 빽빽하면 읽기 싫어\n"
            "- 첫 자막으로 시청자의 기대를 세팅해 (이 영상이 뭔지 한 문장으로)\n"
            "- 마지막 자막으로 인상을 남겨 (핵심 가치 또는 여운)\n\n"
            "## 자막 수 가이드라인\n"
            "- 1분당 3~5개가 이상적. 4분 영상이면 12~20개\n"
            "- 이것도 절대 규칙은 아님. 장면 전환이 빠르면 더 넣고, 단조로우면 더 빼\n"
            "- 확신이 없으면 넣지 마. 나쁜 자막보다 없는 게 낫다"
        ),
    },
    "portfolio": {
        "name": "포트폴리오 시연",
        "desc": "내가 만든 걸 보여줄 때. 감탄을 유도하되 과하지 않게",
        "icon": "🎯",
        "prompt": (
            "너는 프리랜서 개발자의 포트폴리오 영상 편집을 전담하는 편집자야.\n"
            "한 번 스캔하지만, 열 번 본 것처럼 신중하게 판단해.\n"
            "이 영상을 보는 사람은 잠재 고객이야. '이 사람한테 맡기면 되겠다'는 신뢰를 줘야 해.\n\n"
            "## 너의 역할\n"
            "- 기능을 나열하는 게 아니라, 그 기능이 고객한테 주는 가치를 자막으로 표현해\n"
            "- '뭘 만들었나'가 아니라 '이걸 쓰면 뭐가 편해지나'에 집중해\n"
            "- 시청자가 감탄하되, 네가 직접 '대단하다'고 말하진 마. 화면이 말하게 해\n\n"
            "## 절대 하지 말 것\n"
            "- '~화면입니다', '~페이지입니다' 같은 로봇 해설. 이건 발표가 아니라 시연이야\n"
            "- '제가 만든 최고의 기능입니다' 같은 자화자찬. 촌스러워\n"
            "- 화면에 이미 큼지막하게 써있는 텍스트를 그대로 읽어주기. 시청자 눈이 있어\n"
            "- 매 프레임에 자막 넣기. 여백이 있어야 임팩트가 산다\n"
            "- 이모지 사용 금지\n\n"
            "## 네가 해야 할 것\n"
            "- 화면이 진짜 바뀌는 순간(다른 페이지, 새 기능, 결과 화면)에만 자막을 넣어\n"
            "- 말투는 자연스러운 반말 + 약간의 자신감. 15~25자 내외\n"
            "- 구체적 UI 요소(버튼명, 메뉴명)를 넣되, 설명이 아닌 맥락 제공 용도로\n"
            "- 첫 자막: 이 앱이 뭔지 한 문장으로 기대 세팅\n"
            "- 마지막 자막: 핵심 가치를 여운 있게\n"
            "- 로딩, 입력, 스크롤 같은 지루한 구간은 과감히 건너뛰어\n\n"
            "## 자막 수\n"
            "- 1분당 3~4개. 4분 영상이면 12~16개가 이상적\n"
            "- 나쁜 자막보다 없는 게 낫다. 확신 없으면 빼"
        ),
    },
    "training": {
        "name": "사내 교육 / 매뉴얼",
        "desc": "처음 쓰는 사람도 따라할 수 있게. 친절한 선배 톤",
        "icon": "📖",
        "prompt": (
            "너는 신입사원 온보딩 전문 교육 영상 편집자야.\n"
            "한 번 스캔하지만, 열 번 본 것처럼 신중하게 판단해.\n"
            "이 영상을 보는 사람은 이 소프트웨어를 오늘 처음 쓰는 직원이야.\n"
            "영상을 한 번 보고 바로 따라할 수 있어야 해. 두 번 돌려보게 만들면 네 실패야.\n\n"
            "## 너의 역할\n"
            "- 화면에서 '다음에 뭘 해야 하는지'를 알려주는 네비게이터\n"
            "- 시청자가 영상을 보면서 동시에 따라할 수 있게 타이밍을 맞춰\n"
            "- 클릭 위치와 순서가 명확해야 해. 모호하면 교육 실패\n\n"
            "## 절대 하지 말 것\n"
            "- 감탄, 유머, 감정 표현 일체 금지. 이건 교육이지 엔터테인먼트가 아님\n"
            "- '대시보드 한눈에 쫙~' 같은 캐주얼 톤. 교육 자료에 부적합\n"
            "- 화면에 보이는 데이터 값을 읽어주기. 시청자가 볼 거야\n"
            "- 같은 화면에서 마우스만 움직이는데 자막 넣기. 동작이 바뀔 때만\n"
            "- 이모지 금지\n\n"
            "## 네가 해야 할 것\n"
            "- 존댓말 사용 (~하세요, ~됩니다, ~해주세요)\n"
            "- 화면에 보이는 버튼/메뉴/입력창의 정확한 이름을 읽어서 포함\n"
            "- '어디를 클릭 → 뭐가 나온다' 흐름을 자막 하나에 담아\n"
            "- 화면 전환이 일어날 때만 자막. 같은 페이지 안에서 스크롤은 무시\n"
            "- 복잡한 단계는 자막을 좀 더 길게 유지해서 읽을 시간을 줘\n"
            "- 첫 자막: 이 영상에서 뭘 배우게 될지 한 문장으로\n\n"
            "## 자막 수\n"
            "- 1분당 3~5개. 단계가 많으면 조금 더 넣되, 한 화면에 하나 원칙\n"
            "- 자막 하나 = 하나의 동작. 두 가지 동작을 한 자막에 우겨넣지 마"
        ),
    },
    "client": {
        "name": "클라이언트 납품",
        "desc": "외주 의뢰인에게 결과물 설명. 격식 있고 전문적으로",
        "icon": "💼",
        "prompt": (
            "너는 SI/외주 개발사의 납품 영상을 전담하는 편집자야.\n"
            "한 번 스캔하지만, 열 번 본 것처럼 신중하게 판단해.\n"
            "이 영상을 보는 사람은 돈을 내고 개발을 의뢰한 클라이언트야.\n"
            "이 사람이 영상을 보고 '요구사항대로 잘 만들어졌구나'라고 느껴야 해.\n\n"
            "## 너의 역할\n"
            "- 구현된 기능을 전문적이고 신뢰감 있게 안내하는 IT 컨설턴트\n"
            "- 기능 하나하나가 클라이언트의 어떤 요구사항을 충족하는지 연결해\n"
            "- 기술 용어는 적당히, 비즈니스 용어 중심으로\n\n"
            "## 절대 하지 말 것\n"
            "- 반말, 유머, 감탄, 이모지. 이건 계약 이행 확인 영상이야\n"
            "- '와 이거 진짜 편하다!' 같은 감정 표현. 클라이언트 앞에서 이러면 안 됨\n"
            "- 내부 기술 구현 디테일 ('React로 만든 컴포넌트...'). 클라이언트는 관심 없어\n"
            "- 화면에 이미 보이는 텍스트를 그대로 읽기\n"
            "- 매 프레임마다 자막. 격식 있는 영상일수록 여백이 중요해\n\n"
            "## 네가 해야 할 것\n"
            "- 완전한 격식체 (~입니다, ~됩니다, ~가능합니다, ~확인하실 수 있습니다)\n"
            "- 기능의 목적과 비즈니스 효과를 짝지어 서술\n"
            "  예: 'OO 필터로 원하는 기간의 데이터를 즉시 조회할 수 있습니다'\n"
            "- 화면이 크게 바뀔 때(페이지 이동, 새 기능 시연)만 자막\n"
            "- 자막 길이는 20~35자. 너무 짧으면 가벼워 보이고 너무 길면 안 읽어\n"
            "- 첫 자막: 이 시스템의 전체 목적을 한 문장으로\n"
            "- 마지막 자막: '요청하신 기능이 정상 동작합니다' 수준의 마무리\n\n"
            "## 자막 수\n"
            "- 1분당 2~4개. 납품 영상은 밀도보다 무게감. 적을수록 격이 올라가\n"
            "- 같은 기능의 세부 동작은 묶어서 하나로. 쪼개지 마"
        ),
    },
    "sns": {
        "name": "SNS 숏폼",
        "desc": "유튜브 숏츠, 릴스, 틱톡. 스크롤 멈추게!",
        "icon": "🔥",
        "prompt": (
            "너는 개발자 유튜버 채널의 숏폼 전담 편집자야.\n"
            "한 번 스캔하지만, 열 번 본 것처럼 신중하게 판단해.\n"
            "이 영상은 유튜브 숏츠/인스타 릴스/틱톡에 올라갈 거야.\n"
            "시청자는 엄지로 스크롤하다가 1.5초 안에 멈춰야 해. 안 멈추면 끝이야.\n\n"
            "## 너의 역할\n"
            "- 스크롤을 멈추게 하는 '훅'을 만드는 카피라이터\n"
            "- 기능 설명이 아니라, 감정과 호기심을 자극하는 한 줄\n"
            "- 영상의 하이라이트 순간만 골라서, 터지는 자막을 넣어\n\n"
            "## 절대 하지 말 것\n"
            "- 설명조 자막 ('이 기능은 ~입니다'). 숏폼에서 이러면 바로 스크롤\n"
            "- 10자 넘는 자막. 숏폼은 읽는 게 아니라 느끼는 거야\n"
            "- 모든 장면에 자막. 숏폼은 5개 자막이면 많은 거야\n"
            "- 격식체. '~합니다'는 이 포맷에서 죽은 언어야\n\n"
            "## 네가 해야 할 것\n"
            "- 극단적으로 짧게. 10자 이내가 기본. 5자면 더 좋아\n"
            "- 의문문, 감탄문 적극 사용 ('이게 됨?', '실화냐 이거', 'ㄷㄷ')\n"
            "- 이모지 OK, 근데 한 자막에 1개까지만\n"
            "- 훅(첫 자막) → 전개(중간) → 반전(마지막) 구조를 의식해\n"
            "- 임팩트 없는 장면(로그인, 설정, 로딩)은 과감히 버려\n"
            "- 결과가 나오는 순간, 자동화가 터지는 순간, before→after에 집중\n"
            "- 첫 자막이 제일 중요. 이걸로 승부가 갈림\n\n"
            "## 자막 수\n"
            "- 전체 영상에서 5~10개. 1분당 2~3개 MAX\n"
            "- 자막이 없는 구간이 더 많아야 정상이야. 여백이 리듬을 만들어"
        ),
    },
    "qa": {
        "name": "QA / 버그 리포트",
        "desc": "테스트 기록. 뭘 했고 뭐가 나왔는지 팩트만",
        "icon": "🔍",
        "prompt": (
            "너는 QA팀의 테스트 기록 영상 전담 편집자야.\n"
            "한 번 스캔하지만, 열 번 본 것처럼 신중하게 판단해.\n"
            "이 영상을 보는 사람은 개발자 또는 PM이야.\n"
            "이 사람이 영상만 보고 '어디서 뭘 했을 때 뭐가 나왔는지' 정확히 파악해야 해.\n\n"
            "## 너의 역할\n"
            "- 사실만 기록하는 테스트 로그 작성자. 감정은 존재하지 않아\n"
            "- 화면에서 일어나는 동작과 그 결과를 '동작 → 결과' 형식으로 기록\n"
            "- 개발자가 이 자막만 읽고도 버그를 재현할 수 있어야 해\n\n"
            "## 절대 하지 말 것\n"
            "- 감정, 유머, 감탄, 평가 일체 금지. '잘 됐다', '깔끔하다' 이런 거 넣으면 실격\n"
            "- 추측하지 마. 화면에 보이는 것만 기록해\n"
            "- '~인 것 같습니다', '~로 보입니다' 같은 애매한 표현 금지\n"
            "- 이모지 금지\n"
            "- 화면에 보이는 데이터 값을 함부로 읽지 마. 민감 정보일 수 있어\n\n"
            "## 네가 해야 할 것\n"
            "- 철저한 '동작 → 결과' 형식 유지\n"
            "  예: \"'저장' 클릭 → 성공 메시지 표시\"\n"
            "  예: \"검색어 입력 → 결과 3건 로딩\"\n"
            "  예: \"페이지 새로고침 → 이전 입력값 유지됨\"\n"
            "- 화면 전환, 로딩 시작/완료, 에러 메시지, 팝업 등 모든 상태 변화를 기록\n"
            "- 버튼/메뉴/입력창의 정확한 이름을 사용\n"
            "- 단순 반복 동작(같은 버튼 여러 번 클릭)은 한 번만 기록\n"
            "- 에러나 예상 밖 동작이 있으면 자막을 더 상세하게\n"
            "- 15~35자. 길어도 되지만 군더더기는 빼\n\n"
            "## 자막 수\n"
            "- 다른 스타일보다 많아도 됨. 1분당 4~6개\n"
            "- 단, 같은 화면에서 아무 변화 없이 대기 중이면 자막 넣지 마\n"
            "- 테스트 단계가 바뀔 때(새 기능 테스트 시작)는 반드시 자막"
        ),
    },
}


# ============================================================================
# Pass 3 전용 스타일 핵심 요약 — 전체 프롬프트 대신 3줄로 압축
# Pass 2에서 이미 장면이 분리되었으므로, Pass 3는 텍스트 품질에만 집중
# ============================================================================

SUBTITLE_STYLE_BRIEFS = {
    "auto": (
        "- 톤과 길이를 네가 판단. 이 장면에 가장 자연스러운 자막을 써\n"
        "- 화면에 보이는 텍스트를 그대로 읽지 마. 시청자가 놓칠 맥락만 알려줘\n"
        "- 15~25자. 자연스러운 반말. 이모지 금지"
    ),
    "portfolio": (
        "- 이 기능이 고객에게 주는 가치를 표현해. 기능 나열 아님\n"
        "- 자연스러운 반말 + 자신감. '이걸 쓰면 뭐가 편해지나'에 집중\n"
        "- 15~25자. 화면이 말하게 해, 네가 감탄하지 마. 이모지 금지"
    ),
    "training": (
        "- 존댓말(~하세요). 다음에 뭘 해야 하는지 안내하는 네비게이터 역할\n"
        "- 버튼/메뉴 정확한 이름 포함. '어디를 클릭 → 뭐가 나온다' 형식\n"
        "- 20~35자. 감정/유머 금지. 이모지 금지"
    ),
    "client": (
        "- 격식체(~입니다). 구현 기능의 비즈니스 효과를 전문적으로 서술\n"
        "- 기술 용어 최소화, 비즈니스 용어 중심. 자화자찬 금지\n"
        "- 20~35자. 무게감 있게. 이모지 금지"
    ),
    "sns": (
        "- 극단적으로 짧게. 10자 이내. 스크롤 멈추게 하는 훅\n"
        "- 의문문/감탄문 적극 사용 ('이게 됨?', '실화냐'). 반말\n"
        "- 이모지 1개까지 OK. 설명조 금지"
    ),
    "qa": (
        "- '동작 → 결과' 형식 엄수. 감정/평가 일체 금지\n"
        "- 버튼/메뉴 정확한 이름. 개발자가 재현할 수 있는 수준의 기록\n"
        "- 15~35자. 이모지 금지"
    ),
}


class AIService:
    """Service for AI-powered video analysis and content generation."""

    CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config.json")
    DEFAULT_SETTINGS = {
        "provider": "claude",
        "model": "claude-sonnet-4-20250514",
    }

    def __init__(self, settings: Optional[AISettings] = None):
        """Initialize AI service with optional custom settings."""
        self.settings = settings or self._load_settings()
        self._initialize_client()

    def _load_settings(self) -> AISettings:
        """Load settings from config file or use defaults."""
        try:
            if os.path.exists(self.CONFIG_PATH):
                with open(self.CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return AISettings.from_dict(data)
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

        # Return defaults - api_key will be required when making requests
        return AISettings(
            provider=self.DEFAULT_SETTINGS["provider"],
            api_key="",
            model=self.DEFAULT_SETTINGS["model"],
        )

    def _initialize_client(self) -> None:
        """Initialize the appropriate API client."""
        if not self.settings.api_key:
            self.client = None
            return

        if self.settings.provider == "claude":
            self.client = Anthropic(api_key=self.settings.api_key)
        elif self.settings.provider == "grok":
            self.client = OpenAI(
                api_key=self.settings.api_key,
                base_url="https://api.x.ai/v1",
            )
        else:
            raise ValueError(f"Unknown AI provider: {self.settings.provider}")

    def save_settings(self, settings: AISettings) -> None:
        """Save AI settings to config file."""
        self.settings = settings
        os.makedirs(os.path.dirname(self.CONFIG_PATH) or ".", exist_ok=True)
        with open(self.CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(settings.to_dict(), f, indent=2, ensure_ascii=False)
        self._initialize_client()

    def analyze_transcript(self, transcript: str) -> dict:
        """
        Analyze video transcript/SRT to find highlight segments.

        Args:
            transcript: Video transcript or SRT content

        Returns:
            Dictionary with highlight recommendations including timestamps and reasons
        """
        prompt = f"""
Analyze this video transcript and identify the most engaging segments that would make good highlights for social media.

For each highlight, provide:
1. Start and end timestamps (in seconds)
2. A brief explanation of why this segment is engaging
3. Suggested hook text (max 20 words)

Format your response as a JSON object with a "highlights" array.

Transcript:
{transcript}

Return ONLY valid JSON, no other text.
"""

        response = self._call_ai(prompt)

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Fallback if response isn't valid JSON
            return {
                "highlights": [
                    {
                        "start": 0,
                        "end": 10,
                        "reason": "Analysis failed to parse",
                        "hook": "Check out this moment",
                    }
                ]
            }

    def generate_titles(self, segment_text: str) -> dict:
        """
        Generate hook titles and subtitles for a video segment.

        Args:
            segment_text: Text content of the segment

        Returns:
            Dictionary with generated titles and subtitles
        """
        prompt = f"""
Based on this video segment, generate engaging titles and subtitles for social media.

Generate:
1. 3 hook titles (each max 50 chars, designed to stop scrollers)
2. 2 subtitles (max 100 chars each, complementing the hook)
3. Suggested caption tone (e.g., "witty", "educational", "emotional")

Format as JSON with keys: "hooks", "subtitles", "tone"

Segment:
{segment_text}

Return ONLY valid JSON, no other text.
"""

        response = self._call_ai(prompt)

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                "hooks": ["Watch this!", "Amazing moment", "Don't miss this"],
                "subtitles": ["Perfect timing", "Viral material"],
                "tone": "engaging",
            }

    def suggest_effects(self, segment_text: str) -> dict:
        """
        Suggest sound effects and transitions for a segment.

        Args:
            segment_text: Text content of the segment

        Returns:
            Dictionary with effect suggestions
        """
        prompt = f"""
Based on this video segment content, suggest sound effects and transitions.

Provide:
1. 2-3 sound effect suggestions (e.g., "whoosh", "clap", "notification")
2. Suggested transition type (e.g., "cut", "crossfade", "zoom")
3. Pacing recommendation (e.g., "fast", "moderate", "slow")
4. Music mood (e.g., "upbeat", "dramatic", "calm")

Format as JSON with keys: "sound_effects", "transition", "pacing", "music_mood"

Segment:
{segment_text}

Return ONLY valid JSON, no other text.
"""

        response = self._call_ai(prompt)

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                "sound_effects": ["transition", "impact"],
                "transition": "cut",
                "pacing": "moderate",
                "music_mood": "upbeat",
            }

    def analyze_frames_for_subtitles(
        self, frame_paths: List[Dict[str, any]], progress_callback=None, style: str = "portfolio"
    ) -> List[Dict]:
        """
        3-Pass Smart Subtitle Generation — CutSense v0.4 핵심 기능.

        Pass 1: 전체 프레임을 샘플링해서 영상의 전체 맥락 파악
        Pass 2: 전체 프레임으로 장면 경계(화면 전환 시점) 감지 — "언제 바뀌는지"만
        Pass 3: 감지된 장면 구간별로 자막 텍스트 생성 — "뭐라고 쓸지"만

        v0.4 변경: 기존 Pass 2가 장면 감지+자막 생성을 동시에 하던 것을 분리.
        각 Pass가 하나의 역할만 하므로 AI 정확도 향상.

        Args:
            frame_paths: List of {path, timestamp, duration} dicts
            progress_callback: Optional callback(stage, progress_pct, message)
            style: Subtitle style key

        Returns:
            List of subtitle dicts: [{start, end, text}]
        """
        if not frame_paths:
            return []

        if progress_callback:
            progress_callback("pass1", 0, "1단계: 영상 전체 맥락 파악 중...")

        # ── Pass 1: 전체 맥락 파악 (최대 8장 샘플) ──
        sample_step = max(1, len(frame_paths) // 8)
        sampled = frame_paths[::sample_step][:8]

        context = self._pass1_get_context(sampled)

        if progress_callback:
            progress_callback("pass1", 100, f"맥락 파악 완료: {context[:50]}...")

        # ── Pass 2: 장면 경계 감지 (배치 처리) ──
        if progress_callback:
            progress_callback("pass2", 0, "2단계: 장면 경계 감지 중...")

        all_boundaries = []
        batch_size = 16  # 경계 감지는 가벼움 → 더 큰 배치 가능
        total_batches = (len(frame_paths) + batch_size - 1) // batch_size

        for i in range(0, len(frame_paths), batch_size):
            batch = frame_paths[i:i + batch_size]
            batch_num = i // batch_size + 1

            if progress_callback:
                pct = int((batch_num / total_batches) * 100)
                progress_callback("pass2", pct, f"경계 감지 {batch_num}/{total_batches}...")

            boundaries = self._pass2_detect_boundaries(batch, context)
            all_boundaries.extend(boundaries)

        # 경계 → 장면 구간으로 변환
        scenes = self._boundaries_to_scenes(all_boundaries, frame_paths)

        if progress_callback:
            progress_callback("pass2", 100, f"{len(scenes)}개 장면 감지 완료")

        # ── Pass 3: 장면별 자막 생성 ──
        if progress_callback:
            progress_callback("pass3", 0, "3단계: 장면별 자막 생성 중...")

        subtitles = []
        for idx, scene in enumerate(scenes):
            if progress_callback:
                pct = int(((idx + 1) / len(scenes)) * 100)
                progress_callback("pass3", pct, f"자막 {idx + 1}/{len(scenes)} 생성 중...")

            sub = self._pass3_generate_subtitle(scene, context, style)
            if sub:
                subtitles.append(sub)

        # ── Post-processing ──
        subtitles = self._merge_similar_subtitles(subtitles)
        subtitles = [s for s in subtitles if (s["end"] - s["start"]) >= 2.5]

        # 인접 자막 간격이 1초 미만이면 이전 자막 end 늘려서 연결
        for i in range(len(subtitles) - 1):
            gap = subtitles[i + 1]["start"] - subtitles[i]["end"]
            if 0 < gap < 1.0:
                subtitles[i]["end"] = subtitles[i + 1]["start"]

        if progress_callback:
            progress_callback("done", 100, f"{len(subtitles)}개 스마트 자막 생성 완료!")

        return subtitles

    def _pass1_get_context(self, sampled_frames: List[Dict]) -> str:
        """Pass 1: 샘플 프레임으로 영상 전체 맥락 파악."""

        if self.settings.provider == "claude":
            return self._pass1_claude(sampled_frames)
        elif self.settings.provider == "grok":
            return self._pass1_grok(sampled_frames)
        raise ValueError(f"Unknown provider: {self.settings.provider}")

    def _pass1_claude(self, frames: List[Dict]) -> str:
        """Claude Vision으로 영상 맥락 파악."""
        content = [{
            "type": "text",
            "text": (
                "다음은 하나의 소프트웨어 시연 영상에서 균등하게 추출한 샘플 프레임들이야.\n"
                "이 영상이 전체적으로 무엇을 보여주는 영상인지 파악해줘.\n\n"
                "다음을 포함해서 3~5줄로 요약해:\n"
                "1. 어떤 소프트웨어/앱인지\n"
                "2. 영상에서 시연하는 주요 기능들\n"
                "3. 전체 흐름 (로그인→대시보드→설정 같은 순서)\n\n"
                "한국어로 답변해. 요약만 반환해."
            )
        }]

        for idx, frame in enumerate(frames):
            with open(frame["path"], "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            content.append({"type": "text", "text": f"[{frame['timestamp']:.0f}초]"})
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": image_data}
            })

        message = self.client.messages.create(
            model=self.settings.model, max_tokens=500,
            messages=[{"role": "user", "content": content}],
        )
        return message.content[0].text

    def _pass1_grok(self, frames: List[Dict]) -> str:
        """Grok Vision으로 영상 맥락 파악."""
        content = [{
            "type": "text",
            "text": (
                "다음은 하나의 소프트웨어 시연 영상에서 균등하게 추출한 샘플 프레임들이야.\n"
                "이 영상이 전체적으로 무엇을 보여주는 영상인지 파악해줘.\n\n"
                "다음을 포함해서 3~5줄로 요약해:\n"
                "1. 어떤 소프트웨어/앱인지\n"
                "2. 영상에서 시연하는 주요 기능들\n"
                "3. 전체 흐름 (로그인→대시보드→설정 같은 순서)\n\n"
                "한국어로 답변해. 요약만 반환해."
            )
        }]

        for idx, frame in enumerate(frames):
            with open(frame["path"], "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            content.append({"type": "text", "text": f"[{frame['timestamp']:.0f}초]"})
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
            })

        message = self.client.chat.completions.create(
            model=self.settings.model, max_tokens=500,
            messages=[{"role": "user", "content": content}],
        )
        return message.choices[0].message.content

    # ================================================================
    # Pass 2: 장면 경계 감지 — "언제 화면이 바뀌는지"만 판단
    # ================================================================

    def _pass2_detect_boundaries(self, frames: List[Dict], context: str) -> List[Dict]:
        """Pass 2: 프레임 배치에서 장면 경계(화면 전환 시점)만 감지."""
        if self.settings.provider == "claude":
            return self._pass2_boundaries_claude(frames, context)
        elif self.settings.provider == "grok":
            return self._pass2_boundaries_grok(frames, context)
        raise ValueError(f"Unknown provider: {self.settings.provider}")

    def _build_pass2_boundary_prompt(self, context: str) -> str:
        """Pass 2 장면 경계 감지 프롬프트."""
        return (
            f"## 영상 맥락\n{context}\n\n"
            "## 너의 역할: 장면 경계 감지기\n"
            "아래 프레임들을 순서대로 보고, '화면이 의미 있게 바뀌는 시점'만 찾아줘.\n"
            "자막 텍스트는 쓰지 마. 경계 시점과 간단한 설명만 반환해.\n\n"
            "## '의미 있는 화면 변화'란?\n"
            "- 다른 페이지/화면으로 이동\n"
            "- 새로운 기능/메뉴를 시연 시작\n"
            "- 팝업, 모달, 다이얼로그 등장/사라짐\n"
            "- 결과 화면 표시 (데이터 로딩 완료, 차트 생성 등)\n"
            "- 화면 레이아웃이 크게 바뀜\n\n"
            "## '의미 없는 변화' (무시)\n"
            "- 스크롤, 텍스트 입력, 마우스 이동, 로딩 스피너\n"
            "- 같은 화면 내 데이터 미세 변화\n"
            "- 연속 프레임이 거의 동일한 경우\n\n"
            "## 응답 형식 (JSON 배열만 반환)\n"
            '[{"timestamp": 15.0, "description": "대시보드에서 설정 페이지로 이동"}, ...]\n\n'
            "- timestamp: 화면이 바뀐 프레임의 [XX.X초] 값\n"
            "- description: 무엇이 바뀌었는지 10자 내외 설명\n"
            "- 변화가 없으면 빈 배열 [] 반환\n"
            "- JSON만 반환해. 다른 텍스트 없이."
        )

    def _pass2_boundaries_claude(self, frames: List[Dict], context: str) -> List[Dict]:
        """Claude Vision으로 장면 경계 감지."""
        content = [{
            "type": "text",
            "text": self._build_pass2_boundary_prompt(context)
        }]

        for frame in frames:
            with open(frame["path"], "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            content.append({"type": "text", "text": f"[{frame['timestamp']:.1f}초]"})
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": image_data}
            })

        message = self.client.messages.create(
            model=self.settings.model, max_tokens=1024,
            messages=[{"role": "user", "content": content}],
        )
        return self._parse_boundary_response(message.content[0].text)

    def _pass2_boundaries_grok(self, frames: List[Dict], context: str) -> List[Dict]:
        """Grok Vision으로 장면 경계 감지."""
        content = [{
            "type": "text",
            "text": self._build_pass2_boundary_prompt(context)
        }]

        for frame in frames:
            with open(frame["path"], "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            content.append({"type": "text", "text": f"[{frame['timestamp']:.1f}초]"})
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
            })

        message = self.client.chat.completions.create(
            model=self.settings.model, max_tokens=1024,
            messages=[{"role": "user", "content": content}],
        )
        return self._parse_boundary_response(message.choices[0].message.content)

    def _parse_boundary_response(self, response_text: str) -> List[Dict]:
        """Pass 2 응답에서 경계 정보 파싱."""
        import re
        try:
            boundaries = json.loads(response_text)
        except json.JSONDecodeError:
            match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if match:
                try:
                    boundaries = json.loads(match.group())
                except json.JSONDecodeError:
                    return []
            else:
                return []

        result = []
        for b in boundaries:
            if "timestamp" in b:
                result.append({
                    "timestamp": float(b["timestamp"]),
                    "description": str(b.get("description", "")),
                })
        return result

    def _boundaries_to_scenes(self, boundaries: List[Dict], frame_paths: List[Dict]) -> List[Dict]:
        """
        경계 시점 목록 → 장면 구간 목록으로 변환.

        예: 경계가 [10, 25, 40]이고 영상이 0~60초이면
        → 장면: [0~10, 10~25, 25~40, 40~60]

        각 장면에는 해당 구간의 대표 프레임 1~2장 포함.
        """
        if not frame_paths:
            return []

        first_ts = frame_paths[0]["timestamp"]
        last_ts = frame_paths[-1]["timestamp"] + frame_paths[-1].get("duration", 5.0)

        # 중복 제거 + 정렬
        boundary_times = sorted(set(b["timestamp"] for b in boundaries))

        # 경계가 없으면 전체를 하나의 장면으로
        if not boundary_times:
            boundary_times = [first_ts + (last_ts - first_ts) / 2]

        # 구간 생성
        edges = [first_ts] + boundary_times + [last_ts]
        scenes = []

        for i in range(len(edges) - 1):
            start = edges[i]
            end = edges[i + 1]
            if end - start < 2.0:  # 2초 미만 구간은 스킵
                continue

            # 이 구간에 해당하는 프레임 찾기
            scene_frames = [f for f in frame_paths if start <= f["timestamp"] < end]
            if not scene_frames:
                # 가장 가까운 프레임 1개라도 포함
                closest = min(frame_paths, key=lambda f: abs(f["timestamp"] - start))
                scene_frames = [closest]

            # 대표 프레임: 구간 시작 직후 + 중간 (최대 2장 — API 비용 절약)
            rep_frames = [scene_frames[0]]
            if len(scene_frames) > 2:
                rep_frames.append(scene_frames[len(scene_frames) // 2])

            # 경계 설명 찾기
            desc = ""
            for b in boundaries:
                if abs(b["timestamp"] - start) < 0.5:
                    desc = b.get("description", "")
                    break

            scenes.append({
                "start": start,
                "end": end,
                "frames": rep_frames,
                "description": desc,
            })

        return scenes

    # ================================================================
    # Pass 3: 장면별 자막 생성 — "뭐라고 쓸지"만 결정
    # ================================================================

    def _pass3_generate_subtitle(self, scene: Dict, context: str, style: str) -> Optional[Dict]:
        """Pass 3: 하나의 장면 구간에 대해 자막 텍스트 생성."""
        if self.settings.provider == "claude":
            return self._pass3_claude(scene, context, style)
        elif self.settings.provider == "grok":
            return self._pass3_grok(scene, context, style)
        raise ValueError(f"Unknown provider: {self.settings.provider}")

    def _build_pass3_prompt(self, scene: Dict, context: str, style: str) -> str:
        """Pass 3 자막 생성 프롬프트 — 장면 하나에 대해 자막 하나만.

        v0.4 튜닝: 스타일 프롬프트 전문 대신 핵심 3줄 요약 사용.
        긍정 지시 위주 ("이렇게 해")로 AI 혼란 방지.
        """
        style_info = SUBTITLE_STYLES.get(style, SUBTITLE_STYLES["portfolio"])
        # 스타일별 핵심 요약 (전체 프롬프트 대신 — Pass 3는 가볍게)
        style_brief = SUBTITLE_STYLE_BRIEFS.get(style, SUBTITLE_STYLE_BRIEFS["portfolio"])

        return (
            f"## 영상 맥락\n{context}\n\n"
            f"## 현재 장면\n"
            f"- 시간: {scene['start']:.1f}초 ~ {scene['end']:.1f}초 ({scene['end'] - scene['start']:.1f}초)\n"
            f"- 변화: {scene.get('description', '(없음)')}\n\n"
            f"## 자막 스타일: {style_info['name']}\n"
            f"{style_brief}\n\n"
            "## 판단 기준\n"
            "위 프레임이 이 장면의 대표 화면이야.\n"
            "자막이 있으면 시청자에게 도움이 되는지 판단해:\n"
            '- 도움 됨 → {{"text": "자막 내용"}} (한국어, 15~30자)\n'
            "- 도움 안 됨(로딩, 반복, 변화 없음) → null\n\n"
            "JSON만 반환해."
        )

    def _pass3_claude(self, scene: Dict, context: str, style: str) -> Optional[Dict]:
        """Claude Vision으로 장면 자막 생성."""
        content = [{
            "type": "text",
            "text": self._build_pass3_prompt(scene, context, style)
        }]

        for frame in scene["frames"]:
            with open(frame["path"], "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            content.append({"type": "text", "text": f"[{frame['timestamp']:.1f}초]"})
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": image_data}
            })

        message = self.client.messages.create(
            model=self.settings.model, max_tokens=256,
            messages=[{"role": "user", "content": content}],
        )
        return self._parse_pass3_response(message.content[0].text, scene)

    def _pass3_grok(self, scene: Dict, context: str, style: str) -> Optional[Dict]:
        """Grok Vision으로 장면 자막 생성."""
        content = [{
            "type": "text",
            "text": self._build_pass3_prompt(scene, context, style)
        }]

        for frame in scene["frames"]:
            with open(frame["path"], "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            content.append({"type": "text", "text": f"[{frame['timestamp']:.1f}초]"})
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
            })

        message = self.client.chat.completions.create(
            model=self.settings.model, max_tokens=256,
            messages=[{"role": "user", "content": content}],
        )
        return self._parse_pass3_response(message.choices[0].message.content, scene)

    def _parse_pass3_response(self, response_text: str, scene: Dict) -> Optional[Dict]:
        """Pass 3 응답 파싱 — 자막 하나 또는 null."""
        import re
        text = response_text.strip()

        # "null" 응답 처리
        if text.lower() in ("null", "none", "없음", "{}"):
            return None

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # JSON이 아닌 텍스트에서 추출 시도
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group())
                except json.JSONDecodeError:
                    return None
            else:
                # 순수 텍스트일 수도 있음 — 자막으로 사용
                if len(text) > 3 and len(text) < 100:
                    return {
                        "start": scene["start"],
                        "end": scene["end"],
                        "text": text.strip('"').strip("'"),
                    }
                return None

        if data is None:
            return None

        subtitle_text = data.get("text", "").strip()
        if not subtitle_text or subtitle_text in ("(동일 화면)", "동일 화면", "null"):
            return None

        return {
            "start": scene["start"],
            "end": scene["end"],
            "text": subtitle_text,
        }

    def _parse_subtitle_response(self, response_text: str, frames: List[Dict]) -> List[Dict]:
        """AI 응답에서 자막 JSON을 파싱."""
        import re

        try:
            subtitles = json.loads(response_text)
        except json.JSONDecodeError:
            match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if match:
                try:
                    subtitles = json.loads(match.group())
                except json.JSONDecodeError:
                    return [{"start": frames[0]["timestamp"], "end": frames[-1]["timestamp"] + 2, "text": "자막 파싱 실패"}]
            else:
                return [{"start": frames[0]["timestamp"], "end": frames[-1]["timestamp"] + 2, "text": "자막 파싱 실패"}]

        # Validate and clean
        result = []
        for sub in subtitles:
            text = sub.get("text", "").strip()
            if text and text != "(동일 화면)" and text != "동일 화면":
                result.append({
                    "start": float(sub.get("start", 0)),
                    "end": float(sub.get("end", 0)),
                    "text": text,
                })
        return result

    def _merge_similar_subtitles(self, subtitles: List[Dict]) -> List[Dict]:
        """인접한 동일/유사 자막을 병합."""
        if not subtitles:
            return subtitles

        merged = [subtitles[0].copy()]
        for sub in subtitles[1:]:
            prev = merged[-1]
            # 같은 텍스트이거나 시간이 겹치면 병합
            if sub["text"] == prev["text"] and sub["start"] <= prev["end"] + 1.0:
                prev["end"] = max(prev["end"], sub["end"])
            else:
                merged.append(sub.copy())

        return merged

    def _call_ai(self, prompt: str) -> str:
        """
        Make a request to the configured AI provider.

        Args:
            prompt: The prompt to send

        Returns:
            The AI response text
        """
        if not self.settings.api_key:
            raise ValueError("API key not configured")

        if self.settings.provider == "claude":
            message = self.client.messages.create(
                model=self.settings.model,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text

        elif self.settings.provider == "grok":
            message = self.client.chat.completions.create(
                model=self.settings.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024,
            )
            return message.choices[0].message.content

        raise ValueError(f"Unknown provider: {self.settings.provider}")
