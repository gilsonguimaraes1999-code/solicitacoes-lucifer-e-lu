import { cityNameSchema } from "@/features/cities/schemas";
import type { City, CityReorderPlacement, CityWithCount } from "@/features/cities/types";
import { createBrowserClient } from "@/lib/supabase/browser";

type CityWithRawCount = City & { request_cities?: Array<{ count: number }> };

export function mapCityWithCount(raw: CityWithRawCount): CityWithCount {
  const { request_cities, ...city } = raw;
  return { ...city, request_count: request_cities?.[0]?.count ?? 0 };
}

export async function listCities() {
  const response = await createBrowserClient()
    .from("cities")
    .select("*, request_cities(count)")
    .order("position")
    .order("name")
    .order("id");
  if (response.error) throw response.error;
  return ((response.data ?? []) as CityWithRawCount[]).map(mapCityWithCount);
}

export async function createCity(name: string) {
  const parsed = cityNameSchema.parse(name);
  const response = await createBrowserClient().rpc("create_city", { new_name: parsed });
  if (response.error) throw response.error;
  return response.data as City;
}

export async function renameCity(id: string, name: string) {
  const parsed = cityNameSchema.parse(name);
  const response = await createBrowserClient().rpc("rename_city", { city_id: id, new_name: parsed });
  if (response.error) throw response.error;
  return response.data as City;
}

export async function deactivateCity(id: string) {
  const response = await createBrowserClient().rpc("deactivate_city", { city_id: id });
  if (response.error) throw response.error;
  return response.data as City;
}

export async function reactivateCity(id: string) {
  const response = await createBrowserClient().rpc("reactivate_city", { city_id: id });
  if (response.error) throw response.error;
  return response.data as City;
}

export async function reorderCity(id: string, placement: CityReorderPlacement) {
  const response = await createBrowserClient().rpc("reorder_city", {
    city_id: id,
    before_city_id: placement.beforeCityId ?? null,
    after_city_id: placement.afterCityId ?? null,
  });
  if (response.error) throw response.error;
  return (response.data ?? []) as City[];
}
