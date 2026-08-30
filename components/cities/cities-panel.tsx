"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowDownAZ, ArrowUpAZ, MapPinned, Pencil, RotateCcw, Search, X } from "lucide-react";
import { CityDialog } from "@/components/cities/city-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ToastNotice, type ToastMessage } from "@/components/ui/site-toast";
import { createCity, deactivateCity, listCities, reactivateCity, renameCity } from "@/features/cities/api";
import { filterCities, sortCitiesByName } from "@/features/cities/filter";
import type { City, CityFilter, CitySortOrder, CityWithCount } from "@/features/cities/types";
import { createBrowserClient } from "@/lib/supabase/browser";

const filterLabels: Record<CityFilter, string> = { all: "Todas", active: "Ativas", inactive: "Desativadas" };

function cityErrorMessage(error: unknown) {
  const details = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : {};
  const code = String(details.code ?? "");
  const rawMessage = details.message ?? (error instanceof Error ? error.message : "");
  const message = String(rawMessage).toLocaleLowerCase("pt-BR");
  if (code === "23505" || message.includes("duplicate") || message.includes("duplicada") || message.includes("já existe")) return "Já existe uma cidade com este nome.";
  if (code === "42501" || message.includes("permission") || message.includes("permissão")) return "Você não tem permissão para gerenciar cidades.";
  return "Não foi possível salvar a cidade.";
}

function savedCity(city: CityWithCount, response: CityWithCount | Omit<CityWithCount, "request_count">) {
  return { ...response, request_count: city.request_count } as CityWithCount;
}

export function CitiesPanel({ initialCities }: { initialCities: CityWithCount[] }) {
  const [cities, setCities] = useState(initialCities);
  const [filter, setFilter] = useState<CityFilter>("all");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<CitySortOrder>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<CityWithCount | null>(null);
  const [deactivatingCity, setDeactivatingCity] = useState<CityWithCount | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const cityRevisionRef = useRef(0);
  const cityVersionsRef = useRef(new Map<string, number>());
  const refreshVersionRef = useRef(0);
  const markCityChanged = useCallback((cityId: string) => {
    const revision = cityRevisionRef.current + 1;
    cityRevisionRef.current = revision;
    cityVersionsRef.current.set(cityId, revision);
    return revision;
  }, []);
  const isCurrentCityRevision = useCallback((cityId: string, revision: number) => (
    cityVersionsRef.current.get(cityId) === revision
  ), []);

  useEffect(() => {
    const supabase = createBrowserClient();
    let mounted = true;
    const citiesChannel = supabase.channel("cities-management").on("postgres_changes", { event: "*", schema: "public", table: "cities" }, (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => {
      if (!mounted) return;
      if (payload.eventType === "DELETE") {
        const cityId = (payload.old as { id: string }).id;
        markCityChanged(cityId);
        setCities((current) => current.filter((city) => city.id !== cityId));
        return;
      }
      const updatedCity = payload.new as unknown as City;
      markCityChanged(updatedCity.id);
      setCities((current) => {
        const existing = current.find((city) => city.id === updatedCity.id);
        if (!existing) return [...current, { ...updatedCity, request_count: 0 }];
        return current.map((city) => city.id === updatedCity.id ? savedCity(city, updatedCity) : city);
      });
    }).subscribe();
    const requestCitiesChannel = supabase.channel("request-cities-management").on("postgres_changes", { event: "*", schema: "public", table: "request_cities" }, async () => {
      if (!mounted) return;
      const refreshVersion = refreshVersionRef.current + 1;
      refreshVersionRef.current = refreshVersion;
      const cityRevisionAtStart = cityRevisionRef.current;
      try {
        const refreshedCities = await listCities();
        if (!mounted || refreshVersionRef.current !== refreshVersion) return;
        setCities((current) => {
          const currentById = new Map(current.map((city) => [city.id, city]));
          const refreshedIds = new Set<string>();
          const merged: CityWithCount[] = [];
          for (const refreshedCity of refreshedCities) {
            refreshedIds.add(refreshedCity.id);
            if ((cityVersionsRef.current.get(refreshedCity.id) ?? 0) > cityRevisionAtStart) {
              const latestCity = currentById.get(refreshedCity.id);
              if (latestCity) merged.push({ ...latestCity, request_count: refreshedCity.request_count });
            } else {
              merged.push(refreshedCity);
            }
          }
          for (const currentCity of current) {
            if (!refreshedIds.has(currentCity.id) && (cityVersionsRef.current.get(currentCity.id) ?? 0) > cityRevisionAtStart) {
              merged.push(currentCity);
            }
          }
          return merged;
        });
      } catch {
        // A próxima alteração ou ação administrativa fará uma nova tentativa.
      }
    }).subscribe();
    return () => {
      mounted = false;
      void supabase.removeChannel(citiesChannel);
      void supabase.removeChannel(requestCitiesChannel);
    };
  }, [markCityChanged]);

  const counts = useMemo(() => ({
    all: cities.length,
    active: cities.filter((city) => city.active).length,
    inactive: cities.filter((city) => !city.active).length,
  }), [cities]);
  const filteredCities = useMemo(() => sortCitiesByName(filterCities(cities, filter, query), sortOrder), [cities, filter, query, sortOrder]);

  function closeDialog() {
    setDialogOpen(false);
    setEditingCity(null);
  }

  async function saveCity(name: string) {
    try {
      if (editingCity) {
        const cityId = editingCity.id;
        const mutationRevision = markCityChanged(cityId);
        const response = await renameCity(cityId, name);
        if (isCurrentCityRevision(cityId, mutationRevision)) {
          markCityChanged(cityId);
          setCities((current) => current.map((city) => city.id === cityId ? savedCity(city, response) : city));
        }
        setToast({ tone: "success", text: "Cidade renomeada." });
      } else {
        const response = await createCity(name);
        markCityChanged(response.id);
        setCities((current) => current.some((city) => city.id === response.id) ? current : [...current, { ...response, request_count: 0 }]);
        setToast({ tone: "success", text: "Cidade criada." });
      }
      closeDialog();
    } catch (error) {
      setToast({ tone: "error", text: cityErrorMessage(error) });
      throw error;
    }
  }

  async function confirmDeactivation() {
    if (!deactivatingCity) return;
    const cityId = deactivatingCity.id;
    const mutationRevision = markCityChanged(cityId);
    setPendingId(cityId);
    try {
      const response = await deactivateCity(cityId);
      if (isCurrentCityRevision(cityId, mutationRevision)) {
        markCityChanged(cityId);
        setCities((current) => current.map((city) => city.id === cityId ? savedCity(city, response) : city));
      }
      setToast({ tone: "success", text: "Cidade desativada. O histórico foi preservado." });
      setDeactivatingCity(null);
    } catch (error) {
      setToast({ tone: "error", text: cityErrorMessage(error) });
    } finally {
      setPendingId(null);
    }
  }

  async function reactivate(city: CityWithCount) {
    const mutationRevision = markCityChanged(city.id);
    setPendingId(city.id);
    try {
      const response = await reactivateCity(city.id);
      if (isCurrentCityRevision(city.id, mutationRevision)) {
        markCityChanged(city.id);
        setCities((current) => current.map((item) => item.id === city.id ? savedCity(item, response) : item));
      }
      setToast({ tone: "success", text: "Cidade reativada." });
    } catch (error) {
      setToast({ tone: "error", text: cityErrorMessage(error) });
    } finally {
      setPendingId(null);
    }
  }

  return <main className="relative z-10 px-4 py-6 md:px-6 md:py-8">
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Administração</p><h1 className="mt-1 text-3xl font-black text-white">Cidades</h1><p className="mt-2 text-sm text-white/55">Organize as cidades disponíveis para as solicitações.</p></div>
        <button className="button inline-flex items-center gap-2" onClick={() => { setEditingCity(null); setDialogOpen(true); }}><MapPinned size={18} />Nova cidade</button>
      </header>

      {toast && <ToastNotice text={toast.text} tone={toast.tone} onClose={() => setToast(null)} />}

      <section className="panel mt-5 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" aria-label="Filtrar cidades por status">{(Object.keys(filterLabels) as CityFilter[]).map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`filter-chip ${filter === item ? "active" : ""}`}>{filterLabels[item]} <span>{counts[item]}</span></button>)}</div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><Search className="absolute left-3 top-3 text-white/35" size={18} /><span className="sr-only">Pesquisar cidades</span><input className="field" style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome" />{query && <button type="button" aria-label="Limpar pesquisa" className="absolute right-3 top-3 text-white/45 hover:text-white" onClick={() => setQuery("")}><X size={18} /></button>}</label>
          <button type="button" className="button secondary inline-flex items-center justify-center gap-2" onClick={() => setSortOrder((current) => current === "asc" ? "desc" : "asc")}>{sortOrder === "asc" ? <ArrowDownAZ size={18} /> : <ArrowUpAZ size={18} />}{sortOrder === "asc" ? "A–Z" : "Z–A"}</button>
        </div>
      </section>

      <section className="panel mt-5 overflow-hidden" aria-label="Lista de cidades">
        <div className="hidden grid-cols-[minmax(220px,1.5fr)_150px_130px_112px] gap-4 border-b border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-[.14em] text-white/40 lg:grid"><span>Nome</span><span>Solicitações</span><span>Status</span><span className="sr-only">Ações</span></div>
        {filteredCities.map((city) => <article key={city.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-white/[.075] px-4 py-4 last:border-0 hover:bg-white/[.025] lg:grid-cols-[minmax(220px,1.5fr)_150px_130px_112px] lg:gap-4 lg:px-5">
          <div className="min-w-0"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 text-gold"><MapPinned size={18} /></span><h2 className="truncate font-semibold text-white">{city.name}</h2></div></div>
          <p className="text-sm text-white/55 lg:col-auto"><span className="mr-2 text-xs uppercase tracking-wide text-white/35 lg:hidden">Solicitações</span>{city.request_count}</p>
          <span className={`status-badge ${city.active ? "status-approved" : "status-suspended"}`}>{city.active ? "Ativa" : "Desativada"}</span>
          <div className="col-start-2 row-start-1 flex justify-end gap-2 lg:col-auto lg:row-auto">
            <button type="button" className="icon-button" aria-label={`Renomear ${city.name}`} disabled={pendingId === city.id} onClick={() => { setEditingCity(city); setDialogOpen(true); }}><Pencil size={17} /></button>
            {city.active ? <button type="button" className="icon-button danger-text" aria-label={`Desativar ${city.name}`} disabled={pendingId === city.id} onClick={() => setDeactivatingCity(city)}><Archive size={17} /></button> : <button type="button" className="icon-button text-emerald-300" aria-label={`Reativar ${city.name}`} disabled={pendingId === city.id} onClick={() => void reactivate(city)}><RotateCcw size={17} /></button>}
          </div>
        </article>)}
        {filteredCities.length === 0 && <div className="p-12 text-center text-white/45">Nenhuma cidade encontrada com estes filtros.</div>}
      </section>
    </div>
    {dialogOpen && <CityDialog city={editingCity ?? undefined} onSave={saveCity} onClose={closeDialog} />}
    {deactivatingCity && <ConfirmDialog ariaLabel="Confirmar desativação da cidade" title="Desativar esta cidade?" itemName={deactivatingCity.name} description="A cidade deixará de aparecer para novas solicitações. O histórico das solicitações existentes será preservado." busy={pendingId === deactivatingCity.id} actionLabel="Desativar cidade" busyActionLabel="Desativando..." eyebrow="Ação reversível" onCancel={() => setDeactivatingCity(null)} onConfirm={() => void confirmDeactivation()} />}
  </main>;
}
