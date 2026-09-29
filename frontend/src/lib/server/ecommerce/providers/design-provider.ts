import { chatComplete } from '../../llm';
import type { DesignProvider, DesignRequest, DesignResult, DesignSpec } from '../types';

export class ExtensibleDesignProvider implements DesignProvider {
  private providerName: string;
  private apiKey?: string;

  constructor() {
    this.providerName = process.env.DESIGN_PROVIDER || 'agentguild_design_engine';
    this.apiKey = process.env.DESIGN_API_KEY;
  }

  async generateDesign(input: DesignRequest): Promise<DesignResult> {
    const { requirements } = input;
    const isDark = /dark|black|noir|luxury|night|carbon/i.test(requirements.visualStyle);

    // If an external design API endpoint is configured and key is present, call external provider
    if (process.env.DESIGN_API_URL && this.apiKey) {
      try {
        const res = await fetch(process.env.DESIGN_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            brand: requirements.brand,
            category: requirements.category,
            style: requirements.visualStyle,
            pages: requirements.pages,
          }),
        });

        if (res.ok) {
          const externalSpec = await res.json();
          if (externalSpec?.colorPalette && externalSpec?.typography) {
            return {
              success: true,
              designSpec: externalSpec as DesignSpec,
              provider: this.providerName,
            };
          }
        }
      } catch (externalErr) {
        console.warn(`[DesignProvider] External provider (${this.providerName}) error:`, (externalErr as Error).message);
      }
    }

    // High-fidelity design engine synthesis
    try {
      const { text } = await chatComplete({
        system: `You are a Principal UI/UX Design System Architect.
Given the brand "${requirements.brand}" (${requirements.category}, style: "${requirements.visualStyle}"), produce a cohesive design specification JSON.
Return ONLY valid JSON (no markdown fences) matching:
{
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "surface": "#hex",
    "textPrimary": "#hex",
    "textSecondary": "#hex",
    "accent": "#hex",
    "border": "#hex"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "headingScale": "text-2xl sm:text-4xl font-extrabold tracking-tight",
    "bodyScale": "text-sm sm:text-base leading-relaxed"
  },
  "layoutStructure": {
    "containerWidth": "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
    "gridColumns": 4,
    "spacingUnit": "4"
  },
  "componentSpecs": [
    { "name": "Navbar", "purpose": "Header navigation with brand logo, search, and cart counter" },
    { "name": "ProductCard", "purpose": "Product tile displaying image, title, price, category, and quick add button" }
  ]
}`,
        messages: [{ role: 'user', content: `Generate design system for ${requirements.brand}` }],
        maxTokens: 1000,
        label: 'DesignProvider',
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as DesignSpec;
        return {
          success: true,
          designSpec: parsed,
          provider: 'agentguild_design_engine',
        };
      }
    } catch (err) {
      console.warn('[DesignProvider] Synthesis fallback:', (err as Error).message);
    }

    // Default Fallback Design Specification
    const defaultPalette = isDark
      ? {
          primary: '#d97706', // Amber accent
          secondary: '#71717a',
          background: '#09090b', // Deep carbon
          surface: '#18181b', // Dark surface
          textPrimary: '#fafafa',
          textSecondary: '#a1a1aa',
          accent: '#f59e0b',
          border: '#27272a',
        }
      : {
          primary: '#18181b',
          secondary: '#52525b',
          background: '#ffffff',
          surface: '#f4f4f5',
          textPrimary: '#09090b',
          textSecondary: '#71717a',
          accent: '#d97706',
          border: '#e4e4e7',
        };

    const fallbackSpec: DesignSpec = {
      colorPalette: defaultPalette,
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        headingScale: 'text-3xl sm:text-5xl font-extrabold tracking-tight',
        bodyScale: 'text-sm sm:text-base leading-relaxed',
      },
      layoutStructure: {
        containerWidth: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
        gridColumns: 4,
        spacingUnit: '4',
      },
      componentSpecs: [
        { name: 'Navbar', purpose: 'Sticky header with search bar, cart toggle, and brand insignia' },
        { name: 'HeroBanner', purpose: 'High-impact landing hero with CTAs' },
        { name: 'ProductGrid', purpose: 'Filterable product listing' },
        { name: 'ProductCard', purpose: 'Interactive product card with hover animations and direct add-to-cart' },
        { name: 'CartDrawer', purpose: 'Slide-out shopping bag drawer with subtotal calculations' },
        { name: 'CheckoutForm', purpose: 'Streamlined checkout summary and simulated payment' },
        { name: 'Footer', purpose: 'Brand links, newsletter signup, and policy badges' },
      ],
    };

    return {
      success: true,
      designSpec: fallbackSpec,
      provider: 'agentguild_design_engine (deterministic fallback)',
    };
  }
}
