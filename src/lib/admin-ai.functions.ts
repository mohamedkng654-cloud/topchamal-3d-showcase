import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(180),
  brand: z.string().trim().max(100).optional().default(""),
  category: z.string().trim().max(100).optional().default(""),
  existingDescription: z.string().trim().max(1000).optional().default(""),
  language: z.enum(["ar", "fr", "en"]).default("ar"),
});

const outputSchema = z.object({
  description: z.string().min(1).max(800),
  tags: z.array(z.string().min(1).max(40)).min(1).max(12),
  slug: z.string().min(1).max(180),
});

const languageNames = { ar: "Arabic", fr: "French", en: "English" } as const;

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY on the server.");

    const baseUrl = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_completion_tokens: 700,
        messages: [
          {
            role: "system",
            content: `You write concise ecommerce metadata for a Moroccan appliance store. Return only valid JSON. Write the description in ${languageNames[data.language]}. Do not invent technical specifications, warranties, prices, or claims. Use the provided product name as the source of truth. Tags should be short, useful search terms in the same language.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              product_name: data.name,
              brand: data.brand,
              category: data.category,
              existing_description: data.existingDescription,
              output: { description: "60-90 words", tags: "5-10 short tags", slug: "lowercase latin SEO slug" },
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
