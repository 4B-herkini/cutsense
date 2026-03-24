"""
Video processing module using FFmpeg for cutting, subtitle burning, and format conversion.
Handles all video manipulation operations with progress tracking.
"""

import os
import json
import subprocess
from pathlib import Path
from typing import Generator, Optional, Tuple, Dict, List
from dataclasses import dataclass
from PIL import Image
import ffmpeg


@dataclass
class VideoInfo:
    """Video metadata information."""
    duration: float
    width: int
    height: int
    fps: float
    codec: str
    file_size: int

    def to_dict(self) -> dict:
        return {
            "duration": self.duration,
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "codec": self.codec,
            "file_size": self.file_size,
        }


@dataclass
class SubtitleStyle:
    """Subtitle styling configuration."""
    font: str = "Arial"
    size: int = 24
    color: str = "white"
    position: str = "bottom"  # top, bottom, center
    bg_color: Optional[str] = "black"
    bold: bool = False
    italic: bool = False


class VideoProcessor:
    """Handles all video processing operations."""

    def __init__(self, uploads_dir: str = "../uploads"):
        """Initialize video processor with upload directory."""
        self.uploads_dir = uploads_dir
        os.makedirs(uploads_dir, exist_ok=True)

    def get_video_info(self, path: str) -> VideoInfo:
        """
        Extract video metadata.

        Args:
            path: Path to video file

        Returns:
            VideoInfo object with duration, resolution, fps, codec
        """
        try:
            probe = ffmpeg.probe(path)
            video_stream = next(
                (s for s in probe["streams"] if s["codec_type"] == "video"), None
            )

            if not video_stream:
                raise ValueError("No video stream found")

            duration = float(probe["format"].get("duration", 0))
            width = int(video_stream.get("width", 0))
            height = int(video_stream.get("height", 0))
            # eval() 제거 — 보안 취약점 (Opus 리뷰 지적)
            rate = video_stream.get("r_frame_rate", "30/1")
            if "/" in rate:
                num, den = map(int, rate.split("/"))
                fps = num / den if den else 30.0
            else:
                fps = float(rate)
            codec = video_stream.get("codec_name", "unknown")
            file_size = int(probe["format"].get("size", 0))

            return VideoInfo(
                duration=duration,
                width=width,
                height=height,
                fps=fps,
                codec=codec,
                file_size=file_size,
            )
        except Exception as e:
            raise RuntimeError(f"Failed to get video info: {str(e)}")

    def generate_thumbnail(self, path: str, timestamp: float = None) -> str:
        """
        Extract a frame as thumbnail.

        Args:
            path: Path to video file
            timestamp: Time in seconds (default: 10% of video)

        Returns:
            Path to generated thumbnail
        """
        try:
            info = self.get_video_info(path)
            if timestamp is None:
                timestamp = info.duration * 0.1

            thumb_path = os.path.join(
                self.uploads_dir,
                f"{Path(path).stem}_thumb.jpg",
            )

            ffmpeg.input(path, ss=timestamp).filter("scale", 320, -1).output(
                thumb_path, vframes=1
            ).run(quiet=True, overwrite_output=True)

            return thumb_path
        except Exception as e:
            raise RuntimeError(f"Failed to generate thumbnail: {str(e)}")

    def cut_segments(
        self, path: str, segments: List[Dict[str, float]]
    ) -> Generator[dict, None, str]:
        """
        Cut and merge video segments.

        Args:
            path: Path to video file
            segments: List of {start, end} dictionaries in seconds

        Yields:
            Progress updates with status and percentage

        Returns:
            Path to merged output file
        """
        try:
            output_path = os.path.join(
                self.uploads_dir,
                f"{Path(path).stem}_cut.mp4",
            )

            # Create concat demuxer file
            concat_file = os.path.join(self.uploads_dir, "concat_list.txt")
            cut_files = []

            yield {
                "status": "cutting",
                "progress": 0,
                "message": f"Processing {len(segments)} segments",
            }

            for i, segment in enumerate(segments):
                start = segment["start"]
                end = segment["end"]
                cut_path = os.path.join(
                    self.uploads_dir,
                    f"{Path(path).stem}_segment_{i}.mp4",
                )

                ffmpeg.input(path, ss=start, to=end).output(
                    cut_path, c="copy"
                ).run(quiet=True, overwrite_output=True)

                cut_files.append(cut_path)
                progress = int((i + 1) / len(segments) * 50)
                yield {
                    "status": "cutting",
                    "progress": progress,
                    "message": f"Cut segment {i + 1}/{len(segments)}",
                }

            # Merge segments
            with open(concat_file, "w", encoding="utf-8") as f:
                for cut_file in cut_files:
                    f.write(f"file '{cut_file}'\n")

            yield {
                "status": "merging",
                "progress": 50,
                "message": "Merging segments",
            }

            ffmpeg.input(concat_file, format="concat", safe=0).output(
                output_path, c="copy"
            ).run(quiet=True, overwrite_output=True)

            # Cleanup
            for cut_file in cut_files:
                if os.path.exists(cut_file):
                    os.remove(cut_file)
            if os.path.exists(concat_file):
                os.remove(concat_file)

            yield {
                "status": "complete",
                "progress": 100,
                "message": "Cutting complete",
            }

            return output_path

        except Exception as e:
            raise RuntimeError(f"Failed to cut segments: {str(e)}")

    def burn_subtitles(
        self,
        path: str,
        subtitles: List[Dict],
        style: Optional[SubtitleStyle] = None,
    ) -> Generator[dict, None, str]:
        """
        Burn subtitles into video using FFmpeg subprocess (Windows-safe).

        Args:
            path: Path to video file
            subtitles: List of {start, end, text} dictionaries
            style: Default subtitle style

        Yields:
            Progress updates

        Returns:
            Path to output video with subtitles
        """
        try:
            if style is None:
                style = SubtitleStyle()

            output_path = os.path.join(
                self.uploads_dir,
                f"{Path(path).stem}_subtitled.mp4",
            )

            # SRT를 temp 경로에 생성 (공백/한글 경로 문제 방지 — Opus 리뷰)
            import tempfile
            srt_fd, srt_path = tempfile.mkstemp(suffix=".srt", prefix="cutsense_")
            os.close(srt_fd)

            with open(srt_path, "w", encoding="utf-8") as f:
                for i, sub in enumerate(subtitles, 1):
                    start_time = self._seconds_to_srt_time(sub["start"])
                    end_time = self._seconds_to_srt_time(sub["end"])
                    text = sub["text"]
                    f.write(f"{i}\n{start_time} --> {end_time}\n{text}\n\n")

            yield {
                "status": "burning",
                "progress": 0,
                "message": "자막 입히는 중...",
            }

            # Windows-safe: 경로를 forward slash로 + 콜론 이스케이프 (FFmpeg libass용)
            srt_escaped = srt_path.replace("\\", "/").replace(":", "\\:")

            # ASS style string for subtitle formatting
            force_style = (
                f"FontName=Arial,"
                f"FontSize={style.size},"
                f"PrimaryColour=&H00FFFFFF,"
                f"OutlineColour=&H00000000,"
                f"BorderStyle=3,"
                f"Outline=1,"
                f"Shadow=0,"
                f"MarginV=30,"
                f"Bold=1"
            )

            # subprocess list mode — 따옴표 없이 (Gemini 리뷰: shell=False에서 quote 불필요)
            cmd = [
                "ffmpeg", "-y",
                "-i", path,
                "-vf", f"subtitles={srt_escaped}:force_style={force_style}",
                "-c:v", "libx264", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                output_path,
            ]

            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300
            )

            if result.returncode != 0:
                # Fallback: force_style 없이 기본으로 시도
                cmd_simple = [
                    "ffmpeg", "-y",
                    "-i", path,
                    "-vf", f"subtitles={srt_escaped}",
                    "-c:v", "libx264", "-crf", "23",
                    "-c:a", "aac", "-b:a", "128k",
                    output_path,
                ]
                result = subprocess.run(
                    cmd_simple, capture_output=True, text=True, timeout=300
                )

                if result.returncode != 0:
                    raise RuntimeError(
                        f"FFmpeg subtitle burn failed: {result.stderr[-500:]}"
                    )

            # Cleanup SRT
            if os.path.exists(srt_path):
                os.remove(srt_path)

            yield {
                "status": "complete",
                "progress": 100,
                "message": "자막 입히기 완료!",
            }

            return output_path

        except subprocess.TimeoutExpired:
            raise RuntimeError("자막 입히기 시간 초과 (5분)")
        except Exception as e:
            raise RuntimeError(f"Failed to burn subtitles: {str(e)}")

    def convert_aspect_ratio(
        self, path: str, ratio: str = "9:16"
    ) -> Generator[dict, None, str]:
        """
        Convert video to different aspect ratio (horizontal to vertical with blur background).

        Args:
            path: Path to video file
            ratio: Target ratio (e.g., "9:16" for vertical)

        Yields:
            Progress updates

        Returns:
            Path to converted video
        """
        try:
            info = self.get_video_info(path)
            output_path = os.path.join(
                self.uploads_dir,
                f"{Path(path).stem}_vertical.mp4",
            )

            yield {
                "status": "converting",
                "progress": 0,
                "message": f"Converting to {ratio} ratio",
            }

            ratio_parts = ratio.split(":")
            target_ratio = float(ratio_parts[0]) / float(ratio_parts[1])

            current_ratio = info.width / info.height

            if current_ratio > target_ratio:
                # Original is wider - crop width
                new_width = int(info.height * target_ratio)
                new_height = info.height
            else:
                # Original is narrower - crop height
                new_width = info.width
                new_height = int(info.width / target_ratio)

            # Center crop
            x_offset = (info.width - new_width) // 2
            y_offset = (info.height - new_height) // 2

            # Create blurred background and overlay centered video
            blur_filter = "scale=1080:1920,boxblur=40"
            crop_filter = f"crop={new_width}:{new_height}:{x_offset}:{y_offset}"
            overlay_filter = f"overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2"

            yield {
                "status": "converting",
                "progress": 50,
                "message": "Processing aspect ratio",
            }

            ffmpeg.filter(
                [
                    ffmpeg.input(path).filter(blur_filter),
                    ffmpeg.input(path).filter(crop_filter),
                ],
                overlay_filter,
            ).output(output_path, vcodec="libx264", crf=23).run(
                quiet=True, overwrite_output=True
            )

            yield {
                "status": "complete",
                "progress": 100,
                "message": "Aspect ratio conversion complete",
            }

            return output_path

        except Exception as e:
            raise RuntimeError(f"Failed to convert aspect ratio: {str(e)}")

    def export_video(
        self, path: str, quality: str = "medium", format_type: str = "horizontal"
    ) -> Generator[dict, None, str]:
        """
        Export final video with quality settings.
        Uses subprocess for Windows compatibility.

        Args:
            path: Path to video file
            quality: Quality level (low, medium, high)
            format_type: Output format (horizontal, vertical, both)

        Yields:
            Progress updates

        Returns:
            Path to exported video (or first path if "both")
        """
        try:
            crf_map = {"low": 28, "medium": 23, "high": 18}
            crf = crf_map.get(quality, 23)

            outputs = {}

            if format_type in ["horizontal", "both"]:
                yield {
                    "status": "exporting",
                    "progress": 10,
                    "message": "가로(16:9) 내보내기 중...",
                }

                horizontal_path = os.path.join(
                    self.uploads_dir,
                    f"{Path(path).stem}_export_h.mp4",
                )

                cmd = [
                    "ffmpeg", "-y", "-i", path,
                    "-c:v", "libx264", "-crf", str(crf),
                    "-c:a", "aac", "-b:a", "128k",
                    horizontal_path,
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
                if result.returncode != 0:
                    raise RuntimeError(f"가로 내보내기 실패: {result.stderr[-300:]}")

                outputs["horizontal"] = horizontal_path
                yield {
                    "status": "exporting",
                    "progress": 50 if format_type == "both" else 90,
                    "message": "가로 내보내기 완료",
                }

            if format_type in ["vertical", "both"]:
                yield {
                    "status": "exporting",
                    "progress": 50 if format_type == "both" else 10,
                    "message": "세로(9:16) 변환 중...",
                }

                vertical_path = os.path.join(
                    self.uploads_dir,
                    f"{Path(path).stem}_export_v.mp4",
                )

                # 세로 변환: 블러 배경 + 중앙 오버레이
                info = self.get_video_info(path)
                vf_filter = (
                    f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
                    f"crop=1080:1920,boxblur=20:5[bg];"
                    f"[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
                    f"[bg][fg]overlay=(W-w)/2:(H-h)/2"
                )

                cmd = [
                    "ffmpeg", "-y", "-i", path,
                    "-filter_complex", vf_filter,
                    "-c:v", "libx264", "-crf", str(crf),
                    "-c:a", "aac", "-b:a", "128k",
                    vertical_path,
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
                if result.returncode != 0:
                    raise RuntimeError(f"세로 변환 실패: {result.stderr[-300:]}")

                outputs["vertical"] = vertical_path
                yield {
                    "status": "exporting",
                    "progress": 90,
                    "message": "세로 내보내기 완료",
                }

            yield {
                "status": "complete",
                "progress": 100,
                "message": "내보내기 완료!",
            }

            # Return first available path
            return outputs.get("horizontal") or outputs.get("vertical") or path

        except subprocess.TimeoutExpired:
            raise RuntimeError("내보내기 시간 초과 (10분)")
        except Exception as e:
            raise RuntimeError(f"Failed to export video: {str(e)}")

    def extract_frames(
        self, path: str, interval: float = 5.0, keep_segments: List[Dict] = None
    ) -> List[Dict]:
        """
        Extract frames from video at regular intervals for Vision analysis.

        Args:
            path: Path to video file
            interval: Seconds between frame captures (default: 5s)
            keep_segments: Optional list of {start, end} dicts — if provided,
                           only extract frames from these time ranges.
                           Timestamps in returned frames are ORIGINAL video time.

        Returns:
            List of {path, timestamp, duration} dicts
        """
        try:
            info = self.get_video_info(path)
            frames_dir = os.path.join(self.uploads_dir, f"{Path(path).stem}_frames")
            os.makedirs(frames_dir, exist_ok=True)

            frames = []

            if keep_segments:
                # 보존 구간만 프레임 추출 — 타임스탬프는 원본 영상 기준
                for seg in keep_segments:
                    timestamp = seg["start"]
                    while timestamp < seg["end"]:
                        frame_path = os.path.join(
                            frames_dir,
                            f"frame_{int(timestamp * 10):06d}.jpg"
                        )
                        duration = min(interval, seg["end"] - timestamp)

                        ffmpeg.input(path, ss=timestamp).filter(
                            "scale", 1280, -1
                        ).output(
                            frame_path, vframes=1, qscale=2
                        ).run(quiet=True, overwrite_output=True)

                        frames.append({
                            "path": frame_path,
                            "timestamp": timestamp,
                            "duration": duration,
                        })
                        timestamp += interval
            else:
                # 전체 영상 프레임 추출
                timestamp = 0.0
                while timestamp < info.duration:
                    frame_path = os.path.join(
                        frames_dir,
                        f"frame_{int(timestamp * 10):06d}.jpg"
                    )
                    duration = min(interval, info.duration - timestamp)

                    ffmpeg.input(path, ss=timestamp).filter(
                        "scale", 1280, -1
                    ).output(
                        frame_path, vframes=1, qscale=2
                    ).run(quiet=True, overwrite_output=True)

                    frames.append({
                        "path": frame_path,
                        "timestamp": timestamp,
                        "duration": duration,
                    })
                    timestamp += interval

            return frames

        except Exception as e:
            raise RuntimeError(f"Failed to extract frames: {str(e)}")

    def cleanup_frames(self, path: str) -> None:
        """Remove extracted frames directory."""
        frames_dir = os.path.join(self.uploads_dir, f"{Path(path).stem}_frames")
        if os.path.exists(frames_dir):
            import shutil
            shutil.rmtree(frames_dir)

    @staticmethod
    def _seconds_to_srt_time(seconds: float) -> str:
        """Convert seconds to SRT timestamp format."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    @staticmethod
    def _get_font_path(font_name: str) -> str:
        """Get system font file path."""
        # Default to Arial/DejaVuSans or system default
        common_paths = [
            f"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            f"/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            f"/Windows/Fonts/arial.ttf",
            f"/System/Library/Fonts/Arial.ttf",
        ]
        for path in common_paths:
            if os.path.exists(path):
                return path
        return "Arial"  # Fallback to default

    @staticmethod
    def _get_y_position(position: str) -> str:
        """Get Y position for subtitle placement."""
        positions = {
            "top": "h/10",
            "center": "h/2",
            "bottom": "h-text_h-10",
        }
        return positions.get(position, "h-text_h-10")

    def concat_videos(self, video_paths: list, output_name: str = "project_export.mp4", quality: str = "medium") -> Generator[dict, None, str]:
        """
        Concatenate multiple videos into one using FFmpeg concat demuxer.

        Args:
            video_paths: List of video file paths in order
            output_name: Output filename
            quality: Quality level (low, medium, high)

        Yields:
            Progress updates

        Returns:
            Path to concatenated video
        """
        import tempfile

        try:
            if not video_paths:
                raise ValueError("No videos to concatenate")

            if len(video_paths) == 1:
                # 영상 1개면 그냥 복사
                output_path = os.path.join(self.uploads_dir, output_name)
                cmd = [
                    "ffmpeg", "-y", "-i", video_paths[0],
                    "-c", "copy", output_path
                ]
                yield {"status": "exporting", "progress": 50, "message": "Exporting single video..."}
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
                if result.returncode != 0:
                    raise RuntimeError(f"Export failed: {result.stderr[-300:]}")
                yield {"status": "exporting", "progress": 100, "message": "Complete!"}
                return output_path

            # 멀티 영상: concat demuxer 사용
            yield {"status": "exporting", "progress": 5, "message": f"Preparing {len(video_paths)} videos..."}

            # 1단계: 모든 영상을 동일 코덱/해상도로 re-encode
            crf_map = {"low": 28, "medium": 23, "high": 18}
            crf = str(crf_map.get(quality, 23))

            # 첫 영상 해상도 기준
            first_info = self.get_video_info(video_paths[0])
            target_w = first_info.width
            target_h = first_info.height

            temp_files = []
            for i, vpath in enumerate(video_paths):
                progress = 10 + int((i / len(video_paths)) * 60)
                yield {"status": "exporting", "progress": progress, "message": f"Re-encoding video {i+1}/{len(video_paths)}..."}

                temp_path = os.path.join(self.uploads_dir, f"_concat_temp_{i}.ts")
                temp_files.append(temp_path)

                cmd = [
                    "ffmpeg", "-y", "-i", vpath,
                    "-vf", f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2",
                    "-c:v", "libx264", "-crf", crf,
                    "-c:a", "aac", "-b:a", "128k",
                    "-ar", "44100", "-ac", "2",
                    temp_path
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
                if result.returncode != 0:
                    raise RuntimeError(f"Re-encode failed for video {i+1}: {result.stderr[-300:]}")

            # 2단계: concat demuxer로 이어붙이기
            yield {"status": "exporting", "progress": 80, "message": "Concatenating videos..."}

            concat_list = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, dir=self.uploads_dir)
            for tf in temp_files:
                concat_list.write(f"file '{tf}'\n")
            concat_list.close()

            output_path = os.path.join(self.uploads_dir, output_name)
            cmd = [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", concat_list.name,
                "-c", "copy", output_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

            # 임시 파일 정리
            os.unlink(concat_list.name)
            for tf in temp_files:
                try:
                    os.unlink(tf)
                except:
                    pass

            if result.returncode != 0:
                raise RuntimeError(f"Concat failed: {result.stderr[-300:]}")

            yield {"status": "exporting", "progress": 100, "message": "Complete!"}
            return output_path

        except Exception as e:
            yield {"status": "error", "message": str(e)}
            return ""
