import type { CanonicalProduct, RetailerOffer } from '../types';

function computeDedupKey(product: CanonicalProduct): string {
  // 1. If explicit SKU exists, prioritize brand + SKU
  if (product.sku && product.sku.trim().length > 3) {
    return `${product.brand.toLowerCase()}::sku::${product.sku.trim().toLowerCase()}`;
  }

  // 2. Cleaned Model identifier
  const cleanModel = product.model
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');

  // 3. Normalized Title Core Tokens
  const keyTokens = product.title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2 && !['laptop', 'phone', 'shoe', 'shoes', 'running', 'edition', 'black', 'grey', 'next', 'nature', 'series', 'unisex', 'mens'].includes(t))
    .sort()
    .join('_');

  return `${product.brand.toLowerCase()}::${product.category.toLowerCase()}::${cleanModel || keyTokens}`;
}

/**
 * Deduplicates products across providers and aggregates retailer offers for true price comparison.
 */
export function deduplicateProducts(products: CanonicalProduct[]): CanonicalProduct[] {
  const groups = new Map<string, CanonicalProduct[]>();

  for (const p of products) {
    const key = computeDedupKey(p);
    const existing = groups.get(key) || [];
    existing.push(p);
    groups.set(key, existing);
  }

  const consolidated: CanonicalProduct[] = [];

  for (const [, group] of groups.entries()) {
    if (group.length === 1) {
      consolidated.push(group[0]);
      continue;
    }

    // Sort group by price ascending
    const primary = { ...group[0] };
    const allOffers: RetailerOffer[] = [];

    // Collect offers from all group members
    for (const member of group) {
      for (const offer of member.offers) {
        // Prevent duplicate offers from the exact same retailer
        const exists = allOffers.some(o => o.retailer.toLowerCase() === offer.retailer.toLowerCase());
        if (!exists) {
          allOffers.push(offer);
        }
      }
    }

    // Sort offers by price ascending
    allOffers.sort((a, b) => a.price - b.price);

    const lowest = allOffers[0];
    const highest = allOffers[allOffers.length - 1];

    // Merge review themes across sources
    const allPositives = Array.from(new Set(group.flatMap(m => m.reviews.positiveThemes)));
    const allNegatives = Array.from(new Set(group.flatMap(m => m.reviews.negativeThemes)));
    const maxReviewCount = Math.max(...group.map(m => m.reviews.reviewCount));
    const avgRating = parseFloat((group.reduce((sum, m) => sum + m.reviews.rating, 0) / group.length).toFixed(1));

    primary.offers = allOffers;
    primary.lowestPriceOffer = lowest;
    primary.highestPriceOffer = highest;
    primary.priceDifference = highest.price - lowest.price;
    primary.source = lowest.source;
    primary.sourceUrl = lowest.sourceUrl;
    primary.reviews = {
      ...primary.reviews,
      rating: avgRating,
      reviewCount: maxReviewCount,
      positiveThemes: allPositives,
      negativeThemes: allNegatives,
    };

    consolidated.push(primary);
  }

  return consolidated;
}
