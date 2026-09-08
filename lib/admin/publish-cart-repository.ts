import "server-only";
import type { LibraryAsset } from "./asset-library";
import { getSupabaseConfig } from "./supabase-config";

type Row = Record<string, any>;
export type PublishCartItem = {
  id: string; cartDate: string; position: number; assetId: string;
  assetSource: "hook_clip" | "vizard"; dramaId: string; dramaSlug: string;
  dramaTitle: string; episodeNumber: number; title: string; videoUrl: string;
  durationSeconds: number; status: "cart" | "removed" | "scheduled"; createdAt: string;
};

async function request(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig();
  if (!config.configured) throw new Error("Supabase is not configured");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init, cache: "no-store", headers: {
      apikey: config.key, Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json", ...init.headers,
    },
  });
  if (!response.ok) throw new Error((await response.text()) || `Supabase ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const fromRow = (row: Row): PublishCartItem => ({
  id: row.id, cartDate: row.cart_date, position: row.position, assetId: row.asset_id,
  assetSource: row.asset_source, dramaId: row.drama_id, dramaSlug: row.drama_slug,
  dramaTitle: row.drama_title, episodeNumber: row.episode_number, title: row.title,
  videoUrl: row.video_url, durationSeconds: Number(row.duration_seconds || 0),
  status: row.status, createdAt: row.created_at,
});

export async function listPublishCartItems(dates: string[]) {
  if (!dates.length) return [];
  const rows = await request(`publish_cart_items?cart_date=in.(${dates.join(",")})&status=eq.cart&select=*&order=cart_date.asc,position.asc`) as Row[];
  return rows.map(fromRow);
}
export async function addPublishCartItem(cartDate: string, asset: LibraryAsset) {
  const result = await request("rpc/add_publish_cart_item", { method: "POST", body: JSON.stringify({
    p_cart_date: cartDate, p_asset_id: asset.id, p_asset_source: asset.source,
    p_drama_id: asset.dramaId, p_drama_slug: asset.dramaSlug, p_drama_title: asset.dramaTitle,
    p_episode_number: asset.episodeNumber, p_title: asset.title, p_video_url: asset.videoUrl,
    p_duration_seconds: asset.durationSeconds,
  }) }) as Row | Row[];
  return fromRow(Array.isArray(result) ? result[0] : result);
}
export async function removePublishCartItem(id: string) {
  await request("rpc/remove_publish_cart_item", { method: "POST", body: JSON.stringify({ p_item_id: id }) });
}
export async function reorderPublishCartItems(cartDate: string, ids: string[]) {
  const rows = await request("rpc/reorder_publish_cart_items", { method: "POST", body: JSON.stringify({ p_cart_date: cartDate, p_item_ids: ids }) }) as Row[];
  return rows.map(fromRow);
}
