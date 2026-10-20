import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { dramas } = await getCatalog();
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/browse`, changeFrequency: "daily", priority: .9 },
    { url: `${base}/l/featured`, changeFrequency: "daily", priority: .9 },
    ...dramas.map(drama => ({ url: `${base}/watch/${drama.slug}`, changeFrequency: "weekly" as const, priority: .8 }))
  ];
}
