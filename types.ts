
export enum ProductType {
  SIMPLE = 'simple',
  COMPOSITE = 'composite',
}

export enum PriceList {
  B2B = 'B2B',
  CONSUMER = 'Consumer',
}

export interface ProductPrice {
  priceList: PriceList;
  calculatedPrice: number; // Based on dynamic formula
  discount: number | null; // Percentage (0-100), null means unset
  finalPrice: number; // calculatedPrice * (1 - discount/100)
}

export interface BOMComponent {
  componentId: string;
  quantity: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  type: ProductType;
  
  // Costs
  purchaseCost: number; // Editable for Simple, Computed for Composite
  
  // Pricing
  prices: ProductPrice[];
  
  // Composite Logic
  bom?: BOMComponent[];

  // Teamleader Metadata
  teamleaderId?: string;
  lastSync?: string;
  needsSync: boolean;
  
  // Metadata
  lastEdited?: string;
}

export interface Supplier {
  id: string;
  name: string;
  
}

export interface SupplierMapping {
  supplierSku: string;
  internalSku: string;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string; // Only used for saving, not fetching
}

export type LogType = 'info' | 'success' | 'warning' | 'error' | 'sync' | 'import';

export interface LogEntry {
  id: number;
  type: LogType;
  message: string;
  details?: any;
  userId?: string;
  userName?: string;
  createdAt: string;
}

export interface AppSettings {
    priceFormulaB2B: string;
    priceFormulaConsumer: string;
    language: 'en' | 'nl';
}

export interface Category {
  id: string;
  name: string;
  defaultMargin: number;
}
