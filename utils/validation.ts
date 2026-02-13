
import { Product, ProductType } from '../types';

export const validateProduct = (product: Product, allProducts: Product[]): { isValid: boolean; error: string | null } => {
    // 1. Basic Fields
    if (!product.sku || !product.sku.trim()) return { isValid: false, error: 'Missing SKU' };
    
    // Check for duplicate SKU (case-insensitive)
    const duplicate = allProducts.find(p => p.sku.toLowerCase() === product.sku.trim().toLowerCase() && p.id !== product.id);
    if (duplicate) return { isValid: false, error: 'SKU must be unique' };

    if (!product.name || !product.name.trim()) return { isValid: false, error: 'Missing Name' };

    // 2. Simple Product Rules
    if (product.type === ProductType.SIMPLE) {
        if (product.purchaseCost <= 0) return { isValid: false, error: 'Purchase cost must be greater than 0' };
    } 
    
    // 3. Composite Product Rules
    if (product.type === ProductType.COMPOSITE) {
        if (!product.bom || product.bom.length === 0) return { isValid: false, error: 'No components added' };
        
        for (const item of product.bom) {
            const comp = allProducts.find(p => p.id === item.componentId);
            
            // Component must exist
            if (!comp) return { isValid: false, error: `Component (ID: ${item.componentId}) not found` };
            
            // Component must have valid cost (Recursive check essentially, based on user requirement)
            if (comp.purchaseCost <= 0) return { isValid: false, error: `Component '${comp.sku}' has 0 cost` };
        }
    }

    // 4. Pricing Rules (Margins must be set)
    for (const price of product.prices) {
        if (price.discount === null || price.discount === undefined) {
            return { isValid: false, error: `Margin not set for ${price.priceList}` };
        }
    }

    return { isValid: true, error: null };
};
