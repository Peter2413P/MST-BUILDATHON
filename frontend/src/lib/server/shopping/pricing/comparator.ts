import type { CanonicalProduct, PriceComparisonSummary } from '../types';

/**
 * Builds price comparison analysis across connected retailer sources.
 */
export function generatePriceComparison(product: CanonicalProduct): PriceComparisonSummary {
  const offers = [...product.offers].sort((a, b) => a.price - b.price);
  const lowest = offers[0] || product.lowestPriceOffer;
  const highest = offers[offers.length - 1] || product.highestPriceOffer;
  const savings = Math.max(0, highest.price - lowest.price);
  const savingsPct = highest.price > 0 ? Math.round((savings / highest.price) * 100) : 0;

  let summaryPhrase: string;
  if (offers.length > 1 && savings > 0) {
    summaryPhrase = `Lowest price found among the connected sources is ₹${lowest.price.toLocaleString()} on ${lowest.retailer} (saves ₹${savings.toLocaleString()} compared to ${highest.retailer}).`;
  } else {
    summaryPhrase = `Lowest price found among the connected sources is ₹${lowest.price.toLocaleString()} on ${lowest.retailer}.`;
  }

  return {
    productId: product.id,
    title: product.title,
    brand: product.brand,
    lowestPrice: lowest.price,
    highestPrice: highest.price,
    savings,
    savingsPct,
    currency: lowest.currency,
    bestRetailer: lowest.retailer,
    bestRetailerUrl: lowest.sourceUrl,
    retailerCount: offers.length,
    offers: offers.map(o => ({
      retailer: o.retailer,
      price: o.price,
      sourceUrl: o.sourceUrl,
      availability: o.availability,
    })),
    summaryPhrase,
  };
}

export function compareProducts(products: CanonicalProduct[]): PriceComparisonSummary[] {
  return products.map(generatePriceComparison);
}
