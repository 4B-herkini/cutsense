const EditTab = ({ segments, videoRef, onAddSegment, onDeleteSegment, onUpdateSegment, onCut, onPreview, isPreviewPlaying, hasVideo, duration }) => {
    const [inPoint, setInPoint] = useState(null);
    const [outPoint, setOutPoint] = useState(null);
    const [expandedIdx, setExpandedIdx] = useState(null); // 펼친 구간 (미세 조절용)

    const handleSetIn = () => {
        if (videoRef.current) {
            setInPoint(videoRef.current.currentTime);
        }
    };

    const handleSetOut = () => {
        if (videoRef.current) {
            setOutPoint(videoRef.current.currentTime);
        }
    };

    const handleAddSegment = () => {
        if (inPoint !== null && outPoint !== null && inPoint < outPoint) {
            onAddSegment({ start: inPoint, end: outPoint });
            setInPoint(null);
            setOutPoint(null);
        }
    };

    // 미세 조절 버튼 렌더
    const renderAdjustButtons = (idx, field) => {
        const btnStyle = (color) => ({
            background: 'none', border: `1px solid ${color}`,
            color: color, borderRadius: '3px', padding: '2px 6px',
            fontSize: '10px', fontWeight: 700, cursor: 'pointer',
            minWidth: '36px', textAlign: 'center',
            transition: 'all 0.15s',
        });
        return (
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <button style={btnStyle('#CC7832')} onClick={() => onUpdateSegment(idx, field, -1)}>-1s</button>
                <button style={btnStyle('#808080')} onClick={() => onUpdateSegment(idx, field, -0.1)}>-0.1</button>
                <button style={btnStyle('#808080')} onClick={() => onUpdateSegment(idx, field, +0.1)}>+0.1</button>
                <button style={btnStyle('#CC7832')} onClick={() => onUpdateSegment(idx, field, +1)}>+1s</button>
            </div>
        );
    };

    // 구간 클릭 시 해당 시간으로 이동
    const handleSeekToSegment = (seg) => {
        if (videoRef.current) {
            videoRef.current.currentTime = seg.startTime || seg.start;
        }
    };

    return (
        <div className="tab-content">
            <div className="form-group">
                <label className="form-label">구간 선택</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="control-button primary"
                        onClick={handleSetIn}
                        disabled={!hasVideo}
                    >
                        구간 시작: {inPoint !== null ? formatTime(inPoint) : '--:--'}
                    </button>
                    <button
                        className="control-button primary"
                        onClick={handleSetOut}
                        disabled={!hasVideo}
                    >
                        구간 끝: {outPoint !== null ? formatTime(outPoint) : '--:--'}
                    </button>
                </div>
            </div>

            <button
                className="button-primary"
                onClick={handleAddSegment}
                disabled={inPoint === null || outPoint === null || inPoint >= outPoint}
                style={{ width: '100%' }}
            >
                + 구간 추가
            </button>

            <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">제거할 구간 ({segments.length})</label>
                    {segments.length > 0 && (
                        <button
                            onClick={onPreview}
                            style={{
                                background: isPreviewPlaying ? '#6A3333' : '#1E2E1E',
                                color: isPreviewPlaying ? '#FF6B6B' : '#6A9955',
                                border: `1px solid ${isPreviewPlaying ? '#FF6B6B' : '#6A9955'}`,
                                borderRadius: '4px', padding: '3px 10px',
                                fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                transition: 'all 0.2s',
                                animation: isPreviewPlaying ? 'cutPulse 1.5s infinite' : 'none',
                            }}
                        >
                            {isPreviewPlaying ? '■ Stop' : '▶ Preview'}
                        </button>
                    )}
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {segments.length === 0 ? (
                        <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                            구간을 추가하세요
                        </div>
                    ) : (
                        segments.map((seg, idx) => {
                            const start = seg.startTime || seg.start;
                            const end = seg.endTime || seg.end;
                            const isExpanded = expandedIdx === idx;
                            return (
                                <div key={idx} style={{
                                    background: isExpanded ? '#313335' : '#2B2B2B',
                                    border: `1px solid ${isExpanded ? '#CC7832' : '#515658'}`,
                                    borderRadius: '6px', overflow: 'hidden',
                                    transition: 'all 0.2s',
                                }}>
                                    {/* 메인 행 */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '8px 10px', cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                        setExpandedIdx(isExpanded ? null : idx);
                                        handleSeekToSegment(seg);
                                    }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                color: '#CC7832', fontSize: '11px', fontWeight: 800,
                                                background: '#3C3F41', padding: '1px 6px', borderRadius: '3px',
                                            }}>
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <div style={{ color: '#A9B7C6', fontSize: '12px', fontWeight: 600 }}>
                                                    {formatTime(start)} → {formatTime(end)}
                                                </div>
                                                <div style={{ color: '#808080', fontSize: '10px', marginTop: '1px' }}>
                                                    duration: {formatTime(end - start)}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{
                                                color: '#808080', fontSize: '10px',
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                                transition: 'transform 0.2s',
                                            }}>▼</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteSegment(idx); }}
                                                style={{
                                                    background: 'none', border: '1px solid #515658',
                                                    color: '#808080', borderRadius: '3px', padding: '2px 8px',
                                                    fontSize: '10px', cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                }}
                                                onMouseEnter={(e) => { e.target.style.borderColor = '#FF6B6B'; e.target.style.color = '#FF6B6B'; }}
                                                onMouseLeave={(e) => { e.target.style.borderColor = '#515658'; e.target.style.color = '#808080'; }}
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>

                                    {/* 펼침 영역 — 미세 조절 */}
                                    {isExpanded && (
                                        <div style={{
                                            padding: '8px 10px 10px', borderTop: '1px solid #3C3F41',
                                            display: 'flex', flexDirection: 'column', gap: '8px',
                                        }}>
                                            {/* 시작 시간 조절 */}
                                            <div>
                                                <div style={{ fontSize: '10px', color: '#6A9955', marginBottom: '4px', fontWeight: 600 }}>
                                                    Start: {formatTime(start)}
                                                </div>
                                                {renderAdjustButtons(idx, 'start')}
                                            </div>
                                            {/* 끝 시간 조절 */}
                                            <div>
                                                <div style={{ fontSize: '10px', color: '#CC7832', marginBottom: '4px', fontWeight: 600 }}>
                                                    End: {formatTime(end)}
                                                </div>
                                                {renderAdjustButtons(idx, 'end')}
                                            </div>
                                            {/* 이 구간만 재생 */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (videoRef.current) {
                                                        videoRef.current.currentTime = start;
                                                        videoRef.current.play();
                                                        // 구간 끝에서 멈추기
                                                        const checkEnd = () => {
                                                            if (videoRef.current && videoRef.current.currentTime >= end) {
                                                                videoRef.current.pause();
                                                                videoRef.current.removeEventListener('timeupdate', checkEnd);
                                                            }
                                                        };
                                                        videoRef.current.addEventListener('timeupdate', checkEnd);
                                                    }
                                                }}
                                                style={{
                                                    background: '#365880', color: '#A9B7C6', border: '1px solid #4A6D8C',
                                                    borderRadius: '4px', padding: '5px 0', fontSize: '11px',
                                                    fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                                                    width: '100%', marginTop: '2px',
                                                }}
                                            >
                                                ▶ 이 구간만 재생
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <button
                className="button-primary"
                onClick={onCut}
                disabled={segments.length === 0}
                style={{ width: '100%', marginTop: '12px' }}
            >
                선택 구간 제거 & 내보내기
            </button>
            <div style={{ fontSize: '10px', color: '#808080', marginTop: '6px', textAlign: 'center' }}>
                표시된 구간이 영상에서 제거됩니다 | 최종 내보내기는 [내보내기] 탭
            </div>
        </div>
    );
};
