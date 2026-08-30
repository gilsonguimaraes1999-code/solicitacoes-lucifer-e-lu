export interface City {
  id: string;
  name: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CityWithCount extends City { request_count: number }
export type CityFilter = "all" | "active" | "inactive";
export type CitySortOrder = "asc" | "desc";
