const MenuBar = ({ onNewProject, onOpenVideo, onSaveProject, onExport, onSettings, onToggleCrosshair, showCrosshair, onAbout }) => {
    const [openMenu, setOpenMenu] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMenuClick = (menuName) => {
        setOpenMenu(openMenu === menuName ? null : menuName);
    };

    const handleAction = (action) => {
        setOpenMenu(null);
        if (action) action();
    };

    const menus = {
        '파일': [
            { label: '새 프로젝트', action: onNewProject, shortcut: 'Ctrl+N' },
            { label: '영상 열기', action: onOpenVideo, shortcut: 'Ctrl+O' },
            { type: 'separator' },
            { label: '프로젝트 저장', action: onSaveProject, shortcut: 'Ctrl+S' },
            { label: '내보내기', action: onExport, shortcut: 'Ctrl+Shift+E' },
        ],
        '편집': [
            { label: '실행 취소', action: null, shortcut: 'Ctrl+Z', disabled: true },
            { label: '다시 실행', action: null, shortcut: 'Ctrl+Y', disabled: true },
            { type: 'separator' },
            { label: '자막 전체 삭제', action: null, shortcut: '' },
            { label: '구간 전체 삭제', action: null, shortcut: '' },
        ],
        '보기': [
            { label: showCrosshair ? '✓ 십자선 가이드' : '   십자선 가이드', action: onToggleCrosshair },
            { type: 'separator' },
            { label: '타임라인 확대', action: null, shortcut: 'Ctrl+=' },
            { label: '타임라인 축소', action: null, shortcut: 'Ctrl+-' },
        ],
        'AI': [
            { label: 'AI 설정', action: onSettings, shortcut: '' },
            { type: 'separator' },
            { label: '스마트 자막 생성', action: null, shortcut: '' },
            { label: '영상 분석', action: null, shortcut: '' },
        ],
        '도움말': [
            { label: 'CutSense 정보', action: onAbout },
            { type: 'separator' },
            { label: 'GitHub', action: () => window.open('https://github.com/4B-herkini/cutsense', '_blank') },
        ],
    };

    return (
        <div ref={menuRef} style={{
            display: 'flex',
            alignItems: 'center',
            height: '30px',
            background: '#3C3F41',
            borderBottom: '1px solid #515658',
            fontSize: '13px',
            userSelect: 'none',
            position: 'relative',
            zIndex: 100,
            paddingLeft: '8px',
        }}>
            {/* App icon */}
            <div style={{
                width: '20px', height: '20px',
                marginRight: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <img src="/icons/icon-192x192.png" alt="" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
            </div>

            {Object.entries(menus).map(([menuName, items]) => (
                <div key={menuName} style={{ position: 'relative' }}>
                    <div
                        onClick={() => handleMenuClick(menuName)}
                        onMouseEnter={() => openMenu && setOpenMenu(menuName)}
                        style={{
                            padding: '4px 10px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            color: openMenu === menuName ? '#DCDCDC' : '#A9B7C6',
                            background: openMenu === menuName ? '#4C5052' : 'transparent',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => {
                            if (!openMenu) e.currentTarget.style.background = '#45494A';
                        }}
                        onMouseOut={(e) => {
                            if (openMenu !== menuName) e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {menuName}
                    </div>

                    {openMenu === menuName && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            minWidth: '220px',
                            background: '#3C3F41',
                            border: '1px solid #515658',
                            borderRadius: '6px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                            padding: '4px 0',
                            zIndex: 200,
                        }}>
                            {items.map((item, idx) => {
                                if (item.type === 'separator') {
                                    return <div key={idx} style={{
                                        height: '1px',
                                        background: '#515658',
                                        margin: '4px 8px',
                                    }} />;
                                }
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => !item.disabled && handleAction(item.action)}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '6px 16px',
                                            cursor: item.disabled ? 'default' : 'pointer',
                                            color: item.disabled ? '#606060' : '#A9B7C6',
                                            fontSize: '12.5px',
                                            transition: 'background 0.1s ease',
                                        }}
                                        onMouseOver={(e) => {
                                            if (!item.disabled) e.currentTarget.style.background = '#3a3a5e';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <span>{item.label}</span>
                                        {item.shortcut && (
                                            <span style={{ color: '#808080', fontSize: '11px', marginLeft: '24px' }}>
                                                {item.shortcut}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
