"""
FastAPI backend for CutSense video editor.
Handles video processing, AI analysis, and project management.
"""

import os
import json
import asyncio
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, WebSocket, HTTPException, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool  # Gemini 리뷰: 이벤트 루프 블로킹 방지
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import aiofiles
import uvicorn

from video_processor import VideoProcessor, VideoInfo, SubtitleStyle
from ai_service import AIService, AISettings


# ============================================================================
# Pydantic Models
# ============================================================================


class Segment(BaseModel):
    """Video segment definition."""
    start: float = Field(..., ge=0, description="Start time in seconds")
    end: float = Field(..., gt=0, description="End time in seconds")


class CutRequest(BaseModel):
    """Request to cut and merge video segments."""
    file_path: str
    segments: List[Segment]


class SubtitleItem(BaseModel):
    """Single subtitle entry."""
    start: float
    end: float
    text: str
    style: Optional[Dict] = None


class SubtitleRequest(BaseModel):
    """Request to burn subtitles into video."""
    file_path: str
    subtitles: List[SubtitleItem]


class VisionSubtitleRequest(BaseModel):
    """Request to generate subtitles from screen capture using Vision AI."""
    file_path: str


class ExportRequest(BaseModel):
    """Request to export final video."""
    file_path: str
    format: str = Field("horizontal", pattern="^(horizontal|vertical|both)$")
    quality: str = Field("medium", pattern="^(low|medium|high)$")
    output_name: Optional[str] = None


class AnalyzeRequest(BaseModel):
    """Request for AI analysis of transcript."""
    transcript: str


class GenerateTitlesRequest(BaseModel):
    """Request for AI title generation."""
    segment_text: str


class AISettingsRequest(BaseModel):
    """Request to update AI settings."""
    provider: str = Field(..., pattern="^(claude|grok)$")
    api_key: str
    model: str


class VideoItem(BaseModel):
    """Single video in a project."""
    file_path: str
    original_filename: str = ""
    order: int = 0
    cuts: Optional[List[Segment]] = None
    subtitles: Optional[List[SubtitleItem]] = None


class ProjectData(BaseModel):
    """Project state for saving (v2: multi-video)."""
    name: str
    file_path: str = ""  # legacy single-video compat
    videos: Optional[List[VideoItem]] = None
    cuts: Optional[List[Segment]] = None  # legacy compat
    subtitles: Optional[List[SubtitleItem]] = None  # legacy compat
    settings: Optional[Dict] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProjectResponse(BaseModel):
    """Saved project metadata."""
    id: str
    name: str
    file_path: str = ""
    video_count: int = 0
    updated_at: str


# ============================================================================
# FastAPI Setup
# ============================================================================

app = FastAPI(
    title="CutSense Backend",
    description="AI-powered video editor backend",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
UPLOADS_DIR = "../uploads"
PROJECTS_DIR = "../projects"
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(PROJECTS_DIR, exist_ok=True)

video_processor = VideoProcessor(UPLOADS_DIR)
try:
    ai_service = AIService()
except ValueError:
    # API key not configured yet
    ai_service = None


# ============================================================================
# WebSocket Manager
# ============================================================================


class ConnectionManager:
    """Manages WebSocket connections for progress updates."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


# ============================================================================
# Helper Functions
# ============================================================================


async def broadcast_progress(status: str, progress: int, message: str) -> None:
    """Broadcast progress update to all connected clients."""
    await manager.broadcast(
        {
            "status": status,
            "progress": progress,
            "message": message,
        }
    )


def get_project_id(name: str) -> str:
    """Generate project ID from name."""
    return name.lower().replace(" ", "_").replace("/", "_")


# ============================================================================
# Upload & Video Info Endpoints
# ============================================================================


@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)) -> dict:
    """
    Upload video file and return metadata.

    Returns:
        - file_path: Path to uploaded file
        - info: Video metadata (duration, resolution, fps, etc.)
        - thumbnail: Path to generated thumbnail
    """
    try:
        # Save uploaded file with safe naming for Korean filenames
        file_ext = Path(file.filename).suffix
        safe_filename = f"{datetime.now().timestamp()}{file_ext}"
        file_path = os.path.join(UPLOADS_DIR, safe_filename)

        # Save file
        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)

        # Get video info
        info = video_processor.get_video_info(file_path)

        # Generate thumbnail
        thumbnail_path = video_processor.generate_thumbnail(file_path)

        return {
            "success": True,
            "file_path": file_path,
            "original_filename": file.filename,
            "info": info.to_dict(),
            "thumbnail": thumbnail_path,
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Upload failed: {str(e)}",
        )


@app.post("/api/upload-multiple")
async def upload_multiple_videos(files: List[UploadFile] = File(...)) -> dict:
    """Upload multiple video files at once."""
    try:
        results = []
        for file in files:
            file_ext = Path(file.filename).suffix
            safe_filename = f"{datetime.now().timestamp()}{file_ext}"
            file_path = os.path.join(UPLOADS_DIR, safe_filename)

            async with aiofiles.open(file_path, "wb") as f:
                content = await file.read()
                await f.write(content)

            info = video_processor.get_video_info(file_path)
            thumbnail_path = video_processor.generate_thumbnail(file_path)

            results.append({
                "file_path": file_path,
                "original_filename": file.filename,
                "info": info.to_dict(),
                "thumbnail": thumbnail_path,
            })

        return {"success": True, "files": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(e)}")


@app.get("/api/uploads")
async def list_uploads() -> dict:
    """List uploaded video files (newest first) with saved subtitles if available."""
    try:
        files = []
        for f in sorted(Path(UPLOADS_DIR).iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if f.suffix.lower() in ('.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv'):
                # Check for saved subtitles
                subs_path = str(f).rsplit(".", 1)[0] + "_subtitles.json"
                subtitles = []
                if os.path.exists(subs_path):
                    with open(subs_path, "r", encoding="utf-8") as sf:
                        subtitles = json.load(sf)
                files.append({
                    "filename": f.name,
                    "path": str(f),
                    "size": f.stat().st_size,
                    "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                    "subtitles": subtitles,
                })
        return {"files": files}
    except Exception as e:
        return {"files": []}


@app.get("/api/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve an uploaded video file for browser playback."""
    filename = os.path.basename(filename)  # Path Traversal 방어 (Gemini 리뷰)
    file_path = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="video/mp4")


@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """Download exported video file."""
    filename = os.path.basename(filename)  # Path Traversal 방어 (Gemini 리뷰)
    file_path = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    from urllib.parse import quote
    safe_filename = quote(filename)
    return FileResponse(
        file_path,
        media_type="video/mp4",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}",
        },
    )


@app.get("/api/video-info/{file_path:path}")
async def get_video_info(file_path: str) -> dict:
    """Get video metadata for a file."""
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        info = video_processor.get_video_info(file_path)
        return {"success": True, "info": info.to_dict()}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Video Processing Endpoints
# ============================================================================


def _consume_generator(gen):
    """동기 generator를 소진하고 return value를 반환. threadpool에서 실행용."""
    output_path = None
    try:
        while True:
            next(gen)
    except StopIteration as e:
        output_path = e.value
    return output_path


@app.post("/api/cut")
async def cut_segments(request: CutRequest) -> dict:
    """Cut and merge video segments."""
    try:
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail="File not found")

        segments = [{"start": s.start, "end": s.end} for s in request.segments]
        gen = video_processor.cut_segments(request.file_path, segments)

        # run_in_threadpool: 이벤트 루프 블로킹 방지 (Gemini 리뷰)
        output_path = await run_in_threadpool(_consume_generator, gen)

        return {"success": True, "output_path": output_path}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/subtitle")
async def burn_subtitles(request: SubtitleRequest) -> dict:
    """Burn subtitles into video with styling."""
    try:
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail="File not found")

        subtitles = [
            {"start": s.start, "end": s.end, "text": s.text}
            for s in request.subtitles
        ]
        gen = video_processor.burn_subtitles(request.file_path, subtitles)
        output_path = await run_in_threadpool(_consume_generator, gen)

        return {"success": True, "output_path": output_path}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/export")
async def export_video(request: ExportRequest) -> dict:
    """Export final video with quality settings."""
    try:
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail="File not found")

        gen = video_processor.export_video(
            request.file_path,
            quality=request.quality,
            format_type=request.format,
        )
        output_path = await run_in_threadpool(_consume_generator, gen)

        # 사용자 지정 파일명 적용
        if request.output_name and output_path:
            import re
            safe_name = re.sub(r'[^a-zA-Z0-9가-힣_\-]', '_', request.output_name)
            ext = os.path.splitext(output_path)[1] or '.mp4'
            new_path = os.path.join(os.path.dirname(output_path), f"{safe_name}{ext}")
            if os.path.exists(output_path) and output_path != new_path:
                if os.path.exists(new_path):
                    os.remove(new_path)
                os.rename(output_path, new_path)
                output_path = new_path

        return {"success": True, "output_path": output_path}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# AI Endpoints
# ============================================================================


@app.post("/api/ai/analyze")
async def analyze_transcript(request: AnalyzeRequest) -> dict:
    """
    Analyze video transcript to find highlight segments.

    Request:
        - transcript: Video transcript or SRT content
    """
    try:
        if not ai_service:
            raise HTTPException(
                status_code=503,
                detail="AI service not configured. Set API credentials first.",
            )

        result = ai_service.analyze_transcript(request.transcript)
        return {"success": True, "analysis": result}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ai/generate-titles")
async def generate_titles(request: GenerateTitlesRequest) -> dict:
    """Generate hook titles and subtitles for a segment."""
    try:
        if not ai_service:
            raise HTTPException(
                status_code=503,
                detail="AI service not configured.",
            )

        result = ai_service.generate_titles(request.segment_text)
        return {"success": True, "titles": result}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ai/vision-subtitles")
async def generate_vision_subtitles(request: VisionSubtitleRequest) -> dict:
    """
    CutSense 핵심 기능: 화면 캡처 영상을 Vision AI로 분석하여 자막 자동 생성.
    음성 없는 시연 영상에서 AI가 화면을 보고 설명 자막을 만들어줌.

    Request:
        - file_path: Path to uploaded video
        - interval: Seconds between frame captures (default: 5.0)
    """
    try:
        if not ai_service:
            raise HTTPException(
                status_code=503,
                detail="AI service not configured. Set API credentials first.",
            )

        file_path = request.file_path
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Video file not found")

        # Smart interval: 3초 — 시연 영상은 장면 전환이 느려서 충분 (비용 ~30% 절감)
        SMART_INTERVAL = 3.0

        # Step 1: Extract frames at 3-second intervals
        frames = video_processor.extract_frames(file_path, SMART_INTERVAL)

        # Step 2: 2-Pass Smart Analysis
        subtitles = ai_service.analyze_frames_for_subtitles(frames)

        # Step 3: Cleanup extracted frames
        video_processor.cleanup_frames(file_path)

        # Step 4: Save subtitles to JSON (persist across refreshes)
        subs_path = file_path.rsplit(".", 1)[0] + "_subtitles.json"
        with open(subs_path, "w", encoding="utf-8") as f:
            json.dump(subtitles, f, ensure_ascii=False, indent=2)

        return {
            "success": True,
            "subtitles": subtitles,
            "frame_count": len(frames),
            "message": f"스마트 분석 완료! {len(subtitles)}개 자막 생성 (2-Pass AI, 3초 간격)",
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_log = os.path.join(Path(__file__).parent.parent, "error.log")
        with open(error_log, "a", encoding="utf-8") as f:
            f.write(f"\n=== VISION ERROR {datetime.now()} ===\n")
            f.write(f"{str(e)}\n")
            traceback.print_exc(file=f)
        try:
            video_processor.cleanup_frames(request.file_path)
        except:
            pass
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ai/suggest-effects")
async def suggest_effects(request: GenerateTitlesRequest) -> dict:
    """Suggest sound effects and transitions for a segment."""
    try:
        if not ai_service:
            raise HTTPException(
                status_code=503,
                detail="AI service not configured.",
            )

        result = ai_service.suggest_effects(request.segment_text)
        return {"success": True, "suggestions": result}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/ai/settings")
async def get_ai_settings() -> dict:
    """Get current AI provider settings."""
    try:
        if ai_service:
            return {
                "success": True,
                "settings": {
                    "provider": ai_service.settings.provider,
                    "model": ai_service.settings.model,
                    "api_key_set": bool(ai_service.settings.api_key),
                },
            }
        return {
            "success": True,
            "settings": {
                "provider": "claude",
                "model": "claude-3-5-sonnet-20241022",
                "api_key_set": False,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ai/settings")
async def update_ai_settings(request: AISettingsRequest) -> dict:
    """Save AI provider settings."""
    try:
        global ai_service

        settings = AISettings(
            provider=request.provider,
            api_key=request.api_key,
            model=request.model,
        )

        if ai_service:
            ai_service.save_settings(settings)
        else:
            ai_service = AIService(settings)

        return {
            "success": True,
            "message": "Settings saved",
            "settings": {
                "provider": settings.provider,
                "model": settings.model,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# WebSocket Progress
# ============================================================================


@app.websocket("/ws/progress")
async def websocket_progress(websocket: WebSocket):
    """WebSocket endpoint for real-time progress updates."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, receive any messages
            data = await websocket.receive_text()
            # Echo or handle commands if needed
            await websocket.send_json({"status": "connected", "message": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ============================================================================
# Project Management
# ============================================================================


@app.get("/api/projects")
async def list_projects() -> dict:
    """List all saved projects."""
    try:
        projects = []
        if os.path.exists(PROJECTS_DIR):
            for filename in os.listdir(PROJECTS_DIR):
                if filename.endswith(".json"):
                    project_path = os.path.join(PROJECTS_DIR, filename)
                    try:
                        async with aiofiles.open(project_path, "r", encoding="utf-8") as f:
                            content = await f.read()
                            project = json.loads(content)
                            videos = project.get("videos") or []
                            projects.append(
                                {
                                    "id": filename.replace(".json", ""),
                                    "name": project.get("name"),
                                    "file_path": project.get("file_path", ""),
                                    "video_count": len(videos) if videos else (1 if project.get("file_path") else 0),
                                    "updated_at": project.get("updated_at"),
                                }
                            )
                    except Exception:
                        continue

        return {"success": True, "projects": projects}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/projects")
async def save_project(request: ProjectData) -> dict:
    """Save project state."""
    try:
        project_id = get_project_id(request.name)
        project_path = os.path.join(PROJECTS_DIR, f"{project_id}.json")

        project_data = {
            "name": request.name,
            "file_path": request.file_path,
            "videos": [v.dict() if hasattr(v, 'dict') else v for v in (request.videos or [])],
            "cuts": [c.dict() if hasattr(c, 'dict') else c for c in (request.cuts or [])],
            "subtitles": [s.dict() if hasattr(s, 'dict') else s for s in (request.subtitles or [])],
            "settings": request.settings or {},
            "created_at": request.created_at or datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }

        async with aiofiles.open(project_path, "w", encoding="utf-8") as f:
            await f.write(json.dumps(project_data, indent=2, ensure_ascii=False))

        return {
            "success": True,
            "project_id": project_id,
            "message": "Project saved",
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str) -> dict:
    """Load project state."""
    try:
        project_path = os.path.join(PROJECTS_DIR, f"{project_id}.json")

        if not os.path.exists(project_path):
            raise HTTPException(status_code=404, detail="Project not found")

        async with aiofiles.open(project_path, "r", encoding="utf-8") as f:
            content = await f.read()
            project = json.loads(content)
            return {"success": True, "project": project}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Eject (Concat + Export)
# ============================================================================


class EjectRequest(BaseModel):
    """Request to eject (concat all project videos into one)."""
    video_paths: List[str]
    output_name: str = "project_export.mp4"
    quality: str = Field("medium", pattern="^(low|medium|high)$")


@app.post("/api/eject")
async def eject_project(request: EjectRequest) -> dict:
    """Concatenate all project videos into a single output file."""
    try:
        safe_paths = [os.path.basename(p) for p in request.video_paths]
        full_paths = []
        for sp in safe_paths:
            fp = os.path.join(UPLOADS_DIR, sp)
            if not os.path.exists(fp):
                raise HTTPException(status_code=404, detail=f"Video not found: {sp}")
            full_paths.append(fp)

        gen = video_processor.concat_videos(
            full_paths,
            output_name=os.path.basename(request.output_name),
            quality=request.quality,
        )

        result_path = ""
        progress_data = {}
        try:
            while True:
                progress_data = next(gen)
        except StopIteration as e:
            result_path = e.value or ""

        if not result_path:
            raise RuntimeError(progress_data.get("message", "Eject failed"))

        filename = os.path.basename(result_path)
        return {
            "success": True,
            "file_path": result_path,
            "filename": filename,
            "download_url": f"/api/download/{filename}",
            "message": f"Ejected {len(full_paths)} videos into one",
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Health & Info
# ============================================================================


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "CutSense Backend",
        "ai_configured": bool(ai_service and ai_service.settings.api_key),
    }


@app.get("/api/config")
async def get_config() -> dict:
    """Get backend configuration."""
    return {
        "service": "CutSense Video Editor",
        "version": "1.0.0",
        "uploads_dir": UPLOADS_DIR,
        "projects_dir": PROJECTS_DIR,
        "ai_provider": ai_service.settings.provider if ai_service else None,
    }


# ============================================================================
# Static Files — Serve frontend
# ============================================================================

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


# ============================================================================
# Run Server
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=9000,
        log_level="info",
    )
