import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Code, CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

const TeamleaderTester: React.FC = () => {
    const [settings, setSettings] = useState<any>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);
    
    // Request State
    const [endpoint, setEndpoint] = useState('users.me');
    const [method, setMethod] = useState<'GET' | 'POST'>('GET');
    const [body, setBody] = useState('{}');
    const [executing, setExecuting] = useState(false);
    
    // Response State
    const [response, setResponse] = useState<any>(null);
    const [status, setStatus] = useState<number | null>(null);

    // Refresh State
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        const data = await api.getIntegrationSettings('teamleader');
        setSettings(data);
        setLoadingSettings(false);
    };

    const handleExecute = async () => {
        if (!settings?.access_token) {
            alert("No access token found. Please connect in Settings first.");
            return;
        }

        setExecuting(true);
        setResponse(null);
        setStatus(null);

        try {
            let parsedBody = null;
            if (method === 'POST') {
                try {
                    parsedBody = JSON.parse(body);
                } catch (e) {
                    alert("Invalid JSON in Body");
                    setExecuting(false);
                    return;
                }
            }

            // Using the api call wrapper which has auto-refresh logic
            // Note: teamleaderRequest fetches the token from DB internally
            const data = await api.teamleaderRequest(endpoint, method, parsedBody);
            setResponse(data);
            setStatus(200); // Success
            
            // Reload settings in case they were refreshed
            load();
        } catch (e: any) {
            setResponse({ error: e.message || "Failed to fetch" });
            setStatus(0);
        } finally {
            setExecuting(false);
        }
    };

    const handleManualRefresh = async () => {
        setRefreshing(true);
        try {
            const newSettings = await api.refreshAccessToken(settings);
            if (newSettings) {
                setSettings(newSettings);
                alert("Token refreshed manually!");
            } else {
                alert("Failed to refresh token.");
            }
        } catch (e: any) {
            alert("Error refreshing: " + e.message);
        } finally {
            setRefreshing(false);
        }
    };

    if (loadingSettings) return <div className="p-8 text-center">Loading settings...</div>;

    if (!settings || !settings.access_token) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-amber-900">Not Connected</h3>
                <p className="text-amber-800 mt-2">Please go to Settings and connect Teamleader first.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Teamleader API Tester</h2>
                    <p className="text-slate-500 mt-1">Manually test endpoints using your saved connection.</p>
                </div>
                <button 
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium text-sm flex items-center shadow-sm"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Force Token Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Request Panel */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4 h-fit">
                    <h3 className="font-bold text-slate-900 flex items-center">
                        <Code className="w-4 h-4 mr-2" /> Request
                    </h3>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint</label>
                        <div className="flex rounded-md shadow-sm">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
                                https://api.focus.teamleader.eu/
                            </span>
                            <input 
                                type="text" 
                                value={endpoint}
                                onChange={e => setEndpoint(e.target.value)}
                                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-slate-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white text-slate-900"
                                placeholder="users.me"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                        <div className="flex space-x-4">
                            <label className="inline-flex items-center">
                                <input type="radio" className="form-radio text-blue-600" name="method" checked={method === 'GET'} onChange={() => setMethod('GET')} />
                                <span className="ml-2 text-slate-900">GET</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input type="radio" className="form-radio text-blue-600" name="method" checked={method === 'POST'} onChange={() => setMethod('POST')} />
                                <span className="ml-2 text-slate-900">POST</span>
                            </label>
                        </div>
                    </div>

                    {method === 'POST' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Body (JSON)</label>
                            <textarea 
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                className="w-full h-40 font-mono text-sm p-3 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900"
                            />
                        </div>
                    )}

                    <div className="pt-2">
                        <button 
                            onClick={handleExecute}
                            disabled={executing}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md flex items-center justify-center shadow-sm disabled:bg-slate-300"
                        >
                            {executing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                            Execute Request
                        </button>
                    </div>
                    
                    <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-500">
                        <strong>Token Info:</strong><br/>
                        Exp: {settings.expires_in}s<br/>
                        Updated: {new Date(settings.token_updated_at).toLocaleString()}
                    </div>
                </div>

                {/* Response Panel */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-900 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2" /> Response
                        </h3>
                        {status !== null && (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${status >= 200 && status < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                Status: {status}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-auto relative">
                        {response ? (
                            <pre className="text-xs font-mono text-green-400">
                                {JSON.stringify(response, null, 2)}
                            </pre>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                                No response yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamleaderTester;