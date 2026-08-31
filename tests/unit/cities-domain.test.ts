import { describe, expect, it } from "vitest";
import { cityIdsSchema, cityNameSchema } from "@/features/cities/schemas";
import { filterCities } from "@/features/cities/filter";
import { mapCityWithCount } from "@/features/cities/api";
import { moveCityInDirection, restoreCityOrder, sortCitiesByPosition } from "@/features/cities/ordering";

const cities = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "São Paulo", position: 2048, active: true, created_by: null, created_at: "2026-08-30T00:00:00Z", updated_at: "2026-08-30T00:00:00Z", request_count: 2 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Recife", position: 1024, active: false, created_by: null, created_at: "2026-08-30T00:00:00Z", updated_at: "2026-08-30T00:00:00Z", request_count: 1 },
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

  it("filtra por estado sem alterar a responsabilidade da ordenação", () => {
    expect(filterCities(cities, "active", "são").map((city) => city.name)).toEqual(["São Paulo"]);
  });

  it("ordena por posição persistida, depois nome e id", () => {
    const tiedCities = [
      cities[0],
      cities[1],
      { ...cities[1], id: "33333333-3333-4333-8333-333333333333", name: "Água Branca", position: 2048 },
      { ...cities[1], id: "11111111-1111-4111-8111-111111111111", name: "São Paulo", position: 2048 },
    ];

    expect(sortCitiesByPosition(tiedCities).map((city) => city.id)).toEqual([
      cities[1].id,
      "33333333-3333-4333-8333-333333333333",
      "11111111-1111-4111-8111-111111111111",
      cities[0].id,
    ]);
  });

  it("move a cidade na ordem persistida e produz os vizinhos canônicos", () => {
    const result = moveCityInDirection(cities, cities[0].id, "up");

    expect(result).not.toBeNull();
    expect(result?.beforeCityId).toBeUndefined();
    expect(result?.afterCityId).toBe(cities[1].id);
    expect(result?.cities.map((city) => ({ id: city.id, position: city.position }))).toEqual([
      { id: cities[0].id, position: 1024 },
      { id: cities[1].id, position: 2048 },
    ]);
  });

  it("restaura a cidade perto dos vizinhos anteriores sem apagar reordenações posteriores", () => {
    const currentOrder = [
      { ...cities[1], position: 1024 },
      { ...cities[1], id: "33333333-3333-4333-8333-333333333333", name: "Curitiba", position: 2048 },
      { ...cities[0], position: 3072 },
    ];

    expect(restoreCityOrder(currentOrder, cities[1].id, cities[0].id, undefined).map((city) => ({ name: city.name, position: city.position }))).toEqual([
      { name: "Curitiba", position: 1024 },
      { name: "São Paulo", position: 2048 },
      { name: "Recife", position: 3072 },
    ]);
  });

  it("converte a relação de contagem ausente em zero", () => {
    const { id, name, position, active, created_by, created_at, updated_at } = cities[0];
    const rawCity = { id, name, position, active, created_by, created_at, updated_at };

    expect(mapCityWithCount(rawCity)).toEqual({ ...rawCity, request_count: 0 });
  });
});
