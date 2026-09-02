#!/usr/bin/env python3
"""
Focused CDP UI audit — measures overflow and key element dimensions.
Connects to existing Chrome at localhost:9222.
"""
import json, asyncio, websockets, time, base64, os, sys

BROWSER_WS = "ws://localhost:9222/devtools/browser/f3faedef-93fd-49d9-9e99-9f42a1c05378"
COOKIE_FILE = "/tmp/cookies.txt"
BASE = "http://localhost:5173"
SCREENSHOT_DIR = "/tmp/audit_final"

VIEWPORTS = [
    ("1440", 1440, 900),
    ("1280", 1280, 800),
    ("1024", 1024, 768),
    ("768", 768, 900),
    ("700", 700, 900),
    ("480", 480, 800),
    ("375", 375, 812),
    ("320", 320, 700),
]

PAGES = {
    "workspace": f"{BASE}/workspaces/8777ecfd-37a7-4e01-a96d-49e20ddb0c5378",
    "issue": f"{BASE}/workspaces/8777ecfd-37a7-4e01-a96d-49e20ddb0c5378/issues/1",
    "my-issues": f"{BASE}/my-issues",
    "dashboard": f"{BASE}/",
}


async def recv_exact(ws):
    """Receive one message (could be response or event)."""
    raw = await ws.recv()
    return json.loads(raw)


async def send_and_wait(ws, method, params=None, timeout=15):
    """Send a command and wait for its response (not events)."""
    req_id = int(time.time() * 1000) % 1000000
    msg = {"id": req_id, "method": method}
    if params:
        msg["params"] = params
    await ws.send(json.dumps(msg))
    deadline = time.time() + timeout
    while time.time() < deadline:
        raw = await ws.recv()
        msg = json.loads(raw)
        if "id" in msg and msg["id"] == req_id:
            return msg
        # Print interesting events
        method_ev = msg.get("method", "")
        if method_ev in ("Page.frameNavigated", "Page.loadEventFired"):
            print(f"  [event] {method_ev}")
    raise TimeoutError(f"timeout for {method}")


async def inject_cookie(ws, session_id, cookie_value):
    """Inject auth cookie into the page context."""
    await send_and_wait(ws, "Network.enable")
    await send_and_wait(ws, "Network.setCookie", {
        "name": "session_id",
        "value": cookie_value,
        "domain": "localhost",
        "path": "/",
    })
    print("  Cookie injected")


async def audit_page(ws, page_id, page_name, url, vp_name, width, height):
    """Navigate to URL at given viewport and audit."""
    print(f"\n--- {page_name} @ {vp_name} ({width}x{height}) ---")

    # Override device metrics
    await send_and_wait(ws, "Emulation.setDeviceMetricsOverride", {
        "width": width,
        "height": height,
        "deviceScaleFactor": 1,
        "mobile": width <= 700,
        "screenOrientation": {"type": "portraitPrimary" if width <= height else "landscapePrimary"},
    })

    # Navigate
    await send_and_wait(ws, "Page.navigate", {"url": url}, timeout=5)
    await asyncio.sleep(1.5)

    # Measure
    try:
        resp = await send_and_wait(ws, "Runtime.evaluate", {
            "expression": """
(() => {
  const b = document.body;
  const h = document.documentElement;
  const el = (s) => document.querySelector(s);
  const dim = (s) => {
    const e = el(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { found: true, sel: s, ow: e.offsetWidth, cw: e.clientWidth, sw: e.scrollWidth,
             ovf: e.scrollWidth > e.clientWidth, ovfPx: Math.max(e.scrollWidth - e.clientWidth, 0),
             x: r.x, y: r.y, w: r.width, h: r.height };
  };
  return {
    vp: window.innerWidth + 'x' + window.innerHeight,
    title: document.title,
    body: { sw: b.scrollWidth, cw: b.clientWidth, ovf: b.scrollWidth > b.clientWidth,
            ovfPx: Math.max(b.scrollWidth - b.clientWidth, 0) },
    html: { sw: h.scrollWidth, cw: h.clientWidth, ovf: h.scrollWidth > h.clientWidth,
            ovfPx: Math.max(h.scrollWidth - h.clientWidth, 0) },
    shell: dim('.app-shell'),
    sidebar: dim('.app-sidebar'),
    main: dim('.app-main'),
    workspaceLayout: dim('.workspace-layout'),
    projectsCol: dim('.projects-column'),
    issuesCol: dim('.issues-column'),
    filterBar: dim('.filter-bar'),
    ledgerList: dim('.ledger-list'),
    firstLedgerItem: dim('.ledger-item'),
    pageHeader: dim('.page-header'),
    issueLayout: dim('.issue-layout'),
    factRail: dim('.fact-rail'),
    gridCols: el('.workspace-layout')?.computedStyleMap ? 'present' : 'none',
  };
})()
            """,
            "returnByValue": True,
        })
        data = resp.get("result", {}).get("value")
        if data is None:
            print("  [ERROR] Script evaluation returned null")
            return None

        print(f"  Viewport: {data.get('vp')}")
        print(f"  Title: {data.get('title','?')[:50]}")
        body = data.get("body", {})
        html = data.get("html", {})
        body_ovf = body.get("ovf", False)
        html_ovf = html.get("ovf", False)
        total_ovf = body.get("ovfPx", 0) + html.get("ovfPx", 0)
        if body_ovf or html_ovf:
            print(f"  *** BODY/Html OVERFLOW: {total_ovf}px (body: {body.get('sw')}/{body.get('cw')}, html: {html.get('sw')}/{html.get('cw')}) ***")
        else:
            print(f"  Body/Html: CLEAN (body {body.get('cw')}px, doc {data.get('html',{}).get('sw',0)}px)")

        for name in ["shell", "sidebar", "main", "workspaceLayout", "projectsCol",
                      "issuesCol", "filterBar", "ledgerList", "firstLedgerItem",
                      "pageHeader", "issueLayout", "factRail"]:
            d = data.get(name)
            if d and d.get("found"):
                ovf = "OVERFLOW" if d.get("ovf") else "ok"
                ovf_s = f"  ***+{d.get('ovfPx')}px" if d.get("ovf") else ""
                print(f"  [{ovf}] {name}: cw={d.get('cw')}, sw={d.get('sw')}{ovf_s}, rect=({d.get('x'):.0f},{d.get('y'):.0f},{d.get('w'):.0f}x{d.get('h'):.0f})")

        # Check grid columns on workspace layout (media query effect)
        if data.get("workspaceLayout"):
            try:
                cs = document_style(ws, ".workspace-layout")
                if cs:
                    grid = cs.get("grid-template-columns", "")
                    if grid:
                        print(f"  Grid columns: {grid}")
            except:
                pass

        return data
    except Exception as e:
        print(f"  [ERROR] {e}")
        return None


async def document_style(ws, selector):
    """Get computed style of an element."""
    resp = await send_and_wait(ws, "Runtime.evaluate", {
        "expression": f"""
(() => {{
  const el = document.querySelector('{selector}');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {{
    'grid-template-columns': cs.getPropertyValue('grid-template-columns'),
    'display': cs.getPropertyValue('display'),
  }};
}})()
        """,
        "returnByValue": True,
    })
    return resp.get("result", {}).get("value")


async def screenshot(ws, page_id, name):
    """Capture a screenshot."""
    try:
        resp = await send_and_wait(ws, "Page.captureScreenshot", {
            "format": "png",
            "fromSurface": True,
        })
        data = resp.get("result", {}).get("data", "")
        if data and "," in data:
            b64 = data.split(",")[-1]
        elif data:
            b64 = data
        else:
            return None
        png = base64.b64decode(b64)
        os.makedirs(SCREENSHOT_DIR, exist_ok=True)
        path = f"{SCREENSHOT_DIR}/{name}.png"
        with open(path, "wb") as f:
            f.write(png)
        print(f"  Screenshot: {path} ({len(png)} bytes)")
        return path
    except Exception as e:
        print(f"  Screenshot failed: {e}")
        return None


async def main():
    print("=" * 60)
    print("MINI ISSUE TRACKER — FINAL UI AUDIT")
    print("=" * 60)

    # Load cookie
    cookie = None
    try:
        with open(COOKIE_FILE) as f:
            for line in f:
                if "session_id" in line:
                    parts = line.strip().split("\t")
                    if len(parts) >= 7:
                        cookie = parts[6]
    except:
        pass
    print(f"Cookie: {'loaded' if cookie else 'NOT FOUND'} ({len(cookie) if cookie else 0} chars)")
    if not cookie:
        print("WARNING: No auth cookie — pages may show login screen")
        print("Run: curl -s -X POST http://localhost:3000/api/auth/signin -H 'Content-Type: application/json' -d '{\"email\":\"viz@test.com\",\"password\":\"[REDACTED]\"}' -c /tmp/cookies.txt")
        print("Then re-run this script.")

    async with websockets.connect(BROWSER_WS) as ws:
        # Get page target
        resp = await send_and_wait(ws, "Target.getTargetInfo", timeout=5)
        targets = resp.get("result", {}).get("targetInfos", [])
        page_id = None
        for t in targets:
            if t.get("type") == "page":
                page_id = t["targetId"]
                title = t.get("title", "?")
                print(f"Found existing page: {title[:60]}")
                break

        if not page_id:
            print("No page target. Creating one...")
            resp = await send_and_wait(ws, "Target.createTarget", {
                "url": f"{BASE}/workspaces/8777ecfd-37a7-4e01-a96d-49e20ddb0c5378",
                "background": False,
            })
            page_id = resp.get("result", {}).get("targetId")
            print(f"Created: {page_id[:20]}")
            await asyncio.sleep(2)

        if page_id:
            # Attach
            resp = await send_and_wait(ws, "Target.attachToTarget", {
                "targetId": page_id,
                "flatten": True,
            })
            session_id = resp.get("result", {}).get("sessionId")
            print(f"Attached, session={session_id[:30] if session_id else 'NONE'}...")

            if session_id and cookie:
                await inject_cookie(ws, session_id, cookie)

            # Navigate to workspace first
            print("\n=== Navigating to workspace page ===")
            ws.send(json.dumps({"id": 99, "method": "Page.navigate", "params": {"url": PAGES["workspace"]}}))
            await ws.recv()
            await asyncio.sleep(2)

            # Brief title check
            try:
                r = await send_and_wait(ws, "Runtime.evaluate", {
                    "expression": "document.title", "returnByValue": True
                })
                print(f"Page title: {r.get('result',{}).get('value', '?')}")
            except:
                pass

            # Audit all pages at all viewports
            results = {}
            for vp_name, w, h in VIEWPORTS:
                for page_name, url in PAGES.items():
                    data = await audit_page(ws, page_id, page_name, url, vp_name, w, h)
                    if data:
                        results[f"{page_name}@{vp_name}"] = data
                        # Screenshot first page at each viewport
                        if page_name == "workspace":
                            await screenshot(ws, page_id, f"ws_{vp_name}")

            # Summary
            print(f"\n{'='*60}")
            print("SUMMARY")
            print(f"{'='*60}")
            over = 0
            total = len(results)
            for key in sorted(results.keys()):
                d = results[key]
                b = d.get("body", {})
                h = d.get("html", {})
                ovf = b.get("ovf", False) or h.get("ovf", False)
                ovf_px = b.get("ovfPx", 0) + h.get("ovfPx", 0)
                if ovf:
                    over += 1
                    print(f"  [OVERFLOW] {key}: +{ovf_px}px (body:{b.get('sw')}/{b.get('cw')}, html:{h.get('sw')}/{h.get('cw')})")
                else:
                    print(f"  [clean]    {key}")

            print(f"\n{total} page/viewport combinations checked, {over} with overflow")
            if over == 0:
                print("\n✓ NO HORIZONTAL OVERFLOW DETECTED")
            else:
                print(f"\n⚠ {over} overflow(s) detected — see details above")

            return results


if __name__ == "__main__":
    asyncio.run(main())
