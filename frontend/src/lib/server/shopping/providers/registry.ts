import type { ProductProvider, ProviderSearchParams, RawProduct } from './types';
import { RealCatalogProvider } from './real-catalog-provider';
import { ExternalApiProductProvider } from './api-provider';

export interface MultiProviderDiscoveryResult {
  products: RawProduct[];
  connectedProviders: string[];
  failedProviders: string[];
  totalDiscovered: number;
}

export class ProviderRegistry {
  private providers: Map<string, ProductProvider> = new Map();

  constructor() {
    this.registerProvider(new RealCatalogProvider());
    this.registerProvider(new ExternalApiProductProvider());
  }

  registerProvider(provider: ProductProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): ProductProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): ProductProvider[] {
    return Array.from(this.providers.values());
  }

  async discoverProducts(params: ProviderSearchParams): Promise<MultiProviderDiscoveryResult> {
    const connectedProviders: string[] = [];
    const failedProviders: string[] = [];
    const allProducts: RawProduct[] = [];

    const providerPromises = Array.from(this.providers.values()).map(async provider => {
      try {
        const available = await provider.isAvailable();
        if (!available) {
          // If external provider is not configured, don't flag as an unexpected failure, just skip
          return;
        }

        connectedProviders.push(provider.name);
        const result = await provider.searchProducts(params);

        if (result.success && result.products.length > 0) {
          allProducts.push(...result.products);
        } else if (!result.success) {
          failedProviders.push(`${provider.name}: ${result.error || 'Unavailable'}`);
        }
      } catch (err) {
        failedProviders.push(`${provider.name}: ${(err as Error).message}`);
      }
    });

    await Promise.all(providerPromises);

    return {
      products: allProducts,
      connectedProviders,
      failedProviders,
      totalDiscovered: allProducts.length,
    };
  }
}

let defaultRegistryInstance: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!defaultRegistryInstance) {
    defaultRegistryInstance = new ProviderRegistry();
  }
  return defaultRegistryInstance;
}
