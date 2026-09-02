import { test, expect } from '@playwright/test';

test('visual inspection of workspace', async ({ page }) => {
  await page.goto('http://localhost:5175');
  await page.waitForLoadState('networkidle');
  
  // Take full page screenshot
  await page.screenshot({ path: '/tmp/workspace-desktop.png', fullPage: true });
  
  // Viewport 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/workspace-1440.png', fullPage: true });
  
  // Viewport 1280x800
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/workspace-1280.png', fullPage: true });
  
  // Viewport 1024x768
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/workspace-1024.png', fullPage: true });
  
  // Viewport 768x900
  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/workspace-768.png', fullPage: true });
  
  // Viewport 600x900
  await page.setViewportSize({ width: 600, height: 900 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/workspace-600.png', fullPage: true });
  
  // Viewport 480x900
  await page.setViewportSize({ width: 480, height: 900 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/workspace-480.png', fullPage: true });
  
  // Viewport 375x812
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/workspace-375.png', fullPage: true });
  
  // Viewport 320x800
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/workspace-320.png', fullPage: true });
  
  console.log('All screenshots captured');
});
