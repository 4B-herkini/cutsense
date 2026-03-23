const AITab = ({ onAnalyze, recommendations, isAnalyzing, onApplyRecommendation, videoRef, onGenerateTitle, onVisionSubtitles, visionSubtitles, isVisionProcessing, onApplyVisionSubtitles, videoFile, visionStage }) => {
    const [generatingIdx, setGeneratingIdx] = useState(null);

    const handleGenerateTitle = async (idx) => {
        setGeneratingIdx(idx);
        await onGenerateTitle(idx);
        setGeneratingIdx(null);
    };

    const stageMessages = {
        'idle': '',
        'extracting': '프레임 추출 중...',
        'pass1': '1단계: 영상 전체 맥락 파악 중...',
        'pass2': '2단계: 스마트 자막 생성 중...',
        'done': '완료!'
    };

    return (
        <div className="tab-content">
            {/* Vision 자막 생성 — 핵심 기능 */}
            <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.15)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🧠</span>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#e0e7ff' }}>
                        스마트 자막 생성
                    </div>
                </div>
                <div style={{ fontSize: '12px', color: '#a5b4fc', marginBottom: '16px', lineHeight: '1.5' }}>
                    AI가 영상을 2번 분석합니다. 먼저 전체 맥락을 파악하고,
                    그 다음 장면 전환을 감지해서 센스 있는 자막을 만들어줍니다.
                </div>

                {/* Progress indicator */}
                {isVisionProcessing && (
                    <div style={{
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '12px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: '#818cf8',
                                animation: 'pulse 1.5s infinite',
                            }}></div>
                            <span style={{ fontSize: '12px', color: '#c7d2fe', fontWeight: '500' }}>
                                {stageMessages[visionStage] || '분석 중...'}
                            </span>
                        </div>
                        <div style={{
                            height: '3px', background: 'rgba(255,255,255,0.1)',
                            borderRadius: '2px', overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
                                borderRadius: '2px',
                                width: visionStage === 'pass1' ? '30%' : visionStage === 'pass2' ? '70%' : visionStage === 'done' ? '100%' : '10%',
                                transition: 'width 0.5s ease',
                            }}></div>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => onVisionSubtitles()}
                    disabled={isVisionProcessing || !videoFile}
                    style={{
                        width: '100%', padding: '12px', borderRadius: '8px',
                        border: 'none', fontWeight: '700', fontSize: '14px',
                        cursor: isVisionProcessing || !videoFile ? 'not-allowed' : 'pointer',
                        background: isVisionProcessing ? 'rgba(255,255,255,0.1)'
                            : !videoFile ? 'rgba(255,255,255,0.08)'
                            : 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)',
                        color: isVisionProcessing || !videoFile ? '#6366f1' : '#fff',
                        transition: 'all 0.3s ease',
                        boxShadow: !isVisionProcessing && videoFile ? '0 4px 15px rgba(129, 140, 248, 0.4)' : 'none',
                        letterSpacing: '0.5px',
                    }}
                >
                    {isVisionProcessing ? '🔄 AI 분석 진행 중...'
                        : !videoFile ? '📹 영상을 먼저 업로드하세요'
                        : '🚀 스마트 자막 생성'}
                </button>

                {!isVisionProcessing && videoFile && (
                    <div style={{ fontSize: '10px', color: '#6366f1', marginTop: '8px', textAlign: 'center' }}>
                        2-Pass AI 분석 · 장면 전환 자동 감지 · 센스 있는 코멘트
                    </div>
                )}
            </div>

            {/* Vision 결과 */}
            {visionSubtitles.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px' }}>✨</span>
                            <label className="form-label" style={{ margin: 0, color: '#c4b5fd', fontSize: '13px', fontWeight: '600' }}>
                                생성된 자막 ({visionSubtitles.length}개)
                            </label>
                        </div>
                        <button
                            onClick={onApplyVisionSubtitles}
                            style={{
                                fontSize: '11px', padding: '5px 12px', borderRadius: '6px',
                                background: 'linear-gradient(135deg, #059669, #10b981)',
                                color: '#fff', border: 'none', cursor: 'pointer',
                                fontWeight: '600', transition: 'all 0.2s ease',
                            }}
                        >
                            자막 탭에 적용
                        </button>
                    </div>
                    <div style={{
                        maxHeight: '250px', overflowY: 'auto',
                        display: 'flex', flexDirection: 'column', gap: '4px',
                        paddingRight: '4px',
                    }}>
                        {visionSubtitles.map((sub, idx) => (
                            <div key={idx} style={{
                                background: '#1a1a2e', borderRadius: '8px',
                                padding: '10px 12px', fontSize: '12px',
                                borderLeft: '3px solid #6366f1',
                                transition: 'background 0.2s ease',
                            }}>
                                <div style={{
                                    color: '#818cf8', fontSize: '10px', marginBottom: '3px',
                                    fontFamily: "'Courier New', monospace", fontWeight: '600',
                                }}>
                                    {formatTime(sub.start)} → {formatTime(sub.end)}
                                </div>
                                <div style={{ color: '#e2e8f0', lineHeight: '1.4' }}>{sub.text}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: '12px' }}>
                <label className="form-label" style={{ fontSize: '11px', color: '#4b5563' }}>기타 AI 기능</label>
            </div>

            <button
                className="button-primary"
                onClick={onAnalyze}
                disabled={isAnalyzing}
                style={{ width: '100%' }}
            >
                {isAnalyzing ? '분석 중...' : 'AI 하이라이트 분석'}
            </button>

            {recommendations.length > 0 && (
                <div>
                    <label className="form-label">추천 하이라이트</label>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recommendations.map((rec, idx) => (
                            <div key={idx} className="ai-recommendation" onClick={() => onApplyRecommendation(idx)}>
                                <div className="recommendation-title">{rec.title || `하이라이트 ${idx + 1}`}</div>
                                <div className="recommendation-times">
                                    {formatTime(rec.start)} - {formatTime(rec.end)} ({formatTime(rec.end - rec.start)})
                                </div>
                                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                                    신뢰도: {(rec.confidence * 100).toFixed(0)}%
                                </div>
                                <button
                                    className="button-secondary"
                                    onClick={(e) => { e.stopPropagation(); handleGenerateTitle(idx); }}
                                    disabled={generatingIdx === idx}
                                    style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
                                >
                                    {generatingIdx === idx ? '생성 중...' : '타이틀 생성'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!isAnalyzing && recommendations.length === 0 && !isVisionProcessing && visionSubtitles.length === 0 && (
                <div style={{ color: '#4b5563', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                    영상을 업로드하고 AI 기능을 사용해보세요
                </div>
            )}
        </div>
    );
};
