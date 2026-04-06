import { expect, test } from "@playwright/test";
import { createSecondPage, createTestUser, openSidebarTab, registerUser, waitForAssistantAction } from "./helpers";

test("feed, missões, comunidade e dm entre dois usuários reais", async ({ browser, page }) => {
  const userA = createTestUser("alpha");
  const userB = createTestUser("bravo");
  const socialPost = `post-${Date.now()}`;
  const communityName = `com-${Date.now()}`;
  const dmMessage = `dm-${Date.now()}`;

  await registerUser(page, userA);
  const second = await createSecondPage(browser);
  const pageB = second.page;
  await registerUser(pageB, userB);

  await openSidebarTab(page, "Amigos");
  await page.getByTestId("friends-search-input").fill(userB.username);
  const searchCard = page.locator('[class*="p-3"]').filter({ hasText: `@${userB.username}` }).first();
  await expect(searchCard).toBeVisible();
  await searchCard.getByRole("button", { name: /conectar/i }).click();

  await pageB.reload();
  await waitForAssistantAction(pageB, "Aceitar");
  await pageB.getByRole("button", { name: "Aceitar" }).click();

  await openSidebarTab(page, "Feed");
  await page.getByTestId("feed-open-create-post").click();
  await page.getByTestId("feed-post-input").fill(socialPost);
  await page.getByTestId("feed-submit-post").click();
  await expect(page.getByText(socialPost)).toBeVisible();
  await page.locator('[data-testid^="feed-like-"]').first().click();

  await openSidebarTab(page, "Comunidades");
  await page.getByTestId("communities-open-create").click();
  await page.getByPlaceholder("Nome da comunidade *").fill(communityName);
  await page.getByTestId("communities-create-submit").click();
  await expect(page.getByText(communityName)).toBeVisible({ timeout: 15_000 });

  await openSidebarTab(page, "Missões");
  await expect(page.getByText(/nível 2/i)).toBeVisible({ timeout: 15_000 });

  await openSidebarTab(page, "Amigos");
  const friendCard = page.locator('[class*="p-3"]').filter({ hasText: userB.username }).first();
  await expect(friendCard).toBeVisible({ timeout: 15_000 });
  await friendCard.getByRole("button", { name: /enviar mensagem/i }).click();
  await page.getByTestId("dm-input").fill(dmMessage);
  await page.getByTestId("dm-send-button").click();
  await expect(page.getByText(dmMessage)).toBeVisible();

  await openSidebarTab(pageB, "Mensagens");
  await expect(pageB.getByText(userA.displayName)).toBeVisible({ timeout: 15_000 });
  await pageB.getByRole("button", { name: new RegExp(userA.displayName, "i") }).first().click();
  await expect(pageB.getByText(dmMessage)).toBeVisible({ timeout: 15_000 });

  await second.context.close();
});
