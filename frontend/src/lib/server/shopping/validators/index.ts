import type { ShoppingRecommendationArtifact, CanonicalProduct } from '../types';

export interface ValidationOutput {
  isValid: boolean;
  errors: string[];
}

/**
 * Production validation checking all deliverables before any task completion or payment settlement.
 */
export function validateShoppingDeliverable(artifact: ShoppingRecommendationArtifact): ValidationOutput {
  const errors: string[] = [];

  // 1. Requirements verification
  if (!artifact.requirements || !artifact.requirements.query) {
    errors.push('Requirements were not properly extracted or missing query.');
  }

  // If status is conflict or no_matches, ensure it has explicit conflict details and not fake products
  if (artifact.status === 'conflict' || artifact.status === 'no_matches') {
    if (!artifact.conflictDetails || !artifact.conflictDetails.message) {
      errors.push('Conflict or zero-match scenario is missing explicit failure explanation.');
    }
    if (artifact.rankedProducts && artifact.rankedProducts.length > 0) {
      errors.push('Conflict state cannot contain approved ranked product recommendations.');
    }
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // 2. Product existence verification
  if (!artifact.rankedProducts || artifact.rankedProducts.length === 0) {
    errors.push('No ranked products generated in successful shopping deliverable.');
  }

  // 3. Provenance & Real Data Verification
  for (const item of artifact.rankedProducts) {
    const p = item.product;
    if (!p.id || !p.title || !p.brand) {
      errors.push(`Product missing essential identification: ${JSON.stringify(p)}`);
    }
    if (!p.isRealData) {
      errors.push(`Product "${p.title}" violates real data guarantee: isRealData is false.`);
    }
    if (!p.source || !p.sourceUrl || !p.sourceUrl.startsWith('http')) {
      errors.push(`Product "${p.title}" lacks authentic retailer provenance URL.`);
    }
    if (typeof p.lowestPriceOffer.price !== 'number' || p.lowestPriceOffer.price <= 0) {
      errors.push(`Product "${p.title}" has invalid or missing price.`);
    }

    // 4. Hard Filter Verification (Check that no product violates max budget)
    if (artifact.requirements.budget.maximum !== undefined) {
      if (p.lowestPriceOffer.price > artifact.requirements.budget.maximum) {
        errors.push(
          `Product "${p.title}" price (₹${p.lowestPriceOffer.price}) exceeds maximum budget constraint of ₹${artifact.requirements.budget.maximum}.`
        );
      }
    }

    // Check GPU hard constraint
    if (artifact.requirements.hard_requirements.gpu) {
      const normalizeGpu = (str: string) =>
        str.toLowerCase()
          .replace(/geforce/g, '')
          .replace(/nvidia/g, '')
          .replace(/graphics/g, '')
          .replace(/laptop/g, '')
          .replace(/gpu/g, '')
          .replace(/[^a-z0-9]/g, '');

      const reqGpu = normalizeGpu(artifact.requirements.hard_requirements.gpu);
      const prodGpu = normalizeGpu(String(p.specifications.gpu || p.title));
      if (!prodGpu.includes(reqGpu) && !reqGpu.includes(prodGpu)) {
        errors.push(`Product "${p.title}" fails hard GPU requirement: requires ${artifact.requirements.hard_requirements.gpu}`);
      }
    }

    // Check RAM hard constraint
    if (artifact.requirements.hard_requirements.ram_gb_min) {
      const prodRam = Number(p.specifications.ram_gb) || 0;
      if (prodRam < artifact.requirements.hard_requirements.ram_gb_min) {
        errors.push(`Product "${p.title}" fails hard RAM requirement: ${prodRam}GB < ${artifact.requirements.hard_requirements.ram_gb_min}GB`);
      }
    }

    // 5. Price calculation check
    if (item.priceComparison) {
      if (item.priceComparison.savings < 0) {
        errors.push(`Negative savings calculated for product "${p.title}".`);
      }
      if (item.priceComparison.lowestPrice !== p.lowestPriceOffer.price) {
        errors.push(`Lowest price mismatch in price comparison for product "${p.title}".`);
      }
    }

    // 6. Ranking score validity
    if (typeof item.scores.overallScore !== 'number' || isNaN(item.scores.overallScore)) {
      errors.push(`Invalid overall score for product "${p.title}".`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
