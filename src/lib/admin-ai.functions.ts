import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(180),
  brand: z.string().trim().max(100).optional().default(""),
  category: z.string().trim().max(100).optional().default(""),
  existingDescription: z.string().trim().max(1000).optional().default(""),
  language: z.enum(["ar", "fr", "en"]).default("ar"),
  tone: z.enum(["professional", "friendly", "minimal"]).default("professional"),
  descriptionLength: z.enum(["short", "standard", "long"]).default("standard"),
  tagCount: z.number().int().min(5).max(12).default(8),
});

const outputSchema = z.object({
  description: z.string().min(1).max(800),
  tags: z.array(z.string().min(1).max(40)).min(1).max(12),
  slug: z.string().min(1).max(180),
});

const imageScanInputSchema = z.object({
  imageDataUrl: z.string().startsWith("data:image/").max(8_000_000),
  categories: z.array(z.object({ slug: z.string().max(100), name: z.string().max(120) })).max(60).default([]),
});

const imageScanOutputSchema = z.object({
  name: z.string().max(180),
  brand: z.string().max(100),
  sku: z.string().max(100),
  description: z.string().max(800),
  tags: z.array(z.string().max(40)).max(12),
  slug: z.string().max(180),
  category_slug: z.string().max(100),
  current_price_mad: z.string().max(30),
  original_price_mad: z.string().max(30),
});

const languageNames = { ar: "Arabic", fr: "French", en: "English" } as const;
const toneNames = { professional: "professional and trustworthy", friendly: "warm and friendly", minimal: "minimal and direct" } as const;
const lengthNames = { short: "30-50 words", standard: "60-90 words", long: "100-140 words" } as const;

export const generateProductMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(inputSchema)
  .handler(async ({ data, context }) => {
    const { data: admin, error: adminError } = await context.supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .maybeSingle();

    if (adminError || !admin) throw new Error("Unauthorized: admin access required");

    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY on the server.");

    const baseUrl = (process.env["OPENAI_API_BASE"] || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env["OPENAI_MODEL"] || "gpt-5-mini";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_completion_tokens: 700,
        messages: [
          {
            role: "system",
            content: `You write concise ecommerce metadata for a Moroccan appliance store. Return only valid JSON. Write the description in ${languageNames[data.language]} with a ${toneNames[data.tone]} tone and a target length of ${lengthNames[data.descriptionLength]}. Generate exactly ${data.tagCount} short tags. Do not invent technical specifications, warranties, prices, or claims. Use the provided product name as the source of truth. Tags should be short, useful search terms in the same language.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              product_name: data.name,
              brand: data.brand,
              category: data.category,
              existing_description: data.existingDescription,
              output: { description: lengthNames[data.descriptionLength], tags: `${data.tagCount} short tags`, slug: "lowercase latin SEO slug" },
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "product_metadata",
            strict: true,
            schema: {
              type: "object",
              properties: {
                description: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                slug: { type: "string" },
              },
              required: ["description", "tags", "slug"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${message.slice(0, 240)}`);
    }

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("OpenAI returned invalid product metadata.");
    }
    return outputSchema.parse(parsed);
  });

export const scanProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(imageScanInputSchema)
  .handler(async ({ data, context }) => {
    const { data: admin, error: adminError } = await context.supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (adminError || !admin) throw new Error("Unauthorized: admin access required");

    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY on the server.");
    const baseUrl = (process.env["OPENAI_API_BASE"] || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env["OPENAI_VISION_MODEL"] || process.env["OPENAI_MODEL"] || "gpt-5-mini";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_completion_tokens: 900,
        messages: [
          {
            role: "system",
            content: "You extract ecommerce product data from a product image for a Moroccan home-appliance store. Read visible packaging text, labels, logos, model numbers, and printed prices. Never invent information. If a value is not clearly visible, return an empty string. Return only JSON. Use Arabic when the visible text is Arabic; otherwise preserve the clearest visible language. Choose category_slug only from the supplied category list, otherwise empty.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: JSON.stringify({ task: "extract_visible_product_details", categories: data.categories }) },
              { type: "image_url", image_url: { url: data.imageDataUrl, detail: "high" } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "product_image_scan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                name: { type: "string" }, brand: { type: "string" }, sku: { type: "string" },
                description: { type: "string" }, tags: { type: "array", items: { type: "string" } },
                slug: { type: "string" }, category_slug: { type: "string" },
                current_price_mad: { type: "string" }, original_price_mad: { type: "string" },
              },
              required: ["name", "brand", "sku", "description", "tags", "slug", "category_slug", "current_price_mad", "original_price_mad"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI image scan failed (${response.status}): ${message.slice(0, 240)}`);
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty image scan.");
    try {
      return imageScanOutputSchema.parse(JSON.parse(content));
    } catch {
      throw new Error("OpenAI returned invalid product image data.");
    }
  });
