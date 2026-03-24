const AITab = ({ onAnalyze, recommendations, isAnalyzing, onApplyRecommendation, videoRef, onGenerateTitle, onVisionSubtitles, visionSubtitles, isVisionProcessing, onApplyVisionSubtitles, videoFile, visionStage, segmentCount, videoDuration }) => {
    const [generatingIdx, setGeneratingIdx] = useState(null);
    const [subtitleStyle, setSubtitleStyle] = useState('auto');

    const styleOptions = [
        { id: 'auto', name: 'AI 자동 판단', icon: '✨', desc: 'AI가 알아서 톤/밀도/스타일 결정' },
        { id: 'portfolio', name: '포트폴리오 시연', icon: '🎯', desc: '내가 만든 걸 보여줄 때' },
        { id: 'training', name: '사내 교육', icon: '📖', desc: '처음 쓰는 사람도 따라하게' },
        { id: 'client', name: '클라이언트 납품', icon: '💼', desc: '격식 있고 전문적으로' },
        { id: 'sns', name: 'SNS 숏폼', icon: '🔥', desc: '스크롤 멈추게!' },
        { id: 'qa', name: 'QA 리포트', icon: '🔍', desc: '테스트 기록, 팩트만' },
    ];

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
                background: '#2B2B2B',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '16px',
                border: '1px solid #3C3F41',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '22px' }}>🧠</span>
                    <div style={{ fontWeight: '700', fontSize: '18px', color: '#CC7832' }}>
                        AI Vision 자막 생성
                    </div>
                </div>
                <div style={{ fontSize: '14px', color: '#A9B7C6', marginBottom: '14px', lineHeight: '1.7' }}>
                    음성이 없는 화면 캡처 영상을 AI가 <strong style={{ color: '#FFC66D' }}>직접 보고</strong> 자막을 만듭니다.
                </div>

                {/* 작동 방식 */}
                <div style={{
                    fontSize: '13px', color: '#A9B7C6', lineHeight: '2.0',
                    marginBottom: '18px', padding: '12px 14px',
                    background: '#313335', borderRadius: '6px',
                    borderLeft: '3px solid #CC7832',
                }}>
                    <div style={{ marginBottom: '6px', fontSize: '14px' }}><strong style={{ color: '#FFC66D' }}>작동 방식</strong></div>
                    <div>1. 영상에서 3초 간격으로 화면 캡처</div>
                    <div>2. <strong style={{ color: '#CC7832' }}>Pass 1</strong> — 8장 샘플로 전체 맥락 파악 (어떤 앱인지, 뭘 하는지)</div>
                    <div>3. <strong style={{ color: '#CC7832' }}>Pass 2</strong> — 장면 전환 감지 + 자연스러운 자막 생성</div>
                    {segmentCount > 0 && (
                        <div style={{ marginTop: '8px', color: '#FFC66D' }}>
                            ✂ 컷 {segmentCount}개 → 먼저 불필요 구간 제거한 영상을 만든 후 분석
                        </div>
                    )}
                </div>

                {/* 자막 스타일 선택 */}
                <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '14px', color: '#FFC66D', marginBottom: '10px', fontWeight: 700 }}>자막 스타일</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {styleOptions.map(opt => {
                            const isAuto = opt.id === 'auto';
                            const isSelected = subtitleStyle === opt.id;
                            return (
                                <div
                                    key={opt.id}
                                    onClick={() => !isVisionProcessing && setSubtitleStyle(opt.id)}
                                    style={{
                                        flex: isAuto ? '1 1 100%' : '1 1 calc(50% - 4px)',
                                        minWidth: isAuto ? '100%' : '140px',
                                        padding: isAuto ? '12px 14px' : '10px 12px',
                                        borderRadius: '6px',
                                        cursor: isVisionProcessing ? 'not-allowed' : 'pointer',
                                        background: isSelected
                                            ? (isAuto ? '#3d3522' : '#3C3F41')
                                            : '#313335',
                                        border: isSelected
                                            ? (isAuto ? '2px solid #FFC66D' : '2px solid #CC7832')
                                            : '1px solid #3C3F41',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{ fontSize: isAuto ? '16px' : '15px', marginBottom: '4px' }}>
                                        {opt.icon} <span style={{
                                            fontSize: isAuto ? '15px' : '14px', fontWeight: 700,
                                            color: isSelected ? (isAuto ? '#FFC66D' : '#CC7832') : '#A9B7C6'
                                        }}>{opt.name}</span>
                                        {isAuto && <span style={{ fontSize: '11px', color: '#6A8759', marginLeft: '8px' }}>추천</span>}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6A8759', lineHeight: '1.4' }}>
                                        {opt.desc}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Progress indicator */}
                {isVisionProcessing && (
                    <div style={{
                        background: '#313335',
                        borderRadius: '8px',
                        padding: '14px',
                        marginBottom: '14px',
                        border: '1px solid #3C3F41',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <div style={{
                                width: '10px', height: '10px', borderRadius: '50%',
                                background: '#CC7832',
                                animation: 'pulse 1.5s infinite',
                            }}></div>
                            <span style={{ fontSize: '14px', color: '#A9B7C6', fontWeight: '600' }}>
                                {stageMessages[visionStage] || '분석 중...'}
                            </span>
                        </div>
                        <div style={{
                            height: '4px', background: '#3C3F41',
                            borderRadius: '2px', overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                background: '#CC7832',
                                borderRadius: '2px',
                                width: visionStage === 'pass1' ? '30%' : visionStage === 'pass2' ? '70%' : visionStage === 'done' ? '100%' : '10%',
                                transition: 'width 0.5s ease',
                            }}></div>
                        </div>
                    </div>
                )}

                {/* 컷 구간 상태 안내 */}
                {videoFile && segmentCount > 0 && (
                    <div style={{
                        background: 'rgba(204, 120, 50, 0.12)',
                        border: '1px solid #CC7832',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        marginBottom: '14px',
                        display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                        <span style={{ fontSize: '18px' }}>✂</span>
                        <div style={{ fontSize: '13px', color: '#FFC66D', lineHeight: '1.6' }}>
                            <strong>컷 구간 {segmentCount}개 감지</strong><br/>
                            <span style={{ color: '#A9B7C6' }}>
                                컷 적용 영상을 먼저 생성한 후, 그 영상에 AI 자막을 입힙니다.
                            </span>
                        </div>
                    </div>
                )}

                {videoFile && segmentCount === 0 && (
                    <div style={{
                        background: 'rgba(106, 153, 85, 0.1)',
                        border: '1px solid #6A8759',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        marginBottom: '14px',
                        display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                        <span style={{ fontSize: '18px' }}>📹</span>
                        <div style={{ fontSize: '13px', color: '#A9B7C6', lineHeight: '1.6' }}>
                            컷 없음 — 원본 영상 전체에 AI 자막을 생성합니다.
                        </div>
                    </div>
                )}

                <button
                    onClick={() => onVisionSubtitles(subtitleStyle)}
                    disabled={isVisionProcessing || !videoFile}
                    style={{
                        width: '100%', padding: '14px', borderRadius: '8px',
                        border: 'none', fontWeight: '700', fontSize: '16px',
                        cursor: isVisionProcessing || !videoFile ? 'not-allowed' : 'pointer',
                        background: isVisionProcessing ? '#3C3F41'
                            : !videoFile ? '#313335'
                            : '#CC7832',
                        color: isVisionProcessing || !videoFile ? '#6A6A6A' : '#fff',
                        transition: 'all 0.3s ease',
                        letterSpacing: '0.5px',
                    }}
                >
                    {isVisionProcessing ? '🔄 AI 분석 진행 중...'
                        : !videoFile ? '📹 영상을 먼저 업로드하세요'
                        : segmentCount > 0 ? `🚀 컷 적용 → 스마트 자막 생성`
                        : '🚀 스마트 자막 생성'}
                </button>

                {!isVisionProcessing && videoFile && (
                    <div style={{ fontSize: '12px', color: '#6A8759', marginTop: '10px', textAlign: 'center' }}>
                        2-Pass AI 분석 · 장면 전환 자동 감지 · 센스 있는 코멘트
                    </div>
                )}
            </div>

            {/* Vision 결과 */}
            {visionSubtitles.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px' }}>✨</span>
                            <label className="form-label" style={{ margin: 0, color: '#FFC66D', fontSize: '15px', fontWeight: '700' }}>
                                생성된 자막 ({visionSubtitles.length}개)
                            </label>
                        </div>
                        <button
                            onClick={onApplyVisionSubtitles}
                            style={{
                                fontSize: '13px', padding: '6px 14px', borderRadius: '6px',
                                background: '#6A8759',
                                color: '#fff', border: 'none', cursor: 'pointer',
                                fontWeight: '600', transition: 'all 0.2s ease',
                            }}
                        >
                            자막 탭에 적용
                        </button>
                    </div>
                    <div style={{
                        maxHeight: '280px', overflowY: 'auto',
                        display: 'flex', flexDirection: 'column', gap: '6px',
                        paddingRight: '4px',
                    }}>
                        {visionSubtitles.map((sub, idx) => (
                            <div key={idx} style={{
                                background: '#313335', borderRadius: '8px',
                                padding: '12px 14px', fontSize: '13px',
                                borderLeft: '3px solid #CC7832',
                            }}>
                                <div style={{
                                    color: '#CC7832', fontSize: '12px', marginBottom: '4px',
                                    fontFamily: "'Courier New', monospace", fontWeight: '600',
                                }}>
                                    {formatTime(sub.start)} → {formatTime(sub.end)}
                                </div>
                                <div style={{ color: '#A9B7C6', lineHeight: '1.5', fontSize: '14px' }}>{sub.text}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ borderTop: '1px solid #3C3F41', paddingTop: '14px' }}>
                <label className="form-label" style={{ fontSize: '13px', color: '#6A6A6A' }}>기타 AI 기능</label>
            </div>

            <button
                className="button-primary"
                onClick={onAnalyze}
                disabled={isAnalyzing}
                style={{ width: '100%', fontSize: '14px', padding: '12px' }}
            >
                {isAnalyzing ? '분석 중...' : 'AI 하이라이트 분석'}
            </button>

            {recommendations.length > 0 && (
                <div>
                    <label className="form-label" style={{ fontSize: '14px' }}>추천 하이라이트</label>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recommendations.map((rec, idx) => (
                            <div key={idx} className="ai-recommendation" onClick={() => onApplyRecommendation(idx)}>
                                <div className="recommendation-title">{rec.title || `하이라이트 ${idx + 1}`}</div>
                                <div className="recommendation-times">
                                    {formatTime(rec.start)} - {formatTime(rec.end)} ({formatTime(rec.end - rec.start)})
                                </div>
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                                    신뢰도: {(rec.confidence * 100).toFixed(0)}%
                                </div>
                                <button
                                    className="button-secondary"
                                    onClick={(e) => { e.stopPropagation(); handleGenerateTitle(idx); }}
                                    disabled={generatingIdx === idx}
                                    style={{ width: '100%', marginTop: '8px', fontSize: '13px' }}
                                >
                                    {generatingIdx === idx ? '생성 중...' : '타이틀 생성'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!isAnalyzing && recommendations.length === 0 && !isVisionProcessing && visionSubtitles.length === 0 && (
                <div style={{ color: '#6A6A6A', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                    영상을 업로드하고 AI 기능을 사용해보세요
                </div>
            )}
        </div>
    );
};
