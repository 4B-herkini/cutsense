const { useState, useEffect, useRef } = React;

// ============================================================================
// Utility Functions
// ============================================================================

const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const parseTime = (timeStr) => {
    const parts = timeStr.split(':').map(p => parseInt(p) || 0);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
};

// 삭제 구간 → 보존 구간 반전
// segments: 잘라 버릴 구간들, duration: 영상 전체 길이
// return: 살려야 할 구간들 (백엔드 cut API에 보낼 것)
const invertSegments = (segments, duration) => {
    if (!segments.length || !duration) return [];
    // 시간순 정렬
    const sorted = [...segments]
        .map(s => ({ start: s.startTime || s.start, end: s.endTime || s.end }))
        .sort((a, b) => a.start - b.start);
    const keep = [];
    let cursor = 0;
    for (const seg of sorted) {
        if (seg.start > cursor) {
            keep.push({ start: cursor, end: seg.start });
        }
        cursor = Math.max(cursor, seg.end);
    }
    if (cursor < duration) {
        keep.push({ start: cursor, end: duration });
    }
    return keep;
};

// ============================================================================
// Main App Component
// ============================================================================

const App = () => {
    const videoRef = useRef(null);
    const [videoFile, setVideoFile] = useState(null);
    const [videoDuration, setVideoDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const [segments, setSegments] = useState([]);
    const [subtitles, setSubtitles] = useState([]);
    const [recommendations, setRecommendations] = useState([]);

    const [activeTab, setActiveTab] = useState('edit');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState({
        aiProvider: 'claude',
        apiKey: '',
        serverUrl: 'http://localhost:9000'
    });

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [zoom, setZoom] = useState(1);

    // Vision AI states
    const [visionSubtitles, setVisionSubtitles] = useState([]);
    const [isVisionProcessing, setIsVisionProcessing] = useState(false);
    const [visionStage, setVisionStage] = useState('idle');
    const [uploadedFilePath, setUploadedFilePath] = useState(null);

    const [toast, setToast] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    // UI states
    const [showCrosshair, setShowCrosshair] = useState(true);
    const [exportResult, setExportResult] = useState(null);

    // 프로젝트 states
    const [projectName, setProjectName] = useState('');
    const [projectId, setProjectId] = useState(null);
    const [projectScreen, setProjectScreen] = useState('editor'); // always start in editor
    const [showProjectPanel, setShowProjectPanel] = useState(false);
    const [projectList, setProjectList] = useState([]);
    const [videoList, setVideoList] = useState([]); // 멀티 영상 목록 [{file_path, original_filename, info, order}]
    const [activeVideoIndex, setActiveVideoIndex] = useState(0);
    const [dragVideoIdx, setDragVideoIdx] = useState(null);

    // 십자선 인터랙션 states
    const [isCutting, setIsCutting] = useState(false);
    const [cutStartTime, setCutStartTime] = useState(null);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [speedOSD, setSpeedOSD] = useState(null);
    const [labelColors, setLabelColors] = useState({ tl: '#FFC66D', tr: '#FFC66D', bl: '#FFC66D', br: '#FFC66D' });
    const crosshairRef = useRef(null);
    const speedOSDTimer = useRef(null);
    const [needFullscreen, setNeedFullscreen] = useState(true);

    // 프리뷰 재생 states
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const previewSegIdx = useRef(-1);
    const previewCleanup = useRef(null);

    // 프로젝트 생성 모달 states
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectType, setNewProjectType] = useState('single'); // 'single' | 'multi'
    const pendingFilesRef = useRef(null); // 모달 확인 후 처리할 파일 임시 저장

    // 풀스크린 — 첫 진입 + ESC로 빠지면 상태바에 복귀 버튼 표시
    useEffect(() => {
        const goFullscreen = () => {
            const el = document.documentElement;
            if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        };
        // 첫 클릭 시 풀스크린 (브라우저 보안 정책)
        const firstClick = () => {
            if (!document.fullscreenElement) goFullscreen();
            document.removeEventListener('click', firstClick);
        };
        document.addEventListener('click', firstClick);
        // 빠져나가면 상태바에 복귀 버튼 표시
        const fsChange = () => {
            setNeedFullscreen(!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', fsChange);
        return () => {
            document.removeEventListener('click', firstClick);
            document.removeEventListener('fullscreenchange', fsChange);
        };
    }, []);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    // ========================================================================
    // 영상 색상 감지 → 라벨 색상 자동 전환
    // ========================================================================
    useEffect(() => {
        if (!videoRef.current || !showCrosshair) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const detectColors = () => {
            if (video.paused && video.currentTime === 0) return;
            try {
                const w = video.videoWidth;
                const h = video.videoHeight;
                if (!w || !h) return;
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);

                const samplePoints = {
                    tl: [w * 0.25, h * 0.25],
                    tr: [w * 0.75, h * 0.25],
                    bl: [w * 0.25, h * 0.75],
                    br: [w * 0.75, h * 0.75]
                };
                const newColors = {};
                for (const [key, [x, y]] of Object.entries(samplePoints)) {
                    const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
                    const brightness = (pixel[0] * 299 + pixel[1] * 587 + pixel[2] * 114) / 1000;
                    newColors[key] = brightness > 128 ? '#1E1E1E' : '#FFC66D';
                }
                setLabelColors(newColors);
            } catch(e) {}
        };

        const interval = setInterval(detectColors, 500);
        return () => clearInterval(interval);
    }, [showCrosshair, isPlaying]);

    // ========================================================================
    // 마우스 인터랙션 핸들러 (영상 위 어디서든)
    // ========================================================================

    // OSD 표시 헬퍼
    const showSpeedOSD = (text) => {
        setSpeedOSD(text);
        if (speedOSDTimer.current) clearTimeout(speedOSDTimer.current);
        speedOSDTimer.current = setTimeout(() => setSpeedOSD(null), 1200);
    };

    // 좌클릭 = 자르기 시작/끝 (즉시 반응, 딜레이 없음)
    const handleOverlayClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!videoRef.current) return;
        const clickTime = videoRef.current.currentTime;

        if (!isCutting) {
            setIsCutting(true);
            setCutStartTime(clickTime);
            showToast(`✂ Cut START: ${formatTime(clickTime)}`, 'info');
        } else {
            if (clickTime > cutStartTime) {
                setSegments(prev => [...prev, {
                    id: Date.now(),
                    startTime: cutStartTime,
                    endTime: clickTime,
                    label: `Cut ${prev.length + 1}`
                }]);
                showToast(`✂ 제거 구간: ${formatTime(cutStartTime)} ~ ${formatTime(clickTime)}`, 'success');
            } else {
                showToast('End point must be after start', 'error');
            }
            setIsCutting(false);
            setCutStartTime(null);
        }
    };

    // 우클릭 = 배속 순환 (1.0 → 0.5 → 0.3 → 0.25 → 1.0)
    const handleOverlayRightClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!videoRef.current) return;
        const speeds = [1.0, 0.5, 0.3, 0.25];
        const currentIdx = speeds.indexOf(playbackRate);
        const nextIdx = (currentIdx + 1) % speeds.length;
        const newRate = speeds[nextIdx];
        videoRef.current.playbackRate = newRate;
        setPlaybackRate(newRate);
        showSpeedOSD(newRate === 1.0 ? '▶ x1.0' : `🐢 x${newRate}`);
    };

    // ← → 화살표 = 5초 점프
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!videoRef.current) return;
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                showSpeedOSD('⏪ -5s');
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                videoRef.current.currentTime = Math.min(videoDuration, videoRef.current.currentTime + 5);
                showSpeedOSD('⏩ +5s');
            } else if (e.key === ' ') {
                e.preventDefault();
                if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
                else { videoRef.current.pause(); setIsPlaying(false); }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [videoDuration]);

    // ========================================================================
    // Video Handlers
    // ========================================================================

    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => { setDragOver(false); };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
        if (files.length > 0) handleAddVideosGate(files);
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('video/'));
        if (files.length > 0) handleAddVideosGate(files);
    };

    const loadVideo = async (file) => {
        const url = URL.createObjectURL(file);
        setVideoFile({ name: file.name, url, file });
        if (videoRef.current) videoRef.current.src = url;
        showToast('비디오 로드됨: ' + file.name);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`${settings.serverUrl}/api/upload`, {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                const data = await response.json();
                setUploadedFilePath(data.file_path);
                showToast('서버 업로드 완료', 'success');
            }
        } catch (err) {
            console.log('Server upload skipped:', err.message);
        }
    };

    // ========================================================================
    // Vision AI 2-Pass
    // ========================================================================

    const handleVisionSubtitles = async () => {
        if (!uploadedFilePath) {
            showToast('영상을 먼저 업로드하세요', 'error');
            return;
        }

        const estimatedFrames = Math.ceil((videoDuration || 60) / 3);
        const estimatedCalls = 1 + Math.ceil(estimatedFrames / 6);
        const estimatedCost = (estimatedCalls * 0.025).toFixed(2);

        if (!confirm(
            `스마트 자막 생성을 시작합니다.\n\n` +
            `예상 프레임: ${estimatedFrames}장 (3초 간격)\n` +
            `예상 API 호출: ${estimatedCalls}회\n` +
            `예상 비용: ~$${estimatedCost}\n\n` +
            `진행하시겠습니까?`
        )) return;

        setIsVisionProcessing(true);
        setVisionStage('extracting');
        try {
            const response = await fetch(`${settings.serverUrl}/api/ai/vision-subtitles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: uploadedFilePath }),
            });
            const data = await response.json();
            if (data.success) {
                setVisionStage('done');
                setVisionSubtitles(data.subtitles);
                showToast(data.message, 'success');
            } else {
                showToast(data.detail || 'Vision 분석 실패', 'error');
            }
        } catch (err) {
            showToast('Vision AI 연결 실패: ' + err.message, 'error');
        } finally {
            setTimeout(() => {
                setIsVisionProcessing(false);
                setVisionStage('idle');
            }, 1500);
        }
    };

    const handleApplyVisionSubtitles = () => {
        const newSubtitles = visionSubtitles.map(sub => ({
            text: sub.text,
            startTime: sub.start,
            endTime: sub.end,
            fontSize: 20,
            color: '#ffffff',
            position: 'bottom',
            backgroundColor: '#000000',
            backgroundEnabled: true,
        }));
        setSubtitles(newSubtitles);
        setActiveTab('subtitle');
        showToast(`${newSubtitles.length}개 자막 적용됨 (기존 자막 교체)`, 'success');
    };

    const handleClearSubtitles = () => {
        setSubtitles([]);
        setVisionSubtitles([]);
        showToast('자막 전체 삭제됨');
    };

    // ========================================================================
    // 프로젝트 핸들러
    // ========================================================================

    const loadProjectList = async () => {
        try {
            const res = await fetch(`${settings.serverUrl}/api/projects`);
            const data = await res.json();
            if (data.success) setProjectList(data.projects || []);
        } catch (e) {}
    };

    const handleNewProject = (name) => {
        setProjectName(name);
        setProjectId(null);
        setVideoList([]);
        setVideoFile(null);
        setSegments([]);
        setSubtitles([]);
        setVisionSubtitles([]);
        setActiveVideoIndex(0);
        setProjectScreen('editor');
    };

    const handleOpenProject = async (id) => {
        try {
            const res = await fetch(`${settings.serverUrl}/api/projects/${id}`);
            const data = await res.json();
            if (data.success && data.project) {
                const p = data.project;
                setProjectName(p.name);
                setProjectId(id);

                // v2 멀티 영상
                if (p.videos && p.videos.length > 0) {
                    setVideoList(p.videos);
                    const first = p.videos[0];
                    const filename = first.file_path.split(/[/\\]/).pop();
                    setVideoFile({ name: first.original_filename || filename, url: `${settings.serverUrl}/api/uploads/${filename}` });
                    setUploadedFilePath(first.file_path);
                    setSegments(first.cuts || []);
                    setSubtitles((first.subtitles || []).map(s => ({
                        text: s.text, startTime: s.start, endTime: s.end,
                        fontSize: 20, color: '#ffffff', position: 'bottom',
                        backgroundColor: '#000000', backgroundEnabled: true,
                    })));
                    setActiveVideoIndex(0);
                } else if (p.file_path) {
                    // legacy v1
                    const filename = p.file_path.split(/[/\\]/).pop();
                    setVideoFile({ name: filename, url: `${settings.serverUrl}/api/uploads/${filename}` });
                    setUploadedFilePath(p.file_path);
                    setVideoList([{ file_path: p.file_path, original_filename: filename, order: 0 }]);
                    setSegments(p.cuts || []);
                    setSubtitles((p.subtitles || []).map(s => ({
                        text: s.text, startTime: s.start, endTime: s.end,
                        fontSize: 20, color: '#ffffff', position: 'bottom',
                        backgroundColor: '#000000', backgroundEnabled: true,
                    })));
                }

                setProjectScreen('editor');
                showToast(`"${p.name}" loaded`, 'success');
            }
        } catch (e) { showToast('Failed to load project', 'error'); }
    };

    // 프로젝트 저장 (silent=true면 토스트 없이 조용히 저장)
    const saveProjectInternal = async (silent = false) => {
        if (!projectName) return;
        try {
            const body = {
                name: projectName,
                file_path: uploadedFilePath || '',
                videos: videoList.map((v, i) => ({
                    file_path: v.file_path,
                    original_filename: v.original_filename || '',
                    order: i,
                    cuts: i === activeVideoIndex ? segments.map(s => ({ start: s.startTime || s.start, end: s.endTime || s.end })) : (v.cuts || []),
                    subtitles: i === activeVideoIndex ? subtitles.map(s => ({ start: s.startTime, end: s.endTime, text: s.text })) : (v.subtitles || []),
                })),
                settings: { aiProvider: settings.aiProvider },
            };
            const res = await fetch(`${settings.serverUrl}/api/projects`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                setProjectId(data.project_id);
                if (!silent) showToast(`"${projectName}" saved`, 'success');
            }
        } catch (e) { if (!silent) showToast('Save failed', 'error'); }
    };

    const handleSaveProject = () => saveProjectInternal(false);

    // 자동 저장 — 프로젝트명+영상 있으면 2초 디바운스로 조용히 저장
    const autoSaveTimer = useRef(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState('');
    useEffect(() => {
        if (!projectName) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(async () => {
            setAutoSaveStatus('saving...');
            await saveProjectInternal(true);
            setAutoSaveStatus('saved');
            setTimeout(() => setAutoSaveStatus(''), 2000);
        }, 2000);
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    }, [projectName, segments, subtitles, videoList, activeVideoIndex]);

    // 페이지 나가기 경고
    useEffect(() => {
        const handler = (e) => {
            if (projectName && videoList.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [projectName, videoList]);

    // 영상 추가 게이트 — 프로젝트 없으면 모달 띄움
    const handleAddVideosGate = (files) => {
        if (!projectName) {
            // 프로젝트 없음 → 파일 임시 저장 후 모달
            pendingFilesRef.current = files;
            setNewProjectName('');
            setNewProjectType(files.length > 1 ? 'multi' : 'single');
            setShowNewProjectModal(true);
            return;
        }
        handleAddVideosReal(files);
    };

    // 모달에서 확인 후 실행
    const handleNewProjectConfirm = () => {
        if (!newProjectName.trim()) return;
        handleNewProject(newProjectName.trim());
        setShowNewProjectModal(false);

        // 임시 저장된 파일이 있으면 바로 업로드
        if (pendingFilesRef.current) {
            const files = pendingFilesRef.current;
            pendingFilesRef.current = null;
            setTimeout(() => handleAddVideosReal(files), 100);
        } else {
            // 파일 없이 프로젝트만 생성한 경우 → 파일 선택 창 띄우기
            setTimeout(() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*';
                input.multiple = (newProjectType === 'multi');
                input.onchange = (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length > 0) handleAddVideosReal(files);
                };
                input.click();
            }, 200);
        }
    };

    const handleAddVideosReal = async (files) => {
        const formData = new FormData();
        for (const f of files) formData.append('files', f);
        try {
            const res = await fetch(`${settings.serverUrl}/api/upload-multiple`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                const newVideos = data.files.map((f, i) => ({
                    file_path: f.file_path,
                    original_filename: f.original_filename,
                    info: f.info,
                    order: videoList.length + i,
                    cuts: [],
                    subtitles: [],
                }));
                setVideoList(prev => [...prev, ...newVideos]);
                // 첫 영상이면 자동 선택
                if (!videoFile && newVideos.length > 0) {
                    const first = newVideos[0];
                    const filename = first.file_path.split(/[/\\]/).pop();
                    setVideoFile({ name: first.original_filename, url: `${settings.serverUrl}/api/uploads/${filename}` });
                    setUploadedFilePath(first.file_path);
                }
                showToast(`${newVideos.length} video(s) added`, 'success');
            }
        } catch (e) { showToast('Upload failed', 'error'); }
    };

    const handleSwitchVideo = (idx) => {
        // 현재 영상의 cuts/subtitles 저장
        setVideoList(prev => prev.map((v, i) => i === activeVideoIndex ? {
            ...v,
            cuts: segments.map(s => ({ start: s.startTime || s.start, end: s.endTime || s.end })),
            subtitles: subtitles.map(s => ({ start: s.startTime, end: s.endTime, text: s.text })),
        } : v));

        const target = videoList[idx];
        const filename = target.file_path.split(/[/\\]/).pop();
        setVideoFile({ name: target.original_filename || filename, url: `${settings.serverUrl}/api/uploads/${filename}` });
        setUploadedFilePath(target.file_path);
        setSegments((target.cuts || []).map(c => ({ id: Date.now() + Math.random(), startTime: c.start, endTime: c.end, label: `Cut` })));
        setSubtitles((target.subtitles || []).map(s => ({
            text: s.text, startTime: s.start, endTime: s.end,
            fontSize: 20, color: '#ffffff', position: 'bottom',
            backgroundColor: '#000000', backgroundEnabled: true,
        })));
        setActiveVideoIndex(idx);
    };

    // 드래그 드롭 순서 변경
    const handleVideoDragStart = (idx) => setDragVideoIdx(idx);
    const handleVideoDragOver = (e, idx) => { e.preventDefault(); };
    const handleVideoDrop = (idx) => {
        if (dragVideoIdx === null || dragVideoIdx === idx) return;
        setVideoList(prev => {
            const list = [...prev];
            const [item] = list.splice(dragVideoIdx, 1);
            list.splice(idx, 0, item);
            return list;
        });
        if (activeVideoIndex === dragVideoIdx) setActiveVideoIndex(idx);
        setDragVideoIdx(null);
    };

    // ========================================================================
    // Initial Load
    // ========================================================================

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const res = await fetch(`${settings.serverUrl}/api/ai/settings`);
                const data = await res.json();
                if (data.success && data.settings.api_key_set) {
                    setSettings(prev => ({
                        ...prev,
                        aiProvider: data.settings.provider,
                        model: data.settings.model,
                    }));
                }
            } catch (e) { /* server not ready */ }

            // 프로젝트 목록 로드 → 가장 최근 프로젝트 자동 복원
            await loadProjectList();
            try {
                const listRes = await fetch('http://localhost:9000/api/projects');
                const listData = await listRes.json();
                if (listData.success && listData.projects && listData.projects.length > 0) {
                    // updated_at 기준 정렬 (최신 먼저)
                    const sorted = listData.projects.sort((a, b) =>
                        (b.updated_at || '').localeCompare(a.updated_at || '')
                    );
                    const latest = sorted[0];
                    // 직접 복원 (handleOpenProject 클로저 문제 방지)
                    const projRes = await fetch(`http://localhost:9000/api/projects/${latest.id}`);
                    const projData = await projRes.json();
                    if (projData.success && projData.project) {
                        const p = projData.project;
                        setProjectName(p.name);
                        setProjectId(latest.id);
                        if (p.videos && p.videos.length > 0) {
                            setVideoList(p.videos);
                            const first = p.videos[0];
                            const fname = first.file_path.split(/[/\\]/).pop();
                            setVideoFile({ name: first.original_filename || fname, url: `http://localhost:9000/api/uploads/${fname}` });
                            setUploadedFilePath(first.file_path);
                            setSegments((first.cuts || []).map((c, i) => ({ id: Date.now() + i, startTime: c.start, endTime: c.end, label: `Cut ${i+1}` })));
                            setSubtitles((first.subtitles || []).map(s => ({
                                text: s.text, startTime: s.start, endTime: s.end,
                                fontSize: 20, color: '#ffffff', position: 'bottom',
                                backgroundColor: '#000000', backgroundEnabled: true,
                            })));
                            setActiveVideoIndex(0);
                        } else if (p.file_path) {
                            const fname = p.file_path.split(/[/\\]/).pop();
                            setVideoFile({ name: fname, url: `http://localhost:9000/api/uploads/${fname}` });
                            setUploadedFilePath(p.file_path);
                            setVideoList([{ file_path: p.file_path, original_filename: fname, order: 0 }]);
                        }
                        setProjectScreen('editor');
                        setToast({ message: `"${p.name}" auto-restored`, type: 'info' });
                    }
                }
            } catch (e) { console.log('Auto-restore failed:', e); }
        };
        loadInitialData();
    }, []);

    // ========================================================================
    // Action Handlers
    // ========================================================================

    const handlePlay = () => {
        if (videoRef.current) {
            if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
            else { videoRef.current.play(); setIsPlaying(true); }
        }
    };

    const handleLoadedMetadata = () => { if (videoRef.current) setVideoDuration(videoRef.current.duration); };
    const handleTimeUpdate = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
    const handleSeek = (time) => { if (videoRef.current) videoRef.current.currentTime = time; };

    const handleAddSegment = (segment) => { setSegments([...segments, segment]); showToast('구간이 추가되었습니다'); };
    const handleDeleteSegment = (idx) => { setSegments(segments.filter((_, i) => i !== idx)); showToast('구간이 삭제되었습니다'); };

    // 구간 미세 조절 (±1s, ±0.1s)
    const handleUpdateSegment = (idx, field, delta) => {
        setSegments(prev => prev.map((seg, i) => {
            if (i !== idx) return seg;
            const start = seg.startTime || seg.start || 0;
            const end = seg.endTime || seg.end || 0;
            if (field === 'start') {
                const newStart = Math.max(0, Math.round((start + delta) * 10) / 10);
                if (newStart >= end) return seg; // start < end 보장
                return { ...seg, startTime: newStart, start: newStart };
            } else {
                const newEnd = Math.min(videoDuration || 99999, Math.round((end + delta) * 10) / 10);
                if (newEnd <= start) return seg; // end > start 보장
                return { ...seg, endTime: newEnd, end: newEnd };
            }
        }));
        // 비디오 시간도 이동
        if (videoRef.current) {
            const seg = segments[idx];
            const time = field === 'start'
                ? Math.max(0, (seg.startTime || seg.start || 0) + delta)
                : Math.max(0, (seg.endTime || seg.end || 0) + delta);
            videoRef.current.currentTime = time;
        }
    };

    // 구간 프리뷰 재생 (JS 기반, 구간들을 순서대로 재생)
    const handlePreview = () => {
        if (!videoRef.current || segments.length === 0) return;

        // 이미 재생 중이면 중지
        if (isPreviewPlaying) {
            if (previewCleanup.current) previewCleanup.current();
            videoRef.current.pause();
            setIsPreviewPlaying(false);
            previewSegIdx.current = -1;
            showToast('Preview stopped', 'info');
            return;
        }

        // 삭제 구간 → 보존 구간으로 반전 (실제 결과물 미리보기)
        const keepSegments = invertSegments(segments, videoDuration);
        if (keepSegments.length === 0) {
            showToast('보존할 구간이 없습니다', 'error');
            return;
        }

        setIsPreviewPlaying(true);
        previewSegIdx.current = 0;

        const playSegment = (idx) => {
            if (idx >= keepSegments.length) {
                // 모든 구간 재생 완료
                videoRef.current.pause();
                setIsPreviewPlaying(false);
                previewSegIdx.current = -1;
                showToast('Preview complete', 'success');
                return;
            }

            const seg = keepSegments[idx];
            videoRef.current.currentTime = seg.start;
            videoRef.current.play();
            previewSegIdx.current = idx;

            const onTimeUpdate = () => {
                if (videoRef.current && videoRef.current.currentTime >= seg.end) {
                    videoRef.current.removeEventListener('timeupdate', onTimeUpdate);
                    videoRef.current.removeEventListener('ended', onEnded);
                    // 다음 구간으로
                    playSegment(idx + 1);
                }
            };

            const onEnded = () => {
                videoRef.current.removeEventListener('timeupdate', onTimeUpdate);
                videoRef.current.removeEventListener('ended', onEnded);
                playSegment(idx + 1);
            };

            videoRef.current.addEventListener('timeupdate', onTimeUpdate);
            videoRef.current.addEventListener('ended', onEnded);

            // 클린업 함수 저장 (중간에 멈출 때)
            previewCleanup.current = () => {
                videoRef.current.removeEventListener('timeupdate', onTimeUpdate);
                videoRef.current.removeEventListener('ended', onEnded);
            };
        };

        showToast(`Preview: ${keepSegments.length} keep segments`, 'info');
        playSegment(0);
    };
    const handleAddSubtitle = (subtitle) => { setSubtitles([...subtitles, subtitle]); showToast('자막이 추가되었습니다'); };
    const handleDeleteSubtitle = (idx) => { setSubtitles(subtitles.filter((_, i) => i !== idx)); showToast('자막이 삭제되었습니다'); };

    const handleAnalyze = async () => {
        if (!videoFile) { showToast('먼저 비디오를 업로드하세요', 'error'); return; }
        setIsAnalyzing(true);
        try {
            const response = await fetch(`${settings.serverUrl}/api/ai/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoPath: videoFile.url, provider: settings.aiProvider, apiKey: settings.apiKey })
            });
            if (response.ok) {
                const data = await response.json();
                setRecommendations(data.highlights || []);
                showToast('분석 완료');
            } else { showToast('분석 실패', 'error'); }
        } catch (error) { showToast('오류: ' + error.message, 'error'); }
        finally { setIsAnalyzing(false); }
    };

    const handleApplyRecommendation = (idx) => {
        const rec = recommendations[idx];
        if (rec) handleAddSegment({ start: rec.start, end: rec.end });
    };

    const handleGenerateTitle = async (idx) => {
        const rec = recommendations[idx];
        if (!rec) return;
        try {
            const response = await fetch(`${settings.serverUrl}/api/ai/generate-title`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ segment: rec, provider: settings.aiProvider, apiKey: settings.apiKey })
            });
            if (response.ok) {
                const data = await response.json();
                const updated = [...recommendations];
                updated[idx].title = data.title;
                setRecommendations(updated);
                showToast('타이틀 생성됨');
            }
        } catch (error) { showToast('타이틀 생성 실패', 'error'); }
    };

    const handleCut = async () => {
        if (segments.length === 0) { showToast('구간을 선택하세요', 'error'); return; }
        if (!uploadedFilePath) { showToast('영상을 먼저 업로드하세요', 'error'); return; }
        // 삭제 구간 → 보존 구간으로 반전
        const keepSegments = invertSegments(segments, videoDuration);
        if (keepSegments.length === 0) { showToast('보존할 구간이 없습니다 (전체 삭제됨)', 'error'); return; }
        setIsExporting(true);
        setExportProgress(0);
        try {
            const response = await fetch(`${settings.serverUrl}/api/cut`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: uploadedFilePath, segments: keepSegments })
            });
            const data = await response.json();
            if (data.success && data.output_path) {
                const filename = data.output_path.replace(/\\/g, '/').split('/').pop();
                setExportResult({
                    filename: filename,
                    downloadUrl: `${settings.serverUrl}/api/download/${filename}`,
                });
                setActiveTab('export');
                showToast('구간 잘라내기 완료! 내보내기 탭에서 다운로드', 'success');
            } else {
                showToast(data.detail || '잘라내기 실패', 'error');
            }
        } catch (error) { showToast('오류: ' + error.message, 'error'); }
        finally { setIsExporting(false); setExportProgress(0); }
    };

    const handleExport = async (options) => {
        if (!uploadedFilePath) { showToast('영상을 먼저 업로드하세요', 'error'); return; }
        setIsExporting(true);
        setExportProgress(5);
        setExportResult(null);

        try {
            let targetFilePath = uploadedFilePath;

            // Step 1: 구간 편집 적용 — 삭제 구간을 반전하여 보존 구간만 추출
            if (segments.length > 0) {
                const keepSegments = invertSegments(segments, videoDuration);
                if (keepSegments.length === 0) {
                    showToast('보존할 구간이 없습니다', 'error');
                    setIsExporting(false);
                    return;
                }
                setExportProgress(10);
                showToast('Step 1/3: 불필요 구간 제거 중...', 'info');
                const cutResponse = await fetch(`${settings.serverUrl}/api/cut`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_path: targetFilePath,
                        segments: keepSegments,
                    })
                });
                const cutData = await cutResponse.json();
                if (cutData.success && cutData.output_path) {
                    targetFilePath = cutData.output_path;
                    setExportProgress(30);
                } else {
                    showToast('구간 잘라내기 실패: ' + (cutData.detail || ''), 'error');
                    setIsExporting(false);
                    return;
                }
            }

            // Step 2: 자막 입히기 (subtitles가 있으면)
            if (subtitles.length > 0) {
                setExportProgress(35);
                showToast('Step 2/3: 자막 입히기...', 'info');
                const burnResponse = await fetch(`${settings.serverUrl}/api/subtitle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_path: targetFilePath,
                        subtitles: subtitles.map(s => ({ start: s.startTime, end: s.endTime, text: s.text })),
                    })
                });
                const burnData = await burnResponse.json();
                if (burnData.success && burnData.output_path) {
                    targetFilePath = burnData.output_path;
                    setExportProgress(55);
                } else {
                    showToast('자막 입히기 실패: ' + (burnData.detail || ''), 'error');
                    setIsExporting(false);
                    return;
                }
            }

            // Step 3: 최종 내보내기
            setExportProgress(60);
            showToast('Step 3/3: 최종 내보내기...', 'info');
            const exportResponse = await fetch(`${settings.serverUrl}/api/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_path: targetFilePath,
                    format: options.format,
                    quality: options.quality === '4k' ? 'high' : options.quality === '1080p' ? 'medium' : 'low',
                    output_name: options.outputName || '',
                })
            });

            const exportData = await exportResponse.json();
            setExportProgress(100);

            if (exportData.success && exportData.output_path) {
                const filename = exportData.output_path.replace(/\\/g, '/').split('/').pop();
                setExportResult({
                    filename: filename,
                    downloadUrl: `${settings.serverUrl}/api/download/${filename}`,
                });
                showToast('내보내기 완료!', 'success');
            } else {
                showToast('내보내기 실패: ' + (exportData.detail || ''), 'error');
            }
        } catch (error) {
            showToast('오류: ' + error.message, 'error');
        } finally {
            setTimeout(() => setIsExporting(false), 1000);
        }
    };

    const handleEject = async (options) => {
        if (videoList.length === 0) { showToast('No videos to eject', 'error'); return; }
        setIsExporting(true);
        setExportProgress(10);
        setExportResult(null);

        try {
            const paths = videoList.map(v => v.file_path.replace(/\\/g, '/').split('/').pop());
            const safeName = (projectName || 'project').replace(/[^a-zA-Z0-9가-힣_-]/g, '_') + '_export.mp4';

            const res = await fetch(`${settings.serverUrl}/api/eject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video_paths: paths,
                    output_name: safeName,
                    quality: options.quality || 'medium',
                })
            });

            const data = await res.json();
            setExportProgress(100);

            if (data.success) {
                setExportResult({
                    filename: data.filename,
                    downloadUrl: `${settings.serverUrl}${data.download_url}`,
                });
                showToast(`Eject complete! ${videoList.length} → 1`, 'success');
            } else {
                showToast('Eject failed: ' + (data.detail || ''), 'error');
            }
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        } finally {
            setTimeout(() => setIsExporting(false), 1000);
        }
    };

    // ========================================================================
    // Menu Handlers
    // ========================================================================

    const handleOpenVideo = () => {
        document.getElementById('fileInput').click();
    };

    const handleAbout = () => {
        alert(
            'CutSense v0.2\n\n' +
            'AI Vision 기반 시연영상 자동 자막 편집기\n' +
            '화면만 보고 자막 생성 — 이 기능은 현존하는 편집기에 없음\n\n' +
            '제작: 류병수 (4B나무)\n' +
            'AI: Claude Vision 2-Pass 분석'
        );
    };

    // ========================================================================
    // Render — 에디터 화면 (항상 바로 진입)
    // ========================================================================
    return (
        <div className="app-container">
            {/* Android Studio 풍 메뉴바 */}
            <MenuBar
                onNewProject={() => {
                    const name = prompt('새 프로젝트 이름:');
                    if (name && name.trim()) handleNewProject(name.trim());
                }}
                onOpenVideo={handleOpenVideo}
                onSaveProject={handleSaveProject}
                onExport={() => setActiveTab('export')}
                onSettings={() => setIsSettingsOpen(true)}
                onToggleCrosshair={() => setShowCrosshair(!showCrosshair)}
                showCrosshair={showCrosshair}
                onAbout={handleAbout}
                onShowProjects={() => { loadProjectList(); setShowProjectPanel(!showProjectPanel); }}
            />

            {/* 헤더 */}
            <header className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="header-title">CutSense</div>
                    {projectName && (
                        <span style={{ fontSize: '12px', color: '#A9B7C6', fontWeight: 600, padding: '2px 8px', background: '#2B2B2B', borderRadius: '3px', border: '1px solid #515658' }}>
                            {projectName}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {videoFile && (
                        <span style={{ fontSize: '11px', color: '#6b6b8a', marginRight: '8px' }}>
                            {videoFile.name} {videoList.length > 1 ? `(${activeVideoIndex + 1}/${videoList.length})` : ''}
                        </span>
                    )}
                    <button
                        className="header-button"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        ⚙️ AI 설정
                    </button>
                </div>
            </header>

            {/* 메인 콘텐츠 */}
            <div className="main-content">
                <div className="left-panel">
                    <div className="video-container">
                        {!videoFile ? (
                            <div
                                className={`drop-zone ${dragOver ? 'dragover' : ''}`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOver(false);
                                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
                                    if (files.length > 0) handleAddVideosGate(files);
                                }}
                                onClick={() => document.getElementById('fileInput').click()}
                            >
                                <div style={{ fontSize: '24px' }}>📹</div>
                                <div className="drop-zone-text">
                                    비디오 파일을 드래그하거나 클릭하여 업로드<br/>
                                    <span style={{ fontSize: '11px', color: '#808080' }}>여러 파일 동시 선택 가능</span>
                                </div>
                                <input
                                    id="fileInput"
                                    type="file"
                                    accept="video/*"
                                    multiple
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files);
                                        if (files.length > 0) handleAddVideosGate(files);
                                    }}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        ) : (
                            <div style={{ position: 'relative', width: '100%' }}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <video
                                    ref={videoRef}
                                    className="video-player"
                                    src={videoFile?.url}
                                    controls
                                    onClick={(e) => e.preventDefault()}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={() => setIsPlaying(false)}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                />
                                {/* 십자선 인터랙션 오버레이 */}
                                {showCrosshair && (
                                    <div ref={crosshairRef} style={{
                                        position: 'absolute',
                                        top: 0, left: 0, right: 0, bottom: '40px',
                                        pointerEvents: 'auto',
                                        zIndex: 5,
                                        cursor: 'crosshair'
                                    }}
                                    onClick={handleOverlayClick}
                                    onContextMenu={handleOverlayRightClick}
                                    >
                                        {/* 4분할 라벨 (위치 가이드) */}
                                        {[
                                            { key: 'br', pos: { bottom: '8px', right: '12px' },
                                              label: isCutting ? '✂ 제거 END' : '✂ 제거 START' }
                                        ].map(q => (
                                            <div key={q.key} style={{
                                                position: 'absolute', ...q.pos,
                                                pointerEvents: 'none'
                                            }}>
                                                <span style={{
                                                    color: labelColors[q.key],
                                                    background: labelColors[q.key] === '#1E1E1E'
                                                        ? 'rgba(255,255,255,0.75)'
                                                        : 'rgba(0,0,0,0.6)',
                                                    padding: '3px 10px',
                                                    borderRadius: '3px',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.5px',
                                                    userSelect: 'none',
                                                    transition: 'all 0.3s ease',
                                                    border: isCutting
                                                        ? '1px solid #FF6B6B'
                                                        : '1px solid rgba(204,120,50,0.3)',
                                                    animation: isCutting
                                                        ? 'cutPulse 1s infinite' : 'none'
                                                }}>
                                                    {q.label}
                                                </span>
                                            </div>
                                        ))}
                                        {/* 배속 + 조작법 라벨 (좌상단) */}
                                        <div style={{
                                            position: 'absolute', top: '8px', left: '12px',
                                            pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '4px'
                                        }}>
                                            <span style={{
                                                color: labelColors.tl,
                                                background: labelColors.tl === '#1E1E1E'
                                                    ? 'rgba(255,255,255,0.75)'
                                                    : 'rgba(0,0,0,0.6)',
                                                padding: '3px 10px',
                                                borderRadius: '3px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                userSelect: 'none',
                                                border: playbackRate < 1 ? '1px solid #6A9955' : '1px solid rgba(204,120,50,0.3)',
                                                transition: 'all 0.3s ease'
                                            }}>
                                                {playbackRate < 1 ? `🐢 x${playbackRate}` : `▶ x${playbackRate}`}
                                            </span>
                                        </div>
                                        {/* 조작 가이드 (우상단) */}
                                        <div style={{
                                            position: 'absolute', top: '8px', right: '12px',
                                            pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end'
                                        }}>
                                            {[
                                                'L-Click: Cut',
                                                'R-Click: Speed',
                                                '← →: 5s Skip',
                                                'Space: Play/Pause'
                                            ].map((txt, i) => (
                                                <span key={i} style={{
                                                    color: labelColors.tr,
                                                    background: labelColors.tr === '#1E1E1E'
                                                        ? 'rgba(255,255,255,0.6)'
                                                        : 'rgba(0,0,0,0.5)',
                                                    padding: '1px 6px',
                                                    borderRadius: '2px',
                                                    fontSize: '9px',
                                                    fontWeight: 600,
                                                    userSelect: 'none',
                                                    opacity: 0.7
                                                }}>
                                                    {txt}
                                                </span>
                                            ))}
                                        </div>
                                        {/* 배속 OSD (화면 중앙, 잠깐 떴다 사라짐) */}
                                        {speedOSD && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '50%', left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                color: '#FFC66D',
                                                background: 'rgba(0,0,0,0.7)',
                                                padding: '12px 24px',
                                                borderRadius: '8px',
                                                fontSize: '24px',
                                                fontWeight: 800,
                                                pointerEvents: 'none',
                                                animation: 'slideIn 0.2s ease'
                                            }}>
                                                {speedOSD}
                                            </div>
                                        )}
                                        {/* 십자선 */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%', left: 0, right: 0,
                                            height: '1px',
                                            background: 'rgba(204, 120, 50, 0.3)',
                                            borderTop: '1px dashed rgba(204, 120, 50, 0.4)',
                                            pointerEvents: 'none'
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            left: '50%', top: 0, bottom: 0,
                                            width: '1px',
                                            background: 'rgba(204, 120, 50, 0.3)',
                                            borderLeft: '1px dashed rgba(204, 120, 50, 0.4)',
                                            pointerEvents: 'none'
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%', left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: '8px', height: '8px',
                                            borderRadius: '50%',
                                            background: '#CC7832',
                                            boxShadow: '0 0 6px rgba(204, 120, 50, 0.6)',
                                            pointerEvents: 'none'
                                        }} />
                                    </div>
                                )}
                                {/* 자막 실시간 오버레이 */}
                                {(() => {
                                    const activeSub = subtitles.find(s =>
                                        currentTime >= s.startTime && currentTime <= s.endTime
                                    );
                                    if (!activeSub) return null;
                                    return (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '60px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: 'linear-gradient(135deg, rgba(43,43,43,0.92), rgba(60,63,65,0.88))',
                                            backdropFilter: 'blur(8px)',
                                            color: activeSub.color || '#f0f0f0',
                                            fontSize: `${activeSub.fontSize || 18}px`,
                                            fontWeight: '500',
                                            padding: '8px 20px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(104, 151, 187, 0.3)',
                                            maxWidth: '85%',
                                            textAlign: 'center',
                                            pointerEvents: 'none',
                                            zIndex: 10,
                                            fontFamily: '"Pretendard Variable", "Pretendard", sans-serif',
                                            letterSpacing: '0.3px',
                                            lineHeight: '1.4',
                                            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                                            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                        }}>
                                            {activeSub.text}
                                        </div>
                                    );
                                })()}
                                {/* 숨겨진 파일 인풋 (메뉴바용) */}
                                <input
                                    id="fileInput"
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        )}
                    </div>

                    {videoFile && (
                        <div className="controls">
                            <button className="control-button primary" onClick={handlePlay}>
                                {isPlaying ? '⏸️ 일시정지' : '▶️ 재생'}
                            </button>
                            <div className="time-display">
                                {formatTime(currentTime)} / {formatTime(videoDuration)}
                            </div>
                        </div>
                    )}

                    {/* 영상 목록 (멀티 영상) */}
                    {videoList.length > 0 && (
                        <div style={{
                            background: '#3C3F41', borderTop: '1px solid #515658',
                            padding: '6px 8px', display: 'flex', gap: '6px',
                            overflowX: 'auto', flexShrink: 0, alignItems: 'center'
                        }}>
                            {videoList.map((v, idx) => (
                                <div key={idx}
                                    draggable
                                    onDragStart={() => handleVideoDragStart(idx)}
                                    onDragOver={(e) => handleVideoDragOver(e, idx)}
                                    onDrop={() => handleVideoDrop(idx)}
                                    onClick={() => handleSwitchVideo(idx)}
                                    style={{
                                        background: idx === activeVideoIndex ? '#365880' : '#2B2B2B',
                                        border: `1px solid ${idx === activeVideoIndex ? '#4A6D8C' : '#515658'}`,
                                        borderRadius: '4px', padding: '4px 10px',
                                        cursor: 'grab', userSelect: 'none', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ fontSize: '10px', color: '#CC7832', fontWeight: 700 }}>{idx + 1}</span>
                                    <span style={{
                                        fontSize: '11px', color: idx === activeVideoIndex ? '#DCDCDC' : '#A9B7C6',
                                        maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                    }}>
                                        {v.original_filename || `Video ${idx + 1}`}
                                    </span>
                                </div>
                            ))}
                            <button
                                onClick={() => document.getElementById('addVideoInput').click()}
                                style={{
                                    background: 'none', border: '1px dashed #515658', borderRadius: '4px',
                                    color: '#808080', padding: '4px 10px', cursor: 'pointer', fontSize: '11px',
                                    flexShrink: 0
                                }}
                            >
                                + Add
                            </button>
                            <input
                                id="addVideoInput"
                                type="file"
                                accept="video/*"
                                multiple
                                onChange={(e) => {
                                    const files = Array.from(e.target.files);
                                    if (files.length > 0) handleAddVideosGate(files);
                                    e.target.value = '';
                                }}
                                style={{ display: 'none' }}
                            />
                        </div>
                    )}
                </div>

                {/* 오른쪽 패널 (탭) */}
                <div className="right-panel">
                    <div className="tab-header">
                        <button className={`tab-button ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>
                            ✂️ 편집
                        </button>
                        <button className={`tab-button ${activeTab === 'subtitle' ? 'active' : ''}`} onClick={() => setActiveTab('subtitle')}>
                            💬 자막
                        </button>
                        <button className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
                            🤖 AI
                        </button>
                        <button className={`tab-button ${activeTab === 'export' ? 'active' : ''}`} onClick={() => setActiveTab('export')}>
                            📦 내보내기
                        </button>
                    </div>

                    {activeTab === 'edit' && (
                        <EditTab
                            segments={segments}
                            videoRef={videoRef}
                            onAddSegment={handleAddSegment}
                            onDeleteSegment={handleDeleteSegment}
                            onUpdateSegment={handleUpdateSegment}
                            onCut={handleCut}
                            onPreview={handlePreview}
                            isPreviewPlaying={isPreviewPlaying}
                            hasVideo={!!videoFile}
                            duration={videoDuration}
                        />
                    )}

                    {activeTab === 'subtitle' && (
                        <SubtitleTab
                            subtitles={subtitles}
                            onAddSubtitle={handleAddSubtitle}
                            onUpdateSubtitle={() => {}}
                            onDeleteSubtitle={handleDeleteSubtitle}
                            onApplySubtitles={() => {}}
                            onClearSubtitles={handleClearSubtitles}
                            videoRef={videoRef}
                        />
                    )}

                    {activeTab === 'ai' && (
                        <AITab
                            onAnalyze={handleAnalyze}
                            recommendations={recommendations}
                            isAnalyzing={isAnalyzing}
                            onApplyRecommendation={handleApplyRecommendation}
                            videoRef={videoRef}
                            onGenerateTitle={handleGenerateTitle}
                            onVisionSubtitles={handleVisionSubtitles}
                            visionSubtitles={visionSubtitles}
                            isVisionProcessing={isVisionProcessing}
                            onApplyVisionSubtitles={handleApplyVisionSubtitles}
                            videoFile={videoFile}
                            visionStage={visionStage}
                        />
                    )}

                    {activeTab === 'export' && (
                        <ExportTab
                            onExport={handleExport}
                            onEject={handleEject}
                            isExporting={isExporting}
                            exportProgress={exportProgress}
                            hasVideo={!!videoFile}
                            subtitleCount={subtitles.length}
                            segmentCount={segments.length}
                            exportResult={exportResult}
                            videoCount={videoList.length}
                            projectName={projectName}
                        />
                    )}
                </div>
            </div>

            {/* 타임라인 */}
            {videoFile && videoDuration > 0 && (
                <div className="timeline-container">
                    <div className="timeline-controls">
                        <div className="timeline-zoom">
                            <button className="zoom-button" onClick={() => setZoom(Math.max(0.5, zoom - 0.5))}>−</button>
                            <span style={{ fontSize: '12px', color: '#9ca3af', width: '40px', textAlign: 'center' }}>
                                {(zoom * 100).toFixed(0)}%
                            </span>
                            <button className="zoom-button" onClick={() => setZoom(Math.min(3, zoom + 0.5))}>+</button>
                        </div>
                    </div>
                    <Timeline
                        segments={segments}
                        duration={videoDuration}
                        videoRef={videoRef}
                        onSeek={handleSeek}
                        zoom={zoom}
                    />
                </div>
            )}

            {/* 상태 바 (Android Studio 풍) */}
            <div className="status-bar">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                        onClick={() => { loadProjectList(); setShowProjectPanel(!showProjectPanel); }}
                        style={{ cursor: 'pointer', color: '#CC7832', fontWeight: 600, borderRight: '1px solid #515658', paddingRight: '8px' }}
                        title="Open project list"
                    >
                        {projectName || 'No Project'}
                    </span>
                    <span>
                        {videoFile ? `📹 ${videoFile.name}` : '대기 중'}
                        {subtitles.length > 0 && ` | 💬 자막 ${subtitles.length}개`}
                        {segments.length > 0 && ` | ✂️ 구간 ${segments.length}개`}
                    </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {needFullscreen && (
                        <span
                            onClick={() => {
                                const el = document.documentElement;
                                if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
                            }}
                            style={{ color: '#FFC66D', cursor: 'pointer', fontWeight: 600, fontSize: '11px', padding: '1px 6px', background: '#3C3F41', borderRadius: '3px', border: '1px solid #515658' }}
                        >
                            Fullscreen
                        </span>
                    )}
                    {autoSaveStatus && <span style={{ color: autoSaveStatus === 'saved' ? '#6A9955' : '#808080', marginRight: '8px', fontSize: '10px' }}>{autoSaveStatus === 'saved' ? 'Auto-saved' : 'Saving...'}</span>}
                    CutSense v0.2 | Port 9000
                </span>
            </div>

            {/* 프로젝트 패널 (슬라이드) */}
            {showProjectPanel && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 500, display: 'flex',
                }}>
                    {/* 배경 클릭 시 닫기 */}
                    <div
                        onClick={() => setShowProjectPanel(false)}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }}
                    />
                    {/* 패널 (오른쪽에서 슬라이드) */}
                    <div style={{
                        width: '360px', background: '#2B2B2B', borderLeft: '1px solid #515658',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
                    }}>
                        {/* 패널 헤더 */}
                        <div style={{
                            padding: '16px 20px', borderBottom: '1px solid #515658',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFC66D' }}>Projects</span>
                            <span
                                onClick={() => setShowProjectPanel(false)}
                                style={{ color: '#808080', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
                            >×</span>
                        </div>

                        {/* 새 프로젝트 입력 */}
                        <div style={{ padding: '12px 20px', borderBottom: '1px solid #3C3F41' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="newProjectInput"
                                    type="text"
                                    placeholder="New project name..."
                                    defaultValue=""
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                            handleNewProject(e.target.value.trim());
                                            e.target.value = '';
                                            setShowProjectPanel(false);
                                        }
                                    }}
                                    style={{
                                        flex: 1, background: '#3C3F41', border: '1px solid #515658',
                                        borderRadius: '4px', padding: '8px 12px', color: '#A9B7C6',
                                        fontSize: '12px', outline: 'none',
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const input = document.getElementById('newProjectInput');
                                        const val = input?.value?.trim();
                                        if (val) { handleNewProject(val); input.value = ''; setShowProjectPanel(false); }
                                    }}
                                    style={{
                                        background: '#365880', color: '#A9B7C6', border: '1px solid #515658',
                                        borderRadius: '4px', padding: '8px 12px', fontSize: '12px',
                                        fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                    }}
                                >+ New</button>
                            </div>
                            {/* 저장 경로 표시 */}
                            <div style={{ marginTop: '8px', fontSize: '10px', color: '#606060' }}>
                                Save path: ./projects/
                            </div>
                        </div>

                        {/* 현재 프로젝트 */}
                        {projectName && projectId && (
                            <div style={{
                                padding: '10px 20px', borderBottom: '1px solid #3C3F41',
                                background: '#313335',
                            }}>
                                <div style={{ fontSize: '10px', color: '#808080', marginBottom: '4px' }}>Current Project</div>
                                <div style={{ fontSize: '13px', color: '#CC7832', fontWeight: 700 }}>{projectName}</div>
                                <div style={{ fontSize: '10px', color: '#606060', marginTop: '2px' }}>
                                    {videoList.length} video(s) · {segments.length} cut(s)
                                </div>
                            </div>
                        )}

                        {/* 프로젝트 목록 */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                            {projectList.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#606060', fontSize: '12px' }}>
                                    No saved projects yet
                                </div>
                            ) : (
                                projectList.map(p => (
                                    <div key={p.id}
                                        onClick={() => { handleOpenProject(p.id); setShowProjectPanel(false); }}
                                        style={{
                                            background: p.id === projectId ? '#365880' : '#3C3F41',
                                            border: `1px solid ${p.id === projectId ? '#4A6D8C' : '#515658'}`,
                                            borderRadius: '4px', padding: '10px 14px', cursor: 'pointer',
                                            marginBottom: '6px', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={(e) => { if (p.id !== projectId) e.currentTarget.style.borderColor = '#CC7832'; }}
                                        onMouseLeave={(e) => { if (p.id !== projectId) e.currentTarget.style.borderColor = '#515658'; }}
                                    >
                                        <div style={{ fontSize: '13px', color: p.id === projectId ? '#FFC66D' : '#A9B7C6', fontWeight: 600 }}>
                                            {p.name}
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#808080', marginTop: '3px', display: 'flex', gap: '8px' }}>
                                            <span>{p.video_count || 0} videos</span>
                                            <span>·</span>
                                            <span>{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : ''}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 모달 */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onSettingsChange={setSettings}
                onSaveSettings={() => {}}
            />

            {/* 프로젝트 생성 모달 */}
            {showNewProjectModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', zIndex: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{
                        background: '#2B2B2B', border: '1px solid #515658', borderRadius: '10px',
                        padding: '28px 32px', width: '420px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                    }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFC66D', marginBottom: '20px' }}>
                            New Project
                        </div>

                        {/* 프로젝트 이름 */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: '#808080', marginBottom: '6px' }}>Project Name</div>
                            <input
                                type="text"
                                autoFocus
                                placeholder="My video project..."
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleNewProjectConfirm()}
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    background: '#3C3F41', border: '1px solid #515658', borderRadius: '4px',
                                    padding: '10px 14px', color: '#A9B7C6', fontSize: '14px', outline: 'none',
                                }}
                            />
                        </div>

                        {/* 프로젝트 타입 */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', color: '#808080', marginBottom: '8px' }}>Project Type</div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div
                                    onClick={() => setNewProjectType('single')}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: '6px', cursor: 'pointer',
                                        background: newProjectType === 'single' ? '#365880' : '#3C3F41',
                                        border: `1px solid ${newProjectType === 'single' ? '#4A6D8C' : '#515658'}`,
                                        textAlign: 'center', transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>📹</div>
                                    <div style={{ fontSize: '12px', color: '#A9B7C6', fontWeight: 600 }}>Single Video</div>
                                    <div style={{ fontSize: '10px', color: '#808080', marginTop: '2px' }}>영상 1개 편집</div>
                                </div>
                                <div
                                    onClick={() => setNewProjectType('multi')}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: '6px', cursor: 'pointer',
                                        background: newProjectType === 'multi' ? '#365880' : '#3C3F41',
                                        border: `1px solid ${newProjectType === 'multi' ? '#4A6D8C' : '#515658'}`,
                                        textAlign: 'center', transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>🎬</div>
                                    <div style={{ fontSize: '12px', color: '#A9B7C6', fontWeight: 600 }}>Multi Video</div>
                                    <div style={{ fontSize: '10px', color: '#808080', marginTop: '2px' }}>여러 영상 합치기</div>
                                </div>
                            </div>
                        </div>

                        {/* 저장 경로 안내 */}
                        <div style={{ fontSize: '10px', color: '#606060', marginBottom: '16px' }}>
                            Save path: ./projects/{newProjectName ? newProjectName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_') : '...'}.json
                        </div>

                        {/* 버튼 */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setShowNewProjectModal(false); pendingFilesRef.current = null; }}
                                style={{
                                    background: '#3C3F41', color: '#A9B7C6', border: '1px solid #515658',
                                    borderRadius: '4px', padding: '8px 20px', fontSize: '12px', cursor: 'pointer',
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleNewProjectConfirm}
                                disabled={!newProjectName.trim()}
                                style={{
                                    background: newProjectName.trim() ? '#365880' : '#4C5052',
                                    color: newProjectName.trim() ? '#FFC66D' : '#808080',
                                    border: '1px solid #515658', borderRadius: '4px',
                                    padding: '8px 20px', fontSize: '12px', fontWeight: 700,
                                    cursor: newProjectName.trim() ? 'pointer' : 'not-allowed',
                                }}
                            >Create & Start</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
