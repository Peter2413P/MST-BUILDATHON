import type { Currency, RetailerOffer, ProductReviewData } from '../types';

export interface RawProduct {
  productId: string;
  sku?: string;
  model?: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  currency: Currency;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  positiveThemes?: string[];
  negativeThemes?: string[];
  availability: 'in_stock' | 'out_of_stock' | 'limited_stock';
  specifications: Record<string, string | number | boolean>;
  imageUrl: string;
  sourceUrl: string;
  retailer: string;
  source: string;
  retrievedAt: string;
}

export interface ProviderSearchParams {
  query: string;
  category?: string;
  brand?: string;
  maxPrice?: number;
  minPrice?: number;
  currency?: Currency;
  limit?: number;
}

export interface ProviderSearchResult {
  providerName: string;
  success: boolean;
  products: RawProduct[];
  error?: string;
  executionTimeMs: number;
}

export interface ProductProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  searchProducts(params: ProviderSearchParams): Promise<ProviderSearchResult>;
  getProductDetails(productId: string): Promise<RawProduct | null>;
  getProductReviews(productId: string): Promise<ProductReviewData | null>;
  getAvailability(productId: string): Promise<'in_stock' | 'out_of_stock' | 'limited_stock'>;
}
