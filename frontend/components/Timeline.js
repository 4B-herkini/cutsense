const Timeline = ({ segments, duration, videoRef, onSeek, zoom }) => {
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

    return (
        <div className="timeline" ref={timelineRef} onClick={handleTimelineClick}>
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
                {/* 세그먼트 */}
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
                {/* 플레이헤드 */}
                <div
                    className="playhead"
                    style={{ left: `${playheadPos}px` }}
                />
            </div>
        </div>
    );
};
