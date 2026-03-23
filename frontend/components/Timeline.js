const Timeline = ({ segments, duration, videoRef, onSeek, zoom }) => {
    const timelineRef = useRef(null);
    const [playheadPos, setPlayheadPos] = useState(0);

    const pixelsPerSecond = 50 * zoom;
    const totalWidth = Math.max((duration || 0) * pixelsPerSecond, 400);

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

    return (
        <div className="timeline" ref={timelineRef} onClick={handleTimelineClick}>
            <div className="timeline-track" style={{ width: `${totalWidth}px` }}>
                {segments.map((seg, idx) => (
                    <div
                        key={idx}
                        className="timeline-segment"
                        style={{
                            left: `${seg.start * pixelsPerSecond}px`,
                            width: `${(seg.end - seg.start) * pixelsPerSecond}px`
                        }}
                        title={`${formatTime(seg.start)} - ${formatTime(seg.end)}`}
                    />
                ))}
                <div
                    className="playhead"
                    style={{ left: `${playheadPos}px` }}
                />
            </div>
        </div>
    );
};
