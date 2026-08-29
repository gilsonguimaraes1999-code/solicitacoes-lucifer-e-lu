import { expect, test } from "@playwright/test";

test("exibe a tela de login em português", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
});

test("cadastro informa o fluxo de aprovação", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByText("Após o cadastro, sua conta aguardará aprovação.")).toBeVisible();
});
