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


class AIService:
    """Service for AI-powered video analysis and content generation."""

    CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config.json")
    DEFAULT_SETTINGS = {
        "provider": "claude",
        "model": "claude-3-5-sonnet-20241022",
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
            raise ValueError(
                f"API key not configured for {self.settings.provider}. "
                "Please set it via /api/ai/settings"
            )

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
        self, frame_paths: List[Dict[str, any]], progress_callback=None
    ) -> List[Dict]:
        """
        2-Pass Smart Subtitle Generation — CutSense 핵심 기능.

        Pass 1: 전체 프레임을 샘플링해서 영상의 전체 맥락 파악
        Pass 2: 맥락을 알고 있는 상태에서 장면 전환 감지 + 스마트 자막 생성

        Args:
            frame_paths: List of {path, timestamp, duration} dicts
            progress_callback: Optional callback(stage, progress_pct, message)

        Returns:
            List of subtitle dicts: [{start, end, text}]
        """
        if progress_callback:
            progress_callback("pass1", 0, "1단계: 영상 전체 맥락 파악 중...")

        # ── Pass 1: 전체 맥락 파악 (매 10번째 프레임 샘플링) ──
        sample_step = max(1, len(frame_paths) // 8)  # 최대 8장 샘플
        sampled = frame_paths[::sample_step][:8]

        context = self._pass1_get_context(sampled)

        if progress_callback:
            progress_callback("pass1", 100, f"맥락 파악 완료: {context[:50]}...")

        # ── Pass 2: 스마트 자막 생성 (배치 처리) ──
        if progress_callback:
            progress_callback("pass2", 0, "2단계: 장면별 스마트 자막 생성 중...")

        subtitles = []
        batch_size = 6  # 한 번에 6프레임씩
        total_batches = (len(frame_paths) + batch_size - 1) // batch_size

        for i in range(0, len(frame_paths), batch_size):
            batch = frame_paths[i:i + batch_size]
            batch_num = i // batch_size + 1

            if progress_callback:
                pct = int((batch_num / total_batches) * 100)
                progress_callback("pass2", pct, f"배치 {batch_num}/{total_batches} 분석 중...")

            batch_subs = self._pass2_smart_subtitles(batch, context)
            subtitles.extend(batch_subs)

        # ── Post-processing: 중복/유사 자막 병합 ──
        subtitles = self._merge_similar_subtitles(subtitles)

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

    def _pass2_smart_subtitles(self, frames: List[Dict], context: str) -> List[Dict]:
        """Pass 2: 맥락 기반 스마트 자막 생성."""

        if self.settings.provider == "claude":
            return self._pass2_claude(frames, context)
        elif self.settings.provider == "grok":
            return self._pass2_grok(frames, context)
        raise ValueError(f"Unknown provider: {self.settings.provider}")

    def _pass2_claude(self, frames: List[Dict], context: str) -> List[Dict]:
        """Claude Vision으로 스마트 자막 생성."""
        content = [{
            "type": "text",
            "text": (
                f"## 영상 맥락\n{context}\n\n"
                "## 지시사항\n"
                "위 맥락을 이해한 상태에서, 아래 프레임들을 분석하고 자막을 생성해.\n\n"
                "### 규칙\n"
                "1. **화면이 바뀔 때만** 새 자막을 만들어. 같은 화면이면 건너뛰기\n"
                "2. 자막은 **15~25자** 이내, 시청자에게 말하듯 자연스럽게\n"
                "3. 딱딱한 설명 대신 **센스 있는 코멘트** 스타일로:\n"
                "   - 좋은 예: \"대시보드 한눈에 쫙~ 진행률이 보이네요\"\n"
                "   - 좋은 예: \"여기서 금형 번호 입력하면 끝!\"\n"
                "   - 나쁜 예: \"메인 대시보드 화면입니다\"\n"
                "4. 적절한 곳에 가벼운 **유머나 감탄** 삽입 (과하지 않게)\n"
                "5. UI 요소명, 버튼명 등 구체적 정보 포함\n"
                "6. 각 프레임의 timestamp를 보고 자막의 start/end를 직접 결정해\n"
                "   - 화면이 변하는 시점 = 새 자막 시작\n"
                "   - 다음 화면 변화 직전 = 자막 끝\n\n"
                "### 응답 형식 (JSON 배열만 반환)\n"
                '[{"start": 0.0, "end": 6.0, "text": "자막 내용"}, ...]\n\n'
                "- 같은 화면이 이어지면 자막을 합쳐서 end를 늘려\n"
                "- 모든 프레임에 자막을 달 필요 없어. 의미 있는 변화가 있을 때만\n"
                "- JSON만 반환해. 다른 텍스트 없이."
            )
        }]

        for idx, frame in enumerate(frames):
            with open(frame["path"], "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            content.append({"type": "text", "text": f"[{frame['timestamp']:.1f}초]"})
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": image_data}
            })

        message = self.client.messages.create(
            model=self.settings.model, max_tokens=2048,
            messages=[{"role": "user", "content": content}],
        )

        return self._parse_subtitle_response(message.content[0].text, frames)

    def _pass2_grok(self, frames: List[Dict], context: str) -> List[Dict]:
        """Grok Vision으로 스마트 자막 생성."""
        content = [{
            "type": "text",
            "text": (
                f"## 영상 맥락\n{context}\n\n"
                "## 지시사항\n"
                "위 맥락을 이해한 상태에서, 아래 프레임들을 분석하고 자막을 생성해.\n\n"
                "### 규칙\n"
                "1. **화면이 바뀔 때만** 새 자막을 만들어. 같은 화면이면 건너뛰기\n"
                "2. 자막은 **15~25자** 이내, 시청자에게 말하듯 자연스럽게\n"
                "3. 딱딱한 설명 대신 **센스 있는 코멘트** 스타일로:\n"
                "   - 좋은 예: \"대시보드 한눈에 쫙~ 진행률이 보이네요\"\n"
                "   - 좋은 예: \"여기서 금형 번호 입력하면 끝!\"\n"
                "   - 나쁜 예: \"메인 대시보드 화면입니다\"\n"
                "4. 적절한 곳에 가벼운 **유머나 감탄** 삽입 (과하지 않게)\n"
                "5. UI 요소명, 버튼명 등 구체적 정보 포함\n"
                "6. 각 프레임의 timestamp를 보고 자막의 start/end를 직접 결정해\n\n"
                "### 응답 형식 (JSON 배열만 반환)\n"
                '[{"start": 0.0, "end": 6.0, "text": "자막 내용"}, ...]\n\n'
                "- 같은 화면이 이어지면 자막을 합쳐서 end를 늘려\n"
                "- 모든 프레임에 자막을 달 필요 없어. 의미 있는 변화가 있을 때만\n"
                "- JSON만 반환해."
            )
        }]

        for idx, frame in enumerate(frames):
            with open(frame["path"], "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            content.append({"type": "text", "text": f"[{frame['timestamp']:.1f}초]"})
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
            })

        message = self.client.chat.completions.create(
            model=self.settings.model, max_tokens=2048,
            messages=[{"role": "user", "content": content}],
        )

        return self._parse_subtitle_response(message.choices[0].message.content, frames)

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
