export function toUserMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("invalid login")) return "E-mail ou senha inválidos.";
  if (message.includes("permission") || message.includes("row-level")) return "Você não tem permissão para esta ação.";
  if (message.includes("network") || message.includes("fetch")) return "Não foi possível conectar. Tente novamente.";
  return "Não foi possível concluir a ação. Tente novamente.";
}
