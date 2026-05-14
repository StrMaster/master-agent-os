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
