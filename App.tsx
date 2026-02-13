
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import ImportPrices from './pages/ImportPrices';
import SyncStatus from './pages/SyncStatus';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Logs from './pages/Logs';
import TeamleaderTester from './pages/TeamleaderTester';
import { MOCK_SUPPLIERS } from './services/mockData';
import { Product, ProductType, PriceList, BOMComponent, User, AppSettings } from './types';
import { api } from './services/api';
import { isSupabaseConfigured, getSupabase } from './services/supabaseClient';
import { calculatePriceFromFormula, DEFAULT_FORMULA_B2B, DEFAULT_FORMULA_CONSUMER } from './utils/pricing';
import { validateProduct } from './utils/validation';
import { Loader2, Database, Terminal, Copy, ArrowLeft, XCircle, CheckCircle, Info, RefreshCcw, ShieldAlert, Trash2, PlayCircle, AlertTriangle } from 'lucide-react';
import { MIGRATION_SCRIPT } from './services/schema';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetOption, setShowResetOption] = useState(false); // New: Safety valve for stuck loading
  const [dbConfigured, setDbConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null); 
  const [copiedSql, setCopiedSql] = useState(false);
  
  // Key to force re-render of Detail component (for resetting form)
  const [detailKey, setDetailKey] = useState(0);
  
  // Lifted state for ProductList tab (Simple vs Composite)
  const [productTab, setProductTab] = useState<ProductType>(ProductType.SIMPLE);

  const [appSettings, setAppSettings] = useState<AppSettings>({ 
      priceFormulaB2B: DEFAULT_FORMULA_B2B,
      priceFormulaConsumer: DEFAULT_FORMULA_CONSUMER,
      language: 'en'
  });

  const [productFilter, setProductFilter] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 5000);
  };

  // Timeout for loading state to show "Reset" button if stuck
  useEffect(() => {
    let timer: any;
    if (isLoading) {
        timer = setTimeout(() => {
            setShowResetOption(true);
        }, 3000); // 3 seconds
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    const init = async () => {
        setIsLoading(true);
        setError(null);
        setErrorDetails(null);
        
        const configured = isSupabaseConfigured();
        setDbConfigured(configured);

        if (!configured) {
            setIsLoading(false);
            return;
        }

        const supabase = getSupabase();
        
        // 1. Initial Data Load
        try {
            const user = await api.getCurrentSession();
            if (user) {
                setCurrentUser(user);
                await loadAppData();
            } else {
                setIsLoading(false);
            }
        } catch (e: any) {
            console.error("Session Check Failed:", e);
            // Even if session check fails, we stop loading to show Login
            setIsLoading(false);
        }

        // 2. Listen for Auth Changes
        // Note: We intentionally DO NOT listen for SIGNED_IN here to prevent double-loading 
        // or stale-closure bugs when switching tabs. Initial load handles the session.
        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_OUT') {
                    setCurrentUser(null);
                    setCurrentPage('dashboard');
                    setProducts([]); 
                }
            });
            return () => subscription.unsubscribe();
        }
    };
    init();
  }, []);

  const loadAppData = async () => {
        try {
            const [prodData, settings] = await Promise.all([
                api.fetchProducts(),
                api.getAppSettings()
            ]);
            setProducts(prodData);
            setAppSettings(settings);
        } catch (err: any) {
            let msg = "Failed to load application data.";
            if (err.code === '42P01') msg = "MISSING_TABLES"; 
            else if (err.message) msg = err.message;
            
            // Only show error screen if it's a critical DB error.
            if (err.code === '42P01' || err.code === 'PGRST301') {
                setError(msg);
                setErrorDetails(err);
            } else {
                console.error("Non-critical load error:", err);
                showNotification("Could not load latest data. Check connection.", 'error');
            }
        } finally {
            setIsLoading(false);
        }
  };

  const handleLogin = (user: User) => {
      setCurrentUser(user);
      setIsLoading(true);
      loadAppData();
  };

  const handleLogout = async () => {
      await api.logout();
      setCurrentUser(null);
      setCurrentPage('dashboard');
  };

  const handleResetConnection = () => {
      // Hard reset for "It works in Incognito but not here" issues
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
  };
  
  const handleNavigate = (page: string, filter: string = 'all') => {
    setCurrentPage(page);
    setProductFilter(filter); 

    if (page === 'settings') {
        api.getAppSettings().then(setAppSettings);
    }
    if (page !== 'products') setSelectedProduct(null);
  };

  const handleConnectSuccess = () => {
      setCurrentPage('dashboard');
      showNotification("Teamleader connected successfully!", 'success');
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductTab(product.type); 
    setCurrentPage('product-detail');
  };

  const handleCreateProduct = () => {
    setSelectedProduct(null); 
    setDetailKey(prev => prev + 1); 
    setCurrentPage('product-detail');
  };

  const handleSaveProduct = async (updatedProduct: Product) => {
    setIsLoading(true);
    updatedProduct.needsSync = true;
    updatedProduct.lastEdited = new Date().toISOString();
    
    setProductTab(updatedProduct.type);

    const { priceFormulaB2B, priceFormulaConsumer } = appSettings;

    let newProductList = [...products];
    const existingIndex = newProductList.findIndex(p => p.id === updatedProduct.id);
    const isNew = existingIndex === -1;

    if (!isNew) newProductList[existingIndex] = updatedProduct;
    else newProductList.push(updatedProduct);

    if (updatedProduct.type === ProductType.SIMPLE) {
      newProductList = newProductList.map(p => {
        if (p.type === ProductType.COMPOSITE && p.bom) {
          const usesComponent = p.bom.some(b => b.componentId === updatedProduct.id);
          if (usesComponent) {
             let newCost = 0;
             p.bom.forEach(b => {
                const comp = b.componentId === updatedProduct.id ? updatedProduct : newProductList.find(x => x.id === b.componentId);
                if (comp) newCost += comp.purchaseCost * b.quantity;
             });
             
             const newPrices = p.prices.map(pr => {
               const formula = pr.priceList === PriceList.CONSUMER ? priceFormulaConsumer : priceFormulaB2B;
               const margin = pr.discount || 0;
               const calculated = calculatePriceFromFormula(newCost, margin, formula);
               const final = calculated;
               return { ...pr, calculatedPrice: calculated, finalPrice: final };
             });
             return { ...p, purchaseCost: newCost, prices: newPrices, needsSync: true, lastEdited: new Date().toISOString() };
          }
        }
        return p;
      });
    }

    try {
        await api.saveProduct(updatedProduct);
        const changedComposites = newProductList.filter(p => p.id !== updatedProduct.id && p.needsSync && p.type === ProductType.COMPOSITE);
        for(const cp of changedComposites) await api.saveProduct(cp);
        
        setProducts(newProductList);
        
        api.logActivity(
            'success', 
            `${isNew ? 'Created' : 'Updated'} product: ${updatedProduct.sku}`, 
            { id: updatedProduct.id, name: updatedProduct.name }, 
            currentUser
        );

        if (isNew) {
            setDetailKey(prev => prev + 1);
            showNotification(`Created ${updatedProduct.sku}. Ready for new product.`, 'success');
        } else {
            setCurrentPage('products');
            showNotification(`Updated ${updatedProduct.sku}`, 'success');
        }
    } catch (e: any) {
        if (e.code === '23505') {
            showNotification("Error: SKU already exists.", 'error');
            api.logActivity('error', `Failed to save product ${updatedProduct.sku}: Duplicate SKU`, null, currentUser);
        } else {
            showNotification("Failed to save to database. Check connection.", 'error');
            api.logActivity('error', `Failed to save product ${updatedProduct.sku}`, { error: e }, currentUser);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleBulkUpdate = async (updatedProducts: Product[]) => {
      setIsLoading(true);
      try {
          await api.bulkSaveProducts(updatedProducts);
          setProducts(prev => {
              const productMap = new Map(prev.map(p => [p.id, p]));
              updatedProducts.forEach(p => productMap.set(p.id, p));
              return Array.from(productMap.values());
          });
          api.logActivity('success', `Bulk updated ${updatedProducts.length} products`, null, currentUser);
          showNotification(`Successfully updated ${updatedProducts.length} products`, 'success');
      } catch (e: any) {
          showNotification(`Bulk update failed: ${e.message}`, 'error');
          api.logActivity('error', 'Bulk update failed', { error: e.message }, currentUser);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSyncOne = async (product: Product) => {
      const validation = validateProduct(product, products);
      if (!validation.isValid) {
          showNotification(`Cannot sync: ${validation.error}`, 'error');
          return;
      }

      setIsLoading(true);
      try {
          const settings = await api.getIntegrationSettings('teamleader');
          if (!settings || !settings.access_token) {
              throw new Error("Teamleader not connected. Go to Settings.");
          }

          let description = '';
          if (product.type === ProductType.COMPOSITE && product.bom) {
              const lines = product.bom.map(item => {
                  const comp = products.find(p => p.id === item.componentId);
                  return comp ? `${item.quantity} x ${comp.name}` : null;
              }).filter(Boolean);
              description = lines.join('\n');
          } else {
              description = product.name;
          }

          const tlId = await api.syncToTeamleader(product, description);
          
          const updatedProduct = { 
              ...product, 
              teamleaderId: tlId, 
              needsSync: false, 
              lastSync: new Date().toISOString() 
          };
          
          await api.saveProduct(updatedProduct);
          
          setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
          if (selectedProduct && selectedProduct.id === updatedProduct.id) {
              setSelectedProduct(updatedProduct);
          }

          showNotification(`Synced ${product.sku} successfully`, 'success');
          api.logActivity('sync', `Synced product ${product.sku}`, null, currentUser);

      } catch (e: any) {
          showNotification(`Sync failed: ${e.message}`, 'error');
          api.logActivity('error', `Sync failed for ${product.sku}`, { error: e.message }, currentUser);
      } finally {
          setIsLoading(false);
      }
  };

  const handleDeleteProduct = async (id: string) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    
    setIsLoading(true);
    try {
        await api.deleteProduct(id);
        setProducts(prev => prev.filter(p => p.id !== id));
        api.logActivity('warning', `Deleted product: ${prod.sku}`, { id: prod.id }, currentUser);
        showNotification(`Product ${prod.sku} deleted`, 'success');
        setCurrentPage('products');
    } catch (e: any) {
        showNotification(`Failed to delete product: ${e.message}`, 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const handleImportComplete = async (previewData: any[], mode: 'simple' | 'composite') => {
     api.logActivity('import', `Imported ${previewData.length} ${mode} records.`, null, currentUser);
     window.location.reload(); 
  };

  const handleSyncComplete = (syncedIds: string[]) => {
    const newProducts = products.map(p => {
        if (syncedIds.includes(p.id)) {
            return { ...p, needsSync: false, lastSync: new Date().toISOString() };
        }
        return p;
    });

    setProducts(newProducts);
    
    const changed = newProducts.filter(p => syncedIds.includes(p.id));
    api.bulkSaveProducts(changed);

    api.logActivity('sync', `Synced ${changed.length} products to Teamleader.`, null, currentUser);
    showNotification(`Synced ${changed.length} products successfully`, 'success');
  };

  const copySqlToClipboard = () => {
      navigator.clipboard.writeText(MIGRATION_SCRIPT);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
  };

  if (isLoading) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-slate-50 flex-col gap-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-slate-500 font-medium">Loading Application...</p>
              
              {showResetOption && (
                  <div className="flex flex-col items-center gap-2 animate-fade-in">
                    <p className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full">Taking longer than expected?</p>
                    <button 
                        onClick={handleResetConnection}
                        className="flex items-center text-sm font-bold text-slate-600 hover:text-red-600 border border-slate-300 hover:border-red-300 px-4 py-2 rounded-md bg-white shadow-sm transition-all"
                    >
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Reset Cache & Reload
                    </button>
                  </div>
              )}
          </div>
      );
  }

  if (errorDetails || error === 'MISSING_TABLES') {
      const isMissingTables = error === 'MISSING_TABLES' || (errorDetails?.code === '42P01');
      return (
          <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
              <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
                  <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
                      <div className="p-3 bg-red-100 rounded-full"><Database className="w-6 h-6 text-red-600" /></div>
                      <div>
                          <h2 className="text-xl font-bold text-red-900">Database Connection Failed</h2>
                          <p className="text-red-700 mt-1">{isMissingTables ? "Connected, but tables are missing." : "Could not query the database."}</p>
                      </div>
                  </div>
                  <div className="p-6 space-y-6">
                      {!isMissingTables && errorDetails && (
                          <div className="bg-slate-100 p-4 rounded-md font-mono text-xs text-slate-700 overflow-x-auto border border-slate-300">
                             <strong>Error Details:</strong>
                             <pre className="mt-2">{JSON.stringify(errorDetails, null, 2)}</pre>
                             <p className="mt-2 text-slate-500">Code: {errorDetails.code || 'N/A'}, Hint: {errorDetails.hint || 'None'}</p>
                          </div>
                      )}
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-sm">
                          <strong className="text-amber-900 block mb-1">Troubleshooting:</strong>
                          <ul className="list-disc pl-5 text-amber-800 space-y-1">
                              <li>If you see <strong>code: 42P01</strong>, the tables don't exist yet. Run the SQL script below.</li>
                              <li>If you see <strong>code: 20 (AbortError)</strong>, check your internet or ad-blockers.</li>
                              <li>If you see <strong>PGRST301</strong>, Row Level Security (RLS) is blocking access. The script below fixes this.</li>
                          </ul>
                      </div>
                      <div className="space-y-4">
                          <h3 className="font-bold text-slate-900 flex items-center"><Terminal className="w-5 h-5 mr-2 text-slate-500" /> Run Fix Script in Supabase SQL Editor</h3>
                          <p className="text-sm text-slate-600 pl-7">This script creates missing tables AND fixes permission issues.</p>
                      </div>
                      <div className="relative">
                           <button onClick={copySqlToClipboard} className="w-full py-3 bg-slate-900 text-white rounded-md text-sm font-bold flex items-center justify-center hover:bg-slate-800">
                               <Copy className="w-4 h-4 mr-2" /> {copiedSql ? "Copied to Clipboard!" : "Copy SQL Script"}
                           </button>
                      </div>
                      <div className="flex justify-between pt-4 border-t border-slate-100 gap-4">
                          <button 
                            onClick={handleResetConnection} 
                            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-md font-medium text-sm flex items-center"
                          >
                             <RefreshCcw className="w-4 h-4 mr-2" /> Reset Connection
                          </button>
                          <button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-bold shadow-sm">
                             Retry
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  if (!currentUser) {
      if (currentPage === 'settings') {
          return (
              <div className="min-h-screen bg-slate-50">
                  <div className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-sm sticky top-0 z-20">
                      <div className="flex items-center">
                          <h1 className="font-bold text-lg text-slate-900">System Configuration</h1>
                      </div>
                      <button onClick={() => setCurrentPage('dashboard')} className="flex items-center text-sm text-slate-600 font-medium hover:text-blue-600 transition-colors bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md">
                          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
                      </button>
                  </div>
                  <div className="p-4 md:p-8 max-w-5xl mx-auto"><Settings currentUser={null} /></div>
              </div>
          );
      }
      return <Login onLogin={handleLogin} isDbConfigured={dbConfigured} initialError={error} onOpenSettings={() => setCurrentPage('settings')} />;
  }

  return (
    <Layout activePage={currentPage} onNavigate={handleNavigate} currentUser={currentUser} onLogout={handleLogout}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center border transition-all duration-300 transform translate-y-0 ${
            notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 mr-2" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5 mr-2" />}
            {notification.type === 'info' && <Info className="w-5 h-5 mr-2" />}
            <span className="font-medium text-sm">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-4 opacity-50 hover:opacity-100"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {!dbConfigured && currentPage !== 'settings' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center max-w-2xl mx-auto mt-10">
              <h2 className="text-xl font-bold text-amber-900 mb-2">Configuration Required</h2>
              <button onClick={() => setCurrentPage('settings')} className="bg-amber-600 text-white px-4 py-2 rounded-md font-bold">Go to Settings</button>
          </div>
      ) : (
          <>
            {currentPage === 'dashboard' && <Dashboard products={products} onNavigate={handleNavigate} />}
            {currentPage === 'products' && (
              <ProductList 
                  products={products} 
                  initialFilter={productFilter} 
                  onSelectProduct={handleSelectProduct} 
                  onCreateProduct={handleCreateProduct} 
                  onDeleteProduct={handleDeleteProduct} 
                  onSync={handleSyncOne} 
                  onBulkUpdate={handleBulkUpdate}
                  appSettings={appSettings}
                  activeTab={productTab}
                  onTabChange={setProductTab}
              />
            )}
            {currentPage === 'product-detail' && <ProductDetail key={detailKey} product={selectedProduct} allProducts={products} onSave={handleSaveProduct} onDelete={handleDeleteProduct} onBack={() => setCurrentPage('products')} appSettings={appSettings} onSync={handleSyncOne} />}
            {currentPage === 'import' && <ImportPrices suppliers={MOCK_SUPPLIERS} products={products} onImportComplete={handleImportComplete} />}
            {currentPage === 'sync' && <SyncStatus products={products} onSyncComplete={handleSyncComplete} />}
            {currentPage === 'logs' && <Logs />}
            {currentPage === 'tester' && <TeamleaderTester />}
          </>
      )}
      
      {currentPage === 'settings' && <Settings currentUser={currentUser} onConnectSuccess={handleConnectSuccess} />}
    </Layout>
  );
}
