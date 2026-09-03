"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type CollisionDetection, type DragEndEvent, type Modifier, type ScreenReaderInstructions } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, Search } from "lucide-react";
import { AddColumn } from "@/components/kanban/add-column";
import { BoardNotice, type BoardMessage } from "@/components/kanban/board-notice";
import { BoardFilters } from "@/components/kanban/board-filters";
import { ColumnPreview } from "@/components/kanban/column-preview";
import { clampTransformToRect } from "@/components/kanban/drag-boundary";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { RequestCardPreview } from "@/components/kanban/request-card";
import { RequestDialog } from "@/components/requests/request-dialog";
import { createBoardColumn, deleteBoardColumn, getBoardColumn, renameBoardColumn, reorderBoardColumn } from "@/features/columns/api";
import { columnsReducer, type ColumnsEvent } from "@/features/columns/reducer";
import type { BoardColumn, CreateColumnInput, SystemColumnKey } from "@/features/columns/types";
import type { City } from "@/features/cities/types";
import { createRequest, deleteRequest, getRequest, moveRequest, updateRequest } from "@/features/requests/api";
import { filterBoard } from "@/features/requests/filter";
import { positionBetween, sortRequests } from "@/features/requests/ordering";
import { requestsReducer, type RequestsEvent } from "@/features/requests/reducer";
import type { RequestInput } from "@/features/requests/schemas";
import type { EffectivePermissions, Profile, RequestRecord } from "@/features/requests/types";
import type { RequestTag } from "@/features/requests/tags";
import { createBrowserClient } from "@/lib/supabase/browser";

interface KanbanBoardProps {
  initialRequests: RequestRecord[];
  initialColumns: BoardColumn[];
  cities: City[];
  profiles: Profile[];
  currentUserId: string;
  permissions: EffectivePermissions;
}

type MovementOutcome = "success" | "reloaded" | "rollback" | "stale" | "pending";
type PendingOperation =
  | { kind: "move"; token: symbol; targetColumnId: string; targetPosition: number; realtimeConfirmed: boolean }
  | { kind: "delete"; token: symbol };

type ColumnReorderIntent = {
  token: symbol;
  position: number;
  version: number;
  rpcStarted: boolean;
  realtimeConfirmed: boolean;
  resolve: () => void;
};

type ColumnReorderQueue = {
  active: ColumnReorderIntent;
  queued?: ColumnReorderIntent;
  latest: ColumnReorderIntent;
  rollback: BoardColumn;
};

const boardScreenReaderInstructions: ScreenReaderInstructions = {
  draggable: "Para mover solicitações, pressione a barra de espaço. Use as setas para escolher o destino, pressione a barra de espaço novamente para soltar ou Escape para cancelar. Para mover colunas, use os itens acessíveis do menu de ações da lista.",
};

type DragItemType = "column" | "request";
type ActiveDrag = { id: string; type: DragItemType };
type BoardPan = { pointerId: number; startX: number; startScrollLeft: number };

const boardPanBlockSelector = "[data-board-pan-block], article, button, a, input, select, textarea, [role='button'], [role='menu'], [role='dialog'], [contenteditable='true']";

function dragItemType(data: Record<string, unknown> | undefined): DragItemType | undefined {
  return data?.type === "column" || data?.type === "request" ? data.type : undefined;
}

function boardItemName(type: DragItemType | undefined, id: string, requests: RequestRecord[], columns: BoardColumn[]) {
  if (type === "request") return `solicitação ${requests.find((request) => request.id === id)?.title ?? id}`;
  if (type === "column") return `coluna ${columns.find((column) => column.id === id)?.name ?? id}`;
  return "item não identificado";
}

function boardAnnouncements(requests: RequestRecord[], columns: BoardColumn[]): Announcements {
  return {
    onDragStart: ({ active }) => `Movimento iniciado para ${boardItemName(dragItemType(active.data.current), String(active.id), requests, columns)}.`,
    onDragOver: ({ active, over }) => over
      ? `${boardItemName(dragItemType(active.data.current), String(active.id), requests, columns)} está sobre ${boardItemName(dragItemType(over.data.current), String(over.id), requests, columns)}.`
      : `${boardItemName(dragItemType(active.data.current), String(active.id), requests, columns)} está fora de uma lista.`,
    onDragEnd: ({ active, over }) => over
      ? `${boardItemName(dragItemType(active.data.current), String(active.id), requests, columns)} foi movido para ${boardItemName(dragItemType(over.data.current), String(over.id), requests, columns)}.`
      : `Movimento de ${boardItemName(dragItemType(active.data.current), String(active.id), requests, columns)} encerrado sem destino.`,
    onDragCancel: ({ active }) => `Movimento de ${boardItemName(dragItemType(active.data.current), String(active.id), requests, columns)} cancelado.`,
  };
}

const boardCollisionDetection: CollisionDetection = (args) => {
  const activeType = dragItemType(args.active.data.current);
  if (!activeType) return [];
  const droppableContainers = args.droppableContainers.filter((container) => {
    const targetType = dragItemType(container.data.current);
    return activeType === "column" ? targetType === "column" : targetType === "column" || targetType === "request";
  });
  return closestCenter({ ...args, droppableContainers });
};

function enrichAssignee(request: RequestRecord, profiles: Profile[]): RequestRecord {
  const profile = profiles.find((item) => item.id === request.assigned_to);
  const returnedAssignee = request.assignee?.id === request.assigned_to ? request.assignee : null;
  return {
    ...request,
    assignee: profile ? { id: profile.id, full_name: profile.full_name } : returnedAssignee,
  };
}

function normalizeRequestCities(request: RequestRecord, citiesById: ReadonlyMap<string, City>, profiles: Profile[]) {
  return enrichAssignee({
    ...request,
    cities: request.cities.map((city) => citiesById.get(city.id) ?? city),
  }, profiles);
}

function mergeCanonicalRequest(latest: RequestRecord, canonical: RequestRecord, citiesById: ReadonlyMap<string, City>, profiles: Profile[]) {
  return normalizeRequestCities({ ...latest, ...canonical }, citiesById, profiles);
}

function isOlderColumnUpdate(incoming: BoardColumn, current: BoardColumn | undefined) {
  if (!current) return false;
  const incomingTimestamp = Date.parse(incoming.updated_at);
  const currentTimestamp = Date.parse(current.updated_at);
  return Number.isFinite(incomingTimestamp) && Number.isFinite(currentTimestamp) && incomingTimestamp < currentTimestamp;
}

function newestColumnUpdate(current: BoardColumn, incoming: BoardColumn) {
  return isOlderColumnUpdate(incoming, current) ? current : incoming;
}

export function KanbanBoard({ initialRequests, initialColumns, cities, profiles, currentUserId, permissions }: KanbanBoardProps) {
  const sortedInitialRequests = useMemo(() => requestsReducer([], { type: "snapshot", requests: initialRequests }), [initialRequests]);
  const sortedInitialColumns = useMemo(() => columnsReducer([], { type: "snapshot", columns: initialColumns }), [initialColumns]);
  const [requests, rawDispatch] = useReducer(requestsReducer, sortedInitialRequests);
  const [columns, rawDispatchColumns] = useReducer(columnsReducer, sortedInitialColumns);
  const [cityState, setCityState] = useState(() => [...new Map(cities.map((city) => [city.id, city])).values()]);
  const citiesByIdRef = useRef(new Map(cities.map((city) => [city.id, city])));
  const [selected, setSelected] = useState<RequestRecord | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("all");
  const [selectedTags, setSelectedTags] = useState<RequestTag[]>([]);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [isBoardPanning, setIsBoardPanning] = useState(false);
  const boundaryRef = useRef<HTMLDivElement | null>(null);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const boardPanRef = useRef<BoardPan | null>(null);
  const selectedColumnRef = useRef("all");
  const requestsRef = useRef(sortedInitialRequests);
  const columnsRef = useRef(sortedInitialColumns);
  const requestVersionsRef = useRef(new Map<string, number>());
  const requestRealtimeVersionsRef = useRef(new Map<string, number>());
  const columnVersionsRef = useRef(new Map<string, number>());
  const columnReorderQueuesRef = useRef(new Map<string, ColumnReorderQueue>());
  const pendingOperationsRef = useRef(new Map<string, PendingOperation>());
  const tombstonesRef = useRef(new Set<string>());
  const columnTombstonesRef = useRef(new Set<string>());
  const [message, setMessageState] = useState<BoardMessage | null>(null);
  const clearMessage = useCallback(() => setMessageState(null), []);
  const setMessage = useCallback((text: string) => {
    if (!text) {
      setMessageState(null);
      return;
    }
    const error = text.startsWith("Não ")
      || text.startsWith("A movimentação")
      || text.startsWith("Uma movimentação")
      || text.startsWith("A exclusão");
    setMessageState({ text, tone: error ? "error" : "success" });
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const viewport = boardViewportRef.current;
    if (!viewport) return;

    const resizeViewport = () => {
      const top = Math.max(0, viewport.getBoundingClientRect().top);
      const pageMain = viewport.closest("main");
      const bottomPadding = pageMain ? Number.parseFloat(window.getComputedStyle(pageMain).paddingBottom) || 0 : 0;
      viewport.style.height = `${Math.max(0, window.innerHeight - top - bottomPadding)}px`;
    };

    resizeViewport();
    window.addEventListener("resize", resizeViewport);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resizeViewport);
    if (boundaryRef.current) observer?.observe(boundaryRef.current);
    return () => {
      window.removeEventListener("resize", resizeViewport);
      observer?.disconnect();
    };
  }, []);

  function startBoardPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.pointerType && event.pointerType !== "mouse")) return;
    const target = event.target;
    if (target instanceof Element && target !== event.currentTarget && target.closest(boardPanBlockSelector)) return;

    const viewport = event.currentTarget;
    const scrollbarHeight = Math.max(0, viewport.offsetHeight - viewport.clientHeight);
    const bounds = viewport.getBoundingClientRect();
    if (scrollbarHeight > 0 && event.clientY >= bounds.bottom - scrollbarHeight) return;

    boardPanRef.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: viewport.scrollLeft };
    setIsBoardPanning(true);
    viewport.setPointerCapture?.(event.pointerId);
  }

  function moveBoardPan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = boardPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startX);
  }

  function endBoardPan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = boardPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    boardPanRef.current = null;
    setIsBoardPanning(false);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // A captura pode já ter sido liberada pelo navegador.
    }
  }

  const dispatch = useCallback((event: RequestsEvent) => {
    if ((event.type === "insert" || event.type === "update") && tombstonesRef.current.has(event.request.id)) return;
    const nextRequests = requestsReducer(requestsRef.current, event);
    requestsRef.current = nextRequests;
    rawDispatch(event);
    setSelected((current) => {
      if (!current) return current;
      if (event.type === "delete" && event.id === current.id) return undefined;
      if (event.type === "snapshot" || ((event.type === "insert" || event.type === "update") && event.request.id === current.id)) {
        return nextRequests.find((request) => request.id === current.id);
      }
      return current;
    });
  }, []);

  const dispatchColumns = useCallback((event: ColumnsEvent) => {
    if ((event.type === "insert" || event.type === "update") && columnTombstonesRef.current.has(event.column.id)) return;
    const nextColumns = columnsReducer(columnsRef.current, event);
    columnsRef.current = nextColumns;
    rawDispatchColumns(event);
  }, []);

  const currentRequestVersion = useCallback((requestId: string) => (
    requestVersionsRef.current.get(requestId) ?? 0
  ), []);

  const advanceRequestVersion = useCallback((requestId: string) => {
    const version = currentRequestVersion(requestId) + 1;
    requestVersionsRef.current.set(requestId, version);
    return version;
  }, [currentRequestVersion]);

  const isCurrentVersion = useCallback((requestId: string, version: number) => (
    currentRequestVersion(requestId) === version
  ), [currentRequestVersion]);

  const advanceRequestRealtimeVersion = useCallback((requestId: string) => {
    const version = (requestRealtimeVersionsRef.current.get(requestId) ?? 0) + 1;
    requestRealtimeVersionsRef.current.set(requestId, version);
    return version;
  }, []);

  const isCurrentRequestRealtimeVersion = useCallback((requestId: string, version: number) => (
    requestRealtimeVersionsRef.current.get(requestId) === version
  ), []);

  const currentColumnVersion = useCallback((columnId: string) => (
    columnVersionsRef.current.get(columnId) ?? 0
  ), []);

  const advanceColumnVersion = useCallback((columnId: string) => {
    const version = currentColumnVersion(columnId) + 1;
    columnVersionsRef.current.set(columnId, version);
    return version;
  }, [currentColumnVersion]);

  const isCurrentColumnVersion = useCallback((columnId: string, version: number) => (
    currentColumnVersion(columnId) === version
  ), [currentColumnVersion]);

  function selectColumn(columnId: string) {
    selectedColumnRef.current = columnId;
    setSelectedColumn(columnId);
  }

  useEffect(() => {
    const supabase = createBrowserClient();
    let mounted = true;
    async function reconcileRequest(requestId: string, eventType?: "insert" | "update") {
      if (!mounted || tombstonesRef.current.has(requestId)) return;
      const eventVersion = advanceRequestRealtimeVersion(requestId);
      const operationVersionAtReceipt = currentRequestVersion(requestId);
      try {
        const canonical = await getRequest(requestId);
        if (!mounted || tombstonesRef.current.has(requestId) || !isCurrentRequestRealtimeVersion(requestId, eventVersion)) return;
        const pendingOperation = pendingOperationsRef.current.get(requestId);
        const confirmsPendingMove = pendingOperation?.kind === "move"
          && canonical.column_id === pendingOperation.targetColumnId
          && canonical.position === pendingOperation.targetPosition;
        if (currentRequestVersion(requestId) !== operationVersionAtReceipt && !confirmsPendingMove) return;
        if (confirmsPendingMove) {
          pendingOperation.realtimeConfirmed = true;
        }
        advanceRequestVersion(requestId);
        const type = eventType ?? (requestsRef.current.some((request) => request.id === requestId) ? "update" : "insert");
        dispatch({ type, request: normalizeRequestCities(canonical, citiesByIdRef.current, profiles) });
      } catch {
        // A próxima alteração ou operação fará uma nova tentativa de reconciliação.
      }
    }

    const channel = supabase.channel("requests-board").on("postgres_changes", { event: "*", schema: "public", table: "requests" }, async (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => {
      if (!mounted) return;
      const requestId = payload.eventType === "DELETE"
        ? (payload.old as { id: string }).id
        : (payload.new as { id: string }).id;
      if (payload.eventType === "DELETE") {
        advanceRequestRealtimeVersion(requestId);
        advanceRequestVersion(requestId);
        tombstonesRef.current.add(requestId);
        dispatch({ type: "delete", id: requestId });
        return;
      }
      await reconcileRequest(requestId, payload.eventType === "INSERT" ? "insert" : "update");
    }).subscribe();

    const columnsChannel = supabase.channel("board-columns").on("postgres_changes", { event: "*", schema: "public", table: "board_columns" }, (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => {
      if (!mounted) return;
      if (payload.eventType === "DELETE") {
        const columnId = (payload.old as { id: string }).id;
        advanceColumnVersion(columnId);
        columnTombstonesRef.current.add(columnId);
        dispatchColumns({ type: "delete", id: columnId });
        if (selectedColumnRef.current === columnId) selectColumn("all");
      } else {
        const column = payload.new as unknown as BoardColumn;
        if (columnTombstonesRef.current.has(column.id)) return;
        const currentColumn = columnsRef.current.find((current) => current.id === column.id);
        if (isOlderColumnUpdate(column, currentColumn)) return;
        const reorderQueue = columnReorderQueuesRef.current.get(column.id);
        if (reorderQueue) {
          const activeIntent = reorderQueue.active;
          const confirmsActiveIntent = activeIntent.rpcStarted && column.position === activeIntent.position;
          reorderQueue.rollback = newestColumnUpdate(reorderQueue.rollback, column);
          if (confirmsActiveIntent) activeIntent.realtimeConfirmed = true;
          if (!confirmsActiveIntent || reorderQueue.latest.token !== activeIntent.token) return;
        }
        advanceColumnVersion(column.id);
        dispatchColumns({ type: payload.eventType === "INSERT" ? "insert" : "update", column });
      }
    }).subscribe();

    const citiesChannel = supabase.channel("cities-board").on("postgres_changes", { event: "*", schema: "public", table: "cities" }, (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => {
      if (!mounted) return;
      if (payload.eventType === "DELETE") {
        const cityId = (payload.old as { id: string }).id;
        citiesByIdRef.current.delete(cityId);
        setCityState((current) => current.filter((city) => city.id !== cityId));
        return;
      }
      const updatedCity = payload.new as unknown as City;
      citiesByIdRef.current.set(updatedCity.id, updatedCity);
      setCityState((current) => current.some((city) => city.id === updatedCity.id)
        ? current.map((city) => city.id === updatedCity.id ? updatedCity : city)
        : [...current, updatedCity]);
      const relatedRequests = requestsRef.current.filter((request) => request.cities.some((city) => city.id === updatedCity.id));
      for (const request of relatedRequests) {
        dispatch({
          type: "update",
          request: { ...request, cities: request.cities.map((city) => city.id === updatedCity.id ? updatedCity : city) },
        });
      }
    }).subscribe();

    const requestCitiesChannel = supabase.channel("request-cities-board").on("postgres_changes", { event: "*", schema: "public", table: "request_cities" }, async (payload: { old: Record<string, unknown>; new: Record<string, unknown> }) => {
      const requestId = (payload.new as { request_id?: string }).request_id ?? (payload.old as { request_id?: string }).request_id;
      if (requestId) await reconcileRequest(requestId);
    }).subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
      void supabase.removeChannel(columnsChannel);
      void supabase.removeChannel(citiesChannel);
      void supabase.removeChannel(requestCitiesChannel);
    };
  }, [advanceColumnVersion, advanceRequestRealtimeVersion, advanceRequestVersion, currentRequestVersion, dispatch, dispatchColumns, isCurrentRequestRealtimeVersion, profiles]);

  const filtered = useMemo(() => filterBoard(requests, selectedColumn, query, selectedTags), [query, requests, selectedColumn, selectedTags]);
  const visibleColumns = selectedColumn === "all" ? columns : columns.filter((column) => column.id === selectedColumn);
  const activeDragRequest = activeDrag?.type === "request" ? requests.find((request) => request.id === activeDrag.id) : undefined;
  const activeDragColumn = activeDrag?.type === "column" ? columns.find((column) => column.id === activeDrag.id) : undefined;
  const [dragModifiers] = useState<Modifier[]>(() => [({
    transform,
    draggingNodeRect,
    overlayNodeRect,
    activeNodeRect,
  }) => clampTransformToRect(
    transform,
    draggingNodeRect ?? overlayNodeRect ?? activeNodeRect,
    boundaryRef.current?.getBoundingClientRect() ?? null,
  )]);
  const accessibility = useMemo(() => ({
    screenReaderInstructions: boardScreenReaderInstructions,
    announcements: boardAnnouncements(requests, columns),
  }), [columns, requests]);

  async function save(input: RequestInput) {
    if (selected) {
      const version = advanceRequestVersion(selected.id);
      try {
        const updated = await updateRequest(selected.id, input);
        if (!isCurrentVersion(selected.id, version)) return;
        const latest = requestsRef.current.find((request) => request.id === selected.id) ?? selected;
        dispatch({ type: "update", request: mergeCanonicalRequest(latest, updated, citiesByIdRef.current, profiles) });
        setMessage("Solicitação atualizada.");
      } catch (error) {
        throw error;
      }
    } else {
      const created = await createRequest(input, currentUserId, 1024);
      if (tombstonesRef.current.has(created.id)) return;
      const current = requestsRef.current.find((request) => request.id === created.id);
      dispatch({ type: current ? "update" : "insert", request: normalizeRequestCities(current ?? created, citiesByIdRef.current, profiles) });
      setMessage("Solicitação criada.");
    }
  }

  async function persistMovement(previous: RequestRecord, targetColumnId: string, position: number, optimistic?: RequestRecord): Promise<MovementOutcome> {
    const requestId = previous.id;
    const pendingOperation = pendingOperationsRef.current.get(requestId);
    if (pendingOperation) {
      setMessage(pendingOperation.kind === "delete"
        ? "A exclusão desta solicitação já está em andamento."
        : "Uma movimentação desta solicitação já está em andamento.");
      return "pending";
    }
    const operationToken = Symbol("move-request");
    pendingOperationsRef.current.set(requestId, {
      kind: "move",
      token: operationToken,
      targetColumnId,
      targetPosition: position,
      realtimeConfirmed: false,
    });
    const version = advanceRequestVersion(requestId);
    if (optimistic) dispatch({ type: "update", request: optimistic });

    try {
      const canonical = await moveRequest(requestId, targetColumnId, position);
      if (tombstonesRef.current.has(requestId)) return "stale";
      if (!isCurrentVersion(requestId, version)) {
        const operation = pendingOperationsRef.current.get(requestId);
        if (operation?.kind === "move" && operation.token === operationToken && operation.realtimeConfirmed) {
          setMessage("Solicitação movida.");
          return "success";
        }
        return "stale";
      }
      const latest = requestsRef.current.find((request) => request.id === requestId) ?? optimistic ?? previous;
      dispatch({ type: "update", request: mergeCanonicalRequest(latest, canonical, citiesByIdRef.current, profiles) });
      setMessage("Solicitação movida.");
      return "success";
    } catch {
      if (tombstonesRef.current.has(requestId)) return "stale";
      if (!isCurrentVersion(requestId, version)) {
        const operation = pendingOperationsRef.current.get(requestId);
        if (operation?.kind === "move" && operation.token === operationToken && operation.realtimeConfirmed) {
          setMessage("Solicitação movida.");
          return "success";
        }
        return "stale";
      }
      try {
        const canonical = await getRequest(requestId);
        if (tombstonesRef.current.has(requestId) || !isCurrentVersion(requestId, version)) return "stale";
        const latest = requestsRef.current.find((request) => request.id === requestId) ?? optimistic ?? previous;
        dispatch({ type: "update", request: mergeCanonicalRequest(latest, canonical, citiesByIdRef.current, profiles) });
        setMessage("A movimentação não foi confirmada; o quadro foi sincronizado com o servidor.");
        return "reloaded";
      } catch {
        if (tombstonesRef.current.has(requestId) || !isCurrentVersion(requestId, version)) return "stale";
        dispatch({ type: "update", request: normalizeRequestCities(previous, citiesByIdRef.current, profiles) });
        setMessage("Não foi possível mover a solicitação. O cartão voltou à posição anterior.");
        return "rollback";
      }
    } finally {
      if (pendingOperationsRef.current.get(requestId)?.token === operationToken) {
        pendingOperationsRef.current.delete(requestId);
      }
    }
  }

  async function removeRequest(requestId: string) {
    const pendingOperation = pendingOperationsRef.current.get(requestId);
    if (pendingOperation?.kind === "move") {
      throw new Error("Não é possível excluir enquanto uma movimentação está em andamento.");
    }
    if (pendingOperation) throw new Error("A exclusão desta solicitação já está em andamento.");

    const operationToken = Symbol("delete-request");
    pendingOperationsRef.current.set(requestId, { kind: "delete", token: operationToken });
    try {
      await deleteRequest(requestId);
      if (!tombstonesRef.current.has(requestId)) {
        advanceRequestVersion(requestId);
        tombstonesRef.current.add(requestId);
        dispatch({ type: "delete", id: requestId });
      }
      setMessage("Solicitação excluída.");
    } finally {
      if (pendingOperationsRef.current.get(requestId)?.token === operationToken) {
        pendingOperationsRef.current.delete(requestId);
      }
    }
  }

  async function moveToSystem(request: RequestRecord, systemKey: SystemColumnKey) {
    const targetColumn = columns.find((column) => column.kind === "system" && column.system_key === systemKey);
    if (!targetColumn) throw new Error("A coluna de destino não foi encontrada.");

    const latest = requestsRef.current.find((item) => item.id === request.id) ?? request;
    const targetRequests = sortRequests(requestsRef.current.filter((item) => item.id !== request.id && item.column_id === targetColumn.id));
    const position = positionBetween(targetRequests.at(-1)?.position);
    const outcome = await persistMovement(latest, targetColumn.id, position);
    if (outcome === "rollback") throw new Error("Não foi possível mover a solicitação.");
    if (outcome === "pending") throw new Error("Uma movimentação desta solicitação já está em andamento.");
    if (outcome === "stale") throw new Error("A solicitação foi atualizada durante a movimentação. Confira o estado atual.");
  }

  async function handleRequestDragEnd(event: DragEndEvent) {
    if (!permissions.canMove || !event.over) return;

    const currentRequests = requestsRef.current;
    const requestId = String(event.active.id);
    const overId = String(event.over.id);
    if (requestId === overId) return;

    const previous = currentRequests.find((request) => request.id === requestId);
    if (!previous) return;

    const overType = dragItemType(event.over.data.current);
    const overCard = overType === "request" ? currentRequests.find((request) => request.id === overId) : undefined;
    const targetColumnId = overType === "column"
      ? overId
      : overType === "request" && typeof event.over.data.current?.columnId === "string"
        ? event.over.data.current.columnId
        : undefined;
    const targetColumn = columnsRef.current.find((column) => column.id === targetColumnId);
    if (!targetColumnId || !targetColumn) return;

    const targetRequests = sortRequests(currentRequests.filter((request) => request.id !== requestId && request.column_id === targetColumnId));
    let position: number;
    if (overCard) {
      const overIndex = targetRequests.findIndex((request) => request.id === overCard.id);
      if (overIndex < 0) return;
      const translated = event.active.rect?.current?.translated;
      const activeCenter = translated
        ? translated.top + (typeof translated.height === "number" ? translated.height / 2 : 0)
        : undefined;
      const targetCenter = event.over.rect
        ? event.over.rect.top + (typeof event.over.rect.height === "number" ? event.over.rect.height / 2 : 0)
        : undefined;
      const insertAfter = activeCenter !== undefined && targetCenter !== undefined
        ? activeCenter > targetCenter
        : false;
      const targetIndex = overIndex + (insertAfter ? 1 : 0);
      position = positionBetween(targetRequests[targetIndex - 1]?.position, targetRequests[targetIndex]?.position);
    } else {
      position = positionBetween(targetRequests.at(-1)?.position);
    }

    const optimistic: RequestRecord = {
      ...previous,
      column_id: targetColumnId,
      position,
      status: targetColumn.system_key,
    };
    setMessage("");
    await persistMovement(previous, targetColumnId, position, optimistic);
  }

  async function runColumnReorderQueue(columnId: string, queue: ColumnReorderQueue) {
    while (true) {
      const intent = queue.active;
      intent.rpcStarted = true;
      try {
        const updated = await reorderBoardColumn(columnId, intent.position);
        if (!columnTombstonesRef.current.has(columnId)) {
          const responseIsOlder = isOlderColumnUpdate(updated, queue.rollback);
          queue.rollback = newestColumnUpdate(queue.rollback, updated);
          if (queue.latest.token !== intent.token) {
            // A resposta atualiza apenas a base de rollback; a intenção enfileirada continua visível.
          } else if (intent.realtimeConfirmed || !isCurrentColumnVersion(columnId, intent.version)) {
            if (columnsRef.current.find((column) => column.id === columnId)?.position === intent.position) {
              setMessage("Lista reordenada.");
            }
          } else if (!responseIsOlder) {
            dispatchColumns({ type: "update", column: updated });
            setMessage("Lista reordenada.");
          }
        }
      } catch {
        if (!columnTombstonesRef.current.has(columnId)) {
          if (queue.latest.token !== intent.token) {
            // Uma falha supersedida não pode restaurar a intenção anterior.
          } else if (intent.realtimeConfirmed) {
            setMessage("Lista reordenada.");
          } else {
            dispatchColumns({ type: "update", column: queue.rollback });
            setMessage("Não foi possível reordenar a lista. A ordem anterior foi restaurada.");
          }
        }
      } finally {
        intent.resolve();
      }

      if (columnTombstonesRef.current.has(columnId)) {
        queue.queued?.resolve();
        if (columnReorderQueuesRef.current.get(columnId) === queue) columnReorderQueuesRef.current.delete(columnId);
        return;
      }
      const next = queue.queued;
      queue.queued = undefined;
      if (next) {
        queue.active = next;
        continue;
      }

      try {
        const canonical = await getBoardColumn(columnId);
        if (canonical) queue.rollback = newestColumnUpdate(queue.rollback, canonical);
      } catch {
        // O evento Realtime ou a resposta RPC mais recente permanecem como fallback canônico.
      }
      if (columnTombstonesRef.current.has(columnId)) {
        columnReorderQueuesRef.current.get(columnId)?.queued?.resolve();
        if (columnReorderQueuesRef.current.get(columnId) === queue) columnReorderQueuesRef.current.delete(columnId);
        return;
      }
      const queuedDuringReconciliation = columnReorderQueuesRef.current.get(columnId)?.queued;
      queue.queued = undefined;
      if (queuedDuringReconciliation) {
        queue.active = queuedDuringReconciliation;
        continue;
      }
      dispatchColumns({ type: "update", column: queue.rollback });
      if (columnReorderQueuesRef.current.get(columnId) === queue) columnReorderQueuesRef.current.delete(columnId);
      return;
    }
  }

  function persistColumnReorder(previous: BoardColumn, position: number) {
    const columnId = previous.id;
    const version = advanceColumnVersion(columnId);
    dispatchColumns({ type: "update", column: { ...previous, position } });
    setMessage("");
    let resolveIntent: () => void = () => undefined;
    const completed = new Promise<void>((resolve) => { resolveIntent = resolve; });
    const intent: ColumnReorderIntent = {
      token: Symbol("reorder-column"),
      position,
      version,
      rpcStarted: false,
      realtimeConfirmed: false,
      resolve: resolveIntent,
    };
    const queue = columnReorderQueuesRef.current.get(columnId);
    if (queue) {
      queue.queued?.resolve();
      queue.queued = intent;
      queue.latest = intent;
      return completed;
    }
    const nextQueue: ColumnReorderQueue = { active: intent, latest: intent, rollback: previous };
    columnReorderQueuesRef.current.set(columnId, nextQueue);
    void runColumnReorderQueue(columnId, nextQueue);
    return completed;
  }

  async function handleColumnDragEnd(event: DragEndEvent) {
    if (!permissions.canManageColumns || !event.over || dragItemType(event.over.data.current) !== "column") return;

    const currentColumns = columnsRef.current;
    const columnId = String(event.active.id);
    const overId = String(event.over.id);
    if (columnId === overId) return;
    const currentIndex = currentColumns.findIndex((column) => column.id === columnId);
    const overIndex = currentColumns.findIndex((column) => column.id === overId);
    if (currentIndex < 0 || overIndex < 0) return;

    const previous = currentColumns[currentIndex];
    const remainingColumns = currentColumns.filter((column) => column.id !== columnId);
    const targetIndex = remainingColumns.findIndex((column) => column.id === overId);
    const insertionIndex = currentIndex < overIndex ? targetIndex + 1 : targetIndex;
    const position = positionBetween(remainingColumns[insertionIndex - 1]?.position, remainingColumns[insertionIndex]?.position);
    await persistColumnReorder(previous, position);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const activeType = dragItemType(event.active.data.current);
    if (activeType === "request") return handleRequestDragEnd(event);
    if (activeType === "column") return handleColumnDragEnd(event);
  }

  async function addColumn(input: CreateColumnInput) {
    const lastPosition = columnsRef.current.reduce((maximum, column) => Math.max(maximum, column.position), 0);
    const created = await createBoardColumn(input, positionBetween(lastPosition));
    if (columnTombstonesRef.current.has(created.id)) return;
    const current = columnsRef.current.find((column) => column.id === created.id);
    if (!current) {
      advanceColumnVersion(created.id);
      dispatchColumns({ type: "insert", column: created });
    }
    setMessage("Lista adicionada.");
  }

  async function renameColumn(columnId: string, name: string, color: string) {
    const version = advanceColumnVersion(columnId);
    const updated = await renameBoardColumn(columnId, name, color);
    if (columnTombstonesRef.current.has(columnId)) return;
    if (!isCurrentColumnVersion(columnId, version)) {
      if (columnsRef.current.find((column) => column.id === columnId)?.name === updated.name) {
        setMessage("Lista renomeada.");
      }
      return;
    }
    dispatchColumns({ type: "update", column: updated });
    setMessage("Lista renomeada.");
  }

  async function reorderColumn(columnId: string, direction: "left" | "right") {
    const currentColumns = columnsRef.current;
    const currentIndex = currentColumns.findIndex((column) => column.id === columnId);
    const targetIndex = currentIndex + (direction === "left" ? -1 : 1);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentColumns.length) return;

    const previous = currentColumns[currentIndex];
    const position = direction === "left"
      ? positionBetween(currentColumns[targetIndex - 1]?.position, currentColumns[targetIndex].position)
      : positionBetween(currentColumns[targetIndex].position, currentColumns[targetIndex + 1]?.position);
    await persistColumnReorder(previous, position);
  }

  async function removeColumn(columnId: string) {
    await deleteBoardColumn(columnId);
    if (!columnTombstonesRef.current.has(columnId)) {
      advanceColumnVersion(columnId);
      columnTombstonesRef.current.add(columnId);
      dispatchColumns({ type: "delete", id: columnId });
    }
    if (selectedColumnRef.current === columnId) selectColumn("all");
    setMessage("Lista excluída.");
  }

  return (
    <main className="relative z-10 px-4 py-6 md:px-6 md:py-8">
      <div ref={boundaryRef} className="mx-auto max-w-[1800px]" data-drag-boundary="board">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">Fluxo da equipe</p><h1 className="mt-1 text-3xl font-black text-white">Quadro de solicitações</h1><p className="mt-2 text-sm text-white/50">Acompanhe o trabalho da equipe em tempo real.</p></div>
          {permissions.canCreate && <button className="button inline-flex items-center gap-2" onClick={() => setSelected(null)}><Plus size={18} />Nova solicitação</button>}
        </header>
        <BoardNotice message={message} onClose={clearMessage} />
        <div className="panel mb-5 grid gap-3 p-3">
          <label className="relative"><Search className="absolute left-3 top-3 text-white/35" size={18} /><span className="sr-only">Pesquisar</span><input className="field" style={{ paddingLeft: "2.75rem" }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título, cidade ou responsável" /></label>
          <BoardFilters columns={columns} requests={requests} selected={selectedColumn} onChange={selectColumn} selectedTags={selectedTags} onTagChange={setSelectedTags} />
        </div>
        <DndContext sensors={sensors} modifiers={dragModifiers} collisionDetection={boardCollisionDetection} onDragStart={({ active }) => {
          const type = dragItemType(active.data.current);
          setActiveDrag(type ? { id: String(active.id), type } : null);
          }} onDragCancel={() => setActiveDrag(null)} onDragEnd={handleDragEnd} accessibility={accessibility}>
          <div
            ref={boardViewportRef}
            className="kanban-grid kanban-board-scroll"
            style={{ gridAutoColumns: "minmax(min(100%, 340px), 340px)" }}
            role="region"
            aria-label="Quadro de listas"
            tabIndex={0}
            data-panning={isBoardPanning}
            onPointerDown={startBoardPan}
            onPointerMove={moveBoardPan}
            onPointerUp={endBoardPan}
            onPointerCancel={endBoardPan}
            onLostPointerCapture={endBoardPan}
          >
            <SortableContext items={visibleColumns.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
              {visibleColumns.map((column) => {
                const columnIndex = columns.findIndex((item) => item.id === column.id);
                return <KanbanColumn key={column.id} column={column} requests={filtered.filter((request) => request.column_id === column.id)} canMove={permissions.canMove} canManageColumns={permissions.canManageColumns} canReorderColumn={permissions.canManageColumns && selectedColumn === "all"} canMoveColumnLeft={columnIndex > 0} canMoveColumnRight={columnIndex >= 0 && columnIndex < columns.length - 1} onOpen={setSelected} onRename={renameColumn} onReorder={reorderColumn} onDelete={removeColumn} />;
              })}
            </SortableContext>
            <AddColumn columns={columns} profiles={profiles} canManageColumns={permissions.canManageColumns} onCreate={addColumn} />
          </div>
          <DragOverlay modifiers={dragModifiers} dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
            {activeDragRequest ? <RequestCardPreview request={activeDragRequest} /> : activeDragColumn ? <ColumnPreview column={activeDragColumn} requestCount={requests.filter((request) => request.column_id === activeDragColumn.id).length} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
      {selected !== undefined && <RequestDialog key={selected?.id ?? "new"} request={selected} cities={cityState} profiles={profiles} columns={columns} canEdit={permissions.canEdit} canDelete={permissions.canDelete} canMove={permissions.canMove} onClose={() => setSelected(undefined)} onSave={save} onMoveToSystem={async (systemKey) => { if (selected) await moveToSystem(selected, systemKey); }} onDelete={selected ? async () => removeRequest(selected.id) : undefined} />}
    </main>
  );
}
