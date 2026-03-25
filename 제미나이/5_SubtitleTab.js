const SubtitleTab = ({ subtitles, onAddSubtitle, onUpdateSubtitle, onDeleteSubtitle, onApplySubtitles, onClearSubtitles, videoRef, selectedSubtitleIdx, onSelectSubtitle, onTimeAdjust }) => {
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
    const [editingIdx, setEditingIdx] = useState(null);
    const [editText, setEditText] = useState('');
    const listRef = useRef(null);

    // 선택된 자막으로 자동 스크롤
    useEffect(() => {
        if (selectedSubtitleIdx !== null && selectedSubtitleIdx !== undefined && listRef.current) {
            const card = listRef.current.querySelector(`[data-subtitle-idx="${selectedSubtitleIdx}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [selectedSubtitleIdx]);

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

    const handleDelete = (idx) => {
        if (confirm(`자막 #${idx + 1}을 삭제하시겠습니까?\n\n"${subtitles[idx].text.substring(0, 40)}..."`)) {
            onDeleteSubtitle(idx);
        }
    };

    const handleEditStart = (idx) => {
        setEditingIdx(idx);
        setEditText(subtitles[idx].text);
    };

    const handleEditSave = (idx) => {
        if (editText.trim()) {
            onUpdateSubtitle(idx, { ...subtitles[idx], text: editText.trim() });
        }
        setEditingIdx(null);
        setEditText('');
    };

    const handleEditCancel = () => {
        setEditingIdx(null);
        setEditText('');
    };

    // ±1초, ±0.1초 조절 버튼 렌더러
    const TimeAdjustButtons = ({ idx, field, label }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#808080', minWidth: '32px' }}>{label}</span>
            <button onClick={() => onTimeAdjust(idx, field, -1)} style={adjBtnStyle}>-1s</button>
            <button onClick={() => onTimeAdjust(idx, field, -0.1)} style={adjBtnStyle}>-0.1</button>
            <span style={{
                fontSize: '11px', color: '#FFC66D', fontFamily: "'Courier New', monospace",
                fontWeight: 600, minWidth: '50px', textAlign: 'center',
            }}>
                {formatTime(field === 'start' ? subtitles[idx].startTime : subtitles[idx].endTime)}
            </span>
            <button onClick={() => onTimeAdjust(idx, field, 0.1)} style={adjBtnStyle}>+0.1</button>
            <button onClick={() => onTimeAdjust(idx, field, 1)} style={adjBtnStyle}>+1s</button>
        </div>
    );

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
                            onClick={() => {
                                if (confirm(`자막 ${subtitles.length}개를 전부 삭제하시겠습니까?`)) {
                                    onClearSubtitles();
                                }
                            }}
                            style={{
                                background: '#7f1d1d', color: '#fca5a5', border: 'none',
                                padding: '3px 10px', borderRadius: '4px', fontSize: '11px',
                                cursor: 'pointer', fontWeight: '600',
                            }}
                        >
                            전체 삭제
                        </button>
                    </div>
                    <div ref={listRef} style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {subtitles.map((sub, idx) => {
                            const isSelected = selectedSubtitleIdx === idx;
                            return (
                                <div
                                    key={idx}
                                    data-subtitle-idx={idx}
                                    onClick={() => onSelectSubtitle && onSelectSubtitle(idx)}
                                    style={{
                                        background: isSelected ? '#2D3A4A' : '#313335',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        borderLeft: isSelected ? '3px solid #FFC66D' : '3px solid #CC7832',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        boxShadow: isSelected ? '0 0 0 1px rgba(255,198,109,0.3)' : 'none',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        {/* 번호 */}
                                        <div style={{
                                            minWidth: '28px', height: '28px',
                                            borderRadius: '50%',
                                            background: isSelected ? '#FFC66D' : '#CC7832',
                                            color: isSelected ? '#2B2B2B' : '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '12px', fontWeight: 700,
                                            flexShrink: 0,
                                            transition: 'all 0.15s',
                                        }}>
                                            {idx + 1}
                                        </div>

                                        {/* 내용 */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            {/* 시간 — 선택 안 됐을 때: 단순 표시 */}
                                            {!isSelected && (
                                                <div style={{
                                                    fontSize: '11px', color: '#CC7832',
                                                    fontFamily: "'Courier New', monospace",
                                                    fontWeight: 600, marginBottom: '4px',
                                                }}>
                                                    {formatTime(sub.startTime)} → {formatTime(sub.endTime)}
                                                </div>
                                            )}

                                            {/* 시간 — 선택됐을 때: 미세조절 UI */}
                                            {isSelected && onTimeAdjust && (
                                                <div onClick={(e) => e.stopPropagation()} style={{
                                                    background: '#1E1E1E', borderRadius: '6px',
                                                    padding: '8px 10px', marginBottom: '8px',
                                                    display: 'flex', flexDirection: 'column', gap: '6px',
                                                }}>
                                                    <div style={{ fontSize: '10px', color: '#6A8759', fontWeight: 600, marginBottom: '2px' }}>
                                                        싱크 미세조절
                                                    </div>
                                                    <TimeAdjustButtons idx={idx} field="start" label="시작" />
                                                    <TimeAdjustButtons idx={idx} field="end" label="종료" />
                                                </div>
                                            )}

                                            {/* 텍스트 또는 편집 */}
                                            {editingIdx === idx ? (
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <textarea
                                                        className="form-input"
                                                        value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        style={{
                                                            minHeight: '50px', resize: 'vertical',
                                                            fontSize: '13px', marginBottom: '6px',
                                                        }}
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleEditSave(idx);
                                                            }
                                                            if (e.key === 'Escape') handleEditCancel();
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        <button
                                                            onClick={() => handleEditSave(idx)}
                                                            style={{
                                                                fontSize: '11px', padding: '4px 10px',
                                                                borderRadius: '4px', border: 'none',
                                                                background: '#6A8759', color: '#fff',
                                                                cursor: 'pointer', fontWeight: 600,
                                                            }}
                                                        >저장</button>
                                                        <button
                                                            onClick={handleEditCancel}
                                                            style={{
                                                                fontSize: '11px', padding: '4px 10px',
                                                                borderRadius: '4px', border: '1px solid #3C3F41',
                                                                background: 'transparent', color: '#A9B7C6',
                                                                cursor: 'pointer',
                                                            }}
                                                        >취소</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{
                                                    color: '#A9B7C6', fontSize: '13px',
                                                    lineHeight: '1.5', wordBreak: 'break-word',
                                                }}>
                                                    {sub.text}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 버튼 — 편집 모드 아닐 때만 */}
                                    {editingIdx !== idx && (
                                        <div onClick={(e) => e.stopPropagation()} style={{
                                            display: 'flex', gap: '6px',
                                            justifyContent: 'flex-end',
                                            marginTop: '8px',
                                        }}>
                                            <button
                                                onClick={() => handleEditStart(idx)}
                                                style={{
                                                    fontSize: '11px', padding: '4px 10px',
                                                    borderRadius: '4px', border: '1px solid #3C3F41',
                                                    background: 'transparent', color: '#A9B7C6',
                                                    cursor: 'pointer',
                                                }}
                                            >수정</button>
                                            <button
                                                onClick={() => handleDelete(idx)}
                                                style={{
                                                    fontSize: '11px', padding: '4px 10px',
                                                    borderRadius: '4px', border: 'none',
                                                    background: '#7f1d1d', color: '#fca5a5',
                                                    cursor: 'pointer', fontWeight: 600,
                                                }}
                                            >삭제</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// 미세조절 버튼 공통 스타일
const adjBtnStyle = {
    fontSize: '10px', padding: '2px 6px',
    borderRadius: '3px', border: '1px solid #515658',
    background: '#3C3F41', color: '#A9B7C6',
    cursor: 'pointer', fontFamily: "'Courier New', monospace",
    fontWeight: 600, lineHeight: 1.2,
};
