
import React, { useEffect, useState } from 'react';
import { AlertCircle, Package, RefreshCw, Upload, Clock, Info } from 'lucide-react';
import { Product, LogEntry } from '../types';
import { api } from '../services/api';
import { validateProduct } from '../utils/validation';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProps {
  products: Product[];
  onNavigate: (page: string, filter?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ products, onNavigate }) => {
  const { t } = useLanguage();
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const totalProducts = products.length;
  const needsSync = products.filter(p => p.needsSync).length;
  const incompleteCount = products.filter(p => !validateProduct(p, products).isValid).length;

  useEffect(() => {
    // Fetch logs on mount
    api.fetchLogs(5).then(setRecentLogs);
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, onClick }: any) => (
    <div 
      onClick={onClick}
      className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );

  const getLogIcon = (type: string) => {
      switch(type) {
          case 'sync': return <RefreshCw className="h-4 w-4 text-green-600" />;
          case 'import': return <Upload className="h-4 w-4 text-blue-600" />;
          case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />;
          default: return <Info className="h-4 w-4 text-slate-600" />;
      }
  };

  const getLogBg = (type: string) => {
    switch(type) {
        case 'sync': return 'bg-green-100';
        case 'import': return 'bg-blue-100';
        case 'error': return 'bg-red-100';
        default: return 'bg-slate-100';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return t('dash.time.just_now');
      if (diffMins < 60) return `${diffMins}${t('dash.time.min_ago')}`;
      if (diffHours < 24) return `${diffHours}${t('dash.time.hr_ago')}`;
      return `${diffDays}${t('dash.time.day_ago')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('dash.title')}</h2>
          <p className="text-slate-500 mt-1">{t('dash.subtitle')}</p>
        </div>
        <button 
          onClick={() => onNavigate('sync')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center shadow-sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('dash.sync_btn')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title={t('dash.total_products')} 
          value={totalProducts} 
          icon={Package} 
          color="bg-blue-500" 
          onClick={() => onNavigate('products', 'all')}
        />
        <StatCard 
          title={t('dash.pending_sync')} 
          value={needsSync} 
          icon={RefreshCw} 
          color="bg-amber-500" 
          onClick={() => onNavigate('products', 'unsynced')}
        />
        <StatCard 
          title={t('dash.incomplete')} 
          value={incompleteCount} 
          icon={AlertCircle} 
          color="bg-red-500" 
          onClick={() => onNavigate('products', 'incomplete')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">{t('dash.recent_activity')}</h3>
              <button onClick={() => onNavigate('logs')} className="text-sm text-blue-600 hover:underline">{t('dash.view_all')}</button>
          </div>
          <div className="space-y-4">
            {recentLogs.length > 0 ? recentLogs.map(log => (
                <div key={log.id} className="flex items-start">
                    <div className="flex-shrink-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getLogBg(log.type)}`}>
                            {getLogIcon(log.type)}
                        </div>
                    </div>
                    <div className="ml-4 flex-1">
                        <p className="text-sm font-medium text-slate-900">{log.message}</p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center">
                            <Clock className="w-3 h-3 mr-1" /> {formatTimeAgo(log.createdAt)} • {log.userName || 'System'}
                        </p>
                    </div>
                </div>
            )) : (
                <div className="text-center py-10 text-slate-400">
                    <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('dash.no_activity')}</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
