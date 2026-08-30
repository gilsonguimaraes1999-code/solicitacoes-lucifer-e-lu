export const REQUEST_TAGS = ["f1", "loja", "jogo", "hub", "growth", "outros"] as const;

export type RequestTag = (typeof REQUEST_TAGS)[number];

export const REQUEST_TAG_LABELS: Record<RequestTag, string> = {
  f1: "F1",
  loja: "Loja",
  jogo: "Jogo",
  hub: "HUB",
  growth: "Growth",
  outros: "Outros",
};
