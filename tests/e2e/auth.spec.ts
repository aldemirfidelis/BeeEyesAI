import { expect, test } from "@playwright/test";
import { createTestUser, loginUser, logout, registerUser } from "./helpers";

test("cadastro, logout, falha de login e login bem-sucedido", async ({ page }) => {
  const user = createTestUser("auth");

  await registerUser(page, user);
  await logout(page);
  if (await page.getByText(/já tem conta\? entrar/i).isVisible()) {
    await page.getByText(/já tem conta\? entrar/i).click();
  }

  await page.getByPlaceholder("seu_usuario").fill(user.username);
  await page.locator('input[type="password"]').fill("Bee99999");
  await page.getByTestId("auth-login-submit").click();
  await expect(page.getByText(/usuário ou senha incorretos/i)).toBeVisible();

  await loginUser(page, user);
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});
