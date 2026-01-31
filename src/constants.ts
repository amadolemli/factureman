
import { BusinessInfo, Product } from './types';

export const DEFAULT_BUSINESS: BusinessInfo = {
  name: 'MA QUINCAILLERIE PRO',
  specialty: 'Matériaux de Construction - Outillage - Peinture',
  address: 'Sébénikoro, Route de Guinée, Bamako',
  phone: '+223 70 00 00 00',
  city: 'Bamako'
};

export const PRODUCT_CATALOG: Product[] = [
  { id: 'p1', name: 'Ciment CPJ 35 (Sac 50kg)', defaultPrice: 5000, stock: 150, category: 'Matériaux' },
  { id: 'p2', name: 'Fer de 10 (Barre 12m)', defaultPrice: 4500, stock: 80, category: 'Matériaux' },
  { id: 'p3', name: 'Fer de 8 (Barre 12m)', defaultPrice: 3200, stock: 120, category: 'Matériaux' },
  { id: 'p4', name: 'Peinture Astral Blanche (20L)', defaultPrice: 25000, stock: 25, category: 'Peinture' },
  { id: 'p5', name: 'Pinceau Plat 50mm', defaultPrice: 750, stock: 45, category: 'Outillage' },
  { id: 'p6', name: 'Robinet à boisseau 1/2', defaultPrice: 1500, stock: 30, category: 'Plomberie' },
  { id: 'p7', name: 'Tuyau PVC 100 (4m)', defaultPrice: 6500, stock: 15, category: 'Plomberie' },
  { id: 'p8', name: 'Cadenas 50mm Haute Sécurité', defaultPrice: 2500, stock: 12, category: 'Quincaillerie' },
  { id: 'p9', name: 'Pointes de 7 (Kilo)', defaultPrice: 1000, stock: 100, category: 'Quincaillerie' },
  { id: 'p10', name: 'Brouette standard', defaultPrice: 22000, stock: 8, category: 'Matériaux' }
];

export const COLORS = {
  primary: '#1e40af',
  secondary: '#1d4ed8',
  accent: '#fde047'
};
