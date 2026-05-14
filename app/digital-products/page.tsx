"use client";

import { useState } from "react";

const PRODUCT_TYPES = [
  { value: "cv-template", label: "CV Template" },
  { value: "invoice-template", label: "Invoice Template" },
  { value: "planner-template", label: "Planner Template" },
  { value: "prompt-pack", label: "Prompt Pack" },
  { value: "mini-ebook", label: "Mini Ebook" },
  { value: "social-media-kit", label: "Social Media Kit" },
  { value: "bio-link-page", label: "Bio Link Page" },
  { value: "seo-audit-report", label: "SEO Audit Report" },
  { value: "budget-tracker", label: "Budget Tracker" },
  { value: "meal-planner", label: "Meal Planner" },
  { value: "habit-tracker", label: "Habit Tracker" },
  { value: "business-plan", label: "Business Plan" },
  { value: "social-media-calendar", label: "Social Media Calendar" },
  { value: "wedding-checklist", label: "Wedding Checklist" },
  { value: "study-guide", label: "Study Guide" },
  { value: "notion-template", label: "Notion Template" },
];

type Product = {
  id: string;
  type: string;
  title: string;
  description: string;
  htmlContent: string;
  etysListing?: {
    price: number;
    tags: string[];
  };
  createdAt: string;
};

export default function DigitalProductsPage() {
  const [type, setType] = useState("cv-template");
  const [style, setStyle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  async function loadProducts() {
    try {
      const res = await fetch("/api/digital-products", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.products)) setProducts(data.products);
    } catch {
      // silent
    }
  }

  async function generate() {
    if (!prompt.trim()) return;
    try {
      setLoading(true);
      const res = await fetch("/api/digital-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, prompt, style }),
      });
      const data = await res.json();
      if (data.ok) await loadProducts();
    } finally {
      setLoading(false);
    }
  }

  useState(() => {
    loadProducts();
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">Digital Products</h1>
        <p className="mt-2 text-sm text-white/60">
          Generate digital products for Etsy, Gumroad, and other platforms.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Generate New Product</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-white/60">Product Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white"
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/60">Style</label>
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="modern, minimal, colorful..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60">Description / Requirements</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe what you want..."
            className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
          />
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={loading || !prompt.trim()}
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-6 py-3 text-sm text-violet-200 hover:bg-violet-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Generating..." : "Generate Product"}
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Generated Products ({products.length})</h2>
        {products.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
            No products yet. Generate your first digital product above.
          </div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">{product.title}</div>
                  <div className="mt-1 text-xs text-white/40">
                    {product.type} · {new Date(product.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {product.etysListing?.price && (
                  <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
                    ${product.etysListing.price}
                  </span>
                )}
              </div>

              {product.etysListing?.tags && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {product.etysListing.tags.slice(0, 6).map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewHtml(product.htmlContent)}
                  className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200 hover:bg-blue-500/20"
                >
                  Preview
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {previewHtml && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl h-[80vh] bg-white rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPreviewHtml(null)}
              className="absolute top-3 right-3 z-10 rounded-lg bg-black/20 px-3 py-1 text-sm text-black hover:bg-black/30"
            >
              Close
            </button>
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full"
              title="Product Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
