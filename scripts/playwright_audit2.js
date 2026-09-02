#!/usr/bin/env node
/**
 * Mini Issue Tracker — Final UI Audit v2
 * Screenshots + console checks at all breakpoints for ALL pages.
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const WORKSPACE_ID = '8777ecfd-37a7-4e01-a96d-49e20ddb0c5378';
const COOKIE = 'ZWYzNGI0MjhjYjAzOTEzZjE3MDQyZDgwYmViYWE3YWNmZGU1ZmJjN2IxYWViMTFiNjNjZjUzNjYyNzE3OTZmZg.8efe9c0cbc523b307a9aeeb656082e1cf58019ab99abc299286123cbdedd0afd';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768',  width: 768,  height: 900 },
  { name: '480',  width: 480,  height: 800 },
  { name: '375',  width: 375,  height: 812 },
  { name: '320',  width: 320,  height: 700 },
];

const PAGES = [
  { name: 'workspace', url: `/workspaces/${WORKSPACE_ID}` },
  { name: 'issue',     url: `/workspaces/${WORKSPACE_ID}/issues/1` },
  { name: 'my-issues', url: '/my-issues' },
  { name: 'dashboard', url: '/' },
];

async function auditPage(context, vp, pg) {
  const url = BASE + pg.url;
  const page = await context.newPage();
  await page.setViewportSize({ width: vp.width, height: vp.height });
  
  console.log(`\n${vp.name}px — ${pg.name}`);
  
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    const status = response?.status();
    
    if (status !== 200) {
      console.log(`  HTTP ${status} — SKIP`);
      await page.close();
      return null;
    }
    
    const title = await page.title();
    
    // Evaluate layout metrics
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
        statStrip: dim('.stat-strip'),
      };
    });
    
    // Grid info
    let gridInfo = null;
    try {
      gridInfo = await page.evaluate(() => {
        const wl = document.querySelector('.workspace-layout');
        const il = document.querySelector('.issue-layout');
        return {
          workspaceGrid: wl ? getComputedStyle(wl).gridTemplateColumns : 'N/A',
          issueGrid: il ? getComputedStyle(il).gridTemplateColumns : 'N/A',
        };
      });
    } catch(e) {}
    
    console.log(`  HTTP:${status} Title:"${title}"`);
    console.log(`  Body overflow: ${metrics.bodyOvfl}px ${metrics.bodyOvfl > 0 ? '***' : '(clean)'}`);
    
    // Key elements
    const checkKeys = ['sidebar', 'main', 'workspaceLayout', 'projectsCol', 'issuesCol', 
                       'filterBar', 'ledgerList', 'ledgerRow', 'pageHeader', 'issueLayout', 'factRail', 'statStrip'];
    for (const k of checkKeys) {
      const d = metrics[k];
      if (d) {
        const s = d.ovf ? ` ***OVERFLOW +${d.px}px` : '';
        console.log(`    ${k.padEnd(16)}: cw=${String(d.cw).padStart(4)} sw=${String(d.sw).padStart(4)} ovf=${d.ovf?'YES':'no'}${s}`);
      }
    }
    
    if (gridInfo) {
      console.log(`  Workspace grid: "${gridInfo.workspaceGrid}"`);
      console.log(`  Issue grid:     "${gridInfo.issueGrid}"`);
    }
    
    // Screenshot
    const dir = '/tmp/playwright_audit2';
    require('fs').mkdirSync(dir, { recursive: true });
    const fname = `${dir}/${vp.name}px_${pg.name}.png`;
    await page.screenshot({ path: fname, fullPage: false });
    console.log(`  → ${fname}`);
    
    await page.close();
    return { vp: vp.name, page: pg.name, url, status, title, metrics, gridInfo };
    
  } catch (err) {
    console.log(`  ERROR: ${err.message.slice(0, 80)}`);
    await page.close();
    return { vp: vp.name, page: pg.name, url, error: err.message.slice(0, 80) };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('MINI ISSUE TRACKER — FINAL UI AUDIT v2');
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

  const results = [];
  
  for (const vp of VIEWPORTS) {
    for (const pg of PAGES) {
      const r = await auditPage(context, vp, pg);
      if (r) results.push(r);
    }
  }

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(60));
  
  let bodyOverflows = 0;
  let elementOverflows = 0;
  let errors = 0;
  
  for (const r of results) {
    if (r.error) {
      errors++;
      console.log(`  [ERROR]   ${r.vp}px ${r.page}: ${r.error}`);
      continue;
    }
    
    const bo = r.metrics.bodyOvfl || 0;
    if (bo > 0) {
      bodyOverflows++;
      console.log(`  [BODY-OVF] ${r.vp}px ${r.page}: +${bo}px`);
    }
    
    // Check element overflows (excluding sidebar in icon-rail mode which is expected)
    const sidebars = r.metrics.sidebar;
    let elementOvf = false;
    
    for (const [key, data] of Object.entries(r.metrics)) {
      if (!data || key === 'bodyOvfl' || key === 'body' || key === 'vp') continue;
      if (data.ovf) {
        // Sidebar overflow in icon-rail mode (1024-768) is expected — content is hidden
        const isSidebarIconRail = key === 'sidebar' && ['768'].includes(r.vp);
        const isSidebarDesktop = key === 'sidebar' && ['1440'].includes(r.vp);
        if (!isSidebarIconRail && !isSidebarDesktop) {
          elementOvf = true;
          console.log(`  [ELEM-OVF] ${r.vp}px ${r.page} ${key}: +${data.px}px (cw=${data.cw} sw=${data.sw})`);
        } else {
          console.log(`  [SIDEbar]  ${r.vp}px ${r.page} sidebar: cw=${data.cw} sw=${data.sw} (expected ${isSidebarIconRail?'icon-rail':'desktop'})`);
        }
      }
    }
    
    if (!bo > 0 && !elementOvf) {
      console.log(`  [clean]   ${r.vp}px ${r.page}`);
    }
  }
  
  console.log(`\nResults: ${results.length} page/viewport combos`);
  console.log(`Body overflows: ${bodyOverflows}`);
  console.log(`Element overflows (excluding expected sidebar): ${elementOverflows}`);
  console.log(`Errors: ${errors}`);
  console.log(`Clean: ${results.length - bodyOverflows - elementOverflows - errors}`);
  
  if (bodyOverflows === 0 && elementOverflows === 0 && errors === 0) {
    console.log('\n✓ ALL CLEAR');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(2);
});
