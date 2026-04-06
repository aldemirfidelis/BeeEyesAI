import { expect, type Browser, type Page } from "@playwright/test";

export interface TestUser {
  username: string;
  password: string;
  displayName: string;
}

export function createTestUser(prefix: string): TestUser {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    username: `${prefix}${suffix}`.toLowerCase(),
    password: "Bee12345",
    displayName: `${prefix}-${suffix}`,
  };
}

export async function registerUser(page: Page, user: TestUser) {
  await page.goto("/");
  await page.getByRole("button", { name: /criar conta/i }).click();
  await page.getByRole("textbox", { name: /como você quer ser chamado/i }).fill(user.displayName);
  await page.getByPlaceholder("seu_usuario").fill(user.username);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByTestId("auth-register-submit").click();
  await expect(page.getByTestId("input-chat-message")).toBeVisible({ timeout: 30_000 });
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByPlaceholder("seu_usuario")).toBeVisible();
}

export async function loginUser(page: Page, user: TestUser) {
  await page.goto("/");
  await page.getByPlaceholder("seu_usuario").fill(user.username);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByTestId("auth-login-submit").click();
  await expect(page.getByTestId("input-chat-message")).toBeVisible({ timeout: 30_000 });
}

export async function openSidebarTab(page: Page, name: "Feed" | "Missões" | "Amigos" | "Mensagens" | "Comunidades") {
  await page.getByRole("tab", { name }).click();
}

export async function createSecondPage(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  return { context, page };
}

export async function waitForAssistantAction(page: Page, label: string) {
  await expect(page.getByRole("button", { name: label }).first()).toBeVisible({ timeout: 15_000 });
}
