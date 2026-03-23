const EditTab = ({ segments, videoRef, onAddSegment, onDeleteSegment, onCut, hasVideo, duration }) => {
    const [inPoint, setInPoint] = useState(null);
    const [outPoint, setOutPoint] = useState(null);

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
                <label className="form-label">추출된 구간 ({segments.length})</label>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {segments.length === 0 ? (
                        <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                            구간을 추가하세요
                        </div>
                    ) : (
                        segments.map((seg, idx) => (
                            <div key={idx} className="segment-item">
                                <div className="segment-info">
                                    <div style={{ color: '#e5e5e5' }}>구간 {idx + 1}</div>
                                    <div className="segment-times">
                                        {formatTime(seg.start)} - {formatTime(seg.end)} ({formatTime(seg.end - seg.start)})
                                    </div>
                                </div>
                                <button
                                    className="delete-button"
                                    onClick={() => onDeleteSegment(idx)}
                                >
                                    삭제
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <button
                className="button-primary"
                onClick={onCut}
                disabled={segments.length === 0}
                style={{ width: '100%', marginTop: '12px' }}
            >
                잘라내기 및 내보내기
            </button>
        </div>
    );
};