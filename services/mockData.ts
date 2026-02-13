
import { Product, ProductType, PriceList, Supplier } from '../types';

export const MOCK_SUPPLIERS: Supplier[] = [
  { id: 'sup_duranet', name: 'Duranet' },
  { id: 'sup_aluwood', name: 'Alu-wood' },
  { id: 'sup_locinox', name: 'Locinox' },
  { id: 'sup_other', name: 'Generic Supplier' },
];

// Initial Products (Simple components for a gate)
const p1: Product = {
  id: 'p_1',
  sku: 'WING-BLK-200',
  name: 'Gate Wing (Black, 200cm)',
  type: ProductType.SIMPLE,
  purchaseCost: 150.00,
  needsSync: false,
  teamleaderId: 'tl_123',
  prices: [
    { priceList: PriceList.B2B, calculatedPrice: 0, discount: 0, finalPrice: 0 },
    { priceList: PriceList.CONSUMER, calculatedPrice: 0, discount: 0, finalPrice: 0 },
  ]
};

const p2: Product = {
  id: 'p_2',
  sku: 'POST-STD',
  name: 'Standard Gate Post',
  type: ProductType.SIMPLE,
  purchaseCost: 40.00,
  needsSync: false,
  teamleaderId: 'tl_124',
  prices: [
    { priceList: PriceList.B2B, calculatedPrice: 0, discount: 0, finalPrice: 0 },
    { priceList: PriceList.CONSUMER, calculatedPrice: 0, discount: 0, finalPrice: 0 },
  ]
};

const p3: Product = {
  id: 'p_3',
  sku: 'LOCK-MECH',
  name: 'Heavy Duty Lock',
  type: ProductType.SIMPLE,
  purchaseCost: 25.00,
  needsSync: true,
  prices: [
    { priceList: PriceList.B2B, calculatedPrice: 0, discount: 0, finalPrice: 0 },
    { priceList: PriceList.CONSUMER, calculatedPrice: 0, discount: 0, finalPrice: 0 },
  ]
};

// Composite Product (Gate Assembly)
const p4: Product = {
  id: 'p_4',
  sku: 'GATE-SET-BLK',
  name: 'Full Gate Set (Black)',
  type: ProductType.COMPOSITE,
  purchaseCost: 0, // Will be calculated
  needsSync: true,
  bom: [
    { componentId: 'p_1', quantity: 2 }, // 2 Wings
    { componentId: 'p_2', quantity: 2 }, // 2 Posts
    { componentId: 'p_3', quantity: 1 }, // 1 Lock
  ],
  prices: [
    { priceList: PriceList.B2B, calculatedPrice: 0, discount: 0, finalPrice: 0 },
    { priceList: PriceList.CONSUMER, calculatedPrice: 0, discount: 10, finalPrice: 0 }, // 10% Discount
  ]
};

export const INITIAL_PRODUCTS = [p1, p2, p3, p4];
