import { chatComplete } from '../../llm';
import type { RequirementSpec, BuildPlan } from '../types';

export class PlannerProvider {
  async analyzeRequirements(prompt: string, context?: string): Promise<RequirementSpec> {
    const combinedInput = context ? `Context:\n${context}\n\nUser Request:\n${prompt}` : prompt;

    try {
      const { text } = await chatComplete({
        system: `You are an expert E-Commerce Solutions Architect.
Analyze the user's e-commerce website requirements and convert them into a structured JSON specification.
Make reasonable, professional assumptions where details are unspecified.
Return ONLY valid JSON (no markdown fences) matching this schema:
{
  "brand": "Brand name (e.g. HUSTLR)",
  "tagline": "Short compelling brand tagline",
  "category": "E-commerce niche/industry (e.g. Men's Fashion)",
  "purpose": "Primary objective of the store",
  "targetAudience": "Target demographics and user profile",
  "visualStyle": "Visual aesthetic (e.g. premium dark minimalist)",
  "pages": ["Home", "Products", "Product Details", "Cart", "Checkout"],
  "features": ["Category filtering", "Search", "Responsive Navigation", "Cart Drawer", "Checkout Form", "Product Gallery"],
  "components": ["Navbar", "HeroBanner", "ProductGrid", "ProductCard", "CartDrawer", "CheckoutModal", "Footer"],
  "responsiveRequirements": ["Mobile-first design", "Collapsible navigation", "Adaptive grid columns", "Touch-friendly checkout"],
  "assumptions": ["Assumed 8 curated demo products", "Using local currency and mock checkout simulation"]
}`,
        messages: [{ role: 'user', content: combinedInput }],
        maxTokens: 1200,
        label: 'EcommercePlanner',
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as RequirementSpec;
      }
    } catch (err) {
      console.warn('[PlannerProvider] LLM analysis fallback due to:', (err as Error).message);
    }

    // Default Fallback Specification
    const brandMatch = prompt.match(/called\s+([A-Za-z0-9_-]+)/i) || prompt.match(/brand\s+([A-Za-z0-9_-]+)/i);
    const brand = brandMatch ? brandMatch[1] : 'HUSTLR';

    return {
      brand,
      tagline: 'Engineered for the Modern Standard',
      category: "Men's Fashion & Apparel",
      purpose: 'Provide a seamless, premium shopping experience for high-performance apparel',
      targetAudience: 'Fashion-forward professionals and lifestyle enthusiasts',
      visualStyle: 'Premium dark minimalist aesthetic with high-contrast typography and subtle amber accents',
      pages: ['Home', 'Products', 'Product Details', 'Cart', 'Checkout'],
      features: ['Search', 'Category Filtering', 'Shopping Cart', 'Instant Checkout', 'Responsive Navigation', 'Product Quick View'],
      components: ['Navbar', 'HeroBanner', 'ProductGrid', 'ProductCard', 'CartDrawer', 'CheckoutModal', 'Footer'],
      responsiveRequirements: ['Fluid mobile layouts', 'Collapsible drawer navigation', 'Adaptive product grid'],
      assumptions: ['Includes 8 mock catalogue items', 'Simulated instant payment workflow'],
    };
  }

  createBuildPlan(req: RequirementSpec): BuildPlan {
    return {
      steps: [
        {
          id: 1,
          title: 'Project Architecture & Dependencies',
          description: 'Define Next.js 14 App Router layout, package manifest, Tailwind tokens, and global styling',
          targetFiles: ['package.json', 'tsconfig.json', 'tailwind.config.js', 'app/layout.tsx', 'app/globals.css'],
        },
        {
          id: 2,
          title: 'Design System & Data Layer',
          description: `Create ${req.brand} product catalogue mock dataset, cart state manager, and theme tokens`,
          targetFiles: ['data/products.ts', 'context/CartContext.tsx', 'types/store.ts'],
        },
        {
          id: 3,
          title: 'Reusable Storefront UI Components',
          description: 'Build responsive Header/Navbar, ProductCard, CartDrawer, and Footer components',
          targetFiles: ['components/Navbar.tsx', 'components/ProductCard.tsx', 'components/CartDrawer.tsx', 'components/Footer.tsx'],
        },
        {
          id: 4,
          title: 'Core E-Commerce Pages',
          description: 'Implement Homepage, Products Catalogue, Product Details, and Checkout flows',
          targetFiles: ['app/page.tsx', 'app/products/page.tsx', 'app/products/[id]/page.tsx', 'app/checkout/page.tsx'],
        },
        {
          id: 5,
          title: 'Build Verification & Error Diagnosis',
          description: 'Compile project, run typechecks, and resolve any syntax or interface discrepancies',
          targetFiles: [],
        },
      ],
    };
  }
}
