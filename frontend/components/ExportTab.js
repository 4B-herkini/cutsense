const ExportTab = ({ onExport, onEject, isExporting, exportProgress, hasVideo, subtitleCount, exportResult, videoCount, projectName, segmentCount }) => {
    const [format, setFormat] = useState('horizontal');
    const [quality, setQuality] = useState('1080p');
    const [ejectQuality, setEjectQuality] = useState('medium');
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
                        Export Complete!
                    </div>
                    <div style={{ fontSize: '12px', color: '#A9B7C6', marginBottom: '6px', wordBreak: 'break-all' }}>
                        {exportResult.filename}
                    </div>
                    <div style={{ fontSize: '10px', color: '#808080', marginBottom: '14px' }}>
                        Downloads folder (browser default)
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
                        Download File
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
                        Open in new tab
                    </a>
                </div>
            )}

            {/* 이젝트 (프로젝트 완성) — 멀티 영상일 때만 표시 */}
            {videoCount > 1 && (
                <div style={{
                    background: '#3C3F41', borderRadius: '6px', padding: '16px',
                    border: '1px solid #CC7832', marginBottom: '8px',
                }}>
                    <div style={{ fontSize: '13px', color: '#CC7832', fontWeight: '700', marginBottom: '8px' }}>
                        Eject — Combine All Videos
                    </div>
                    <div style={{ fontSize: '11px', color: '#808080', marginBottom: '12px' }}>
                        {videoCount} videos → 1 video ({projectName || 'project'})
                    </div>

                    <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Quality</label>
                        <select
                            className="form-select"
                            value={ejectQuality}
                            onChange={(e) => setEjectQuality(e.target.value)}
                            disabled={isExporting}
                            style={{ fontSize: '12px' }}
                        >
                            <option value="low">Low (fast)</option>
                            <option value="medium">Medium</option>
                            <option value="high">High (slow)</option>
                        </select>
                    </div>

                    <button
                        className="button-primary"
                        onClick={() => onEject && onEject({ quality: ejectQuality })}
                        disabled={isExporting}
                        style={{
                            width: '100%', background: '#CC7832', color: '#fff',
                            border: '1px solid #E8A84C', fontWeight: 700
                        }}
                    >
                        {isExporting ? 'Ejecting...' : `Eject ${videoCount} Videos → 1`}
                    </button>
                </div>
            )}

            {/* 파일명 */}
            <div className="form-group">
                <label className="form-label">File Name</label>
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

            {/* 내보내기 정보 */}
            <div style={{
                background: '#2B2B2B', borderRadius: '6px', padding: '12px',
                border: '1px solid #515658', marginBottom: '4px',
            }}>
                <div style={{ fontSize: '12px', color: '#808080', marginBottom: '6px' }}>Export Info</div>
                <div style={{ fontSize: '12px', color: '#A9B7C6', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>Video: {hasVideo ? 'Ready' : 'None'} {videoCount > 1 ? `(${videoCount} files)` : ''}</div>
                    <div>Cuts: {segmentCount > 0 ? `${segmentCount} segments (auto apply)` : 'None (full video)'}</div>
                    <div>Subtitles: {subtitleCount > 0 ? `${subtitleCount} items (auto burn)` : 'None'}</div>
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Format</label>
                <select
                    className="form-select"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    disabled={isExporting}
                >
                    <option value="horizontal">Horizontal (16:9)</option>
                    <option value="vertical">Vertical (9:16)</option>
                    <option value="both">Both</option>
                </select>
            </div>

            <div className="form-group">
                <label className="form-label">Quality</label>
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
                    <label className="form-label">Progress</label>
                    <div className="progress-bar">
                        <div style={{
                            height: '100%', borderRadius: '3px',
                            background: '#CC7832',
                            width: `${exportProgress}%`,
                            transition: 'width 0.5s ease',
                        }}></div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#CC7832', marginTop: '6px', textAlign: 'center' }}>
                        {exportProgress < 15 ? 'Preparing...'
                            : exportProgress < 35 ? 'Cutting segments...'
                            : exportProgress < 60 ? 'Burning subtitles...'
                            : exportProgress < 95 ? 'Encoding final...'
                            : 'Complete!'
                        } ({exportProgress}%)
                    </div>
                </div>
            )}

            <button
                className="button-primary"
                onClick={() => onExport({ format, quality, outputName: outputName.trim() || 'export' })}
                disabled={isExporting || !hasVideo}
                style={{ width: '100%' }}
            >
                {isExporting ? 'Exporting...'
                    : !hasVideo ? 'Upload a video first'
                    : `Export${segmentCount > 0 ? ` (${segmentCount} cuts)` : ''}${subtitleCount > 0 ? ` + ${subtitleCount} subs` : ''}`
                }
            </button>
        </div>
    );
};
