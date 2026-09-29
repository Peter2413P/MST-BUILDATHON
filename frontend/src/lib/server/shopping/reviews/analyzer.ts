import type { CanonicalProduct, ProductReviewData } from '../types';

export interface DetailedReviewInsight {
  productId: string;
  rating: number;
  reviewCount: number;
  sentiment: 'very_positive' | 'positive' | 'mixed' | 'negative' | 'unknown';
  volumeReliability: 'high' | 'moderate' | 'low';
  reliabilityScore: number; // 0 - 100
  positiveThemes: string[];
  negativeThemes: string[];
  summaryNarrative: string;
  isAvailable: boolean;
}

/**
 * Deterministically analyzes real review statistics and themes.
 * Never invents or hallucinates review feedback.
 */
export function analyzeProductReviews(product: CanonicalProduct): DetailedReviewInsight {
  const rev = product.reviews;

  if (!rev || rev.reviewCount === 0) {
    return {
      productId: product.id,
      rating: 0,
      reviewCount: 0,
      sentiment: 'unknown',
      volumeReliability: 'low',
      reliabilityScore: 0,
      positiveThemes: [],
      negativeThemes: [],
      summaryNarrative: 'Review analysis unavailable for this product.',
      isAvailable: false,
    };
  }

  // Volume reliability evaluation
  let volumeReliability: 'high' | 'moderate' | 'low' = 'low';
  if (rev.reviewCount >= 1000) volumeReliability = 'high';
  else if (rev.reviewCount >= 100) volumeReliability = 'moderate';

  // Sentiment classification
  let sentiment: DetailedReviewInsight['sentiment'] = 'mixed';
  if (rev.rating >= 4.4 && rev.reviewCount >= 500) sentiment = 'very_positive';
  else if (rev.rating >= 4.0) sentiment = 'positive';
  else if (rev.rating < 3.5) sentiment = 'negative';

  // Summarize why users like and dislike this product
  let narrative = '';
  if (rev.positiveThemes.length > 0 && rev.negativeThemes.length > 0) {
    narrative = `Users praise ${rev.positiveThemes.slice(0, 2).join(' and ')}, but frequently report concerns regarding ${rev.negativeThemes.slice(0, 2).join(' and ')}.`;
  } else if (rev.positiveThemes.length > 0) {
    narrative = `Users consistently commend the ${rev.positiveThemes.join(', ')}.`;
  } else if (rev.negativeThemes.length > 0) {
    narrative = `Primary reported drawbacks include ${rev.negativeThemes.join(', ')}.`;
  } else {
    narrative = `Rated ${rev.rating}★ across ${rev.reviewCount.toLocaleString()} verified customer reviews.`;
  }

  return {
    productId: product.id,
    rating: rev.rating,
    reviewCount: rev.reviewCount,
    sentiment,
    volumeReliability,
    reliabilityScore: rev.reviewReliabilityScore,
    positiveThemes: rev.positiveThemes,
    negativeThemes: rev.negativeThemes,
    summaryNarrative: narrative,
    isAvailable: true,
  };
}
