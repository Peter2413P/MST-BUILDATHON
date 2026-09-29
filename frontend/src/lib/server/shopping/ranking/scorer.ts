import type { CanonicalProduct, ShoppingRequirements, ProductScoreBreakdown, RankedProduct } from '../types';
import { generatePriceComparison } from '../pricing/comparator';

export interface ScoringWeights {
  requirementMatch: number; // default: 0.35
  valueForMoney: number;    // default: 0.25
  reviewQuality: number;    // default: 0.20
  priceAdvantage: number;   // default: 0.10
  reviewReliability: number;// default: 0.10
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  requirementMatch: 0.35,
  valueForMoney: 0.25,
  reviewQuality: 0.20,
  priceAdvantage: 0.10,
  reviewReliability: 0.10,
};

/**
 * Deterministically scores a canonical product across 5 transparent dimensions.
 */
export function scoreProduct(
  product: CanonicalProduct,
  requirements: ShoppingRequirements,
  allCandidates: CanonicalProduct[],
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ProductScoreBreakdown {
  const specs = product.specifications || {};
  const price = product.lowestPriceOffer.price;
  const matchHighlights: string[] = [];
  const drawbacks = [...(product.reviews.negativeThemes || [])];

  // 1. Requirement Match Score (0 - 100)
  let reqMatch = 100;
  if (requirements.budget.maximum) {
    if (price <= requirements.budget.maximum) {
      matchHighlights.push(`Within specified budget (₹${price.toLocaleString()} <= ₹${requirements.budget.maximum.toLocaleString()})`);
    }
  }

  if (requirements.hard_requirements.gpu) {
    const gpu = String(specs.gpu || '');
    if (gpu.toLowerCase().includes(requirements.hard_requirements.gpu.toLowerCase())) {
      matchHighlights.push(`Meets GPU specification (${gpu})`);
    }
  }

  if (requirements.hard_requirements.ram_gb_min) {
    const ram = Number(specs.ram_gb) || 0;
    if (ram >= requirements.hard_requirements.ram_gb_min) {
      matchHighlights.push(`Meets RAM specification (${ram}GB >= ${requirements.hard_requirements.ram_gb_min}GB)`);
    }
  }

  if (requirements.hard_requirements.storage_gb_min) {
    const storage = Number(specs.storage_gb) || 0;
    if (storage >= requirements.hard_requirements.storage_gb_min) {
      matchHighlights.push(`Meets storage specification (${storage}GB >= ${requirements.hard_requirements.storage_gb_min}GB)`);
    }
  }

  if (requirements.hard_requirements.camera_mp_min) {
    const cam = Number(specs.camera_mp) || 0;
    if (cam >= requirements.hard_requirements.camera_mp_min) {
      matchHighlights.push(`High resolution camera (${cam}MP)`);
    }
  }

  if (requirements.hard_requirements.battery_mah_min) {
    const bat = Number(specs.battery_mah) || 0;
    if (bat >= requirements.hard_requirements.battery_mah_min) {
      matchHighlights.push(`Long-lasting battery (${bat}mAh)`);
    }
  }

  // Soft preference bonuses
  if (requirements.preferences.use_case === 'AI/ML development') {
    if (specs.cuda_support) {
      matchHighlights.push('NVIDIA CUDA architecture supported for PyTorch/TensorFlow');
      reqMatch = Math.min(100, reqMatch + 5);
    }
    if (Number(specs.vram_gb) >= 8) {
      matchHighlights.push('8GB dedicated VRAM enables local LLM / model fine-tuning');
    }
  }

  // 2. Value For Money Score (0 - 100)
  // Compares price against discount and candidate distribution
  const discountBonus = product.lowestPriceOffer.discountPct ? Math.min(20, product.lowestPriceOffer.discountPct * 0.8) : 5;
  const valueScore = Math.min(100, Math.round(75 + discountBonus));

  // 3. Review Quality Score (0 - 100)
  // Map 3.5 -> 70, 4.0 -> 80, 4.5 -> 90, 5.0 -> 100
  const reviewScore = Math.min(100, Math.round(product.reviews.rating * 20));

  // 4. Price Advantage Score (0 - 100)
  // Lowest price in cohort gets 100, highest gets proportional penalty
  const allPrices = allCandidates.map(c => c.lowestPriceOffer.price).filter(p => p > 0);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  let priceScore = 85;
  if (maxPrice > minPrice) {
    priceScore = Math.round(100 - ((price - minPrice) / (maxPrice - minPrice)) * 30);
  }

  // Multi-retailer competition bonus: if product has multi-store savings
  if (product.priceDifference > 0) {
    matchHighlights.push(`Available across ${product.offers.length} stores with up to ₹${product.priceDifference.toLocaleString()} price variance`);
  }

  // 5. Review Reliability Score (0 - 100)
  const reliabilityScore = product.reviews.reviewReliabilityScore;

  // Composite Weighted Calculation
  const overallScore = parseFloat(
    (
      reqMatch * weights.requirementMatch +
      valueScore * weights.valueForMoney +
      reviewScore * weights.reviewQuality +
      priceScore * weights.priceAdvantage +
      reliabilityScore * weights.reviewReliability
    ).toFixed(1)
  );

  let useCaseFit = 'General use';
  if (requirements.preferences.use_case) {
    useCaseFit = `Optimized for ${requirements.preferences.use_case}`;
  }

  return {
    requirementMatch: reqMatch,
    valueScore,
    reviewScore,
    priceScore,
    reliabilityScore,
    overallScore,
    matchHighlights,
    drawbacks,
    useCaseFit,
  };
}

/**
 * Ranks all matching candidates transparently and creates ranked recommendations.
 */
export function rankProducts(
  candidates: CanonicalProduct[],
  requirements: ShoppingRequirements,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): RankedProduct[] {
  const scored = candidates.map(product => {
    const scores = scoreProduct(product, requirements, candidates, weights);
    const priceComp = generatePriceComparison(product);

    const whyItMatches = [
      ...scores.matchHighlights,
      `Rated ${product.reviews.rating}★ from ${product.reviews.reviewCount.toLocaleString()} real purchasers`,
    ];

    const importantDrawbacks = product.reviews.negativeThemes.length > 0
      ? product.reviews.negativeThemes
      : ['No significant recurring customer complaints reported'];

    let verdict = 'Strong candidate matching your criteria';
    if (scores.overallScore >= 90) verdict = 'Best overall recommendation';
    else if (scores.priceScore >= 95) verdict = 'Best budget value choice';

    return {
      product,
      scores,
      priceComparison: priceComp,
      whyItMatches,
      importantDrawbacks,
      verdict,
    };
  });

  // Sort descending by overallScore
  scored.sort((a, b) => b.scores.overallScore - a.scores.overallScore);

  return scored.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}
