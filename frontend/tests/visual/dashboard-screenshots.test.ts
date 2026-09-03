import { test, devices } from '@playwright/test';

test('dashboard at all viewports', async ({ page, browser }) => {
  const viewports = [
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1280x800', width: 1280, height: 800 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '768x900', width: 768, height: 900 },
    { name: '600x900', width: 600, height: 900 },
    { name: '480x800', width: 480, height: 800 },
    { name: '390x844', width: 390, height: 844 },
    { name: '375x812', width: 375, height: 812 },
    { name: '320x800', width: 320, height: 800 },
  ];

  // Authenticate first
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'test@acme.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/');

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:5173/workspaces/348c98db-6c72-4359-b44c-c1f826d57498/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `tests/visual/dashboard-${vp.name}.png`,
      fullPage: true,
    });
    console.log(`Captured ${vp.name}`);
  }
});
