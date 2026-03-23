const SettingsModal = ({ isOpen, onClose, settings, onSettingsChange, onSaveSettings }) => {
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    const modelOptions = {
        claude: [
            { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
            { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
            { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
        ],
        grok: [
            { value: 'grok-2-vision-1212', label: 'Grok 2 Vision' },
            { value: 'grok-2-1212', label: 'Grok 2' },
        ]
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const model = settings.model || modelOptions[settings.aiProvider][0].value;
            const response = await fetch(`${settings.serverUrl}/api/ai/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: settings.aiProvider,
                    api_key: settings.apiKey,
                    model: model,
                }),
            });
            const data = await response.json();
            if (data.success) {
                setStatus({ type: 'success', message: 'AI 설정 저장 완료!' });
                onSettingsChange({ ...settings, model });
                setTimeout(() => onClose(), 1000);
            } else {
                setStatus({ type: 'error', message: data.detail || '저장 실패' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: '서버 연결 실패: ' + err.message });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const currentModels = modelOptions[settings.aiProvider] || [];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">AI 설정</div>

                <div className="form-group">
                    <label className="form-label">AI 제공자</label>
                    <select
                        className="form-select"
                        value={settings.aiProvider}
                        onChange={(e) => {
                            const provider = e.target.value;
                            const defaultModel = modelOptions[provider][0].value;
                            onSettingsChange({ ...settings, aiProvider: provider, model: defaultModel });
                        }}
                    >
                        <option value="claude">Claude (Anthropic)</option>
                        <option value="grok">Grok (xAI)</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">모델</label>
                    <select
                        className="form-select"
                        value={settings.model || currentModels[0]?.value}
                        onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
                    >
                        {currentModels.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">API 키</label>
                    <input
                        type="password"
                        className="form-input"
                        placeholder="API 키를 입력하세요"
                        value={settings.apiKey}
                        onChange={(e) => onSettingsChange({ ...settings, apiKey: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">서버 URL</label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="http://localhost:9000"
                        value={settings.serverUrl}
                        onChange={(e) => onSettingsChange({ ...settings, serverUrl: e.target.value })}
                    />
                </div>

                {status && (
                    <div style={{
                        padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
                        background: status.type === 'success' ? '#065f46' : '#7f1d1d',
                        color: status.type === 'success' ? '#6ee7b7' : '#fca5a5',
                    }}>
                        {status.message}
                    </div>
                )}

                <div className="modal-buttons">
                    <button className="button-secondary" onClick={onClose}>
                        취소
                    </button>
                    <button
                        className="button-primary"
                        onClick={handleSave}
                        disabled={saving || !settings.apiKey}
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};