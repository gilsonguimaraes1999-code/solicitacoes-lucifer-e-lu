export interface City {
  id: string;
  name: string;
  position: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CityReorderPlacement {
  beforeCityId?: string;
  afterCityId?: string;
}

export interface CityWithCount extends City { request_count: number }
export type CityFilter = "all" | "active" | "inactive";
export type CitySortOrder = "asc" | "desc";
