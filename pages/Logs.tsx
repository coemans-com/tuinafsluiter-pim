
import React, { useEffect, useState } from 'react';
import { RefreshCw, Upload, AlertCircle, Info, Search, Filter, Clock, CheckCircle } from 'lucide-react';
import { LogEntry, LogType } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const Logs: React.FC = () => {
    const { t } = useLanguage();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        const data = await api.fetchLogs(100);
        setLogs(data);
        setLoading(false);
    };

    const getIcon = (type: LogType) => {
        switch(type) {
            case 'sync': return <RefreshCw className="h-4 w-4" />;
            case 'import': return <Upload className="h-4 w-4" />;
            case 'error': return <AlertCircle className="h-4 w-4" />;
            case 'success': return <CheckCircle className="h-4 w-4" />;
            default: return <Info className="h-4 w-4" />;
        }
    };

    const getColor = (type: LogType) => {
        switch(type) {
            case 'sync': return 'text-green-600 bg-green-100';
            case 'import': return 'text-blue-600 bg-blue-100';
            case 'error': return 'text-red-600 bg-red-100';
            case 'success': return 'text-emerald-600 bg-emerald-100';
            case 'warning': return 'text-amber-600 bg-amber-100';
            default: return 'text-slate-600 bg-slate-100';
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesFilter = filter === 'all' || log.type === filter;
        const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">{t('logs.title')}</h2>
                    <p className="text-slate-500 mt-1">{t('logs.subtitle')}</p>
                </div>
                <button onClick={loadLogs} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium text-sm flex items-center shadow-sm">
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    {t('logs.refresh')}
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto">
                        <Filter className="w-4 h-4 text-slate-500 mr-2" />
                        {['all', 'sync', 'import', 'success', 'error'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                            >
                                {f === 'all' ? t('logs.filter_all') : f}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder={t('logs.search_placeholder')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('logs.col_type')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('logs.col_message')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('logs.col_user')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{t('logs.col_time')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${getColor(log.type)}`}>
                                            <span className="mr-1.5">{getIcon(log.type)}</span>
                                            {log.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-slate-900">{log.message}</div>
                                        {log.details && (
                                            <div className="text-xs text-slate-500 font-mono mt-1 max-w-md truncate">
                                                {JSON.stringify(log.details)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {log.userName || 'System'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-500">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-slate-500 italic">
                                        {t('logs.no_logs')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Logs;
