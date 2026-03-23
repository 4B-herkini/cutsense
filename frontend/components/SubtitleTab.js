const SubtitleTab = ({ subtitles, onAddSubtitle, onUpdateSubtitle, onDeleteSubtitle, onApplySubtitles, onClearSubtitles, videoRef }) => {
    const [newSubtitle, setNewSubtitle] = useState({
        text: '',
        startTime: '00:00',
        endTime: '00:05',
        fontSize: 20,
        color: '#ffffff',
        position: 'bottom',
        backgroundColor: '#000000',
        backgroundEnabled: false
    });

    const handleAddSubtitle = () => {
        if (newSubtitle.text.trim()) {
            onAddSubtitle({
                ...newSubtitle,
                startTime: parseTime(newSubtitle.startTime),
                endTime: parseTime(newSubtitle.endTime)
            });
            setNewSubtitle({
                text: '',
                startTime: '00:00',
                endTime: '00:05',
                fontSize: 20,
                color: '#ffffff',
                position: 'bottom',
                backgroundColor: '#000000',
                backgroundEnabled: false
            });
        }
    };

    return (
        <div className="tab-content">
            <div className="form-group">
                <label className="form-label">자막 텍스트</label>
                <textarea
                    className="form-input"
                    placeholder="자막을 입력하세요"
                    value={newSubtitle.text}
                    onChange={(e) => setNewSubtitle({ ...newSubtitle, text: e.target.value })}
                    style={{ minHeight: '60px', resize: 'vertical' }}
                />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">시작 시간</label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="00:00"
                        value={newSubtitle.startTime}
                        onChange={(e) => setNewSubtitle({ ...newSubtitle, startTime: e.target.value })}
                    />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">종료 시간</label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="00:05"
                        value={newSubtitle.endTime}
                        onChange={(e) => setNewSubtitle({ ...newSubtitle, endTime: e.target.value })}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">글자 크기</label>
                    <input
                        type="number"
                        className="form-input"
                        value={newSubtitle.fontSize}
                        onChange={(e) => setNewSubtitle({ ...newSubtitle, fontSize: parseInt(e.target.value) || 20 })}
                        min="12"
                        max="48"
                    />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">위치</label>
                    <select
                        className="form-select"
                        value={newSubtitle.position}
                        onChange={(e) => setNewSubtitle({ ...newSubtitle, position: e.target.value })}
                    >
                        <option value="top">상단</option>
                        <option value="center">중간</option>
                        <option value="bottom">하단</option>
                    </select>
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">글자 색상</label>
                <input
                    type="color"
                    className="color-picker"
                    value={newSubtitle.color}
                    onChange={(e) => setNewSubtitle({ ...newSubtitle, color: e.target.value })}
                />
            </div>

            <div className="checkbox-group">
                <input
                    type="checkbox"
                    className="checkbox"
                    checked={newSubtitle.backgroundEnabled}
                    onChange={(e) => setNewSubtitle({ ...newSubtitle, backgroundEnabled: e.target.checked })}
                    id="bgCheckbox"
                />
                <label className="checkbox-label" htmlFor="bgCheckbox">
                    배경색 사용
                </label>
            </div>

            {newSubtitle.backgroundEnabled && (
                <div className="form-group">
                    <label className="form-label">배경 색상</label>
                    <input
                        type="color"
                        className="color-picker"
                        value={newSubtitle.backgroundColor}
                        onChange={(e) => setNewSubtitle({ ...newSubtitle, backgroundColor: e.target.value })}
                    />
                </div>
            )}

            <button
                className="button-primary"
                onClick={handleAddSubtitle}
                style={{ width: '100%' }}
            >
                + 자막 추가
            </button>

            {subtitles.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label">자막 목록 ({subtitles.length})</label>
                        <button
                            onClick={onClearSubtitles}
                            style={{
                                background: '#7f1d1d', color: '#fca5a5', border: 'none',
                                padding: '3px 10px', borderRadius: '4px', fontSize: '11px',
                                cursor: 'pointer', fontWeight: '600',
                            }}
                        >
                            전체 삭제
                        </button>
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {subtitles.map((sub, idx) => (
                            <div key={idx} className="segment-item">
                                <div className="segment-info">
                                    <div style={{ color: '#e5e5e5' }} title={sub.text}>{sub.text.substring(0, 30)}...</div>
                                    <div className="segment-times">
                                        {formatTime(sub.startTime)} - {formatTime(sub.endTime)}
                                    </div>
                                </div>
                                <button
                                    className="delete-button"
                                    onClick={() => onDeleteSubtitle(idx)}
                                >
                                    삭제
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
