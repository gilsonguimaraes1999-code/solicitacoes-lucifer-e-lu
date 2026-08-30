import { describe, expect, it } from "vitest";
import { cityIdsSchema, cityNameSchema } from "@/features/cities/schemas";
import { filterCities, sortCitiesByName } from "@/features/cities/filter";
import { mapCityWithCount } from "@/features/cities/api";

const cities = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "São Paulo", active: true, created_by: null, created_at: "2026-08-30T00:00:00Z", updated_at: "2026-08-30T00:00:00Z", request_count: 2 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Recife", active: false, created_by: null, created_at: "2026-08-30T00:00:00Z", updated_at: "2026-08-30T00:00:00Z", request_count: 1 },
];

describe("cities domain", () => {
  it("normaliza o nome e exige UUIDs distintos", () => {
    expect(cityNameSchema.parse("  São Paulo  ")).toBe("São Paulo");
    expect(() => cityIdsSchema.parse([])).toThrow("Selecione pelo menos uma cidade.");
    expect(() => cityIdsSchema.parse([cities[0].id, cities[0].id])).toThrow("Não repita cidades.");
  });

  it("rejeita UUIDs repetidos com capitalização diferente", () => {
    expect(() => cityIdsSchema.parse([cities[0].id, cities[0].id.toUpperCase()])).toThrow("Não repita cidades.");
  });

  it("filtra por estado e ordena pelo nome", () => {
    expect(filterCities(cities, "active", "são").map((city) => city.name)).toEqual(["São Paulo"]);
    expect(sortCitiesByName(cities, "asc").map((city) => city.name)).toEqual(["Recife", "São Paulo"]);
  });

  it("converte a relação de contagem ausente em zero", () => {
    const { request_count, ...rawCity } = cities[0];

    expect(mapCityWithCount(rawCity)).toEqual({ ...rawCity, request_count: 0 });
  });
});
