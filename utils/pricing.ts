
export const DEFAULT_FORMULA_B2B = 'cost * 1.25 * 1.05 / 0.98';
export const DEFAULT_FORMULA_CONSUMER = 'cost * 1.25';

export const calculatePriceFromFormula = (cost: number, discount: number | null, formula: string): number => {
    if (!formula || typeof formula !== 'string') return 0;
    
    try {
        let sanitizedFormula = formula.toLowerCase();
        
        // Treat null discount as 0 for calculation purposes
        const safeDiscount = discount ?? 0;
        
        // --- 1. Variable Pre-Calculation ---
        // Discount = 25
        // Markup = 1.25 (1 + 25/100)
        // Discount Factor = 0.75 (1 - 25/100)
        
        const markupVal = 1 + (safeDiscount / 100);
        const discountFactorVal = 1 - (safeDiscount / 100);

        // --- 2. Replace Variables ---
        
        // Replace 'markup' with 1.25
        sanitizedFormula = sanitizedFormula.replace(/markup/g, markupVal.toString());
        
        // Replace 'discount_factor' with 0.75
        sanitizedFormula = sanitizedFormula.replace(/discount_factor/g, discountFactorVal.toString());

        // Replace 'cost' with value
        sanitizedFormula = sanitizedFormula.replace(/cost/g, cost.toString());
        
        // Replace 'discount' with raw value (e.g. 25)
        // Note: We do this last to avoid partial matches if possible, though regex above handles it.
        sanitizedFormula = sanitizedFormula.replace(/discount/g, safeDiscount.toString());
        
        // --- 3. Replace Operators ---
        // Replace '%' with '/100' to support "25%" -> "0.25" syntax
        sanitizedFormula = sanitizedFormula.replace(/%/g, '/100');
        
        // Remove unsafe chars. Allowed: 0-9, ., +, -, *, /, (, ), and whitespace.
        // Using explicit regex for safety.
        sanitizedFormula = sanitizedFormula.replace(/[^0-9.+\-*/()\s]/g, '');

        if (!sanitizedFormula.trim()) return 0;

        // --- 4. Evaluate ---
        // Use new Function to evaluate the mathematical expression
        const result = new Function(`return (${sanitizedFormula})`)();
        return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch (e) {
        console.error("Formula evaluation failed for:", formula, e);
        return 0;
    }
};
