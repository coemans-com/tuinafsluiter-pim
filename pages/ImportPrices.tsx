
import React, { useState } from 'react';
import { Upload, FileText, Check, ArrowRight, Loader2, Download, Info, LayoutTemplate, Layers, Package, Truck } from 'lucide-react';
import { Supplier, Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface ImportPricesProps {
  suppliers: Supplier[];
  products: Product[];
  onImportComplete: (updates: any[], mode: 'simple' | 'composite') => void;
}

const ImportPrices: React.FC<ImportPricesProps> = ({ suppliers, products, onImportComplete }) => {
  const { t } = useLanguage();
  const [importMode, setImportMode] = useState<'simple' | 'composite' | 'supplier'>('simple'); 
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleDownloadTemplate = () => {
    let rows = [];
    let filename = "";

    if (importMode === 'simple') {
      filename = "products_import_template.csv";
      rows = [
        ['SKU', 'Name', 'Cost', 'B2B Price', 'Consumer Price'],
        ['WING-100', 'Gate Wing 100x100', '59.73', '80.00', '100.00'],
        ['POST-001', 'Standard Post', '66.35', '90.00', '110.00'],
        ['', '', '', '', ''],
        ['Note: You can also upload Teamleader exports directly (ID, Naam, Aankoopprijs, etc.)', '', '', '', '']
      ];
    } else if (importMode === 'composite') {
      filename = "composite_structure_template.csv";
      rows = [
        ['Parent SKU', 'Component SKU', 'Quantity'],
        ['GATE-SET-FULL', 'GATE-WING-LEFT', '1'],
        ['GATE-SET-FULL', 'GATE-WING-RIGHT', '1'],
        ['GATE-SET-FULL', 'GATE-POST', '2'],
        ['GATE-SET-FULL', 'GATE-LOCK', '1'],
      ];
    } else {
      // Supplier Template (Duranet/Alu-wood style)
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      filename = `${supplier?.name || 'supplier'}_import_template.csv`;
      
      if (supplier?.name === 'Duranet' || supplier?.name === 'Alu-wood') {
          rows = [
            ['Artikelnummer', 'Barcode', 'Artikel omschrijving', 'Aantal', 'Eenheid', 'Eenheidsprijs', 'Korting', 'Nettoprijs', 'Internal SKU'],
            ['00000001', '', 'ADMINISTRATIEKOSTEN', '0', 'st', '€ 12,50', '0,00%', '€ 12,50', 'ADM-FEE'],
            ['1000502', '', 'HERCULES', '20', 'm²', '€ 228,00', '25,00%', '€ 171,00', 'NET-HERC-01'],
            ['', '', '', '', '', '', '', '', ''],
            ['Note: Please add the "Internal SKU" column to map these items to your system products.', '', '', '', '', '', '', '', '']
          ];
      } else {
          rows = [
            ['Supplier SKU', 'Description', 'Net Price', 'Internal SKU'],
            ['SUP-001', 'Item Description', '10.50', 'MY-SKU-001'],
          ];
      }
    }

    const csvContent = "data:text/csv;charset=utf-8," 
        + rows.map(e => e.join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper: Parse CSV respecting quotes
  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result.map(c => c.replace(/^"|"$/g, '').trim()); // Clean surrounding quotes
  };

  const cleanPrice = (val: string) => {
      if(!val) return 0;
      const clean = val.replace(/[^0-9.,-]/g, '');
      return parseFloat(clean.replace(',', '.')) || 0;
  };

  const processFile = async (file: File) => {
    return new Promise<any[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        if (lines.length < 2) {
            resolve([]);
            return;
        }

        const headers = parseCSVLine(lines[0]);
        const result = [];

        for(let i = 1; i < lines.length; i++) {
            const currentline = parseCSVLine(lines[i]);
            // Skip empty lines or comment lines starting with # or Note
            if (currentline.length < 2 || currentline[0].startsWith('#') || currentline[0].startsWith('Note')) continue; 

            const obj: any = {};
            headers.forEach((h, idx) => {
                if(idx < currentline.length) {
                    obj[h.trim()] = currentline[idx];
                }
            });
            result.push(obj);
        }
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
        const rawData = await processFile(file);
        let processedData: any[] = [];

        if (importMode === 'simple') {
            processedData = rawData.map(row => {
                const sku = row['ID'] || row['SKU'] || row['sku'] || '';
                const name = row['Naam'] || row['Name'] || row['name'] || '';
                const costStr = row['Aankoopprijs'] || row['Cost'] || row['cost'] || '0';
                const b2bStr = row['B2B'] || row['B2B Price'] || '0';
                const b2cStr = row['Particulier'] || row['Consumer Price'] || '0';

                if (!sku && !name) return null;

                return {
                    status: 'new', 
                    sku: sku,
                    name: name,
                    cost: cleanPrice(costStr),
                    priceB2B: cleanPrice(b2bStr),
                    priceB2C: cleanPrice(b2cStr),
                };
            }).filter(Boolean);

        } else if (importMode === 'composite') { 
             processedData = rawData.map(row => {
                 const parent = row['Parent SKU'] || row['Parent'] || row['parent'];
                 const component = row['Component SKU'] || row['Component'] || row['component'];
                 const qty = row['Quantity'] || row['Qty'] || row['quantity'];

                 if (!parent || !component) return null;

                 return {
                     status: 'new',
                     parentSku: parent,
                     componentSku: component,
                     qty: parseFloat(qty) || 1
                 };
             }).filter(Boolean);
        } else {
             // SUPPLIER IMPORT
             const supplier = suppliers.find(s => s.id === selectedSupplierId);
             
             processedData = rawData.map(row => {
                 let skuToMatch = '';
                 let cost = 0;
                 let itemName = '';
                 let supplierSku = '';

                 // Specific parsing for Duranet/Alu-wood
                 if (supplier?.name === 'Duranet' || supplier?.name === 'Alu-wood') {
                     supplierSku = row['Artikelnummer'];
                     itemName = row['Artikel omschrijving'];
                     cost = cleanPrice(row['Nettoprijs']); // Use Nettoprijs as Cost
                     skuToMatch = row['Internal SKU'] || ''; 
                 } else {
                     // Generic
                     supplierSku = row['Supplier SKU'] || row['id'];
                     itemName = row['Description'] || row['name'];
                     cost = cleanPrice(row['Net Price'] || row['cost'] || row['price']);
                     skuToMatch = row['Internal SKU'] || row['sku'] || '';
                 }

                 if (!skuToMatch && !supplierSku) return null;

                 // Find matching product in system
                 // 1. Try Internal SKU Match
                 let matchedProduct = products.find(p => p.sku === skuToMatch);
                 
                 // 2. Fallback: Try exact match on Supplier SKU (if user uses same SKU)
                 if (!matchedProduct && supplierSku) {
                     matchedProduct = products.find(p => p.sku === supplierSku);
                     if(matchedProduct) skuToMatch = matchedProduct.sku;
                 }

                 let status = 'skip';
                 if (matchedProduct) status = 'update';
                 else if (skuToMatch) status = 'new';
                 
                 return {
                     status: status,
                     sku: skuToMatch || `(Unmapped: ${supplierSku})`,
                     name: matchedProduct ? matchedProduct.name : itemName,
                     cost: cost,
                     oldCost: matchedProduct ? matchedProduct.purchaseCost : 0,
                     supplierSku: supplierSku
                 };
             }).filter(Boolean);
        }

        setPreviewData(processedData);
        setStep(3);
    } catch (error) {
        console.error("Import failed:", error);
        alert("Failed to parse the file. Please ensure it is a valid CSV.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    // If supplier mode, we format the data to look like simple update for the parent handler
    if (importMode === 'supplier') {
        const updates = previewData
            .filter(d => d.status === 'update' || d.status === 'new')
            .map(d => ({
                sku: d.sku,
                cost: d.cost,
                name: d.name
            }));
        // Pass as 'simple' because it's essentially a cost/product update on simple products
        onImportComplete(updates, 'simple');
    } else {
        onImportComplete(previewData, importMode);
    }
    setStep(4);
  };

  const reset = () => {
    setStep(1);
    setFile(null);
    setPreviewData([]);
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('import.title')}</h2>
            <p className="text-slate-500 mt-1">{t('import.subtitle')}</p>
         </div>
       </div>

       {/* Import Mode Toggle */}
       <div className="flex flex-col gap-4">
           <div className="bg-white p-1 rounded-lg border border-slate-200 inline-flex shadow-sm self-start">
             <button 
               onClick={() => { setImportMode('simple'); reset(); }}
               className={`px-4 py-2 text-sm font-medium rounded-md flex items-center transition-colors ${importMode === 'simple' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <Package className="w-4 h-4 mr-2" />
               {t('import.mode.simple')}
             </button>
             <button 
               onClick={() => { setImportMode('composite'); reset(); }}
               className={`px-4 py-2 text-sm font-medium rounded-md flex items-center transition-colors ${importMode === 'composite' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <Layers className="w-4 h-4 mr-2" />
               {t('import.mode.composite')}
             </button>
             <button 
               onClick={() => { setImportMode('supplier'); reset(); }}
               className={`px-4 py-2 text-sm font-medium rounded-md flex items-center transition-colors ${importMode === 'supplier' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               <Truck className="w-4 h-4 mr-2" />
               {t('import.mode.supplier')}
             </button>
           </div>

           {importMode === 'supplier' && (
               <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                   <div className="flex items-center">
                       <label className="mr-3 text-sm font-medium text-slate-700">{t('import.select_supplier')}</label>
                       <select 
                            value={selectedSupplierId}
                            onChange={(e) => setSelectedSupplierId(e.target.value)}
                            className="rounded-md border border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 bg-white text-slate-900 min-w-[200px]"
                       >
                           {suppliers.map(s => (
                               <option key={s.id} value={s.id}>{s.name}</option>
                           ))}
                       </select>
                   </div>
               </div>
           )}
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDE: Visual Guide */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <h3 className="font-bold text-slate-900 flex items-center mb-4">
                 <LayoutTemplate className="w-5 h-5 mr-2 text-blue-600" />
                 {t('import.guide.title')}
               </h3>
               
               {importMode === 'simple' && (
                 <>
                   <p className="text-sm text-slate-600 mb-4">
                     {t('import.guide.desc_simple')}
                   </p>
                   <div className="border border-slate-300 rounded bg-slate-50 overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-200 font-bold text-slate-700">
                          <tr><th className="px-2 py-1">ID / SKU</th><th className="px-2 py-1">Name</th><th className="px-2 py-1">Cost</th></tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white border-b border-slate-100"><td className="px-2 py-1 font-mono">WING-100</td><td className="px-2 py-1">Gate Wing</td><td className="px-2 py-1">59.73</td></tr>
                          <tr className="bg-white"><td className="px-2 py-1 font-mono">POST-001</td><td className="px-2 py-1">Post</td><td className="px-2 py-1">66.35</td></tr>
                        </tbody>
                      </table>
                   </div>
                 </>
               )}

               {importMode === 'composite' && (
                 <>
                   <p className="text-sm text-slate-600 mb-4">
                     {t('import.guide.desc_composite')}
                   </p>
                   <div className="border border-slate-300 rounded bg-slate-50 overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-200 font-bold text-slate-700">
                            <tr><th className="px-2 py-1">Parent</th><th className="px-2 py-1">Component</th><th className="px-2 py-1">Qty</th></tr>
                          </thead>
                          <tbody>
                            <tr className="bg-green-50 text-green-900 border-b border-white">
                              <td className="px-2 py-1 font-mono">GATE-SET</td>
                              <td className="px-2 py-1 font-mono">WING-LEFT</td>
                              <td className="px-2 py-1">1</td>
                            </tr>
                            <tr className="bg-green-50 text-green-900 border-b border-white">
                              <td className="px-2 py-1 font-mono">GATE-SET</td>
                              <td className="px-2 py-1 font-mono">WING-RGHT</td>
                              <td className="px-2 py-1">1</td>
                            </tr>
                          </tbody>
                        </table>
                     </div>
                 </>
               )}

               {importMode === 'supplier' && (
                 <>
                   <p className="text-sm text-slate-600 mb-4">
                     {t('import.guide.desc_supplier')} <strong>{selectedSupplier?.name}</strong>. 
                     {(selectedSupplier?.name === 'Duranet' || selectedSupplier?.name === 'Alu-wood') && (
                         <span className="block mt-2 text-amber-700 font-medium">
                             {t('import.guide.supplier_note')}
                         </span>
                     )}
                   </p>
                   <div className="border border-slate-300 rounded bg-slate-50 overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-200 font-bold text-slate-700">
                          {selectedSupplier?.name === 'Duranet' || selectedSupplier?.name === 'Alu-wood' ? (
                              <tr><th className="px-2 py-1">Artikelnr</th><th className="px-2 py-1">Nettoprijs</th><th className="px-2 py-1 text-blue-700">Internal SKU</th></tr>
                          ) : (
                              <tr><th className="px-2 py-1">Supplier SKU</th><th className="px-2 py-1">Net Price</th><th className="px-2 py-1 text-blue-700">Internal SKU</th></tr>
                          )}
                        </thead>
                        <tbody>
                          {selectedSupplier?.name === 'Duranet' || selectedSupplier?.name === 'Alu-wood' ? (
                            <>
                                <tr className="bg-white border-b border-slate-100"><td className="px-2 py-1 font-mono">1000502</td><td className="px-2 py-1">€ 171,00</td><td className="px-2 py-1 font-mono text-blue-700">NET-HERC</td></tr>
                                <tr className="bg-white"><td className="px-2 py-1 font-mono">1000802</td><td className="px-2 py-1">€ 136,80</td><td className="px-2 py-1 font-mono text-blue-700">NET-HERC-S</td></tr>
                            </>
                          ) : (
                            <tr className="bg-white"><td className="px-2 py-1 font-mono">SUP-001</td><td className="px-2 py-1">10.50</td><td className="px-2 py-1 font-mono text-blue-700">MY-SKU</td></tr>
                          )}
                        </tbody>
                      </table>
                   </div>
                 </>
               )}

               <div className="mt-6">
                 <button 
                    onClick={handleDownloadTemplate}
                    className="w-full bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 py-3 rounded-md text-sm font-medium flex items-center justify-center transition-colors"
                  >
                      <Download className="w-4 h-4 mr-2" /> 
                      {t('import.download_template')}
                  </button>
               </div>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start">
                 <Info className="w-5 h-5 mr-3 text-amber-600 flex-shrink-0 mt-0.5" />
                 <div>
                    <h4 className="text-sm font-bold text-amber-900">{t('import.note.title')}</h4>
                    <p className="text-sm text-amber-800 mt-1">
                        {importMode === 'simple' && t('import.note.simple')}
                        {importMode === 'composite' && t('import.note.composite')}
                        {importMode === 'supplier' && t('import.note.supplier')}
                    </p>
                 </div>
            </div>
          </div>

          {/* RIGHT SIDE: Upload Wizard */}
          <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            
            {/* Steps Indicator */}
            <div className="flex items-center mb-8">
                {[1, 2, 3].map((s) => (
                    <div key={s} className={`flex items-center ${s < 3 ? 'w-full' : ''}`}>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {step > s ? <Check className="w-5 h-5" /> : s}
                    </div>
                    {s < 3 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`} />}
                    </div>
                ))}
            </div>

            {/* STEP 1: Upload */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:bg-slate-50 transition-colors relative">
                  <input 
                    type="file" 
                    accept=".xlsx,.csv" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center">
                    <FileText className="w-12 h-12 text-slate-400 mb-3" />
                    <p className="text-sm font-medium text-slate-900">
                        {file ? file.name : t('import.drop_text')}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Excel (.csv) files only</p>
                  </div>
                </div>

                <button 
                  disabled={!file}
                  onClick={() => setStep(2)}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2 rounded-md font-medium"
                >
                  {t('import.next_verify')}
                </button>
              </div>
            )}

            {/* STEP 2: Map Columns */}
            {step === 2 && (
              <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800">
                    <p>{t('import.detected_columns')}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {importMode === 'simple' && (
                      <>
                        <div className="grid grid-cols-2 gap-4 items-center">
                          <div className="p-3 border border-slate-200 rounded bg-slate-50 text-sm font-medium">SKU / ID</div>
                          <div className="flex items-center text-slate-600"><ArrowRight className="w-4 h-4 mx-2" /><span className="font-bold text-slate-900">Product SKU</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-center">
                          <div className="p-3 border border-slate-200 rounded bg-slate-50 text-sm font-medium">Cost / Aankoopprijs</div>
                          <div className="flex items-center text-slate-600"><ArrowRight className="w-4 h-4 mx-2" /><span className="font-bold text-slate-900">Purchase Cost</span></div>
                        </div>
                      </>
                    )}
                    {importMode === 'composite' && (
                      <>
                        <div className="grid grid-cols-2 gap-4 items-center">
                          <div className="p-3 border border-slate-200 rounded bg-slate-50 text-sm font-medium">Parent SKU</div>
                          <div className="flex items-center text-slate-600"><ArrowRight className="w-4 h-4 mx-2" /><span className="font-bold text-slate-900">Parent ID</span></div>
                        </div>
                         <div className="grid grid-cols-2 gap-4 items-center">
                          <div className="p-3 border border-slate-200 rounded bg-slate-50 text-sm font-medium">Component SKU</div>
                          <div className="flex items-center text-slate-600"><ArrowRight className="w-4 h-4 mx-2" /><span className="font-bold text-slate-900">Child Component</span></div>
                        </div>
                      </>
                    )}
                    {importMode === 'supplier' && (
                        <>
                            {selectedSupplier?.name === 'Duranet' || selectedSupplier?.name === 'Alu-wood' ? (
                                <>
                                    <div className="grid grid-cols-2 gap-4 items-center">
                                        <div className="p-3 border border-slate-200 rounded bg-slate-50 text-sm font-medium">Artikelnummer</div>
                                        <div className="flex items-center text-slate-600"><ArrowRight className="w-4 h-4 mx-2" /><span className="font-bold text-slate-900">Supplier Ref</span></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 items-center">
                                        <div className="p-3 border border-slate-200 rounded bg-slate-50 text-sm font-medium">Nettoprijs</div>
                                        <div className="flex items-center text-slate-600"><ArrowRight className="w-4 h-4 mx-2" /><span className="font-bold text-slate-900">Cost Price</span></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 items-center">
                                        <div className="p-3 border border-slate-200 rounded bg-slate-50 text-sm font-medium text-blue-700">Internal SKU</div>
                                        <div className="flex items-center text-slate-600"><ArrowRight className="w-4 h-4 mx-2" /><span className="font-bold text-blue-700">System SKU Match</span></div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4 items-center">
                                        <div className="p-3 border border-slate-200 rounded bg-slate-50 text-sm font-medium">Net Price</div>
                                        <div className="flex items-center text-slate-600"><ArrowRight className="w-4 h-4 mx-2" /><span className="font-bold text-slate-900">Cost Price</span></div>
                                    </div>
                                     <div className="grid grid-cols-2 gap-4 items-center">
                                        <div className="p-3 border border-slate-200 rounded bg-slate-50 text-sm font-medium">Internal SKU</div>
                                        <div className="flex items-center text-slate-600"><ArrowRight className="w-4 h-4 mx-2" /><span className="font-bold text-slate-900">System SKU Match</span></div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                  </div>

                  <button 
                  onClick={handleProcess}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium flex justify-center items-center"
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : t('import.btn_process')}
                </button>
              </div>
            )}

            {/* STEP 3: Preview */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="font-bold text-lg">{t('import.preview_title')} ({previewData.length} rows)</h3>
                <div className="overflow-hidden border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Item</th>
                        {importMode === 'simple' ? (
                            <>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Cost</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Price (B2C)</th>
                            </>
                        ) : importMode === 'supplier' ? (
                            <>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Supplier Ref</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">New Cost</th>
                            </>
                        ) : (
                            <>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Component</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Qty</th>
                            </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {previewData.slice(0, 100).map((row, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">
                             {row.status === 'skip' ? (
                                 <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Skipped</span>
                             ) : (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${row.status === 'new' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                    {row.status === 'update' ? 'Update' : 'New'}
                                </span>
                             )}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {importMode === 'simple' || importMode === 'supplier' ? (
                                <>
                                    <div className="font-medium">{row.sku}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[150px]">{row.name}</div>
                                </>
                            ) : (
                                <>
                                    <div className="font-medium">{row.parentSku}</div>
                                </>
                            )}
                          </td>
                          {importMode === 'simple' ? (
                            <>
                                <td className="px-4 py-2 text-sm text-slate-700">€{Number(row.cost).toFixed(2)}</td>
                                <td className="px-4 py-2 text-right text-sm font-bold text-slate-900">€{Number(row.priceB2C).toFixed(2)}</td>
                            </>
                          ) : importMode === 'supplier' ? (
                             <>
                                <td className="px-4 py-2 text-sm font-mono text-slate-500">{row.supplierSku}</td>
                                <td className="px-4 py-2 text-right text-sm font-bold text-slate-900">
                                    <div className={row.oldCost !== row.cost ? 'text-blue-600' : ''}>€{Number(row.cost).toFixed(2)}</div>
                                    {row.status === 'update' && row.oldCost !== row.cost && (
                                        <div className="text-xs text-slate-400 line-through">€{Number(row.oldCost).toFixed(2)}</div>
                                    )}
                                </td>
                             </>
                          ) : (
                             <>
                                <td className="px-4 py-2 text-sm font-mono text-slate-700">{row.componentSku}</td>
                                <td className="px-4 py-2 text-right text-sm font-bold text-slate-900">{row.qty}</td>
                             </>
                          )}
                        </tr>
                      ))}
                      {previewData.length > 100 && (
                          <tr><td colSpan={4} className="px-4 py-2 text-center text-xs text-slate-500">...and {previewData.length - 100} more rows</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end space-x-3">
                  <button onClick={() => setStep(1)} className="text-slate-600 hover:text-slate-900 px-4 py-2">{t('common.cancel')}</button>
                  <button 
                    onClick={handleConfirm} 
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium"
                    disabled={previewData.filter(x => x.status !== 'skip').length === 0}
                  >
                    {importMode === 'simple' ? t('import.btn_import') : importMode === 'supplier' ? t('import.btn_update') : t('import.btn_import_bom')}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Success */}
            {step === 4 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{t('import.success_title')}</h3>
                <p className="text-slate-500 mt-2">
                    {t('import.success_desc')}
                </p>
                <button onClick={() => reset()} className="mt-6 text-blue-600 hover:text-blue-800 font-medium">{t('import.import_another')}</button>
              </div>
            )}
          </div>
       </div>
    </div>
  );
};

export default ImportPrices;
