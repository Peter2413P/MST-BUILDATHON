import type { BuildProvider, BuildRequest, BuildResult, GeneratedFile } from '../types';

export class NextjsBuildProvider implements BuildProvider {
  async generateCode(input: BuildRequest): Promise<BuildResult> {
    const { requirements, designSpec } = input;
    const brand = requirements.brand || 'HUSTLR';
    const primaryColor = designSpec.colorPalette.primary || '#d97706';
    const accentColor = designSpec.colorPalette.accent || '#f59e0b';
    const bgColor = designSpec.colorPalette.background || '#09090b';
    const surfaceColor = designSpec.colorPalette.surface || '#18181b';
    const textPrimary = designSpec.colorPalette.textPrimary || '#fafafa';
    const textSecondary = designSpec.colorPalette.textSecondary || '#a1a1aa';
    const borderColor = designSpec.colorPalette.border || '#27272a';

    const files: GeneratedFile[] = [
      // 1. package.json
      {
        path: 'package.json',
        description: 'Next.js 14 E-Commerce Application Manifest',
        content: JSON.stringify(
          {
            name: `${brand.toLowerCase().replace(/[^a-z0-9]/g, '-')}-store`,
            version: '1.0.0',
            private: true,
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
              lint: 'next lint',
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
              next: '14.2.5',
              lucide_react: '^0.395.0',
            },
            devDependencies: {
              typescript: '^5.4.5',
              '@types/node': '^20.12.7',
              '@types/react': '^18.3.1',
              '@types/react-dom': '^18.3.0',
              autoprefixer: '^10.4.19',
              postcss: '^8.4.38',
              tailwindcss: '^3.4.3',
            },
          },
          null,
          2
        ),
      },

      // 2. tsconfig.json
      {
        path: 'tsconfig.json',
        description: 'TypeScript Configuration',
        content: JSON.stringify(
          {
            compilerOptions: {
              lib: ['dom', 'dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: 'esnext',
              moduleResolution: 'bundler',
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: 'preserve',
              incremental: true,
              plugins: [{ name: 'next' }],
              paths: { '@/*': ['./*'] },
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
            exclude: ['node_modules'],
          },
          null,
          2
        ),
      },

      // 3. tailwind.config.js
      {
        path: 'tailwind.config.js',
        description: 'Tailwind CSS Theme Configuration',
        content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '${primaryColor}',
          accent: '${accentColor}',
          bg: '${bgColor}',
          surface: '${surfaceColor}',
          border: '${borderColor}',
          text: '${textPrimary}',
          muted: '${textSecondary}',
        },
      },
    },
  },
  plugins: [],
};`,
      },

      // 4. types/store.ts
      {
        path: 'types/store.ts',
        description: 'TypeScript Domain Models for E-Commerce Store',
        content: `export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  image: string;
  description: string;
  features: string[];
  sizes: string[];
  inStock: boolean;
  featured?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
}

export interface OrderDetails {
  customerName: string;
  email: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  totalAmount: number;
  items: CartItem[];
}`,
      },

      // 5. data/products.ts
      {
        path: 'data/products.ts',
        description: `Curated 8-Product Mock Dataset for ${brand}`,
        content: `import { Product } from '../types/store';

export const PRODUCTS: Product[] = [
  {
    id: 'p-1',
    name: 'Stealth Carbon Bomber Jacket',
    brand: '${brand}',
    category: 'Outerwear',
    price: 189.99,
    originalPrice: 229.99,
    rating: 4.9,
    reviewCount: 142,
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80',
    description: 'Precision-tailored matte technical shell with thermo-regulating insulation and storm-sealed zippers.',
    features: ['Water-resistant technical membrane', 'Reinforced articulated sleeves', 'Magnetic inner stash pockets'],
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
    featured: true,
  },
  {
    id: 'p-2',
    name: 'Obsidian Minimalist Oversized Hoodie',
    brand: '${brand}',
    category: 'Hoodies',
    price: 98.00,
    rating: 4.8,
    reviewCount: 96,
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80',
    description: 'Ultra-heavyweight 480 GSM French terry cotton with structured dropped shoulders and double-lined hood.',
    features: ['480 GSM 100% Organic French Terry', 'Pre-shrunk vintage wash', 'Hidden side-seam pockets'],
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
    featured: true,
  },
  {
    id: 'p-3',
    name: 'Aero-Fit Technical Cargo Pants',
    brand: '${brand}',
    category: 'Pants',
    price: 135.00,
    originalPrice: 155.00,
    rating: 4.7,
    reviewCount: 88,
    image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&auto=format&fit=crop&q=80',
    description: 'Four-way stretch ripstop fabric engineered with ergonomic knee darts and low-profile modular cargo bays.',
    features: ['DWR weather-shield coating', 'Adjustable cinch cuffs', 'Custom magnetic hardware'],
    sizes: ['30', '32', '34', '36'],
    inStock: true,
    featured: true,
  },
  {
    id: 'p-4',
    name: 'Architect Heavyweight Graphic Tee',
    brand: '${brand}',
    category: 'T-Shirts',
    price: 48.00,
    rating: 4.9,
    reviewCount: 215,
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
    description: 'High-density silk screen typographic graphic on combed heavyweight ringspun jersey with reinforced collar.',
    features: ['260 GSM Combed Ringspun Cotton', 'Anti-fray ribbed collar', 'Seamless boxy silhouette'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    inStock: true,
    featured: true,
  },
  {
    id: 'p-5',
    name: 'Monolith Tactical Crossbody Bag',
    brand: '${brand}',
    category: 'Accessories',
    price: 74.50,
    rating: 4.8,
    reviewCount: 64,
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
    description: 'Cordura ballistic nylon with Fidlock quick-release magnetic buckle and water-repellent compartments.',
    features: ['1000D Cordura Ballistic Nylon', 'Fidlock V-Buckle mechanism', 'Padded tech sleeve'],
    sizes: ['One Size'],
    inStock: true,
    featured: false,
  },
  {
    id: 'p-6',
    name: 'Vanguard Cashmere-Blend Overcoat',
    brand: '${brand}',
    category: 'Outerwear',
    price: 340.00,
    originalPrice: 420.00,
    rating: 5.0,
    reviewCount: 39,
    image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80',
    description: 'Italian wool and virgin cashmere blend single-breasted coat with sharp notch lapels and cupro lining.',
    features: ['75% Virgin Wool / 25% Cashmere', 'Bemberg cupro interior lining', 'Horn button closures'],
    sizes: ['38R', '40R', '42R', '44R'],
    inStock: true,
    featured: false,
  },
  {
    id: 'p-7',
    name: 'Nomad Relaxed Linen Resort Shirt',
    brand: '${brand}',
    category: 'Shirts',
    price: 82.00,
    rating: 4.6,
    reviewCount: 52,
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
    description: 'Breathable 100% Belgian flax linen with camp collar and relaxed drape for effortless warm-weather styling.',
    features: ['100% Washed Belgian Linen', 'Camp collar silhouette', 'Mother of pearl buttons'],
    sizes: ['S', 'M', 'L', 'XL'],
    inStock: true,
    featured: false,
  },
  {
    id: 'p-8',
    name: 'Apex Precision Knit Sneakers',
    brand: '${brand}',
    category: 'Footwear',
    price: 165.00,
    rating: 4.9,
    reviewCount: 178,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
    description: 'Seamless adaptive knit upper paired with high-rebound EVA midsole and textured grip outsole.',
    features: ['Adaptive 3D Knit upper', 'Responsive energy-return midsole', 'Ergonomic heel counter'],
    sizes: ['8', '9', '10', '11', '12'],
    inStock: true,
    featured: false,
  },
];

export const CATEGORIES = ['All', 'Outerwear', 'Hoodies', 'Pants', 'T-Shirts', 'Shirts', 'Accessories', 'Footwear'];`,
      },

      // 6. context/CartContext.tsx
      {
        path: 'context/CartContext.tsx',
        description: 'Shopping Cart State Management Context',
        content: `'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem } from '../types/store';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, size?: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  cartCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToCart = (product: Product, size?: string) => {
    const selectedSize = size || product.sizes[0];
    setCart(prev => {
      const existingIdx = prev.findIndex(
        item => item.product.id === product.id && item.selectedSize === selectedSize
      );
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += 1;
        return next;
      }
      return [...prev, { product, quantity: 1, selectedSize }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        cartCount,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}`,
      },

      // 7. components/Navbar.tsx
      {
        path: 'components/Navbar.tsx',
        description: 'Responsive E-Commerce Navigation Bar',
        content: `'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { cartCount, setIsCartOpen } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-[#27272a] text-[#fafafa]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded bg-[#d97706] text-black font-extrabold flex items-center justify-center text-sm tracking-tighter">
              ${brand.slice(0, 2).toUpperCase()}
            </span>
            <span className="font-extrabold tracking-widest text-lg uppercase group-hover:text-[#f59e0b] transition-colors">
              ${brand}
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wider font-semibold text-[#a1a1aa]">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/products" className="hover:text-white transition-colors">Shop All</Link>
            <Link href="/products?category=Outerwear" className="hover:text-white transition-colors">Outerwear</Link>
            <Link href="/products?category=Hoodies" className="hover:text-white transition-colors">Hoodies</Link>
            <Link href="/products?category=Accessories" className="hover:text-white transition-colors">Accessories</Link>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <Link
            href="/products"
            className="p-2 text-[#a1a1aa] hover:text-white transition-colors"
            title="Search Products"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>

          {/* Cart Button with Count Badge */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 rounded-lg bg-[#18181b] border border-[#27272a] hover:border-[#d97706] text-[#fafafa] transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="text-xs font-bold font-mono">Bag</span>
            {cartCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#d97706] text-black font-extrabold text-[10px] flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-[#a1a1aa] hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-4 bg-[#18181b] border-b border-[#27272a] space-y-2 text-sm font-semibold uppercase">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-white">Home</Link>
          <Link href="/products" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-white">Shop All</Link>
          <Link href="/products?category=Outerwear" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-[#a1a1aa]">Outerwear</Link>
          <Link href="/products?category=Hoodies" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-[#a1a1aa]">Hoodies</Link>
          <Link href="/checkout" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-[#f59e0b]">Checkout</Link>
        </div>
      )}
    </header>
  );
}`,
      },

      // 8. components/ProductCard.tsx
      {
        path: 'components/ProductCard.tsx',
        description: 'Interactive Product Grid Tile Component',
        content: `'use client';

import React from 'react';
import Link from 'next/link';
import { Product } from '../types/store';
import { useCart } from '../context/CartContext';

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();

  return (
    <div className="group rounded-xl bg-[#18181b] border border-[#27272a] overflow-hidden hover:border-[#d97706]/60 transition-all duration-300 flex flex-col shadow-md">
      {/* Product Image Tile */}
      <Link href={\`/products/\${product.id}\`} className="relative aspect-square overflow-hidden bg-black/40 block">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />
        {product.originalPrice && (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#d97706] text-black">
            Sale
          </span>
        )}
        <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-mono bg-black/70 text-zinc-300 backdrop-blur-sm">
          {product.category}
        </span>
      </Link>

      {/* Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-[#a1a1aa] mb-1">
            <span className="font-mono text-[10px] uppercase">{product.brand}</span>
            <span className="flex items-center gap-1 text-[#f59e0b]">
              ★ <span className="font-mono text-[11px] text-zinc-300">{product.rating}</span>
            </span>
          </div>
          <Link href={\`/products/\${product.id}\`}>
            <h3 className="font-semibold text-sm text-[#fafafa] line-clamp-1 group-hover:text-[#f59e0b] transition-colors">
              {product.name}
            </h3>
          </Link>
          <p className="text-xs text-[#a1a1aa] line-clamp-2 mt-1">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#27272a]">
          <div>
            <span className="text-base font-bold font-mono text-white">
              \${product.price.toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="ml-2 text-xs line-through text-zinc-500 font-mono">
                \${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          <button
            onClick={() => addToCart(product)}
            className="px-3 py-1.5 rounded-lg bg-[#d97706] hover:bg-[#b45309] text-black font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Add +
          </button>
        </div>
      </div>
    </div>
  );
}`,
      },

      // 9. components/CartDrawer.tsx
      {
        path: 'components/CartDrawer.tsx',
        description: 'Slide-out Shopping Bag Drawer with Real-Time Subtotal',
        content: `'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '../context/CartContext';

export default function CartDrawer() {
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, subtotal } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#09090b] border-l border-[#27272a] text-[#fafafa] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm uppercase tracking-wider">Your Shopping Bag</span>
              <span className="text-xs font-mono text-[#a1a1aa]">({cart.length} items)</span>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1 rounded-md text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 text-xs space-y-3">
                <p>Your bag is currently empty.</p>
                <Link
                  href="/products"
                  onClick={() => setIsCartOpen(false)}
                  className="inline-block px-4 py-2 rounded bg-[#d97706] text-black font-bold text-xs uppercase tracking-wider"
                >
                  Discover Catalogue
                </Link>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={\`\${item.product.id}-\${item.selectedSize}\`}
                  className="flex gap-3 p-3 rounded-lg bg-[#18181b] border border-[#27272a]"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-16 h-16 rounded object-cover object-center bg-black/30 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-white truncate">{item.product.name}</h4>
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      Size: {item.selectedSize} · \${item.product.price.toFixed(2)}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-[#27272a] rounded">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="px-2 py-0.5 text-xs text-zinc-400 hover:text-white"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-mono font-bold text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="px-2 py-0.5 text-xs text-zinc-400 hover:text-white"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-[10px] text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout */}
          {cart.length > 0 && (
            <div className="p-4 bg-[#18181b] border-t border-[#27272a] space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Subtotal</span>
                <span className="font-mono font-bold text-white text-base">\${subtotal.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-zinc-500">Shipping & taxes calculated at checkout.</p>
              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="w-full block py-3 rounded-lg bg-[#d97706] hover:bg-[#b45309] text-black font-extrabold text-center text-xs uppercase tracking-wider transition-colors shadow-lg"
              >
                Proceed to Checkout →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}`,
      },

      // 10. components/Footer.tsx
      {
        path: 'components/Footer.tsx',
        description: 'Brand Footer Component',
        content: `import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#09090b] border-t border-[#27272a] text-[#a1a1aa] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <span className="font-extrabold tracking-widest text-lg uppercase text-white">${brand}</span>
          <p className="text-xs leading-relaxed text-zinc-400">
            ${requirements.tagline || 'Engineered for the Modern Standard. Premium apparel crafted without compromise.'}
          </p>
        </div>
        <div>
          <h4 className="text-xs uppercase font-bold text-white tracking-wider mb-3">Shop</h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/products" className="hover:text-white">All Products</Link></li>
            <li><Link href="/products?category=Outerwear" className="hover:text-white">Outerwear</Link></li>
            <li><Link href="/products?category=Hoodies" className="hover:text-white">Hoodies</Link></li>
            <li><Link href="/products?category=Footwear" className="hover:text-white">Footwear</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs uppercase font-bold text-white tracking-wider mb-3">Company</h4>
          <ul className="space-y-2 text-xs">
            <li><span className="hover:text-white cursor-pointer">About Us</span></li>
            <li><span className="hover:text-white cursor-pointer">Sustainability</span></li>
            <li><span className="hover:text-white cursor-pointer">Store Locator</span></li>
            <li><span className="hover:text-white cursor-pointer">Careers</span></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="text-xs uppercase font-bold text-white tracking-wider">Stay Connected</h4>
          <p className="text-xs text-zinc-400">Subscribe to receive exclusive collection drops.</p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="px-3 py-1.5 rounded bg-[#18181b] border border-[#27272a] text-xs text-white placeholder-zinc-500 flex-1 focus:outline-none focus:border-[#d97706]"
            />
            <button className="px-3 py-1.5 rounded bg-[#d97706] text-black font-bold text-xs uppercase">
              Join
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-[#27272a] flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500">
        <span>© {new Date().getFullYear()} ${brand}. All rights reserved.</span>
        <span>Built autonomously by AgentGuild ECommerceWebsiteBuilderAgent.</span>
      </div>
    </footer>
  );
}`,
      },

      // 11. app/layout.tsx
      {
        path: 'app/layout.tsx',
        description: 'Root Storefront Layout',
        content: `import React from 'react';
import { CartProvider } from '../context/CartContext';
import Navbar from '../components/Navbar';
import CartDrawer from '../components/CartDrawer';
import Footer from '../components/Footer';

export const metadata = {
  title: '${brand} | Premium E-Commerce Store',
  description: '${requirements.purpose || `Official online store for ${brand}`}',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark bg-[#09090b]">
      <body className="min-h-screen flex flex-col bg-[#09090b] text-[#fafafa] antialiased selection:bg-[#d97706] selection:text-black">
        <CartProvider>
          <Navbar />
          <CartDrawer />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}`,
      },

      // 12. app/page.tsx
      {
        path: 'app/page.tsx',
        description: 'Storefront Homepage with Hero, Featured Grid, and Value Props',
        content: `import React from 'react';
import Link from 'next/link';
import { PRODUCTS } from '../data/products';
import ProductCard from '../components/ProductCard';

export default function HomePage() {
  const featured = PRODUCTS.filter(p => p.featured);

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#18181b] border-b border-[#27272a] py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl space-y-6">
            <span className="px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider bg-[#d97706]/15 text-[#f59e0b] border border-[#d97706]/30">
              New Season Drop
            </span>
            <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white leading-none">
              ${brand} <span className="text-[#f59e0b]">Signature</span> Series
            </h1>
            <p className="text-base sm:text-lg text-zinc-300 leading-relaxed">
              ${requirements.tagline || 'Engineered for the Modern Standard. Minimalist performance apparel designed to perform across every environment.'}
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href="/products"
                className="px-6 py-3.5 rounded-lg bg-[#d97706] hover:bg-[#b45309] text-black font-extrabold uppercase text-xs tracking-wider transition-all shadow-lg"
              >
                Shop Collection →
              </Link>
              <Link
                href="/products?category=Outerwear"
                className="px-6 py-3.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-white font-bold uppercase text-xs tracking-wider transition-colors border border-zinc-700"
              >
                Explore Outerwear
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Featured Drops</h2>
            <p className="text-xs text-zinc-400">Hand-selected iconic pieces from the current release.</p>
          </div>
          <Link href="/products" className="text-xs font-bold uppercase text-[#f59e0b] hover:underline">
            View All ({PRODUCTS.length}) →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Brand Value Propositions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 rounded-2xl bg-[#18181b] border border-[#27272a]">
          <div className="space-y-2">
            <span className="text-2xl">⚡</span>
            <h3 className="text-sm font-bold uppercase text-white">Engineered Materials</h3>
            <p className="text-xs text-zinc-400">Custom technical textiles crafted for supreme longevity and comfort.</p>
          </div>
          <div className="space-y-2">
            <span className="text-2xl">🛡️</span>
            <h3 className="text-sm font-bold uppercase text-white">Lifetime Guarantee</h3>
            <p className="text-xs text-zinc-400">We stand behind the craftsmanship of every garment we construct.</p>
          </div>
          <div className="space-y-2">
            <span className="text-2xl">📦</span>
            <h3 className="text-sm font-bold uppercase text-white">Express Global Shipping</h3>
            <p className="text-xs text-zinc-400">Worldwide tracked courier delivery with seamless hassle-free returns.</p>
          </div>
        </div>
      </section>
    </div>
  );
}`,
      },

      // 13. app/products/page.tsx
      {
        path: 'app/products/page.tsx',
        description: 'Complete Filterable E-Commerce Product Catalogue',
        content: `'use client';

import React, { useState } from 'react';
import { PRODUCTS, CATEGORIES } from '../../data/products';
import ProductCard from '../../components/ProductCard';

export default function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');

  const filtered = PRODUCTS.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#27272a] pb-6">
        <div>
          <span className="text-xs font-mono uppercase text-[#f59e0b] tracking-wider">Catalogue</span>
          <h1 className="text-3xl font-black uppercase text-white tracking-tight">All Products</h1>
          <p className="text-xs text-zinc-400 mt-1">Showing {filtered.length} curated apparel and gear items.</p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#d97706]"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3.5 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-xs text-white focus:outline-none focus:border-[#d97706]"
          >
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={\`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all shrink-0 \${
              selectedCategory === category
                ? 'bg-[#d97706] text-black shadow-md'
                : 'bg-[#18181b] text-zinc-400 hover:text-white border border-[#27272a]'
            }\`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-zinc-500 text-sm">
          No products matched your search or category filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}`,
      },

      // 14. app/checkout/page.tsx
      {
        path: 'app/checkout/page.tsx',
        description: 'Instant Checkout Flow with Order Summary',
        content: `'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';

export default function CheckoutPage() {
  const { cart, subtotal, clearCart } = useCart();
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: 'Alex Mercer',
    email: 'alex.mercer@example.com',
    address: '742 Evergreen Terrace',
    city: 'San Francisco',
    postal: '94107',
  });

  const shipping = subtotal > 150 || subtotal === 0 ? 0 : 15;
  const total = subtotal + shipping;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSuccess(true);
    clearCart();
  };

  if (isSuccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 text-3xl flex items-center justify-center mx-auto">
          ✓
        </div>
        <h1 className="text-2xl font-black uppercase text-white">Order Confirmed!</h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Thank you for choosing ${brand}. A confirmation email and tracking link have been dispatched to {formData.email}.
        </p>
        <div className="pt-4">
          <Link
            href="/products"
            className="inline-block px-6 py-3 rounded-lg bg-[#d97706] text-black font-extrabold text-xs uppercase tracking-wider"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Form */}
        <div className="lg:col-span-7 space-y-6">
          <h1 className="text-2xl font-black uppercase text-white tracking-tight">Express Checkout</h1>
          <form onSubmit={handleSubmit} className="space-y-4 bg-[#18181b] p-6 rounded-2xl border border-[#27272a]">
            <h3 className="text-xs font-bold uppercase text-[#f59e0b] tracking-wider">Shipping Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-black/50 border border-[#27272a] text-xs text-white focus:outline-none focus:border-[#d97706]"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-black/50 border border-[#27272a] text-xs text-white focus:outline-none focus:border-[#d97706]"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 block mb-1">Street Address</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 rounded bg-black/50 border border-[#27272a] text-xs text-white focus:outline-none focus:border-[#d97706]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">City</label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-black/50 border border-[#27272a] text-xs text-white focus:outline-none focus:border-[#d97706]"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Postal Code</label>
                <input
                  type="text"
                  required
                  value={formData.postal}
                  onChange={e => setFormData({ ...formData, postal: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-black/50 border border-[#27272a] text-xs text-white focus:outline-none focus:border-[#d97706]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-lg bg-[#d97706] hover:bg-[#b45309] text-black font-extrabold uppercase text-xs tracking-wider transition-colors shadow-lg mt-4"
            >
              Complete Order (\${total.toFixed(2)}) →
            </button>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5 bg-[#18181b] p-6 rounded-2xl border border-[#27272a] h-fit space-y-4">
          <h3 className="text-xs font-bold uppercase text-white tracking-wider">Order Summary</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <img src={item.product.image} alt={item.product.name} className="w-10 h-10 rounded object-cover" />
                  <div>
                    <p className="font-semibold text-white truncate max-w-[160px]">{item.product.name}</p>
                    <p className="text-[10px] text-zinc-400">Qty: {item.quantity}</p>
                  </div>
                </div>
                <span className="font-mono text-zinc-200">\${(item.product.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#27272a] pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span className="font-mono text-white">\${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Shipping</span>
              <span className="font-mono text-white">{shipping === 0 ? 'Free' : \`\$\${shipping.toFixed(2)}\`}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-[#27272a]">
              <span>Total</span>
              <span className="font-mono text-[#f59e0b]">\${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}`,
      },
    ];

    return {
      success: true,
      files,
      provider: 'NextjsBuildProvider',
    };
  }
}
