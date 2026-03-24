const Timeline = ({ segments, subtitles, activeTab, duration, videoRef, onSeek, zoom, selectedSubtitleIdx, onSelectSubtitle }) => {
    const timelineRef = useRef(null);
    const [playheadPos, setPlayheadPos] = useState(0);
    const [containerWidth, setContainerWidth] = useState(400);

    // 컨테이너 폭 감지
    useEffect(() => {
        const updateWidth = () => {
            if (timelineRef.current) {
                setContainerWidth(timelineRef.current.clientWidth);
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // 타임라인을 컨테이너에 딱 맞춤 (zoom으로 확대 가능)
    const pixelsPerSecond = duration > 0 ? (containerWidth / duration) * zoom : 1;
    const totalWidth = Math.max(containerWidth, (duration || 0) * pixelsPerSecond);

    useEffect(() => {
        const updatePlayhead = () => {
            if (videoRef.current) {
                setPlayheadPos(videoRef.current.currentTime * pixelsPerSecond);
            }
        };

        const video = videoRef.current;
        if (video) {
            video.addEventListener('timeupdate', updatePlayhead);
            return () => video.removeEventListener('timeupdate', updatePlayhead);
        }
    }, [pixelsPerSecond, videoRef]);

    const handleTimelineClick = (e) => {
        if (!timelineRef.current || !duration) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = timelineRef.current.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft;
        const time = x / pixelsPerSecond;
        onSeek(Math.max(0, Math.min(time, duration)));
    };

    // 시간 눈금 생성
    const timeMarks = [];
    if (duration > 0) {
        const interval = duration <= 60 ? 10 : duration <= 300 ? 30 : 60;
        for (let t = 0; t <= duration; t += interval) {
            timeMarks.push(t);
        }
    }

    // 자막 탭일 때만 자막 번호 렌더링
    const showSubtitleMarkers = activeTab === 'subtitle' && subtitles && subtitles.length > 0;

    return (
        <div className="timeline" ref={timelineRef} onClick={handleTimelineClick}
            style={{ minHeight: showSubtitleMarkers ? '60px' : undefined }}
        >
            <div className="timeline-track" style={{ width: `${totalWidth}px` }}>
                {/* 시간 눈금 */}
                {timeMarks.map(t => (
                    <div key={`mark-${t}`} style={{
                        position: 'absolute',
                        left: `${t * pixelsPerSecond}px`,
                        top: 0,
                        bottom: 0,
                        borderLeft: '1px solid rgba(81,86,88,0.5)',
                        pointerEvents: 'none'
                    }}>
                        <span style={{
                            position: 'absolute',
                            top: '2px',
                            left: '4px',
                            fontSize: '9px',
                            color: '#808080',
                            userSelect: 'none'
                        }}>
                            {formatTime(t)}
                        </span>
                    </div>
                ))}
                {/* 세그먼트 (컷 구간) */}
                {segments.map((seg, idx) => (
                    <div
                        key={idx}
                        className="timeline-segment"
                        style={{
                            left: `${(seg.startTime || seg.start || 0) * pixelsPerSecond}px`,
                            width: `${((seg.endTime || seg.end || 0) - (seg.startTime || seg.start || 0)) * pixelsPerSecond}px`
                        }}
                        title={`${formatTime(seg.startTime || seg.start)} - ${formatTime(seg.endTime || seg.end)}`}
                    />
                ))}

                {/* 자막 번호 마커 — 자막 탭일 때만, 클릭 가능 */}
                {showSubtitleMarkers && subtitles.map((sub, idx) => {
                    const startTime = sub.startTime || sub.start || 0;
                    const endTime = sub.endTime || sub.end || 0;
                    const midTime = (startTime + endTime) / 2;
                    const leftPx = midTime * pixelsPerSecond;
                    const isTop = idx % 2 === 0;
                    const isSelected = selectedSubtitleIdx === idx;

                    return (
                        <div key={`sub-marker-${idx}`} style={{
                            position: 'absolute',
                            left: `${leftPx}px`,
                            top: 0,
                            bottom: 0,
                            zIndex: isSelected ? 8 : 5,
                        }}>
                            {/* 실선 — 중앙까지 연결 */}
                            <div style={{
                                position: 'absolute',
                                left: '-0.5px',
                                width: isSelected ? '2px' : '1px',
                                background: isSelected ? '#FFC66D' : '#CC7832',
                                opacity: isSelected ? 1 : 0.6,
                                top: isTop ? '0px' : '50%',
                                bottom: isTop ? '50%' : '0px',
                                transition: 'all 0.15s',
                            }} />
                            {/* 자막 범위 바 (선택 시) */}
                            {isSelected && (
                                <div style={{
                                    position: 'absolute',
                                    left: `${(startTime - midTime) * pixelsPerSecond}px`,
                                    width: `${(endTime - startTime) * pixelsPerSecond}px`,
                                    top: '50%',
                                    height: '4px',
                                    marginTop: '-2px',
                                    background: 'rgba(255, 198, 109, 0.4)',
                                    borderRadius: '2px',
                                    pointerEvents: 'none',
                                }} />
                            )}
                            {/* 번호 동그라미 — 클릭 가능 */}
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectSubtitle) onSelectSubtitle(idx);
                                }}
                                style={{
                                    position: 'absolute',
                                    left: '-12px',
                                    [isTop ? 'top' : 'bottom']: '-2px',
                                    width: isSelected ? '24px' : '20px',
                                    height: isSelected ? '24px' : '20px',
                                    borderRadius: '50%',
                                    background: isSelected ? '#FFC66D' : '#CC7832',
                                    color: isSelected ? '#2B2B2B' : '#fff',
                                    fontSize: isSelected ? '11px' : '9px',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: 1,
                                    boxShadow: isSelected
                                        ? '0 0 8px rgba(255, 198, 109, 0.6)'
                                        : '0 1px 3px rgba(0,0,0,0.4)',
                                    cursor: 'pointer',
                                    pointerEvents: 'auto',
                                    transition: 'all 0.15s',
                                    border: isSelected ? '2px solid #fff' : 'none',
                                }}
                                title={`#${idx + 1}: ${formatTime(startTime)} → ${formatTime(endTime)}`}
                            >
                                {idx + 1}
                            </div>
                        </div>
                    );
                })}

                {/* 플레이헤드 */}
                <div
                    className="playhead"
                    style={{ left: `${playheadPos}px` }}
                />
            </div>
        </div>
    );
};
