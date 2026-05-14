import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ThumbnailStyle = {
  palette: string;
  productType: string;
  productTitle: string;
  niche: string;
};

export async function generateEtsyThumbnail(context: ThumbnailStyle): Promise<string> {
  const paletteDescriptions: Record<string, string> = {
    "dark-premium": "dark black background, purple accents, cyber aesthetic, elite luxury",
    "warm-minimal": "warm cream/beige background, gold accents, cozy minimal luxury",
    "clean-professional": "clean white background, blue accents, professional modern",
    "rose-wellness": "soft pink background, rose gold accents, feminine luxury wellness",
    "forest-calm": "deep forest green background, lime accents, nature mindfulness",
    "ocean-focus": "deep navy background, cyan blue accents, focus productivity",
    "gold-luxury": "dark black background, gold accents, premium wealth luxury",
    "soft-lavender": "soft lavender/white background, purple accents, calm sleep",
    "sunset-energy": "dark brown/orange background, orange accents, fitness energy",
  };

  const paletteDesc = paletteDescriptions[context.palette] ?? "premium minimal dark background";

  const prompt = `Create a premium Etsy digital product thumbnail for a "${context.productTitle}" ${context.productType}.

Style: ${paletteDesc}
The image should look like a high-end printable product mockup.
Show 2-3 pages of the planner/tracker slightly overlapping at angles, like a professional product photo.
Include elegant typography showing the product title.
The aesthetic should be: luxury, premium, clean, minimal, sellable on Etsy.
No people, no hands, just the product pages beautifully arranged.
Photorealistic product mockup style.
2:1 or square format works best.`;

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "hd",
  });

  return response.data[0]?.url ?? "";
}
