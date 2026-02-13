
import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Layers, Box, CalendarClock, Trash2, AlertTriangle, AlertCircle, RefreshCw, Filter, CheckSquare, Square, X } from 'lucide-react';
import { Product, ProductType, PriceList, AppSettings } from '../types';
import { validateProduct } from '../utils/validation';
import { calculatePriceFromFormula } from '../utils/pricing';
import { useLanguage } from '../contexts/LanguageContext';

interface ProductListProps {
  products: Product[];
  initialFilter?: string;
  onSelectProduct: (product: Product) => void;
  onCreateProduct: () => void;
  onDeleteProduct: (id: string) => void;
  onSync: (product: Product) => void;
  onBulkUpdate: (products: Product[]) => void;
  appSettings: AppSettings;
  activeTab: ProductType;
  onTabChange: (tab: ProductType) => void;
}

const ProductList: React.FC<ProductListProps> = ({ 
  products, 
  initialFilter, 
  onSelectProduct, 
  onCreateProduct, 
  onDeleteProduct, 
  onSync, 
  onBulkUpdate, 
  appSettings,
  activeTab,
  onTabChange
}) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  // activeTab state moved to parent (App.tsx)
  const [filterMode, setFilterMode] = useState<'all' | 'incomplete' | 'unsynced'>('all');
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Bulk Edit Modal State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkB2BMargin, setBulkB2BMargin] = useState<string>('');
  const [bulkConsumerMargin, setBulkConsumerMargin] = useState<string>('');

  // Confirmation Modal State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilter && (initialFilter === 'incomplete' || initialFilter === 'unsynced')) {
        setFilterMode(initialFilter as any);
    } else {
        setFilterMode('all');
    }
  }, [initialFilter]);

  // Clear selection when tab or filter changes
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, filterMode]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = p.type === activeTab;
    
    let matchesFilter = true;
    if (filterMode === 'incomplete') matchesFilter = !validateProduct(p, products).isValid;
    if (filterMode === 'unsynced') matchesFilter = p.needsSync;

    return matchesSearch && matchesType && matchesFilter;
  });

  const handleSelectAll = () => {
      if (selectedIds.length === filteredProducts.length) {
          setSelectedIds([]);
      } else {
          setSelectedIds(filteredProducts.map(p => p.id));
      }
  };

  const handleSelectRow = (id: string) => {
      if (selectedIds.includes(id)) {
          setSelectedIds(selectedIds.filter(i => i !== id));
      } else {
          setSelectedIds([...selectedIds, id]);
      }
  };

  const applyBulkEdit = () => {
      if (!bulkB2BMargin && !bulkConsumerMargin) {
          setIsBulkEditOpen(false);
          return;
      }

      const updatedProducts = products
        .filter(p => selectedIds.includes(p.id))
        .map(p => {
             const cost = p.purchaseCost;
             const newPrices = p.prices.map(price => {
                 let margin = price.discount; // Default to existing
                 
                 if (price.priceList === PriceList.B2B && bulkB2BMargin !== '') {
                     margin = parseFloat(bulkB2BMargin);
                 } else if (price.priceList === PriceList.CONSUMER && bulkConsumerMargin !== '') {
                     margin = parseFloat(bulkConsumerMargin);
                 }

                 const formula = price.priceList === PriceList.CONSUMER 
                    ? appSettings.priceFormulaConsumer 
                    : appSettings.priceFormulaB2B;
                 
                 const calculated = calculatePriceFromFormula(cost, margin, formula);
                 
                 return { 
                     ...price, 
                     discount: margin, 
                     calculatedPrice: calculated, 
                     finalPrice: calculated 
                };
             });

             return {
                 ...p,
                 prices: newPrices,
                 lastEdited: new Date().toISOString(),
                 needsSync: true
             };
        });
        
      onBulkUpdate(updatedProducts);
      setIsBulkEditOpen(false);
      setSelectedIds([]);
      setBulkB2BMargin('');
      setBulkConsumerMargin('');
  };

  const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
      });
  };

  const selectedForDelete = products.find(p => p.id === confirmDeleteId);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('prod.title')}</h2>
          <p className="text-slate-500 mt-1">{t('prod.subtitle')}</p>
        </div>
        <button 
          onClick={onCreateProduct}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('prod.add')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tabs & Filters */}
        <div className="border-b border-slate-200">
             <div className="flex items-center px-4 pt-4">
                 <button
                    onClick={() => onTabChange(ProductType.SIMPLE)}
                    className={`flex items-center px-6 py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === ProductType.SIMPLE ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                 >
                     <Box className="w-4 h-4 mr-2" />
                     {t('prod.tab.simple')}
                     <span className="ml-2 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">
                         {products.filter(p => p.type === ProductType.SIMPLE).length}
                     </span>
                 </button>
                 <button
                    onClick={() => onTabChange(ProductType.COMPOSITE)}
                    className={`flex items-center px-6 py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === ProductType.COMPOSITE ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                 >
                     <Layers className="w-4 h-4 mr-2" />
                     {t('prod.tab.composite')}
                     <span className="ml-2 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">
                         {products.filter(p => p.type === ProductType.COMPOSITE).length}
                     </span>
                 </button>
             </div>
             
             <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                    type="text" 
                    placeholder={t('prod.search_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 border bg-white text-slate-900"
                    />
                </div>
                <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-slate-200">
                    <span className="text-xs font-bold text-slate-400 px-2 flex items-center uppercase"><Filter className="w-3 h-3 mr-1" /> {t('prod.filter.label')}</span>
                    <button 
                        onClick={() => setFilterMode('all')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${filterMode === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        {t('prod.filter.all')}
                    </button>
                    <button 
                        onClick={() => setFilterMode('incomplete')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${filterMode === 'incomplete' ? 'bg-red-100 text-red-800 border border-red-200' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        {t('prod.filter.incomplete')}
                    </button>
                    <button 
                        onClick={() => setFilterMode('unsynced')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${filterMode === 'unsynced' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        {t('prod.filter.unsynced')}
                    </button>
                </div>
             </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 w-10">
                    <button onClick={handleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-slate-600">
                        {selectedIds.length > 0 && selectedIds.length === filteredProducts.length ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                            <Square className="w-5 h-5" />
                        )}
                    </button>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('prod.col.sku_name')}</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{t('prod.col.last_edited')}</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{t('prod.col.cost')}</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">{t('prod.col.status')}</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredProducts.map((product) => {
                const validation = validateProduct(product, products);
                const isSelected = selectedIds.includes(product.id);

                return (
                <tr 
                    key={product.id} 
                    className={`transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    onClick={() => onSelectProduct(product)}
                >
                  <td className="px-4 py-4" onClick={(e) => { e.stopPropagation(); handleSelectRow(product.id); }}>
                      <div className="flex items-center justify-center">
                        {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />}
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center mr-4 ${product.type === ProductType.COMPOSITE ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                          {product.type === ProductType.COMPOSITE ? <Layers className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{product.sku}</div>
                        <div className="text-sm text-slate-500">{product.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <div className="flex items-center">
                        <CalendarClock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {formatDate(product.lastEdited)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 text-right font-mono font-medium">
                    {product.purchaseCost === 0 ? <span className="text-red-600 font-bold">€0.00</span> : `€${product.purchaseCost.toFixed(2)}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {!validation.isValid ? (
                        <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full border border-slate-200" title={validation.error || 'Incomplete'}>
                            <AlertCircle className="w-3 h-3 mr-1 text-slate-400" />
                            {t('prod.status.incomplete')}
                        </span>
                    ) : product.needsSync ? (
                      <span className="inline-flex items-center text-xs font-medium text-amber-600">
                        <span className="w-2 h-2 mr-1 bg-amber-500 rounded-full"></span>
                        {t('prod.status.unsynced')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-medium text-green-600">
                        <span className="w-2 h-2 mr-1 bg-green-500 rounded-full"></span>
                        {t('prod.status.synced')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                        {product.needsSync && validation.isValid && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onSync(product); }} 
                                className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-full transition-colors"
                                title="Sync to Teamleader"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); onSelectProduct(product); }} 
                            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"
                            title="Edit Product"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(product.id); }} 
                            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-colors"
                            title="Delete Product"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-slate-300 mb-3">
                  {activeTab === ProductType.SIMPLE ? <Box className="w-full h-full" /> : <Layers className="w-full h-full" />}
              </div>
              <p className="text-slate-500 font-medium">
                 {t('prod.no_products')}
                 {filterMode !== 'all' && <span className="block text-sm text-slate-400 mt-1">Filter active: {filterMode.replace('_', ' ')}</span>}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Bar for Selections */}
      {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-6 z-40 animate-fade-in-up">
              <span className="font-bold text-sm">{selectedIds.length} {t('prod.bulk.selected')}</span>
              <div className="h-4 w-px bg-slate-700"></div>
              <button 
                onClick={() => setIsBulkEditOpen(true)}
                className="text-sm font-medium hover:text-blue-300 flex items-center"
              >
                  <Edit2 className="w-4 h-4 mr-2" /> {t('prod.bulk.edit_margins')}
              </button>
              <button 
                onClick={() => setSelectedIds([])}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
              >
                  <X className="w-4 h-4" />
              </button>
          </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900">{t('prod.bulk.modal_title')}</h3>
                    <button onClick={() => setIsBulkEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 mb-4">
                        {t('prod.bulk.desc')} <span className="font-bold">{selectedIds.length}</span> {t('prod.bulk.products')}. 
                        {t('prod.bulk.placeholder')}
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('prod.bulk.b2b_margin')}</label>
                        <input 
                            type="number" 
                            value={bulkB2BMargin}
                            onChange={(e) => setBulkB2BMargin(e.target.value)}
                            placeholder="Keep existing"
                            className="w-full rounded-md border border-slate-300 p-2 bg-white text-slate-900 focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('prod.bulk.cons_margin')}</label>
                        <input 
                            type="number" 
                            value={bulkConsumerMargin}
                            onChange={(e) => setBulkConsumerMargin(e.target.value)}
                            placeholder="Keep existing"
                            className="w-full rounded-md border border-slate-300 p-2 bg-white text-slate-900 focus:ring-blue-500 focus:border-blue-500" 
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
                    <button onClick={() => setIsBulkEditOpen(false)} className="px-4 py-2 text-slate-700 font-medium">{t('common.cancel')}</button>
                    <button 
                        onClick={applyBulkEdit}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                    >
                        {t('prod.bulk.apply')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDeleteId && selectedForDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-6 text-center">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{t('prod.delete.title')}</h3>
                      <p className="text-sm text-slate-500">
                          {t('prod.delete.confirm')} <span className="font-bold text-slate-900">{selectedForDelete.sku}</span>? 
                          <br />
                          <span className="text-xs text-amber-600 font-medium mt-2 block">
                            {t('prod.delete.note')}
                          </span>
                      </p>
                  </div>
                  <div className="flex border-t border-slate-200">
                      <button 
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 border-r border-slate-200"
                      >
                          {t('common.cancel')}
                      </button>
                      <button 
                        onClick={() => { onDeleteProduct(confirmDeleteId); setConfirmDeleteId(null); }}
                        className="flex-1 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
                      >
                          {t('common.delete')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ProductList;
