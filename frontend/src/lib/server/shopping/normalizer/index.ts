import type { RawProduct } from '../providers/types';
import type { CanonicalProduct, RetailerOffer, ProductReviewData } from '../types';

/**
 * Normalizes a raw product from any provider into the canonical product schema.
 */
export function normalizeProduct(raw: RawProduct): CanonicalProduct {
  const initialOffer: RetailerOffer = {
    retailer: raw.retailer,
    price: raw.price,
    currency: raw.currency,
    originalPrice: raw.originalPrice,
    discountPct: raw.originalPrice && raw.originalPrice > raw.price
      ? Math.round(((raw.originalPrice - raw.price) / raw.originalPrice) * 100)
      : undefined,
    availability: raw.availability,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    retrievedAt: raw.retrievedAt,
  };

  const reviewData: ProductReviewData = {
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    positiveThemes: raw.positiveThemes || [],
    negativeThemes: raw.negativeThemes || [],
    sentimentScore: raw.rating >= 4.5 ? 0.85 : raw.rating >= 4.0 ? 0.65 : 0.35,
    reviewReliabilityScore: Math.min(100, Math.round(50 + Math.log10(Math.max(1, raw.reviewCount)) * 12)),
    retrievedAt: raw.retrievedAt,
  };

  // Canonical unique ID derived from brand and model/sku
  const normalizedId = `${raw.brand.toLowerCase()}-${(raw.sku || raw.model || raw.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)}`;

  return {
    id: normalizedId,
    sku: raw.sku || '',
    model: raw.model || raw.title,
    title: raw.title,
    brand: raw.brand,
    category: raw.category,
    specifications: { ...raw.specifications },
    imageUrl: raw.imageUrl,
    offers: [initialOffer],
    lowestPriceOffer: initialOffer,
    highestPriceOffer: initialOffer,
    priceDifference: 0,
    reviews: reviewData,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    retrievedAt: raw.retrievedAt,
    isRealData: true,
  };
}

export function normalizeProductList(rawProducts: RawProduct[]): CanonicalProduct[] {
  return rawProducts.map(normalizeProduct);
}
