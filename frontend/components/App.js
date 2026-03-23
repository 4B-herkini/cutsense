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

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    // ========================================================================
    // Video Handlers
    // ========================================================================

    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => { setDragOver(false); };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) loadVideo(file);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('video/')) loadVideo(file);
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

            try {
                const res = await fetch(`${settings.serverUrl}/api/uploads`);
                const data = await res.json();
                if (data.files && data.files.length > 0) {
                    const latest = data.files[0];
                    setUploadedFilePath(latest.path);
                    const videoUrl = `${settings.serverUrl}/api/uploads/${latest.filename}`;
                    setVideoFile({ name: latest.filename, url: videoUrl });

                    if (latest.subtitles && latest.subtitles.length > 0) {
                        setVisionSubtitles(latest.subtitles);
                        const loadedSubs = latest.subtitles.map(sub => ({
                            text: sub.text,
                            startTime: sub.start,
                            endTime: sub.end,
                            fontSize: 20,
                            color: '#ffffff',
                            position: 'bottom',
                            backgroundColor: '#000000',
                            backgroundEnabled: true,
                        }));
                        setSubtitles(loadedSubs);
                    }
                }
            } catch (e) { /* no uploads yet */ }
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
        setIsExporting(true);
        setExportProgress(0);
        try {
            const response = await fetch(`${settings.serverUrl}/api/cut`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: uploadedFilePath, segments: segments.map(s => ({ start: s.start, end: s.end })) })
            });
            const data = await response.json();
            if (data.success) showToast('구간 잘라내기 완료!', 'success');
            else showToast(data.detail || '잘라내기 실패', 'error');
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

            if (subtitles.length > 0) {
                setExportProgress(15);
                const burnResponse = await fetch(`${settings.serverUrl}/api/subtitle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_path: uploadedFilePath,
                        subtitles: subtitles.map(s => ({ start: s.startTime, end: s.endTime, text: s.text })),
                    })
                });
                const burnData = await burnResponse.json();
                if (burnData.success && burnData.output_path) {
                    targetFilePath = burnData.output_path;
                    setExportProgress(45);
                } else {
                    showToast('자막 입히기 실패: ' + (burnData.detail || ''), 'error');
                    setIsExporting(false);
                    return;
                }
            }

            setExportProgress(55);
            const exportResponse = await fetch(`${settings.serverUrl}/api/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_path: targetFilePath,
                    format: options.format,
                    quality: options.quality === '4k' ? 'high' : options.quality === '1080p' ? 'medium' : 'low',
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

    // ========================================================================
    // Menu Handlers
    // ========================================================================

    const handleNewProject = () => {
        if (confirm('새 프로젝트를 시작합니다. 현재 작업이 초기화됩니다.')) {
            setVideoFile(null);
            setSegments([]);
            setSubtitles([]);
            setVisionSubtitles([]);
            setRecommendations([]);
            setExportResult(null);
            setUploadedFilePath(null);
            showToast('새 프로젝트 시작');
        }
    };

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
    // Render
    // ========================================================================

    return (
        <div className="app-container">
            {/* Android Studio 풍 메뉴바 */}
            <MenuBar
                onNewProject={handleNewProject}
                onOpenVideo={handleOpenVideo}
                onSaveProject={() => showToast('프로젝트 저장 (준비 중)')}
                onExport={() => setActiveTab('export')}
                onSettings={() => setIsSettingsOpen(true)}
                onToggleCrosshair={() => setShowCrosshair(!showCrosshair)}
                showCrosshair={showCrosshair}
                onAbout={handleAbout}
            />

            {/* 헤더 */}
            <header className="header">
                <div className="header-title">CutSense</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {videoFile && (
                        <span style={{ fontSize: '11px', color: '#6b6b8a', marginRight: '8px' }}>
                            {videoFile.name}
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
                                onDrop={handleDrop}
                                onClick={() => document.getElementById('fileInput').click()}
                            >
                                <div style={{ fontSize: '24px' }}>📹</div>
                                <div className="drop-zone-text">
                                    비디오 파일을 드래그하거나 클릭하여 업로드
                                </div>
                                <input
                                    id="fileInput"
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        ) : (
                            <div style={{ position: 'relative', width: '100%' }}>
                                <video
                                    ref={videoRef}
                                    className="video-player"
                                    src={videoFile?.url}
                                    controls
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={() => setIsPlaying(false)}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                />
                                {/* 십자선 가이드 오버레이 */}
                                {showCrosshair && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0, left: 0, right: 0, bottom: '40px',
                                        pointerEvents: 'none',
                                        zIndex: 5
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%', left: 0, right: 0,
                                            height: '1px',
                                            background: 'rgba(204, 120, 50, 0.3)',
                                            borderTop: '1px dashed rgba(204, 120, 50, 0.4)'
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            left: '50%', top: 0, bottom: 0,
                                            width: '1px',
                                            background: 'rgba(204, 120, 50, 0.3)',
                                            borderLeft: '1px dashed rgba(204, 120, 50, 0.4)'
                                        }} />
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%', left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: '8px', height: '8px',
                                            borderRadius: '50%',
                                            background: '#CC7832',
                                            boxShadow: '0 0 6px rgba(204, 120, 50, 0.6)'
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
                            onCut={handleCut}
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
                            isExporting={isExporting}
                            exportProgress={exportProgress}
                            hasVideo={!!videoFile}
                            subtitleCount={subtitles.length}
                            exportResult={exportResult}
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
                <span>
                    {videoFile ? `📹 ${videoFile.name}` : '대기 중'}
                    {subtitles.length > 0 && ` | 💬 자막 ${subtitles.length}개`}
                    {segments.length > 0 && ` | ✂️ 구간 ${segments.length}개`}
                </span>
                <span>
                    CutSense v0.2 | Port 9000
                </span>
            </div>

            {/* 모달 */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onSettingsChange={setSettings}
                onSaveSettings={() => {}}
            />

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
