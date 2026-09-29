/**
 * Core Data Models & Canonical Schemas for Shopping Agent
 */

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface BudgetConstraint {
  minimum?: number;
  maximum?: number;
  exact?: number;
  currency: Currency;
}

export interface ShoppingRequirements {
  category: string;
  query: string;
  budget: BudgetConstraint;
  hard_requirements: {
    brand?: string;
    model?: string;
    gpu?: string;
    cpu?: string;
    ram_gb_min?: number;
    storage_gb_min?: number;
    screen_size_inch?: number;
    refresh_rate_hz?: number;
    camera_mp_min?: number;
    battery_mah_min?: number;
    color?: string;
    size?: string | number;
    in_stock_only?: boolean;
    [key: string]: unknown;
  };
  preferences: {
    use_case?: string; // e.g. "gaming", "AI/ML", "programming", "running", "casual"
    review_quality?: 'good' | 'great' | 'any';
    brand_affinity?: string[];
    priority?: 'performance' | 'battery' | 'value' | 'portability' | 'brand';
    [key: string]: unknown;
  };
  location?: string;
  target_products?: string[]; // for direct comparison requests
}

export interface RetailerOffer {
  retailer: string;
  price: number;
  currency: Currency;
  originalPrice?: number;
  discountPct?: number;
  availability: 'in_stock' | 'out_of_stock' | 'limited_stock';
  source: string;
  sourceUrl: string;
  retrievedAt: string;
}

export interface ProductReviewData {
  rating: number; // 1.0 - 5.0
  reviewCount: number;
  positiveThemes: string[];
  negativeThemes: string[];
  sentimentScore?: number; // -1 to 1
  reviewReliabilityScore: number; // 0 to 100 based on review count and distribution
  verifiedPurchaseRatio?: number;
  recentFeedbackSummary?: string;
  retrievedAt: string;
}

export interface CanonicalProduct {
  id: string; // Canonical unique identifier
  sku: string;
  model: string;
  title: string;
  brand: string;
  category: string;
  specifications: Record<string, string | number | boolean>;
  imageUrl: string;
  // Consolidated offers across retailers
  offers: RetailerOffer[];
  lowestPriceOffer: RetailerOffer;
  highestPriceOffer: RetailerOffer;
  priceDifference: number;
  // Review metrics
  reviews: ProductReviewData;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  isRealData: true; // Provenance guarantee: must always be real data
}

export interface FilterResult {
  passed: boolean;
  reasons: string[];
}

export interface PriceComparisonSummary {
  productId: string;
  title: string;
  brand: string;
  lowestPrice: number;
  highestPrice: number;
  savings: number;
  savingsPct: number;
  currency: Currency;
  bestRetailer: string;
  bestRetailerUrl: string;
  retailerCount: number;
  offers: Array<{
    retailer: string;
    price: number;
    sourceUrl: string;
    availability: string;
  }>;
  summaryPhrase: string; // e.g. "Lowest price found among connected sources is ₹74,990 on Amazon India."
}

export interface ProductScoreBreakdown {
  requirementMatch: number; // 0 - 100 (35% default weight)
  valueScore: number;       // 0 - 100 (25% default weight)
  reviewScore: number;      // 0 - 100 (20% default weight)
  priceScore: number;       // 0 - 100 (10% default weight)
  reliabilityScore: number; // 0 - 100 (10% default weight)
  overallScore: number;     // 0 - 100
  matchHighlights: string[];
  drawbacks: string[];
  useCaseFit: string;
}

export interface RankedProduct {
  rank: number;
  product: CanonicalProduct;
  scores: ProductScoreBreakdown;
  priceComparison: PriceComparisonSummary;
  whyItMatches: string[];
  importantDrawbacks: string[];
  verdict: string;
}

export interface ShoppingRecommendationArtifact {
  type: 'shopping';
  status: 'success' | 'no_matches' | 'conflict' | 'error';
  query: string;
  requirements: ShoppingRequirements;
  connectedProviders: string[];
  failedProviders?: string[];
  totalDiscovered: number;
  totalNormalized: number;
  totalFiltered: number;
  shortlistedCount: number;
  rankedProducts: RankedProduct[];
  rejectedProducts?: Array<{
    title: string;
    brand: string;
    price: number;
    currency: Currency;
    rejectionReasons: string[];
  }>;
  conflictDetails?: {
    conflictType: 'budget_spec_conflict' | 'zero_matches' | 'unsupported_category';
    message: string;
    relaxationSuggestions: string[];
  };
  summaryNarrative: string;
  generatedAt: string;
  provenanceNotice: string;
}
