import type { City } from "@/features/cities/types";

const POSITION_STEP = 1024;
const MAX_SAFE_POSITION = 9007199254740991;

type OrderedCity = Pick<City, "id" | "name" | "position">;

export interface PlannedCityMove<T extends OrderedCity> {
  cities: T[];
  beforeCityId?: string;
  afterCityId?: string;
  previousBeforeCityId?: string;
  previousAfterCityId?: string;
}

export function sortCitiesByPosition<T extends Pick<City, "id" | "name" | "position">>(cities: T[]): T[] {
  return [...cities].sort((left, right) => left.position - right.position || left.name.localeCompare(right.name, "pt-BR") || left.id.localeCompare(right.id));
}

export function normalizeCityPositions<T extends OrderedCity>(cities: T[]): T[] {
  return cities.map((city, index) => {
    const position = (index + 1) * POSITION_STEP;
    if (position > MAX_SAFE_POSITION) throw new RangeError("posição segura esgotada para cidades");
    return { ...city, position };
  });
}

export function moveCityInDirection<T extends OrderedCity>(cities: T[], cityId: string, direction: "up" | "down"): PlannedCityMove<T> | null {
  const orderedCities = sortCitiesByPosition(cities);
  const currentIndex = orderedCities.findIndex((city) => city.id === cityId);
  if (currentIndex < 0) return null;
  const targetIndex = currentIndex + (direction === "up" ? -1 : 1);
  if (targetIndex < 0 || targetIndex >= orderedCities.length) return null;

  const city = orderedCities[currentIndex];
  const remainingCities = orderedCities.filter((item) => item.id !== cityId);
  const nextOrder = [...remainingCities];
  nextOrder.splice(targetIndex, 0, city);

  return {
    cities: normalizeCityPositions(nextOrder),
    beforeCityId: nextOrder[targetIndex - 1]?.id,
    afterCityId: nextOrder[targetIndex + 1]?.id,
    previousBeforeCityId: orderedCities[currentIndex - 1]?.id,
    previousAfterCityId: orderedCities[currentIndex + 1]?.id,
  };
}

export function restoreCityOrder<T extends OrderedCity>(cities: T[], cityId: string, previousBeforeCityId?: string, previousAfterCityId?: string): T[] {
  const orderedCities = sortCitiesByPosition(cities);
  const city = orderedCities.find((item) => item.id === cityId);
  if (!city) return orderedCities;

  const remainingCities = orderedCities.filter((item) => item.id !== cityId);
  let insertionIndex = remainingCities.length;

  if (previousBeforeCityId) {
    const previousBeforeIndex = remainingCities.findIndex((item) => item.id === previousBeforeCityId);
    if (previousBeforeIndex >= 0) insertionIndex = previousBeforeIndex + 1;
  } else if (previousAfterCityId) {
    const previousAfterIndex = remainingCities.findIndex((item) => item.id === previousAfterCityId);
    if (previousAfterIndex >= 0) insertionIndex = previousAfterIndex;
    else insertionIndex = 0;
  } else {
    insertionIndex = 0;
  }

  const nextOrder = [...remainingCities];
  nextOrder.splice(insertionIndex, 0, city);
  return normalizeCityPositions(nextOrder);
}
