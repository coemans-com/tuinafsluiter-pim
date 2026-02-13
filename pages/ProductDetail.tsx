
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Trash2, Search, Percent, AlertTriangle, AlertCircle, Package, Plus, RefreshCw } from 'lucide-react';
import { Product, ProductType, PriceList, BOMComponent, AppSettings } from '../types';
import { calculatePriceFromFormula } from '../utils/pricing';
import { validateProduct } from '../utils/validation';
import { useLanguage } from '../contexts/LanguageContext';

interface ProductDetailProps {
  product: Product | null; 
  allProducts: Product[];
  onSave: (p: Product) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  appSettings: AppSettings;
  onSync: (product: Product) => void;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ product: initialProduct, allProducts, onSave, onDelete, onBack, appSettings, onSync }) => {
  const { t } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  
  const [newSearchTerm, setNewSearchTerm] = useState('');
  const [newQuantity, setNewQuantity] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (initialProduct) {
      setProduct(JSON.parse(JSON.stringify(initialProduct)));
    } else {
      // Logic for new product: Check localStorage for previously used margins & type
      const getSavedMargin = (key: string): number | null => {
          const val = localStorage.getItem(key);
          if (val === null) return null;
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
      };

      const savedType = localStorage.getItem('last_product_type');
      const initialType = (savedType === ProductType.SIMPLE || savedType === ProductType.COMPOSITE) 
                          ? savedType as ProductType 
                          : ProductType.SIMPLE;

      setProduct({
        id: `new_${Date.now()}`,
        sku: '',
        name: '',
        type: initialType,
        purchaseCost: 0,
        needsSync: true,
        bom: initialType === ProductType.COMPOSITE ? [] : undefined,
        prices: [
          { 
            priceList: PriceList.B2B, 
            calculatedPrice: 0, 
            discount: getSavedMargin(`last_margin_${PriceList.B2B}`), 
            finalPrice: 0 
          },
          { 
            priceList: PriceList.CONSUMER, 
            calculatedPrice: 0, 
            discount: getSavedMargin(`last_margin_${PriceList.CONSUMER}`), 
            finalPrice: 0 
          },
        ]
      });
    }
  }, [initialProduct]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!product) return <div>{t('common.loading')}</div>;

  const calculateCostsAndPrices = (p: Product): Product => {
    let cost = p.purchaseCost;

    if (p.type === ProductType.COMPOSITE && p.bom) {
      cost = p.bom.reduce((sum, item) => {
        const component = allProducts.find(prod => prod.id === item.componentId);
        return sum + (component ? component.purchaseCost * item.quantity : 0);
      }, 0);
    }

    const newPrices = p.prices.map(price => {
      const formula = price.priceList === PriceList.CONSUMER ? appSettings.priceFormulaConsumer : appSettings.priceFormulaB2B;
      const margin = price.discount;
      const calculated = calculatePriceFromFormula(cost, margin, formula);
      const final = calculated;
      return { ...price, calculatedPrice: calculated, finalPrice: final };
    });

    return { ...p, purchaseCost: cost, prices: newPrices };
  };

  const updateProduct = (updater: (prev: Product) => Product) => {
    setProduct(prev => {
      if (!prev) return null;
      const updated = updater(prev);
      return calculateCostsAndPrices(updated);
    });
  };

  const handleAddComponent = (component: Product) => {
      updateProduct(p => {
          const qtyToAdd = newQuantity <= 0 ? 1 : newQuantity; 
          return {
              ...p,
              bom: [...(p.bom || []), { componentId: component.id, quantity: qtyToAdd }]
          };
      });
      setNewSearchTerm('');
      setNewQuantity(0);
      setShowSuggestions(false);
      if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleBOMUpdate = (index: number, quantity: number) => {
    updateProduct(p => {
      const newBOM = [...(p.bom || [])];
      newBOM[index].quantity = quantity;
      return { ...p, bom: newBOM };
    });
  };

  const handleBOMRemove = (index: number) => {
    updateProduct(p => {
      const newBOM = [...(p.bom || [])];
      newBOM.splice(index, 1);
      return { ...p, bom: newBOM };
    });
  };

  const handleSaveInternal = () => {
    if (!product) return;
    
    // Save used margins to localStorage for next time
    product.prices.forEach(p => {
        if (p.discount !== null && p.discount !== undefined) {
             localStorage.setItem(`last_margin_${p.priceList}`, p.discount.toString());
        }
    });

    // Save used type
    localStorage.setItem('last_product_type', product.type);

    onSave(product);
  };

  const isNew = !initialProduct;
  const validation = validateProduct(product, allProducts);
  const isDuplicateSku = validation.error === 'SKU must be unique';

  const availableProducts = allProducts.filter(p => 
      p.type === ProductType.SIMPLE && 
      p.id !== product.id && 
      !product.bom?.some(b => b.componentId === p.id)
  );

  const filteredSuggestions = availableProducts.filter(p => 
      p.sku.toLowerCase().includes(newSearchTerm.toLowerCase()) || 
      p.name.toLowerCase().includes(newSearchTerm.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 relative">
      {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-6 text-center">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{t('prod.delete.title')}</h3>
                      <p className="text-sm text-slate-500">
                          {t('prod.delete.confirm')} <span className="font-bold text-slate-900">{product.sku}</span>? 
                          <br />
                          <span className="text-xs text-amber-600 font-medium mt-2 block">
                            {t('prod.delete.note')}
                          </span>
                      </p>
                  </div>
                  <div className="flex border-t border-slate-200">
                      <button 
                        onClick={() => setIsDeleteModalOpen(false)}
                        className="flex-1 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 border-r border-slate-200"
                      >
                          {t('common.cancel')}
                      </button>
                      <button 
                        onClick={() => { onDelete(product.id); setIsDeleteModalOpen(false); }}
                        className="flex-1 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
                      >
                          {t('common.delete')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-900 font-medium">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('detail.back')}
        </button>
        <div className="flex items-center gap-3">
          {product.needsSync && validation.isValid && !isNew && (
            <button
               onClick={() => onSync(product)}
               className="text-blue-600 hover:bg-blue-50 border border-blue-200 px-3 py-2 rounded-md font-medium flex items-center transition-colors"
               title="Sync to Teamleader"
            >
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync
            </button>
          )}

          {!isNew && (
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-md font-medium flex items-center transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('common.delete')}
            </button>
          )}
          <button 
            onClick={handleSaveInternal}
            disabled={isDuplicateSku}
            title={isDuplicateSku ? "Fix duplicate SKU to save" : ""}
            className={`text-white px-6 py-2 rounded-md font-medium shadow-sm flex items-center transition-colors ${isDuplicateSku ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <Save className="w-4 h-4 mr-2" />
            {isNew ? t('detail.save_create') : t('detail.save_changes')}
          </button>
        </div>
      </div>
      
      {!validation.isValid && (
          <div className={`border rounded-lg p-4 flex items-start ${isDuplicateSku ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
             <AlertCircle className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${isDuplicateSku ? 'text-red-600' : 'text-amber-600'}`} />
             <div>
                 <h3 className={`text-sm font-bold ${isDuplicateSku ? 'text-red-900' : 'text-amber-900'}`}>
                     {isDuplicateSku ? 'Validation Error' : t('detail.incomplete_title')}
                 </h3>
                 <p className={`text-sm mt-1 ${isDuplicateSku ? 'text-red-800' : 'text-amber-800'}`}>
                     {isDuplicateSku ? 'This SKU is already taken by another product.' : t('detail.incomplete_desc')} <strong>{validation.error}</strong>.
                 </p>
             </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{t('detail.details_title')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">{t('common.sku')}</label>
                <input 
                  type="text" 
                  value={product.sku} 
                  onChange={(e) => updateProduct(p => ({ ...p, sku: e.target.value }))}
                  className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 bg-white text-slate-900 ${isDuplicateSku ? 'border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500' : 'border border-slate-300 focus:border-blue-500 focus:ring-blue-500'}`}
                />
                {isDuplicateSku && <p className="text-xs text-red-600 mt-1 font-medium">SKU already exists</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">{t('common.name')}</label>
                <input 
                  type="text" 
                  value={product.name} 
                  onChange={(e) => updateProduct(p => ({ ...p, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white text-slate-900"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">{t('detail.type')}</label>
                <select 
                  value={product.type} 
                  onChange={(e) => updateProduct(p => ({ ...p, type: e.target.value as ProductType, bom: e.target.value === ProductType.COMPOSITE ? [] : undefined }))}
                  className="mt-1 block w-full rounded-md border border-slate-300 shadow-sm focus:ring-blue-500 sm:text-sm p-2 bg-white text-slate-900"
                >
                  <option value={ProductType.SIMPLE}>{t('detail.type.simple')}</option>
                  <option value={ProductType.COMPOSITE}>{t('detail.type.composite')}</option>
                </select>
              </div>
            </div>
          </div>

          {product.type === ProductType.COMPOSITE && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-visible min-h-[400px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">{t('detail.bom_title')}</h3>
              </div>
              <div className="overflow-visible border border-slate-200 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase w-1/2">{t('detail.bom.component')}</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">{t('detail.bom.qty')}</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">{t('detail.bom.unit_cost')}</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">{t('detail.bom.total')}</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {product.bom?.map((item, idx) => {
                      const comp = allProducts.find(p => p.id === item.componentId);
                      if(!comp) return null;
                      return (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-slate-900">
                              <div className="font-medium">{comp.sku}</div>
                              <div className="text-xs text-slate-500">{comp.name}</div>
                          </td>
                          <td className="px-4 py-2 text-sm text-right">
                             <input type="number" min="1" value={item.quantity} onChange={(e) => handleBOMUpdate(idx, parseInt(e.target.value) || 0)} className="w-16 border rounded p-1 text-right bg-white text-slate-900" />
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-slate-500">€{comp.purchaseCost.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-slate-900">€{(comp.purchaseCost * item.quantity).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">
                            <button onClick={() => handleBOMRemove(idx)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    <tr className="bg-blue-50/50">
                        <td className="px-4 py-2 relative">
                            <div className="relative" ref={searchInputRef}>
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder={t('detail.bom.add_placeholder')}
                                    className="w-full pl-8 pr-2 py-1.5 border border-slate-300 shadow-sm rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900"
                                    value={newSearchTerm}
                                    onChange={(e) => {
                                        setNewSearchTerm(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                />
                                {showSuggestions && newSearchTerm && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-md shadow-lg border border-slate-200 z-50 max-h-60 overflow-y-auto">
                                        {filteredSuggestions.length > 0 ? (
                                            filteredSuggestions.map(suggestion => (
                                                <div 
                                                    key={suggestion.id}
                                                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault(); 
                                                        handleAddComponent(suggestion);
                                                    }}
                                                >
                                                    <div className="font-bold text-sm text-slate-900">{suggestion.sku}</div>
                                                    <div className="text-xs text-slate-500 truncate">{suggestion.name}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-2 text-xs text-slate-400 italic">{t('prod.no_products')}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                            <input 
                                type="number" 
                                min="0" 
                                value={newQuantity} 
                                onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)} 
                                className="w-16 border border-slate-300 shadow-sm rounded p-1.5 text-right bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-slate-400">-</td>
                        <td className="px-4 py-2 text-right text-sm text-slate-400">-</td>
                        <td className="px-4 py-2 text-center">
                            <div className="w-8 h-8 flex items-center justify-center text-slate-300">
                                <Plus className="w-4 h-4" />
                            </div>
                        </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right text-sm font-bold text-slate-900">{t('detail.bom.total_cost')}</td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-slate-900">€{product.purchaseCost.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <h3 className="text-lg font-bold text-slate-900 mb-4">{t('detail.pricing_title')}</h3>
             <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
               <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t('detail.purchase_cost')}</label>
               {product.type === ProductType.SIMPLE ? (
                 <div className="relative rounded-md shadow-sm">
                   <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                     <span className="text-slate-500 sm:text-sm">€</span>
                   </div>
                   <input type="number" step="0.01" value={product.purchaseCost} onChange={(e) => updateProduct(p => ({ ...p, purchaseCost: parseFloat(e.target.value) || 0 }))} className="block w-full rounded-md border-slate-300 pl-7 pr-12 focus:ring-blue-500 sm:text-lg font-mono border p-2 bg-white text-slate-900 shadow-sm" />
                 </div>
               ) : (
                 <div className="text-2xl font-mono font-bold text-slate-900">€{product.purchaseCost.toFixed(2)}</div>
               )}
               <p className="text-xs text-slate-500 mt-2">{product.type === ProductType.SIMPLE ? t('detail.cost_editable') : t('detail.cost_calculated')}</p>
             </div>

             <hr className="border-slate-200 my-4" />
             {product.prices.map((price, idx) => {
                const currentFormula = price.priceList === PriceList.CONSUMER ? appSettings.priceFormulaConsumer : appSettings.priceFormulaB2B;
                
                return (
                <div key={price.priceList} className="mb-6 last:mb-0">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-bold text-slate-800">{price.priceList} {t('detail.price')}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded text-white ${price.priceList === PriceList.B2B ? 'bg-blue-600' : 'bg-purple-600'}`}>
                        {price.priceList} {t('detail.formula')}
                    </span>
                  </div>
                  
                  <div className="bg-slate-50 p-2 rounded text-xs text-slate-500 border border-slate-200 font-mono mb-2 break-all">
                      {currentFormula}
                  </div>
                  
                  <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t('detail.margin_pct')}</label>
                      <div className="relative rounded-md shadow-sm">
                        <input 
                          type="number" 
                          step="1" 
                          min="0"
                          max="100"
                          value={price.discount ?? ''} 
                          onChange={(e) => updateProduct(p => {
                            const newPrices = [...p.prices];
                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                            newPrices[idx].discount = val;
                            return { ...p, prices: newPrices };
                          })} 
                          placeholder="Empty"
                          className="block w-full rounded-md border-slate-300 pr-8 focus:ring-blue-500 sm:text-sm font-mono border p-2 bg-white text-slate-900 shadow-sm" 
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                          <Percent className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-100 rounded text-slate-900 font-bold">
                    <span>{t('detail.final_price')}</span>
                    <span className="font-mono text-lg text-blue-700">€{price.finalPrice.toFixed(2)}</span>
                  </div>
                </div>
             )})}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
