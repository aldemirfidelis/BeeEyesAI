import { expect, test } from "@playwright/test";
import { createTestUser, openSidebarTab, registerUser } from "./helpers";

test("onboarding inicial, recuperação de sessão e interação avançada em comunidades", async ({ page }) => {
  const user = createTestUser("onboard");
  const communityName = `crew-${Date.now()}`;
  const communityPost = `community-post-${Date.now()}`;
  const communityComment = `community-comment-${Date.now()}`;

  await registerUser(page, user);
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await expect(page.getByText(/\/feed/i)).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("input-chat-message")).toBeVisible({ timeout: 20_000 });

  await openSidebarTab(page, "Comunidades");
  await page.getByTestId("communities-open-create").click();
  await page.getByPlaceholder("Nome da comunidade *").fill(communityName);
  await page.getByTestId("communities-create-submit").click();
  await expect(page.getByText(communityName)).toBeVisible({ timeout: 15_000 });

  await page.getByText(communityName).click();
  await page.getByPlaceholder("Escreva algo para a comunidade...").fill(communityPost);
  await page.getByTestId("community-post-submit").click();
  await expect(page.getByPlaceholder("Escreva algo para a comunidade...")).toHaveValue("");
  const createdPost = page.getByTestId(/^community-post-card-/).filter({ hasText: communityPost }).first();
  await expect(createdPost).toBeVisible({ timeout: 15_000 });

  await createdPost.getByRole("button", { name: /comentar/i }).click();
  await page.locator('[data-testid^="community-comment-input-"]').first().fill(communityComment);
  await page.locator('[data-testid^="community-comment-submit-"]').first().click();
  await expect(page.getByText(communityComment)).toBeVisible({ timeout: 15_000 });
});
