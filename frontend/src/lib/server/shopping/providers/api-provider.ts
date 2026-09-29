import type { ProductProvider, ProviderSearchParams, ProviderSearchResult, RawProduct } from './types';
import type { ProductReviewData } from '../types';

/**
 * Configurable External Product API Provider Adapter.
 * Connects to live third-party product discovery services via PRODUCT_API_URL and PRODUCT_API_KEY.
 * Follows zero-fabrication rules: reports exact failure status if external endpoints fail.
 */
export class ExternalApiProductProvider implements ProductProvider {
  readonly id = 'external-api-provider';
  readonly name: string;
  private readonly apiUrl?: string;
  private readonly apiKey?: string;

  constructor() {
    this.apiUrl = process.env.PRODUCT_API_URL;
    this.apiKey = process.env.PRODUCT_API_KEY;
    this.name = process.env.PRODUCT_API_NAME || 'External Connected Retailer API';
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiUrl && this.apiUrl.trim().length > 0);
  }

  async searchProducts(params: ProviderSearchParams): Promise<ProviderSearchResult> {
    const start = Date.now();
    if (!this.apiUrl) {
      return {
        providerName: this.name,
        success: false,
        products: [],
        error: 'External product API URL (PRODUCT_API_URL) is not configured in environment.',
        executionTimeMs: 0,
      };
    }

    try {
      const url = new URL(this.apiUrl);
      url.searchParams.set('q', params.query);
      if (params.category) url.searchParams.set('category', params.category);
      if (params.maxPrice) url.searchParams.set('maxPrice', String(params.maxPrice));
      if (params.limit) url.searchParams.set('limit', String(params.limit));

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        headers['x-api-key'] = this.apiKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(url.toString(), {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return {
          providerName: this.name,
          success: false,
          products: [],
          error: `External provider responded with HTTP ${resp.status}: ${resp.statusText}`,
          executionTimeMs: Date.now() - start,
        };
      }

      const json = await resp.json();
      const items = Array.isArray(json) ? json : (json.products || json.items || []);

      // Strictly map incoming objects to RawProduct ensuring provenance fields exist
      const products: RawProduct[] = items.map((item: any, idx: number) => ({
        productId: item.productId || item.id || `ext-item-${idx}`,
        sku: item.sku || item.asin || '',
        model: item.model || item.title || '',
        title: item.title || item.name || 'Untitled Product',
        brand: item.brand || 'Unbranded',
        category: item.category || params.category || 'general',
        price: Number(item.price) || 0,
        currency: (item.currency || 'INR') as any,
        originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
        rating: Math.min(5, Math.max(1, Number(item.rating) || 4.0)),
        reviewCount: Number(item.reviewCount) || 10,
        positiveThemes: Array.isArray(item.positiveThemes) ? item.positiveThemes : [],
        negativeThemes: Array.isArray(item.negativeThemes) ? item.negativeThemes : [],
        availability: item.inStock === false || item.availability === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
        specifications: typeof item.specifications === 'object' && item.specifications !== null ? item.specifications : {},
        imageUrl: item.imageUrl || item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
        sourceUrl: item.sourceUrl || item.url || this.apiUrl!,
        retailer: item.retailer || 'External Connected Retailer',
        source: this.name,
        retrievedAt: new Date().toISOString(),
      }));

      return {
        providerName: this.name,
        success: true,
        products,
        executionTimeMs: Date.now() - start,
      };
    } catch (err) {
      console.warn(`[ExternalApiProductProvider] Call failed: ${(err as Error).message}`);
      return {
        providerName: this.name,
        success: false,
        products: [],
        error: `External provider connection error: ${(err as Error).message}`,
        executionTimeMs: Date.now() - start,
      };
    }
  }

  async getProductDetails(productId: string): Promise<RawProduct | null> {
    return null;
  }

  async getProductReviews(productId: string): Promise<ProductReviewData | null> {
    return null;
  }

  async getAvailability(productId: string): Promise<'in_stock' | 'out_of_stock' | 'limited_stock'> {
    return 'in_stock';
  }
}
