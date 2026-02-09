import React from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    copied: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            copied: false
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error details
        console.error('🚨 Error Boundary Caught:', error, errorInfo);

        // Store in localStorage for debugging on mobile
        const errorLog = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            userAgent: navigator.userAgent,
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
            online: navigator.onLine
        };

        try {
            const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
            existingLogs.push(errorLog);
            // Keep only last 5 errors
            if (existingLogs.length > 5) existingLogs.shift();
            localStorage.setItem('error_logs', JSON.stringify(existingLogs));
        } catch (e) {
            console.error('Failed to save error log', e);
        }

        this.setState({
            error,
            errorInfo
        });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleCopyError = () => {
        const errorText = `
Error: ${this.state.error?.message}
Stack: ${this.state.error?.stack}
Component Stack: ${this.state.errorInfo?.componentStack}
User Agent: ${navigator.userAgent}
Screen: ${window.innerWidth}x${window.innerHeight}
Online: ${navigator.onLine}
    `.trim();

        navigator.clipboard.writeText(errorText).then(() => {
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                        <div className="flex items-center justify-center mb-6">
                            <div className="bg-red-100 p-4 rounded-full">
                                <AlertTriangle className="text-red-600" size={40} />
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
                            Une erreur est survenue
                        </h1>

                        <p className="text-gray-600 text-center mb-6">
                            L'application a rencontré un problème. Veuillez réessayer.
                        </p>

                        {/* Error Details (Collapsible for debugging) */}
                        <details className="mb-6 bg-gray-50 rounded-lg p-4">
                            <summary className="cursor-pointer font-semibold text-sm text-gray-700 mb-2">
                                Détails de l'erreur
                            </summary>
                            <div className="text-xs text-gray-600 space-y-2 mt-2">
                                <div>
                                    <strong>Message:</strong>
                                    <p className="font-mono bg-white p-2 rounded mt-1 break-words">
                                        {this.state.error?.message}
                                    </p>
                                </div>
                                <div>
                                    <strong>Stack:</strong>
                                    <pre className="font-mono bg-white p-2 rounded mt-1 text-[10px] overflow-x-auto">
                                        {this.state.error?.stack?.substring(0, 500)}
                                    </pre>
                                </div>
                                <div>
                                    <strong>Appareil:</strong>
                                    <p className="font-mono bg-white p-2 rounded mt-1 text-[10px] break-all">
                                        {navigator.userAgent}
                                    </p>
                                </div>
                            </div>
                        </details>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={this.handleReload}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={20} />
                                Recharger l'application
                            </button>

                            <button
                                onClick={this.handleCopyError}
                                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 flex items-center justify-center gap-2"
                            >
                                {this.state.copied ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
                                {this.state.copied ? 'Copié !' : 'Copier les détails'}
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 text-center mt-6">
                            Si le problème persiste, contactez le support avec les détails de l'erreur.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
