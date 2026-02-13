
import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, ArrowRight, Layers, Box } from 'lucide-react';
import { Product, ProductType } from '../types';
import { validateProduct } from '../utils/validation';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

interface SyncStatusProps {
  products: Product[];
  onSyncComplete: (syncedIds: string[]) => void;
}

const SyncStatus: React.FC<SyncStatusProps> = ({ products, onSyncComplete }) => {
  const { t } = useLanguage();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [syncingType, setSyncingType] = useState<string>('');

  // Split products into Syncable vs Incomplete
  const itemsNeedsSync = products.filter(p => p.needsSync);
  
  const validItemsToSync = itemsNeedsSync.filter(p => validateProduct(p, products).isValid);
  const incompleteItems = itemsNeedsSync.filter(p => !validateProduct(p, products).isValid);
  
  const total = validItemsToSync.length;
  
  const validSimple = validItemsToSync.filter(p => p.type === ProductType.SIMPLE);
  const validComposite = validItemsToSync.filter(p => p.type === ProductType.COMPOSITE);

  const runSync = async (targets: Product[], typeLabel: string) => {
    if (targets.length === 0) return;
    
    setSyncing(true);
    setSyncingType(typeLabel);
    setLogs([`Initializing sync for ${targets.length} ${typeLabel} products...`]);
    setProgress(0);

    const targetTotal = targets.length;
    let processed = 0;
    const successfulIds: string[] = [];

    // Check for Teamleader connection
    let accessToken: string | null = null;
    try {
        const settings = await api.getIntegrationSettings('teamleader');
        if (settings && settings.access_token) {
            accessToken = settings.access_token;
            setLogs(prev => ['Connected to Teamleader API.', ...prev]);
        } else {
            setLogs(prev => ['Warning: Teamleader not connected. Simulation Mode.', ...prev]);
        }
    } catch (e) {
        setLogs(prev => ['Warning: Could not check connection. Simulation Mode.', ...prev]);
    }

    // Process sequentially to handle API rate limits and dependencies
    for (const product of targets) {
        try {
            // Generate Description for Composite
            let description = '';
            if (product.type === ProductType.COMPOSITE && product.bom) {
                // List single products in order and quantity
                const lines = product.bom.map(item => {
                    const comp = products.find(p => p.id === item.componentId);
                    if (!comp) return null;
                    return `${item.quantity} x ${comp.name}`;
                }).filter(Boolean);
                description = lines.join('\n');
            } else {
                // For Simple Products, use Name as description if no explicit description exists
                // This prevents empty string errors in some API versions
                description = product.name; 
            }

            if (accessToken) {
                // Real Sync
                try {
                    await api.syncToTeamleader(product, description);
                    const action = product.teamleaderId ? 'Updated' : 'Created';
                    setLogs(prev => [`[SUCCESS] ${action} ${product.sku}`, ...prev]);
                    successfulIds.push(product.id);
                } catch (err: any) {
                    setLogs(prev => [`[ERROR] Failed ${product.sku}: ${err.message}`, ...prev]);
                }
            } else {
                // Simulation
                await new Promise(r => setTimeout(r, 400)); // Simulate delay
                const action = product.teamleaderId ? 'Updated' : 'Created';
                const descLog = description ? ` (Desc: ${description.replace(/\n/g, ', ')})` : '';
                setLogs(prev => [`[SIMULATION] ${action} ${product.sku}${descLog}`, ...prev]);
                successfulIds.push(product.id);
            }
        } catch (e: any) {
             setLogs(prev => [`[ERROR] Unexpected error ${product.sku}: ${e.message}`, ...prev]);
        }

        processed++;
        setProgress(Math.floor((processed / targetTotal) * 100));
    }
    
    setSyncing(false);
    setSyncingType('');
    setLogs(prev => ['Sync process finished.', ...prev]);
    
    if (successfulIds.length > 0) {
        onSyncComplete(successfulIds);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
          <RefreshCw className={`w-5 h-5 mr-2 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
          {t('sync.title')}
        </h2>

        {total === 0 && !syncing && incompleteItems.length === 0 ? (
           <div className="text-center py-8">
             <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
             <p className="text-slate-900 font-medium">{t('sync.up_to_date')}</p>
             <p className="text-slate-500 text-sm">{t('sync.no_changes')}</p>
           </div>
        ) : (
          <div>
            {!syncing && (
              <div className="mb-6 space-y-4">
                 {/* Ready to Sync */}
                 {total > 0 ? (
                    <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                        <div className="mb-4">
                            <p className="text-blue-900 text-lg">
                                <strong className="font-bold">{total}</strong> {t('sync.ready_msg')}
                            </p>
                            <p className="text-sm text-blue-700 mt-1 flex gap-3">
                                <span className="flex items-center"><Box className="w-3 h-3 mr-1" /> {validSimple.length} Simple</span>
                                <span className="flex items-center"><Layers className="w-3 h-3 mr-1" /> {validComposite.length} Composite</span>
                            </p>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => runSync(validItemsToSync, 'All')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-bold shadow-sm transition-colors flex items-center justify-center text-sm"
                            >
                                {t('sync.btn_all')} ({total}) <ArrowRight className="w-4 h-4 ml-2" />
                            </button>

                            {validSimple.length > 0 && validComposite.length > 0 && (
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    <button 
                                        onClick={() => runSync(validSimple, 'Simple')}
                                        className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 py-2 rounded-md font-medium text-xs flex items-center justify-center transition-colors"
                                    >
                                        <Box className="w-3 h-3 mr-2" /> {t('sync.btn_simple')} ({validSimple.length})
                                    </button>
                                    <button 
                                        onClick={() => runSync(validComposite, 'Composite')}
                                        className="bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 py-2 rounded-md font-medium text-xs flex items-center justify-center transition-colors"
                                    >
                                        <Layers className="w-3 h-3 mr-2" /> {t('sync.btn_composite')} ({validComposite.length})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Individual Products List */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden mt-4">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 text-sm">{t('sync.pending_list')}</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto bg-white">
                            <table className="min-w-full divide-y divide-slate-100">
                                <tbody className="divide-y divide-slate-100">
                                    {validItemsToSync.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center">
                                                    <div className={`mr-3 p-1.5 rounded-md ${p.type === ProductType.COMPOSITE ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        {p.type === ProductType.COMPOSITE ? <Layers className="w-4 h-4" /> : <Box className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-900">{p.sku}</div>
                                                        <div className="text-xs text-slate-500">{p.name}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                 <button 
                                                    onClick={() => runSync([p], 'Single')}
                                                    disabled={syncing}
                                                    className="text-sm border border-blue-200 text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-md font-medium transition-colors"
                                                 >
                                                    {t('sync.sync_now')}
                                                 </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </>
                 ) : (
                     <p className="text-slate-500 text-sm">No valid products ready to sync.</p>
                 )}

                 {/* Incomplete Items (Blocked) */}
                 {incompleteItems.length > 0 && (
                     <div className="bg-slate-100 border border-slate-200 rounded-lg p-4">
                         <h4 className="flex items-center text-slate-800 font-bold text-sm mb-2">
                             <AlertCircle className="w-4 h-4 mr-2 text-slate-500" />
                             {incompleteItems.length} {t('sync.blocked_title')}
                         </h4>
                         <p className="text-xs text-slate-500 mb-3">
                             {t('sync.blocked_desc')}
                         </p>
                         <div className="bg-white rounded border border-slate-200 max-h-40 overflow-y-auto">
                             <table className="w-full text-left text-xs">
                                 <tbody>
                                     {incompleteItems.map(p => {
                                         const val = validateProduct(p, products);
                                         return (
                                            <tr key={p.id} className="border-b border-slate-100 last:border-0">
                                                <td className="p-2 font-medium text-slate-700">{p.sku}</td>
                                                <td className="p-2 text-red-600">{val.error}</td>
                                            </tr>
                                         );
                                     })}
                                 </tbody>
                             </table>
                         </div>
                     </div>
                 )}
              </div>
            )}

            {/* Progress */}
            {(syncing || progress > 0) && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-medium text-slate-700">
                    <span>{t('sync.progress')}</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            {/* Logs */}
            <div className="mt-6 bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-xs h-64 overflow-y-auto">
               {logs.length === 0 ? (
                 <span className="text-slate-600">{t('sync.waiting_log')}</span>
               ) : (
                 logs.map((log, i) => <div key={i} className="mb-1">{log}</div>)
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncStatus;
