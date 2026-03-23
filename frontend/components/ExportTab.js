const ExportTab = ({ onExport, isExporting, exportProgress, hasVideo, subtitleCount, exportResult }) => {
    const [format, setFormat] = useState('horizontal');
    const [quality, setQuality] = useState('1080p');

    return (
        <div className="tab-content">
            {/* 다운로드 링크 (내보내기 완료 시) */}
            {exportResult && (
                <div style={{
                    background: 'linear-gradient(135deg, #064e3b, #065f46)',
                    borderRadius: '10px', padding: '16px',
                    border: '1px solid #10b981', marginBottom: '8px',
                }}>
                    <div style={{ fontSize: '14px', color: '#6ee7b7', fontWeight: '700', marginBottom: '8px' }}>
                        내보내기 완료!
                    </div>
                    <div style={{ fontSize: '12px', color: '#a7f3d0', marginBottom: '12px' }}>
                        {exportResult.filename}
                    </div>
                    <a
                        href={exportResult.downloadUrl}
                        download={exportResult.filename}
                        style={{
                            display: 'block', textAlign: 'center',
                            background: '#10b981', color: '#fff',
                            padding: '10px', borderRadius: '8px',
                            textDecoration: 'none', fontWeight: '700',
                            fontSize: '14px',
                        }}
                    >
                        📥 다운로드
                    </a>
                </div>
            )}

            {/* 내보내기 요약 */}
            <div style={{
                background: '#1a1a2e', borderRadius: '8px', padding: '12px',
                border: '1px solid #2a2a3a', marginBottom: '4px',
            }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>내보내기 정보</div>
                <div style={{ fontSize: '13px', color: '#e5e5e5', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>📹 영상: {hasVideo ? '준비됨' : '없음'}</div>
                    <div>💬 자막: {subtitleCount > 0 ? `${subtitleCount}개 (자동 입힘)` : '없음'}</div>
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">형식</label>
                <select
                    className="form-select"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    disabled={isExporting}
                >
                    <option value="horizontal">가로 (16:9)</option>
                    <option value="vertical">세로 (9:16)</option>
                    <option value="both">둘 다</option>
                </select>
            </div>

            <div className="form-group">
                <label className="form-label">품질</label>
                <select
                    className="form-select"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    disabled={isExporting}
                >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="4k">4K</option>
                </select>
            </div>

            {isExporting && (
                <div className="form-group">
                    <label className="form-label">내보내기 진행률</label>
                    <div style={{
                        height: '6px', background: '#2a2a3a', borderRadius: '3px', overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%', borderRadius: '3px',
                            background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                            width: `${exportProgress}%`,
                            transition: 'width 0.5s ease',
                        }}></div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#a78bfa', marginTop: '6px', textAlign: 'center' }}>
                        {exportProgress < 30 ? '자막 입히는 중...'
                            : exportProgress < 80 ? '영상 인코딩 중...'
                            : exportProgress < 100 ? '마무리 중...'
                            : '완료!'
                        } ({exportProgress}%)
                    </div>
                </div>
            )}

            <button
                className="button-primary"
                onClick={() => onExport({ format, quality })}
                disabled={isExporting || !hasVideo}
                style={{ width: '100%' }}
            >
                {isExporting ? '내보내는 중...' : !hasVideo ? '영상을 먼저 업로드하세요' : subtitleCount > 0 ? `자막 포함 내보내기 (${subtitleCount}개)` : '내보내기'}
            </button>
        </div>
    );
};