import type { CityFilter, CitySortOrder, CityWithCount } from "@/features/cities/types";

export function filterCities(cities: CityWithCount[], filter: CityFilter, query: string) {
  const term = query.trim().toLocaleLowerCase("pt-BR");
  return cities.filter((city) => (filter === "all" || city.active === (filter === "active")) && city.name.toLocaleLowerCase("pt-BR").includes(term));
}

export function sortCitiesByName(cities: CityWithCount[], order: CitySortOrder) {
  return [...cities].sort((left, right) => left.name.localeCompare(right.name, "pt-BR") * (order === "asc" ? 1 : -1));
}
