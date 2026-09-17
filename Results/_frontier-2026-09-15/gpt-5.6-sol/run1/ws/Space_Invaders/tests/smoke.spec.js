import { test, expect } from '@playwright/test';

const collectErrors = (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
};

test('boots, accepts both input paths, pauses, restarts, and reaches victory', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/?test=1');
  await expect(page.locator('#screen-title')).toBeVisible();
  await expect(page.locator('#start-button')).toContainText('Initialize defense');
  await page.screenshot({ path: testInfo.outputPath('title.png') });

  await page.keyboard.press('Enter');
  await expect(page.locator('#game-shell')).toHaveAttribute('data-game-state', 'playing');
  const beforeMove = await page.evaluate(() => window.__SPACE_INVADERS__.state().playerX);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(280);
  await page.keyboard.up('KeyD');
  const afterMove = await page.evaluate(() => window.__SPACE_INVADERS__.state().playerX);
  expect(afterMove).toBeGreaterThan(beforeMove);

  await page.keyboard.press('Space');
  await page.waitForTimeout(40);
  expect(await page.evaluate(() => window.__SPACE_INVADERS__.state().shotsFired)).toBeGreaterThan(0);

  await page.evaluate(() => window.__SPACE_INVADERS__.injectGamepad({ axisX: -1 }, 24));
  await page.waitForTimeout(260);
  const afterGamepad = await page.evaluate(() => window.__SPACE_INVADERS__.state().playerX);
  expect(afterGamepad).toBeLessThan(afterMove);
  await page.screenshot({ path: testInfo.outputPath('active-combat.png') });

  await page.keyboard.press('KeyP');
  await expect(page.locator('#screen-pause')).toBeVisible();
  const pausedX = await page.evaluate(() => window.__SPACE_INVADERS__.state().playerX);
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.__SPACE_INVADERS__.state().playerX)).toBe(pausedX);
  await page.keyboard.press('KeyP');
  await expect(page.locator('#game-shell')).toHaveAttribute('data-game-state', 'playing');

  await page.evaluate(() => window.__SPACE_INVADERS__.forceVictory());
  await expect(page.locator('#game-shell')).toHaveAttribute('data-game-state', 'wave-clear');
  await expect(page.locator('#screen-victory')).toBeVisible({ timeout: 4_000 });
  await page.screenshot({ path: testInfo.outputPath('victory.png') });
  expect(errors).toEqual([]);
});

test('renders narrow HUD, reaches invasion loss, and keeps memory stable across resets', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/?test=1');
  await page.evaluate(() => window.__SPACE_INVADERS__.start());
  await expect(page.locator('#game-shell')).toHaveAttribute('data-game-state', 'playing');
  const baseline = await page.evaluate(() => window.__SPACE_INVADERS__.state().renderer);
  for (let i = 0; i < 10; i += 1) {
    await page.evaluate(() => window.__SPACE_INVADERS__.start());
    await page.waitForTimeout(20);
  }
  const after = await page.evaluate(() => window.__SPACE_INVADERS__.state().renderer);
  expect(after.geometries).toBe(baseline.geometries);
  expect(after.textures).toBe(baseline.textures);
  expect(await page.evaluate(() => window.__SPACE_INVADERS__.state().particles)).toBeLessThanOrEqual(500);

  await page.evaluate(() => window.__SPACE_INVADERS__.forceInvasion());
  await expect(page.locator('#screen-game-over')).toBeVisible();
  await expect(page.locator('#game-over-cause')).toContainText('FLEET BREACH');
  await page.screenshot({ path: testInfo.outputPath('narrow-game-over.png') });
  expect(errors).toEqual([]);
});
