import { Redis } from "@upstash/redis";

const PORTFOLIO_KEY = "master-agent-os:portfolio";

export type ProductStatus = "building" | "ready" | "listed" | "selling" | "paused";

export type ProductSale = {
  date: string;
  amount: number;
  platform: string;
};

export type PortfolioProduct = {
  id: string;
  name: string;
  niche: string;
  productType: string;
  status: ProductStatus;
  platform: string[];
  price: number;
  sales: ProductSale[];
  totalRevenue: number;
  pipelineId?: string;
  listingUrl?: string;
  createdAt: string;
  updatedAt: string;
};

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Redis env vars");
  return new Redis({ url, token });
}

export async function getPortfolio(): Promise<PortfolioProduct[]> {
  const redis = getRedis();
  return await redis.get<PortfolioProduct[]>(PORTFOLIO_KEY) ?? [];
}

export async function addProduct(input: Omit<PortfolioProduct, "id" | "sales" | "totalRevenue" | "createdAt" | "updatedAt">): Promise<PortfolioProduct> {
  const product: PortfolioProduct = {
    ...input,
    id: `product-${Date.now()}`,
    sales: [],
    totalRevenue: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const redis = getRedis();
  const existing = await redis.get<PortfolioProduct[]>(PORTFOLIO_KEY) ?? [];
  await redis.set(PORTFOLIO_KEY, [product, ...existing]);
  return product;
}

export async function updateProduct(id: string, update: Partial<PortfolioProduct>): Promise<PortfolioProduct | null> {
  const redis = getRedis();
  const products = await redis.get<PortfolioProduct[]>(PORTFOLIO_KEY) ?? [];
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  products[idx] = { ...products[idx], ...update, updatedAt: new Date().toISOString() };
  await redis.set(PORTFOLIO_KEY, products);
  return products[idx];
}

export async function addSale(productId: string, sale: ProductSale): Promise<PortfolioProduct | null> {
  const redis = getRedis();
  const products = await redis.get<PortfolioProduct[]>(PORTFOLIO_KEY) ?? [];
  const idx = products.findIndex((p) => p.id === productId);
  if (idx === -1) return null;

  products[idx].sales = [sale, ...products[idx].sales];
  products[idx].totalRevenue = products[idx].sales.reduce((sum, s) => sum + s.amount, 0);
  products[idx].updatedAt = new Date().toISOString();
  await redis.set(PORTFOLIO_KEY, products);
  return products[idx];
}

export async function deleteProduct(id: string): Promise<void> {
  const redis = getRedis();
  const products = await redis.get<PortfolioProduct[]>(PORTFOLIO_KEY) ?? [];
  await redis.set(PORTFOLIO_KEY, products.filter((p) => p.id !== id));
}

export async function getPortfolioStats(products: PortfolioProduct[]) {
  const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalSales = products.reduce((sum, p) => sum + p.sales.length, 0);
  const activeProducts = products.filter((p) => p.status === "selling").length;
  const readyProducts = products.filter((p) => p.status === "ready" || p.status === "listed").length;

  return {
    totalRevenue,
    totalSales,
    activeProducts,
    readyProducts,
    totalProducts: products.length,
  };
}
