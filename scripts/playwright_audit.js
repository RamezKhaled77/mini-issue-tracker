#!/usr/bin/env node
/**
 * Mini Issue Tracker — Final UI Audit via Playwright
 * Screenshots + console checks at all breakpoints.
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const WORKSPACE_ID = '8777ecfd-37a7-4e01-a96d-49e20ddb0c5378';
const COOKIE = 'ZWYzNGI0MjhjYjAzOTEzZjE3MDQyZDgwYmViYWE3YWNmZGU1ZmJjN2IxYWViMTFiNjNjZjUzNjYyNzE3OTZmZg.8efe9c0cbc523b307a9aeeb656082e1cf58019ab99abc299286123cbdedd0afd';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1024', width: 1024, height: 768 },
  { name: '768',  width: 768,  height: 900 },
  { name: '700',  width: 700,  height: 900 },
  { name: '480',  width: 480,  height: 800 },
  { name: '375',  width: 375,  height: 812 },
  { name: '320',  width: 320,  height: 700 },
];

const PAGES = [
  { name: 'workspace', url: `/${WORKSPACE_ID}` },
  { name: 'issue',     url: `/${WORKSPACE_ID}/issues/1` },
  { name: 'my-issues', url: '/my-issues' },
  { name: 'dashboard', url: '/' },
];

async function audit() {
  console.log('='.repeat(60));
  console.log('MINI ISSUE TRACKER — PLAYWRIGHT UI AUDIT');
  console.log('='.repeat(60));

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext();
  await context.addCookies([{
    name: 'session_id',
    value: COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
  }]);

  const allResults = [];

  for (const vp of VIEWPORTS) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    
    for (const pg of PAGES) {
      const url = BASE + pg.url;
      console.log(`\n${vp.name}px — ${pg.name} — ${url}`);
      
      try {
        const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        const status = response?.status();
        console.log(`  HTTP: ${status}`);
        
        if (status !== 200) {
          console.log(`  SKIP: non-200 response`);
          await page.close();
          continue;
        }
        
        // Check page title
        const title = await page.title();
        console.log(`  Title: ${title}`);
        
        // Check for console errors
        const consoleErrors = [];
        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        
        // Evaluate overflow
        const metrics = await page.evaluate(() => {
          const b = document.body;
          const h = document.documentElement;
          function dim(s) {
            const e = document.querySelector(s);
            if (!e) return null;
            const r = e.getBoundingClientRect();
            return {
              sel: s, cw: e.clientWidth, sw: e.scrollWidth,
              ow: e.offsetWidth, ovf: e.scrollWidth > e.clientWidth,
              px: Math.max(e.scrollWidth - e.clientWidth, 0),
              x: r.x.toFixed(0), y: r.y.toFixed(0),
              w: r.width.toFixed(0), h: r.height.toFixed(0)
            };
          }
          return {
            vp: window.innerWidth + 'x' + window.innerHeight,
            bodyOvfl: Math.max(b.scrollWidth - b.clientWidth, h.scrollWidth - h.clientWidth, 0),
            hasOverflow: b.scrollWidth > b.clientWidth || h.scrollWidth > h.clientWidth,
            body: dim('body'),
            sidebar: dim('.app-sidebar'),
            main: dim('.app-main'),
            workspaceLayout: dim('.workspace-layout'),
            projectsCol: dim('.projects-column'),
            issuesCol: dim('.issues-column'),
            filterBar: dim('.filter-bar'),
            ledgerList: dim('.ledger-list'),
            ledgerRow: dim('.ledger-item'),
            pageHeader: dim('.page-header'),
            issueLayout: dim('.issue-layout'),
            factRail: dim('.fact-rail'),
          };
        });
        
        const ovfl = metrics.bodyOvfl;
        const status_str = ovfl > 0 ? `*** OVERFLOW: ${ovfl}px ***` : 'CLEAN';
        console.log(`  ${status_str}`);
        console.log(`  Layout elements:`);
        for (const key of ['sidebar', 'main', 'workspaceLayout', 'projectsCol', 'issuesCol', 'filterBar', 'ledgerList', 'ledgerRow', 'pageHeader', 'issueLayout', 'factRail']) {
          const d = metrics[key];
          if (d) {
            const ovf = d.ovf ? ' [OVERFLOW]' : '';
            console.log(`    ${key.padEnd(16)}: cw=${d.cw.toString().padStart(4)} sw=${d.sw.toString().padStart(4)} ow=${d.ow.toString().padStart(4)} ovf=${d.ovf?'YES': 'no'}${ovf}`);
          }
        }
        
        // Check grid columns
        try {
          const gridCols = await page.evaluate(() => {
            const el = document.querySelector('.workspace-layout');
            if (!el) return null;
            return getComputedStyle(el).gridTemplateColumns;
          });
          if (gridCols) console.log(`  Workspace grid columns: "${gridCols}"`);
        } catch(e) {}
        
        try {
          const issueGrid = await page.evaluate(() => {
            const el = document.querySelector('.issue-layout');
            if (!el) return null;
            return getComputedStyle(el).gridTemplateColumns;
          });
          if (issueGrid) console.log(`  Issue grid columns: "${issueGrid}"`);
        } catch(e) {}
        
        if (consoleErrors.length > 0) {
          console.log(`  CONSOLE ERRORS: ${consoleErrors.length}`);
          for (const e of consoleErrors.slice(0, 3)) console.log(`    - ${e.slice(0, 100)}`);
        }
        
        // Save screenshot
        const dir = '/tmp/playwright_audit';
        require('fs').mkdirSync(dir, { recursive: true });
        const fname = `${dir}/${vp.name}px_${pg.name}.png`;
        await page.screenshot({ path: fname, fullPage: false });
        console.log(`  Screenshot: ${fname}`);
        
        allResults.push({
          viewport: vp.name,
          page: pg.name,
          url,
          status,
          title,
          overflow: ovfl,
          hasOverflow: metrics.hasOverflow,
          metrics,
          consoleErrors: consoleErrors.slice(0, 5),
        });
        
      } catch (err) {
        console.log(`  ERROR: ${err.message.slice(0, 100)}`);
        allResults.push({
          viewport: vp.name,
          page: pg.name,
          url,
          error: err.message.slice(0, 100),
        });
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(60));
  
  let overflowCount = 0;
  let errorCount = 0;
  let total = 0;
  
  for (const r of allResults) {
    total++;
    if (r.overflow && r.overflow > 0) {
      overflowCount++;
      console.log(`  [OVERFLOW] ${r.viewport}px ${r.page}: +${r.overflow}px`);
    } else if (r.error) {
      errorCount++;
      console.log(`  [ERROR]   ${r.viewport}px ${r.page}: ${r.error}`);
    } else {
      console.log(`  [clean]   ${r.viewport}px ${r.page}`);
    }
  }
  
  console.log(`\nTotal pages/viewports checked: ${total}`);
  console.log(`With overflow: ${overflowCount}`);
  console.log(`With errors: ${errorCount}`);
  console.log(`Clean: ${total - overflowCount - errorCount}`);
  
  if (overflowCount === 0 && errorCount === 0) {
    console.log('\n✓ ALL CLEAR — No horizontal overflow or errors detected.');
    process.exit(0);
  } else {
    console.log('\n⚠ Issues found — see details above.');
    process.exit(overflowCount > 0 ? 1 : 0);
  }
}

audit().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(2);
});
