import type { ShoppingRequirements, BudgetConstraint, Currency } from '../types';
import { chatComplete } from '../../llm';

/**
 * Deterministic requirement extractor that parses shopping constraints from natural language.
 * Ensures strict separation between HARD requirements and SOFT preferences.
 */
export function extractRequirementsDeterministically(query: string): ShoppingRequirements {
  const lower = query.toLowerCase();

  // 1. Currency & Budget Extraction
  let currency: Currency = 'INR';
  if (lower.includes('$') || lower.includes('usd') || lower.includes('dollar')) currency = 'USD';
  else if (lower.includes('€') || lower.includes('eur')) currency = 'EUR';
  else if (lower.includes('£') || lower.includes('gbp')) currency = 'GBP';

  const budget: BudgetConstraint = { currency };

  // Patterns for max budget: "under ₹80,000", "below 80k", "within 80000", "no laptop over 60000", "<= 80000", "max 90,000"
  const maxMatches = [
    /(?:under|below|less than|within|max|maximum|up to|budget(?: of)?|no\s+\w+\s+over)\s*[:=]?\s*(?:₹|rs\.?|inr|\$|€|£)?\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|thousand)?/i,
    /(?:₹|rs\.?|inr|\$|€|£)\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|thousand)?(?:\s*(?:or less|max|budget))/i,
  ];

  for (const regex of maxMatches) {
    const match = query.match(regex);
    if (match) {
      let num = parseFloat(match[1].replace(/,/g, ''));
      const unit = (match[2] || '').toLowerCase();
      if (unit === 'k' || unit === 'thousand') num *= 1000;
      else if (unit === 'lakh') num *= 100000;
      budget.maximum = num;
      break;
    }
  }

  // Patterns for min budget: "above ₹50,000", "at least 50k", "min 50000"
  const minMatch = query.match(/(?:above|greater than|at least|minimum|min)\s*[:=]?\s*(?:₹|rs\.?|inr|\$|€|£)?\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|thousand)?/i);
  if (minMatch) {
    let num = parseFloat(minMatch[1].replace(/,/g, ''));
    const unit = (minMatch[2] || '').toLowerCase();
    if (unit === 'k' || unit === 'thousand') num *= 1000;
    else if (unit === 'lakh') num *= 100000;
    budget.minimum = num;
  }

  // 2. Category Detection
  let category = 'general';
  if (/\b(laptop|notebook|macbook|chromebook|thinkpad)\b/i.test(lower)) {
    category = 'laptop';
  } else if (/\b(phone|smartphone|mobile|iphone|android|galaxy)\b/i.test(lower)) {
    category = 'phone';
  } else if (/\b(shoe|shoes|sneaker|sneakers|footwear|runner|running shoes)\b/i.test(lower)) {
    category = 'shoes';
  } else if (/\b(monitor|monitors|display|screen|screens)\b/i.test(lower)) {
    category = 'monitor';
  }

  // 3. Hard Specification Extraction (Deterministic)
  const hard_requirements: ShoppingRequirements['hard_requirements'] = {
    in_stock_only: true,
  };

  // GPU detection: RTX 4060, RTX 4070, RTX 4050, RTX 3050, etc.
  const gpuMatch = query.match(/\b(RTX\s*\d{4}(?:\s*Ti)?|GTX\s*\d{4}|Radeon\s*RX\s*\d{4}|NVIDIA(?:\s*GPU)?)\b/i);
  if (gpuMatch) {
    let gpuStr = gpuMatch[1].toUpperCase().replace(/\s+/, ' ');
    if (gpuStr.startsWith('RTX') && !gpuStr.startsWith('NVIDIA')) gpuStr = `NVIDIA ${gpuStr}`;
    hard_requirements.gpu = gpuStr;
  }

  // RAM detection: "16GB RAM", "at least 16GB", "32GB"
  const ramMatch = query.match(/(\d+)\s*(?:gb|gigs?)\s*(?:of\s*)?ram/i) || query.match(/at least\s*(\d+)\s*(?:gb|gigs?)\s*(?:ram)?/i);
  if (ramMatch) {
    hard_requirements.ram_gb_min = parseInt(ramMatch[1], 10);
  }

  // Storage detection: "512GB SSD", "1TB SSD", "512 GB storage"
  const storageMatch = query.match(/(\d+)\s*(?:gb|tb)\s*(?:ssd|nvme|storage|rom)/i);
  if (storageMatch) {
    let val = parseInt(storageMatch[1], 10);
    if (/tb/i.test(storageMatch[0])) val *= 1024;
    hard_requirements.storage_gb_min = val;
  }

  // Camera detection for phones
  if (category === 'phone' || lower.includes('camera')) {
    const camMatch = query.match(/(\d+)\s*mp(?:\s*camera)?/i);
    if (camMatch) {
      hard_requirements.camera_mp_min = parseInt(camMatch[1], 10);
    } else if (lower.includes('good camera') || lower.includes('great camera')) {
      hard_requirements.camera_mp_min = 48; // Baseline for "good camera"
    }
  }

  // Battery detection for phones
  if (category === 'phone' || lower.includes('battery')) {
    const batMatch = query.match(/(\d{4,5})\s*mah/i);
    if (batMatch) {
      hard_requirements.battery_mah_min = parseInt(batMatch[1], 10);
    } else if (lower.includes('good battery') || lower.includes('long battery')) {
      hard_requirements.battery_mah_min = 5000;
    }
  }

  // Brand preference
  const brands = ['asus', 'lenovo', 'acer', 'dell', 'hp', 'apple', 'samsung', 'oneplus', 'redmi', 'realme', 'motorola', 'nike', 'puma', 'adidas', 'asics', 'lg', 'benq'];
  for (const b of brands) {
    const bRegex = new RegExp(`\\b${b}\\b`, 'i');
    if (bRegex.test(lower)) {
      hard_requirements.brand = b.charAt(0).toUpperCase() + b.slice(1);
      break;
    }
  }

  // 4. Soft Preferences & Use-Case Extraction
  const preferences: ShoppingRequirements['preferences'] = {};

  if (lower.includes('ai/ml') || lower.includes('machine learning') || lower.includes('deep learning') || lower.includes('data science')) {
    preferences.use_case = 'AI/ML development';
    // AI/ML domain awareness: requires NVIDIA CUDA support
    if (!hard_requirements.gpu) hard_requirements.gpu = 'NVIDIA';
    if (!hard_requirements.ram_gb_min) hard_requirements.ram_gb_min = 16;
  } else if (lower.includes('gaming') || lower.includes('gamer') || lower.includes('esports')) {
    preferences.use_case = 'gaming';
  } else if (lower.includes('programming') || lower.includes('coding') || lower.includes('developer')) {
    preferences.use_case = 'programming';
  } else if (lower.includes('running') || lower.includes('jogging') || lower.includes('marathon')) {
    preferences.use_case = 'running';
  }

  if (lower.includes('good review') || lower.includes('great review') || lower.includes('top rated') || lower.includes('best review')) {
    preferences.review_quality = 'good';
  }

  // Check if comparison request with specific products
  const targetProducts: string[] = [];
  if (lower.startsWith('compare') || lower.includes('compare these')) {
    const parts = query.replace(/^compare\s+(?:these\s+)?(?:products\s*)?:?/i, '').split(/,|vs\.?|and/i);
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed.length > 2) targetProducts.push(trimmed);
    }
  }

  return {
    category,
    query,
    budget,
    hard_requirements,
    preferences,
    location: 'India',
    target_products: targetProducts.length > 0 ? targetProducts : undefined,
  };
}

/**
 * Intelligent Requirement Extractor leveraging Groq LLM with deterministic fallback.
 */
export async function extractRequirements(query: string): Promise<ShoppingRequirements> {
  const deterministicResult = extractRequirementsDeterministically(query);

  const prompt = `You are AgentMesh's precise Shopping Requirements Extractor.
Extract structured shopping constraints from the user's natural language request.

Rules:
1. Distinguish strictly between HARD REQUIREMENTS (mandatory filters: max budget, specific GPU, min RAM, min storage, category) and SOFT PREFERENCES (use case, brand affinity, review quality).
2. For AI/ML requests, recognize that CUDA/NVIDIA GPU and >=16GB RAM are essential.
3. Numeric budget must be an exact number without currency symbols (e.g. 80000 for ₹80,000).
4. Return ONLY valid JSON matching this schema:
{
  "category": "laptop" | "phone" | "shoes" | "monitor" | "general",
  "budget": {
    "minimum": <number or undefined>,
    "maximum": <number or undefined>,
    "currency": "INR" | "USD"
  },
  "hard_requirements": {
    "gpu": "<string or undefined>",
    "ram_gb_min": <number or undefined>,
    "storage_gb_min": <number or undefined>,
    "brand": "<string or undefined>",
    "camera_mp_min": <number or undefined>,
    "battery_mah_min": <number or undefined>
  },
  "preferences": {
    "use_case": "<string>",
    "review_quality": "good" | "any"
  },
  "location": "India",
  "target_products": <array of strings or undefined>
}

User Request: "${query}"`;

  try {
    const { text } = await chatComplete({
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a strict, structured shopping parser. Return JSON only without markdown.',
      maxTokens: 512,
      label: 'ShoppingRequirementExtractor',
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : text.trim();
    const parsed = JSON.parse(cleaned) as Partial<ShoppingRequirements>;

    // Merge LLM extraction with deterministic results for maximum accuracy
    return {
      category: parsed.category || deterministicResult.category,
      query,
      budget: {
        currency: parsed.budget?.currency || deterministicResult.budget.currency,
        maximum: typeof parsed.budget?.maximum === 'number' ? parsed.budget.maximum : deterministicResult.budget.maximum,
        minimum: typeof parsed.budget?.minimum === 'number' ? parsed.budget.minimum : deterministicResult.budget.minimum,
        exact: parsed.budget?.exact || deterministicResult.budget.exact,
      },
      hard_requirements: {
        ...deterministicResult.hard_requirements,
        ...(parsed.hard_requirements || {}),
      },
      preferences: {
        ...deterministicResult.preferences,
        ...(parsed.preferences || {}),
      },
      location: parsed.location || deterministicResult.location || 'India',
      target_products: parsed.target_products || deterministicResult.target_products,
    };
  } catch (err) {
    console.warn('[RequirementExtractor] LLM extraction error, using deterministic extractor:', (err as Error).message);
    return deterministicResult;
  }
}
