import React, { useState, useEffect } from 'react';
import { Bug, Trash2, Copy, Check, RefreshCw, Smartphone } from 'lucide-react';

const DiagnosticsPage: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [errorLogs, setErrorLogs] = useState<any[]>([]);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = () => {
        try {
            const mobileLogs = localStorage.getItem('mobile_debug_logs');
            const errors = localStorage.getItem('error_logs');

            setLogs(mobileLogs ? JSON.parse(mobileLogs) : []);
            setErrorLogs(errors ? JSON.parse(errors) : []);
        } catch (e) {
            console.error('Failed to load logs', e);
        }
    };

    const clearLogs = () => {
        if (confirm('Êtes-vous sûr de vouloir effacer tous les logs ?')) {
            localStorage.removeItem('mobile_debug_logs');
            localStorage.removeItem('error_logs');
            setLogs([]);
            setErrorLogs([]);
        }
    };

    const copyAllLogs = () => {
        const allLogs = {
            deviceInfo: {
                userAgent: navigator.userAgent,
                screenSize: `${window.innerWidth}x${window.innerHeight}`,
                online: navigator.onLine,
                timestamp: new Date().toISOString()
            },
            mobileLogs: logs,
            errorLogs: errorLogs
        };

        const text = JSON.stringify(allLogs, null, 2);

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-3 rounded-full">
                                <Bug className="text-blue-600" size={24} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Diagnostics Mobile</h1>
                                <p className="text-xs text-gray-500">FactureMan Debug Tools</p>
                            </div>
                        </div>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200"
                        >
                            Retour
                        </button>
                    </div>

                    {/* Device Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Écran</div>
                            <div className="font-bold text-gray-900">{window.innerWidth}×{window.innerHeight}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Connexion</div>
                            <div className="font-bold text-gray-900">{navigator.onLine ? '🟢 En ligne' : '🔴 Hors ligne'}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Logs</div>
                            <div className="font-bold text-gray-900">{logs.length + errorLogs.length} entrées</div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mb-4">
                    <button
                        onClick={copyAllLogs}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2"
                    >
                        {copied ? <Check size={20} /> : <Copy size={20} />}
                        {copied ? 'Copié !' : 'Copier tous les logs'}
                    </button>
                    <button
                        onClick={loadLogs}
                        className="px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg flex items-center justify-center"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={clearLogs}
                        className="px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg flex items-center justify-center"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>

                {/* Error Logs */}
                {errorLogs.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
                        <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                            <Bug size={20} />
                            Erreurs React ({errorLogs.length})
                        </h2>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {errorLogs.map((log, idx) => (
                                <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                                    <div className="text-xs text-gray-500 mb-1">{new Date(log.timestamp).toLocaleString()}</div>
                                    <div className="font-bold text-red-900 mb-2">{log.message}</div>
                                    {log.stack && (
                                        <pre className="text-xs bg-white p-2 rounded mt-2 overflow-x-auto">
                                            {log.stack.substring(0, 300)}...
                                        </pre>
                                    )}
                                    <div className="text-xs text-gray-600 mt-2">
                                        Screen: {log.screenSize} | Online: {log.online ? 'Yes' : 'No'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Console Logs */}
                {logs.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">
                            Logs Console ({logs.length})
                        </h2>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {logs.slice(-50).reverse().map((log, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded border-l-4 ${log.level === 'ERROR'
                                            ? 'bg-red-50 border-red-500'
                                            : log.level === 'WARN'
                                                ? 'bg-yellow-50 border-yellow-500'
                                                : 'bg-gray-50 border-blue-500'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-gray-500">
                                                {new Date(log.timestamp).toLocaleTimeString()}
                                            </div>
                                            <div className="font-mono text-xs mt-1 break-words">{log.message}</div>
                                        </div>
                                        <span
                                            className={`text-[10px] font-bold px-2 py-1 rounded ${log.level === 'ERROR'
                                                    ? 'bg-red-200 text-red-800'
                                                    : log.level === 'WARN'
                                                        ? 'bg-yellow-200 text-yellow-800'
                                                        : 'bg-blue-200 text-blue-800'
                                                }`}
                                        >
                                            {log.level}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {logs.length === 0 && errorLogs.length === 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <Smartphone className="mx-auto mb-4 text-gray-400" size={48} />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Aucun log disponible</h3>
                        <p className="text-gray-600 text-sm">
                            Naviguez dans l'application pour générer des logs de débogage.
                        </p>
                    </div>
                )}

                {/* User Agent */}
                <div className="bg-white rounded-xl shadow-lg p-6 mt-4">
                    <h2 className="text-sm font-bold text-gray-700 mb-2">User Agent</h2>
                    <p className="text-xs font-mono bg-gray-50 p-3 rounded break-all">{navigator.userAgent}</p>
                </div>
            </div>
        </div>
    );
};

export default DiagnosticsPage;
