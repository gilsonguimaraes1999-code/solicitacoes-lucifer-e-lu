import { CitiesPanel } from "@/components/cities/cities-panel";
import { mapCityWithCount } from "@/features/cities/api";
import { requireCityManager } from "@/features/auth/guards";

export default async function CitiesPage() {
  const { supabase } = await requireCityManager();
  const { data, error } = await supabase.from("cities").select("*, request_cities(count)").order("position").order("name").order("id");
  if (error) throw error;
  const initialCities = (data ?? []).map(mapCityWithCount);
  return <CitiesPanel initialCities={initialCities} />;
}
