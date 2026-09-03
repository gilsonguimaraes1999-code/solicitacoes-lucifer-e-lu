import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestDialog } from "@/components/requests/request-dialog";
import type { City } from "@/features/cities/types";
import type { BoardColumn } from "@/features/columns/types";
import type { Profile, RequestRecord } from "@/features/requests/types";

const profiles: Profile[] = [
  { id: "11111111-1111-4111-8111-111111111111", full_name: "Lucifer", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "22222222-2222-4222-8222-222222222222", full_name: "Bruno", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "33333333-3333-4333-8333-333333333333", full_name: "Lu", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const cities: City[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Santa Luzia", position: 1024, active: true, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Belo Horizonte", position: 2048, active: true, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Cidade histórica", position: 3072, active: false, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const columns: BoardColumn[] = [
  { id: "column-pending", name: "Pendente", kind: "system", system_key: "pending", assignee_id: null, position: 1024, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-progress", name: "Em progresso", kind: "system", system_key: "in_progress", assignee_id: null, position: 2048, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-completed", name: "Concluído", kind: "system", system_key: "completed", assignee_id: null, position: 3072, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-lucifer", name: "Atendimento Lucifer", kind: "assignee", system_key: null, assignee_id: profiles[0].id, position: 4096, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const request: RequestRecord = {
  id: "request-1",
  title: "Pedido de acesso",
  description: null,
  cities: [cities[0]],
  assigned_to: profiles[0].id,
  external_url: null,
  tags: ["loja"],
  status: null,
  column_id: "column-lucifer",
  position: 1024,
  created_by: "owner",
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
  assignee: { id: profiles[0].id, full_name: profiles[0].full_name },
};

const baseProps = {
  cities,
  profiles,
  columns,
  canEdit: true,
  canDelete: false,
  canMove: false,
  onClose: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
  onMoveToSystem: vi.fn().mockResolvedValue(undefined),
};

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Nova demanda" } });
  selectAssignee(profiles[0]);
}

function selectAssignee(profile: Profile) {
  fireEvent.click(screen.getByRole("button", { name: "Selecionar responsável" }));
  fireEvent.click(screen.getByRole("option", { name: profile.full_name }));
}

function selectCity(city: City) {
  fireEvent.click(screen.getByRole("button", { name: "Selecionar cidades" }));
  fireEvent.click(screen.getByRole("option", { name: city.active ? city.name : `${city.name} Desativada` }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RequestDialog destination", () => {
  it("mostra a data e o horário de criação nos detalhes", () => {
    render(<RequestDialog {...baseProps} request={request} />);

    expect(screen.getByText("Criada em: 28/08/2026 21:00:00")).toBeInTheDocument();
  });
  it("usa um menu customizado de escolha única com somente responsáveis aprovados", () => {
    const pendingProfile: Profile = {
      ...profiles[0],
      id: "44444444-4444-4444-8444-444444444444",
      full_name: "Usuário pendente",
      approval_status: "pending",
    };
    render(<RequestDialog {...baseProps} profiles={[...profiles, pendingProfile]} request={null} />);

    expect(screen.queryByRole("combobox", { name: "Responsável" })).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Selecionar responsável" });
    fireEvent.click(trigger);

    const menu = screen.getByRole("listbox", { name: "Responsáveis disponíveis" });
    expect(within(menu).getByRole("option", { name: "Lucifer" })).toBeInTheDocument();
    expect(within(menu).getByRole("option", { name: "Bruno" })).toBeInTheDocument();
    expect(within(menu).queryByRole("option", { name: "Usuário pendente" })).not.toBeInTheDocument();

    fireEvent.click(within(menu).getByRole("option", { name: "Bruno" }));

    expect(screen.queryByRole("listbox", { name: "Responsáveis disponíveis" })).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("Bruno");
  });

  it("mostra a coluna vinculada e volta para Pendente ao trocar o responsável", () => {
    render(<RequestDialog {...baseProps} request={null} />);

    selectAssignee(profiles[0]);
    expect(screen.getByText("Entrará em: Atendimento Lucifer")).toBeInTheDocument();

    selectAssignee(profiles[1]);
    expect(screen.getByText("Entrará em: Pendente")).toBeInTheDocument();
  });

  it("explica que editar o responsável não move um cartão de coluna fixa", () => {
    const fixedRequest = { ...request, column_id: "column-progress", status: "in_progress" as const };
    render(<RequestDialog {...baseProps} request={fixedRequest} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    selectAssignee(profiles[1]);

    expect(screen.getByText("Ao salvar, continuará em: Em progresso")).toBeInTheDocument();
  });

  it("mantém a coluna assignee atual enquanto o responsável não muda", () => {
    const brunoInLuciferColumn = {
      ...request,
      assigned_to: profiles[1].id,
      assignee: { id: profiles[1].id, full_name: profiles[1].full_name },
    };
    render(<RequestDialog {...baseProps} request={brunoInLuciferColumn} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByText("Ao salvar, continuará em: Atendimento Lucifer")).toBeInTheDocument();
  });

  it("mantém a lista personalizada ao trocar o responsável", () => {
    const customColumn: BoardColumn = {
      id: "column-prioridades",
      name: "Prioridades",
      kind: "custom",
      system_key: null,
      assignee_id: null,
      position: 5120,
      created_by: "owner",
      created_at: "2026-08-29T00:00:00Z",
      updated_at: "2026-08-29T00:00:00Z",
    };
    render(<RequestDialog {...baseProps} columns={[...columns, customColumn]} request={{ ...request, column_id: customColumn.id }} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    selectAssignee(profiles[1]);

    expect(screen.getByText("Ao salvar, continuará em: Prioridades")).toBeInTheDocument();
  });

  it("exige responsável antes de validar cidade e tags e preserva os campos", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={null} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Nova demanda" } });
    selectCity(cities[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tag Loja" }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Selecione um responsável.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título")).toHaveValue("Nova demanda");
    expect(screen.getByRole("button", { name: "Selecionar cidades" })).toHaveTextContent(cities[0].name);
    expect(screen.getByRole("button", { name: "Tag Loja" })).toHaveAttribute("aria-pressed", "true");
  });

  it("preserva a escolha manual do responsável diante de atualização remota posterior", () => {
    const { rerender } = render(<RequestDialog {...baseProps} request={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    selectAssignee(profiles[1]);

    const remoteRequest = {
      ...request,
      assigned_to: profiles[2].id,
      assignee: { id: profiles[2].id, full_name: profiles[2].full_name },
    };
    rerender(<RequestDialog {...baseProps} request={remoteRequest} />);

    expect(screen.getByRole("button", { name: "Selecionar responsável" })).toHaveTextContent(profiles[1].full_name);
  });
});

describe("RequestDialog creation date", () => {
  it("cria sem sobrescrever a data quando a opção manual permanece desativada", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={null} onSave={onSave} />);
    fillRequiredFields();
    selectCity(cities[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tag Loja" }));

    expect(screen.getByRole("checkbox", { name: "Definir data manualmente" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ createdAtLocal: null })));
  });

  it("permite definir data e horário com segundos na criação", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={null} onSave={onSave} />);
    fillRequiredFields();
    selectCity(cities[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tag Loja" }));

    fireEvent.click(screen.getByRole("checkbox", { name: "Definir data manualmente" }));
    fireEvent.click(screen.getByRole("button", { name: "Escolher data e horário" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Segundo" }), { target: { value: "07" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].createdAtLocal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:07$/);
  });

  it("preserva a data na edição comum e inicia a alteração com o valor existente", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={request} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    const toggle = screen.getByRole("checkbox", { name: "Alterar data de criação" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ createdAtLocal: null })));

    onSave.mockClear();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Escolher data e horário" })).toHaveTextContent("28/08/2026 21:00:00");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ createdAtLocal: "2026-08-28T21:00:00" })));
  });
});

describe("RequestDialog tags", () => {
  it("exige uma tag e envia todas as tags selecionadas", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={null} onSave={onSave} />);
    fillRequiredFields();
    selectCity(cities[0]);

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const validationNotice = await screen.findByRole("alert");
    expect(validationNotice).toHaveTextContent("Selecione pelo menos uma tag.");
    expect(validationNotice.parentElement).toBe(document.body);
    expect(validationNotice).toHaveClass("fixed", "bottom-6", "left-1/2");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Tag Loja" }));
    fireEvent.click(screen.getByRole("button", { name: "Tag Growth" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ tags: ["loja", "growth"] })));
  });

  it("permite trocar as tags ao editar", () => {
    render(<RequestDialog {...baseProps} request={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("button", { name: "Tag Loja" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Tag Loja" }));
    fireEvent.click(screen.getByRole("button", { name: "Tag Jogo" }));
    expect(screen.getByRole("button", { name: "Tag Loja" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Tag Jogo" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("RequestDialog cities", () => {
  it("remove cidade recém-desativada ao criar e pede revisão da seleção", () => {
    const { rerender } = render(<RequestDialog {...baseProps} request={null} />);
    selectCity(cities[0]);
    expect(screen.getByRole("button", { name: "Selecionar cidades" })).toHaveTextContent(cities[0].name);

    const updatedCities = cities.map((city) => city.id === cities[0].id ? { ...city, active: false } : city);
    rerender(<RequestDialog {...baseProps} request={null} cities={updatedCities} />);

    expect(screen.getByText("Uma cidade selecionada foi desativada. Revise a seleção.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar cidades" })).not.toHaveTextContent(cities[0].name);
  });

  it("preserva no modo de edição a relação que acabou de ficar inativa e permite removê-la", () => {
    const { rerender } = render(<RequestDialog {...baseProps} request={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const inactiveCity = { ...cities[0], active: false };

    rerender(<RequestDialog {...baseProps} request={{ ...request, cities: [inactiveCity] }} cities={[inactiveCity, ...cities.slice(1)]} />);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar cidades" }));

    const option = screen.getByRole("option", { name: `${inactiveCity.name} Desativada` });
    expect(option).toHaveAttribute("aria-selected", "true");
    fireEvent.click(option);
    expect(screen.queryByRole("option", { name: `${inactiveCity.name} Desativada` })).not.toBeInTheDocument();
  });

  it("exige cidade antes de submeter, mantém o formulário aberto e permite selecionar várias", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={null} onSave={onSave} />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Tag Loja" }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Selecione pelo menos uma cidade.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Nova solicitação" })).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    fireEvent.click(screen.getByRole("option", { name: cities[0].name }));
    fireEvent.click(screen.getByRole("option", { name: cities[1].name }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ cityIds: [cities[0].id, cities[1].id] })));
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("requesterName");
  });

  it("pré-seleciona as cidades relacionadas e permite substituí-las ao editar", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={{ ...request, cities: [cities[0], cities[1]] }} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar cidades" }));

    expect(screen.getByRole("option", { name: cities[0].name })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: cities[1].name })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("option", { name: cities[0].name }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ cityIds: [cities[1].id] })));
  });

  it("mantém cidade desativada relacionada visível, removível e identificada nos detalhes", () => {
    render(<RequestDialog {...baseProps} request={{ ...request, cities: [cities[2]] }} />);

    expect(screen.getByText("Cidade", { selector: "b" })).toBeInTheDocument();
    expect(screen.getByText(cities[2].name)).toBeInTheDocument();
    expect(screen.getByText("Desativada")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    const inactiveOption = screen.getByRole("option", { name: `${cities[2].name} Desativada` });
    expect(inactiveOption).toHaveAttribute("aria-selected", "true");
    fireEvent.click(inactiveOption);
    expect(screen.queryByRole("option", { name: `${cities[2].name} Desativada` })).not.toBeInTheDocument();
  });

  it("usa rótulo plural para várias cidades nos detalhes", () => {
    render(<RequestDialog {...baseProps} request={{ ...request, cities: [cities[0], cities[1]] }} />);

    expect(screen.getByText("Cidades", { selector: "b" })).toBeInTheDocument();
    expect(screen.getByText("Santa Luzia, Belo Horizonte")).toBeInTheDocument();
  });

  it("identifica nos detalhes uma solicitação antiga ainda sem cidade", () => {
    render(<RequestDialog {...baseProps} request={{ ...request, cities: [] }} />);

    expect(screen.getByText("Cidade", { selector: "b" })).toBeInTheDocument();
    expect(screen.getByText("Não definida")).toBeInTheDocument();
  });

  it("preserva o formulário aberto e preenchido quando a API falha", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    render(<RequestDialog {...baseProps} request={null} onSave={onSave} />);
    fillRequiredFields();
    selectCity(cities[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tag Loja" }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Não foi possível salvar. Revise os dados e tente novamente.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Nova solicitação" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Nova demanda");
    expect(screen.getByRole("button", { name: "Selecionar cidades" })).toHaveTextContent(cities[0].name);
  });
});

describe("RequestDialog status actions", () => {
  it("oculta as ações sem permissão de movimentação", () => {
    render(<RequestDialog {...baseProps} request={request} />);

    expect(screen.queryByRole("button", { name: "Pendente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Em progresso" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluído" })).not.toBeInTheDocument();
  });

  it("envia a chave exata da ação fixa e fecha após sucesso", async () => {
    const onClose = vi.fn();
    const onMoveToSystem = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={request} canMove onClose={onClose} onMoveToSystem={onMoveToSystem} />);

    fireEvent.click(screen.getByRole("button", { name: "Concluído" }));

    await waitFor(() => expect(onMoveToSystem).toHaveBeenCalledWith("completed"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("desabilita todas as ações enquanto move e mostra a falha em português", async () => {
    let rejectMove: (error: Error) => void = () => undefined;
    const onMoveToSystem = vi.fn().mockImplementation(() => new Promise<void>((_, reject) => { rejectMove = reject; }));
    render(<RequestDialog {...baseProps} request={request} canMove onMoveToSystem={onMoveToSystem} />);

    fireEvent.click(screen.getByRole("button", { name: "Pendente" }));
    expect(screen.getByRole("button", { name: "Pendente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Em progresso" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Concluído" })).toBeDisabled();

    rejectMove(new Error("A coluna de destino não foi encontrada."));
    expect(await screen.findByText("A coluna de destino não foi encontrada.")).toBeInTheDocument();
  });
});

describe("RequestDialog deletion", () => {
  it("exige confirmação temática antes de excluir a solicitação", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<RequestDialog {...baseProps} request={request} canDelete onDelete={onDelete} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    const confirmation = screen.getByRole("dialog", { name: "Confirmar exclusão da solicitação" });
    expect(within(confirmation).getByText("Pedido de acesso")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cancela a confirmação sem excluir", () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={request} canDelete onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog", { name: "Confirmar exclusão da solicitação" })).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
