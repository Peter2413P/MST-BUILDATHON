import type { CanonicalProduct, ShoppingRequirements, FilterResult } from '../types';

export interface HardFilterEvaluation {
  matchingProducts: CanonicalProduct[];
  rejectedProducts: Array<{
    product: CanonicalProduct;
    rejectionReasons: string[];
  }>;
}

/**
 * Deterministically tests if a single canonical product satisfies all hard constraints.
 * Evaluation order:
 * 1. Availability
 * 2. Budget (min, max, exact)
 * 3. Required specifications (GPU, RAM, Storage, Camera, Battery)
 * 4. Required category
 * 5. Specific brand or model requirement
 */
export function evaluateHardRequirements(
  product: CanonicalProduct,
  requirements: ShoppingRequirements
): FilterResult {
  const reasons: string[] = [];
  const { budget, hard_requirements, category } = requirements;
  const price = product.lowestPriceOffer.price;

  // 1. Availability Filter
  if (hard_requirements.in_stock_only && product.lowestPriceOffer.availability === 'out_of_stock') {
    reasons.push('Item is currently out of stock.');
  }

  // 2. Budget Filter (Pure Deterministic Math)
  if (budget.maximum !== undefined && price > budget.maximum) {
    reasons.push(
      `Lowest price (₹${price.toLocaleString()}) exceeds the maximum specified budget of ₹${budget.maximum.toLocaleString()}.`
    );
  }
  if (budget.minimum !== undefined && price < budget.minimum) {
    reasons.push(
      `Price (₹${price.toLocaleString()}) is below the minimum specified threshold of ₹${budget.minimum.toLocaleString()}.`
    );
  }

  // 3. Category Filter
  if (category && category !== 'general') {
    const pCat = product.category.toLowerCase();
    const reqCat = category.toLowerCase();
    if (reqCat.includes('laptop') && !pCat.includes('laptop')) {
      reasons.push(`Category mismatch: requested laptop, but product is ${product.category}.`);
    } else if (reqCat.includes('phone') && !pCat.includes('phone')) {
      reasons.push(`Category mismatch: requested phone, but product is ${product.category}.`);
    } else if (reqCat.includes('shoe') && !pCat.includes('shoe')) {
      reasons.push(`Category mismatch: requested shoes, but product is ${product.category}.`);
    } else if (reqCat.includes('monitor') && !pCat.includes('monitor')) {
      reasons.push(`Category mismatch: requested monitor, but product is ${product.category}.`);
    }
  }

  // 4. Required Specifications Filter
  const specs = product.specifications || {};

  // GPU Requirement
  if (hard_requirements.gpu) {
    const normalizeGpu = (str: string) =>
      str.toLowerCase()
        .replace(/geforce/g, '')
        .replace(/nvidia/g, '')
        .replace(/graphics/g, '')
        .replace(/laptop/g, '')
        .replace(/gpu/g, '')
        .replace(/[^a-z0-9]/g, '');

    const targetGpu = normalizeGpu(hard_requirements.gpu);
    const productGpu = normalizeGpu(String(specs.gpu || product.title));

    if (!productGpu.includes(targetGpu) && !targetGpu.includes(productGpu)) {
      reasons.push(`GPU requirement mismatch: requires ${hard_requirements.gpu}, but product has ${specs.gpu || 'different GPU'}.`);
    }
  }

  // RAM Requirement
  if (hard_requirements.ram_gb_min !== undefined) {
    const productRam = Number(specs.ram_gb) || 0;
    if (productRam < hard_requirements.ram_gb_min) {
      reasons.push(`RAM requirement mismatch: requires at least ${hard_requirements.ram_gb_min}GB RAM, but product has ${productRam}GB.`);
    }
  }

  // Storage Requirement
  if (hard_requirements.storage_gb_min !== undefined) {
    const productStorage = Number(specs.storage_gb) || 0;
    if (productStorage < hard_requirements.storage_gb_min) {
      reasons.push(`Storage requirement mismatch: requires at least ${hard_requirements.storage_gb_min}GB storage, but product has ${productStorage}GB.`);
    }
  }

  // Phone Camera Requirement
  if (hard_requirements.camera_mp_min !== undefined) {
    const productCam = Number(specs.camera_mp) || 0;
    if (productCam < hard_requirements.camera_mp_min) {
      reasons.push(`Camera requirement mismatch: requires at least ${hard_requirements.camera_mp_min}MP, but product has ${productCam}MP.`);
    }
  }

  // Phone Battery Requirement
  if (hard_requirements.battery_mah_min !== undefined) {
    const productBat = Number(specs.battery_mah) || 0;
    if (productBat < hard_requirements.battery_mah_min) {
      reasons.push(`Battery requirement mismatch: requires at least ${hard_requirements.battery_mah_min}mAh, but product has ${productBat}mAh.`);
    }
  }

  // Brand Requirement
  if (hard_requirements.brand) {
    const targetBrand = hard_requirements.brand.toLowerCase();
    if (!product.brand.toLowerCase().includes(targetBrand)) {
      reasons.push(`Brand mismatch: requires ${hard_requirements.brand}, but product is ${product.brand}.`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

/**
 * Filter an entire list of canonical products against hard constraints.
 */
export function applyHardFilters(
  products: CanonicalProduct[],
  requirements: ShoppingRequirements
): HardFilterEvaluation {
  const matchingProducts: CanonicalProduct[] = [];
  const rejectedProducts: HardFilterEvaluation['rejectedProducts'] = [];

  for (const product of products) {
    const evalResult = evaluateHardRequirements(product, requirements);
    if (evalResult.passed) {
      matchingProducts.push(product);
    } else {
      rejectedProducts.push({
        product,
        rejectionReasons: evalResult.reasons,
      });
    }
  }

  return {
    matchingProducts,
    rejectedProducts,
  };
}
