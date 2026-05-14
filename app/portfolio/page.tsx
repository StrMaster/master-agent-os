"use client";

import { useState, useEffect, useCallback } from "react";

type ProductSale = {
  date: string;
  amount: number;
  platform: string;
};

type PortfolioProduct = {
  id: string;
  name: string;
  niche: string;
  productType: string;
  status: string;
  platform: string[];
  price: number;
  sales: ProductSale[];
  totalRevenue: number;
  listingUrl?: string;
  createdAt: string;
};

type Stats = {
  totalRevenue: number;
  totalSales: number;
  activeProducts: number;
  readyProducts: number;
  totalProducts: number;
};

const STATUS_STYLE: Record<string, string> = {
  building: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  ready: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  listed: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  selling: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  paused: "border-white/10 bg-white/5 text-white/40",
};

const STATUSES = ["building", "ready", "listed", "selling", "paused"];

export default function PortfolioPage() {
  const [products, setProducts] = useState<PortfolioProduct[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingSale, setAddingSale] = useState<string | null>(null);
  const [saleAmount, setSaleAmount] = useState("");
  const [salePlatform, setSalePlatform] = useState("Etsy");
  const [form, setForm] = useState({
    name: "", niche: "", productType: "digital-template",
    status: "ready", platform: "Etsy", price: "", listingUrl: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setProducts(data.products);
        setStats(data.stats);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addProduct() {
    if (!form.name.trim()) return;
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        ...form,
        platform: [form.platform],
        price: parseFloat(form.price) || 0,
      }),
    });
    setAdding(false);
    setForm({ name: "", niche: "", productType: "digital-template", status: "ready", platform: "Etsy", price: "", listingUrl: "" });
    await load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, update: { status } }),
    });
    await load();
  }

  async function recordSale(productId: string) {
    if (!saleAmount) return;
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add-sale", productId, amount: parseFloat(saleAmount), platform: salePlatform }),
    });
    setAddingSale(null);
    setSaleAmount("");
    await load();
  }

  async function deleteProduct(id: string) {
    await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="mt-2 text-sm text-white/60">Track all digital products, sales, and revenue.</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-200 hover:bg-violet-500/20 transition"
        >
          + Add Product
        </button>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            { label: "Total Products", value: stats.totalProducts },
            { label: "Selling", value: stats.activeProducts },
            { label: "Ready/Listed", value: stats.readyProducts },
            { label: "Total Sales", value: stats.totalSales },
            { label: "Total Revenue", value: `$${stats.totalRevenue.toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/30">{s.label}</div>
              <div className="mt-2 text-xl font-bold text-white">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Add Product</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Product Name", key: "name", placeholder: "e.g. Minimal CV Template" },
              { label: "Niche", key: "niche", placeholder: "e.g. job seekers" },
              { label: "Price ($)", key: "price", placeholder: "e.g. 9.99" },
              { label: "Listing URL", key: "listingUrl", placeholder: "https://etsy.com/..." },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-sm text-white/60">{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30"
                />
              </div>
            ))}
            <div>
              <label className="text-sm text-white/60">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white"
              >
                {["Etsy", "Gumroad", "Creative Market", "Payhip", "Lemon Squeezy"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={addProduct} className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-2.5 text-sm text-violet-200 hover:bg-violet-500/20 transition">
              Add Product
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/60 hover:bg-white/10 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {products.length === 0 && !adding ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/50">
          No products yet. Add your first product or complete a pipeline.
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-white">{product.name}</span>
                    <span className={`rounded-lg border px-2 py-0.5 text-xs ${STATUS_STYLE[product.status] ?? STATUS_STYLE.paused}`}>
                      {product.status}
                    </span>
                    <span className="text-xs text-white/30">{product.platform.join(", ")}</span>
                  </div>
                  <div className="mt-1 text-xs text-white/40">{product.niche} · ${product.price} · {product.productType}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-400">${product.totalRevenue.toFixed(2)}</div>
                  <div className="text-xs text-white/30">{product.sales.length} sales</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <select
                  value={product.status}
                  onChange={(e) => updateStatus(product.id, e.target.value)}
                  className="rounded-lg border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-white"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>

                {product.listingUrl && (
                  
                   <a href={product.listingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-200 hover:bg-blue-500/20 transition"
                  >
                    View Listing
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setAddingSale(addingSale === product.id ? null : product.id)}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 transition"
                >
                  + Record Sale
                </button>

                <button
                  type="button"
                  onClick={() => deleteProduct(product.id)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/40 hover:text-red-400 transition"
                >
                  Delete
                </button>
              </div>

              {addingSale === product.id && (
                <div className="mt-3 flex gap-2 items-center">
                  <input
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    placeholder="Amount $"
                    type="number"
                    className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-sm text-white placeholder-white/30 w-32"
                  />
                  <select
                    value={salePlatform}
                    onChange={(e) => setSalePlatform(e.target.value)}
                    className="rounded-lg border border-white/10 bg-neutral-900 px-2 py-1.5 text-xs text-white"
                  >
                    {["Etsy", "Gumroad", "Creative Market", "Payhip", "Lemon Squeezy"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => recordSale(product.id)}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20 transition"
                  >
                    Save
                  </button>
                </div>
              )}

              {product.sales.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-white/30 uppercase tracking-wide">Recent Sales</div>
                  {product.sales.slice(0, 3).map((sale, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-white/50">
                      <span>{new Date(sale.date).toLocaleDateString()} · {sale.platform}</span>
                      <span className="text-emerald-400">${sale.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
