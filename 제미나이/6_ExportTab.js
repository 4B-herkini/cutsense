const ExportTab = ({ onExport, isExporting, exportProgress, hasVideo, subtitleCount, exportResult, videoCount, projectName, segmentCount }) => {
    const [format, setFormat] = useState('horizontal');
    const [quality, setQuality] = useState('medium');
    const [resolution, setResolution] = useState('1080p');
    const [outputName, setOutputName] = useState(projectName || '');

    return (
        <div className="tab-content">
            {/* 다운로드 링크 (내보내기 완료 시) */}
            {exportResult && (
                <div style={{
                    background: '#1E2E1E', borderRadius: '8px', padding: '20px',
                    border: '2px solid #6A9955', marginBottom: '12px',
                    boxShadow: '0 4px 12px rgba(106,153,85,0.2)',
                }}>
                    <div style={{ fontSize: '15px', color: '#6A9955', fontWeight: '800', marginBottom: '10px' }}>
                        내보내기 완료!
                    </div>
                    <div style={{ fontSize: '12px', color: '#A9B7C6', marginBottom: '6px', wordBreak: 'break-all' }}>
                        {exportResult.filename}
                    </div>
                    <a
                        href={exportResult.downloadUrl}
                        download={exportResult.filename}
                        style={{
                            display: 'block', textAlign: 'center',
                            background: '#6A9955', color: '#fff',
                            padding: '12px', borderRadius: '6px',
                            textDecoration: 'none', fontWeight: '700',
                            fontSize: '14px', border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        다운로드
                    </a>
                    <a
                        href={exportResult.downloadUrl}
                        target="_blank"
                        style={{
                            display: 'block', textAlign: 'center',
                            color: '#6A9955', marginTop: '8px',
                            textDecoration: 'underline', fontSize: '11px',
                            cursor: 'pointer',
                        }}
                    >
                        새 탭에서 열기
                    </a>
                </div>
            )}

            {/* 내보내기 정보 */}
            <div style={{
                background: '#2B2B2B', borderRadius: '8px', padding: '14px',
                border: '1px solid #515658', marginBottom: '10px',
            }}>
                <div style={{ fontSize: '13px', color: '#FFC66D', fontWeight: 700, marginBottom: '8px' }}>내보내기 정보</div>
                <div style={{ fontSize: '12px', color: '#A9B7C6', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#808080' }}>영상</span>
                        <span>{hasVideo ? (videoCount > 1 ? `${videoCount}개 → 1개로 병합` : '1개') : '없음'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#808080' }}>컷 편집</span>
                        <span>{segmentCount > 0 ? `${segmentCount}개 구간 (자동 적용)` : '없음'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#808080' }}>자막</span>
                        <span>{subtitleCount > 0 ? `${subtitleCount}개 (자동 입힘)` : '없음'}</span>
                    </div>
                </div>
                {videoCount > 1 && (
                    <div style={{
                        marginTop: '10px', padding: '8px 10px', borderRadius: '6px',
                        background: '#1E2A1E', border: '1px solid #6A8759',
                        fontSize: '11px', color: '#6A8759', lineHeight: 1.5,
                    }}>
                        각 영상별 컷 편집 + 자막이 개별 적용된 후 순서대로 하나의 영상으로 합쳐집니다.
                        영상 순서는 하단 비디오 목록에서 드래그로 변경할 수 있습니다.
                    </div>
                )}
            </div>

            {/* 파일명 */}
            <div className="form-group">
                <label className="form-label">파일 이름</label>
                <input
                    type="text"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="export filename..."
                    disabled={isExporting}
                    style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#2B2B2B', border: '1px solid #515658', borderRadius: '4px',
                        padding: '8px 12px', color: '#A9B7C6', fontSize: '13px', outline: 'none',
                    }}
                />
                <div style={{ fontSize: '10px', color: '#606060', marginTop: '4px' }}>
                    {outputName || 'export'}.mp4
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">화면 비율</label>
                <select
                    className="form-select"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    disabled={isExporting}
                >
                    <option value="horizontal">가로 (16:9)</option>
                    <option value="vertical">세로 (9:16)</option>
                    <option value="both">가로 + 세로 (둘 다)</option>
                </select>
            </div>

            <div className="form-group">
                <label className="form-label">해상도</label>
                <select
                    className="form-select"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    disabled={isExporting}
                >
                    <option value="original">원본 유지</option>
                    <option value="720p">720p (HD)</option>
                    <option value="1080p">1080p (FHD) — 유튜브 권장</option>
                    <option value="1440p">1440p (QHD)</option>
                    <option value="4k">4K (UHD)</option>
                </select>
                <div style={{ fontSize: '10px', color: '#606060', marginTop: '4px' }}>
                    원본보다 높으면 업스케일됩니다
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">화질 (인코딩)</label>
                <select
                    className="form-select"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    disabled={isExporting}
                >
                    <option value="low">낮음 (빠름, 파일 작음)</option>
                    <option value="medium">보통 (권장)</option>
                    <option value="high">높음 (느림, 파일 큼)</option>
                </select>
            </div>

            {isExporting && (
                <div className="form-group">
                    <label className="form-label">진행</label>
                    <div className="progress-bar">
                        <div style={{
                            height: '100%', borderRadius: '3px',
                            background: '#CC7832',
                            width: `${exportProgress}%`,
                            transition: 'width 0.5s ease',
                        }}></div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#CC7832', marginTop: '6px', textAlign: 'center' }}>
                        {exportProgress < 15 ? '준비 중...'
                            : exportProgress < 35 ? '컷 편집 적용 중...'
                            : exportProgress < 60 ? '자막 입히는 중...'
                            : exportProgress < 95 ? '인코딩 중...'
                            : '완료!'
                        } ({exportProgress}%)
                    </div>
                </div>
            )}

            <button
                className="button-primary"
                onClick={() => onExport({ format, quality, resolution, outputName: outputName.trim() || 'export' })}
                disabled={isExporting || !hasVideo}
                style={{
                    width: '100%',
                    background: videoCount > 1 ? '#CC7832' : undefined,
                    border: videoCount > 1 ? '1px solid #E8A84C' : undefined,
                    fontSize: '14px', fontWeight: 700, padding: '12px',
                }}
            >
                {isExporting ? '내보내는 중...'
                    : !hasVideo ? '영상을 먼저 업로드하세요'
                    : videoCount > 1
                        ? `${videoCount}개 영상 병합 내보내기`
                        : `내보내기${segmentCount > 0 ? ` (${segmentCount} cuts)` : ''}${subtitleCount > 0 ? ` + ${subtitleCount} subs` : ''}`
                }
            </button>
        </div>
    );
};
