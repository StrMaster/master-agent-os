import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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

async function getProducts() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/digital-products`, {
      cache: "no-store",
    });
    const data = await res.json();
    return Array.isArray(data.products) ? data.products : [];
  } catch {
    return [];
  }
}

export default async function DigitalProductsPage() {
  const products = await getProducts();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-white sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">Digital Products</h1>
        <p className="mt-2 text-sm text-white/60">
          Generate and manage digital products for Etsy, Gumroad, and other platforms.
        </p>
      </div>

      <form action={async (formData: FormData) => {
        "use server";
        const type = formData.get("type") as string;
        const prompt = formData.get("prompt") as string;
        const style = formData.get("style") as string;

        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/digital-products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, prompt, style }),
        });

        redirect("/digital-products");
      }} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Generate New Product</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-white/60">Product Type</label>
            <select name="type" className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white">
              {PRODUCT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/60">Style</label>
            <input name="style" placeholder="modern, minimal, colorful..." className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30" />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60">Description / Requirements</label>
          <textarea name="prompt" rows={3} placeholder="Describe what you want..." className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/30" />
        </div>

        <button type="submit" className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-6 py-3 text-sm text-violet-200 hover:bg-violet-500/20 transition">
          Generate Product
        </button>
      </form>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Generated Products ({products.length})</h2>
        {products.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
            No products yet. Generate your first digital product above.
          </div>
        ) : (
          products.map((product: any) => (
            <div key={product.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">{product.title}</div>
                  <div className="mt-1 text-xs text-white/40">{product.type} · {new Date(product.createdAt).toLocaleDateString()}</div>
                </div>
                {product.etysListing?.price && (
                  <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
                    ${product.etysListing.price}
                  </span>
                )}
              </div>

              {product.etysListing?.tags && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {product.etysListing.tags.slice(0, 6).map((tag: string) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">{tag}</span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                
                  href={`/api/digital-products/preview?id=${product.id}`}
                  target="_blank"
                  className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200 hover:bg-blue-500/20"
                >
                  Preview HTML
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
