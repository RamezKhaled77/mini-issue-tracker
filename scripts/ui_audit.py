#!/usr/bin/env python3
"""
CDP-based UI audit script for Mini Issue Tracker.
Measures overflow, checks key elements at multiple breakpoints.
"""
import json, asyncio, websockets, time, base64, os, sys

BROWSER_WS = "ws://localhost:9222/devtools/browser/f3faedef-93fd-49d9-9e99-9f42a1c05378"
COOKIE_FILE = "/tmp/cookies.txt"
BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = "/tmp/audit_screenshots"

VIEWPORTS = [
    ("1440x900", 1440, 900),
    ("1280x800", 1280, 800),
    ("1024x768", 1024, 768),
    ("768x900", 768, 900),
    ("700x900", 700, 900),
    ("480x800", 480, 800),
    ("375x812", 375, 812),
    ("320x700", 320, 700),
]

PAGES = [
    ("workspace", "/workspaces/8777ecfd-37a7-4e01-a96d-49e20ddb0c5378"),
    ("issue", "/workspaces/8777ecfd-37a7-4e01-a96d-49e20ddb0c5378/issues/1"),
    ("my-issues", "/my-issues"),
    ("dashboard", "/"),
]


def load_cookie():
    try:
        with open(COOKIE_FILE) as f:
            for line in f:
                if line.startswith("localhost") and "session_id" in line:
                    parts = line.strip().split("\t")
                    if len(parts) >= 7:
                        return parts[6]
    except Exception:
        pass
    return None


class CDPAgent:
    def __init__(self, ws):
        self.ws = ws
        self.pending = {}

    async def send(self, method, **params):
        req_id = int(time.time() * 1000) + hash(str(params)) % 10000
        msg = {"id": req_id, "method": method, "params": params}
        await self.ws.send(json.dumps(msg))
        self.pending[req_id] = None
        return req_id

    async def recv(self):
        while True:
            raw = await self.ws.recv()
            msg = json.loads(raw)
            if "id" in msg and msg["id"] in self.pending:
                self.pending[msg["id"]] = msg
                return msg
            # Handle events silently
            if msg.get("method") == "Page.frameNavigated":
                print(f"  [CDP] Navigated to: {msg.get('params', {}).get('frame', {}).get('url', 'unknown')[:80]}")

    async def wait_for(self, req_id, timeout=10):
        start = time.time()
        while self.pending.get(req_id) is None:
            if time.time() - start > timeout:
                raise TimeoutError(f"Timeout waiting for req {req_id}")
            await self.recv()
        return self.pending[req_id]


async def connect_page(page_id):
    """Attach to an existing page target."""
    async with websockets.connect(BROWSER_WS) as ws:
        agent = CDPAgent(ws)
        # Attach to page
        resp = await agent.wait_for(
            await agent.send("Target.attachToTarget", targetId=page_id, flatten=True)
        )
        session_id = resp.get("result", {}).get("sessionId")
        if not session_id:
            raise RuntimeError(f"Failed to attach: {resp}")
        print(f"  Attached to page {page_id}, session={session_id[:50]}...")
        return ws, agent, session_id


async def navigate_and_audit(page_id, url, viewport_name, width, height):
    """Navigate to URL and audit the page."""
    print(f"\n{'='*60}")
    print(f"Auditing: {page_id} at {viewport_name} ({width}x{height})")
    print(f"URL: {url}")
    print(f"{'='*60}")

    async with websockets.connect(BROWSER_WS) as ws:
        agent = CDPAgent(ws)

        # Get page target
        resp = await agent.wait_for(
            await agent.send("Target.getTargetInfo")
        )
        targets = resp.get("result", {}).get("targetInfos", [])
        page_target = None
        for t in targets:
            if t.get("type") == "page":
                page_target = t
                break
        if not page_target:
            print("  ERROR: No page target found")
            return None

        print(f"  Existing page: {page_target.get('title', 'unknown')[:60]}")

        # Resize viewport
        await agent.wait_for(
            await agent.send("Emulation.setDeviceMetricsOverride", {
                "width": width,
                "height": height,
                "deviceScaleFactor": 1,
                "mobile": width < 768,
                "fitPrimaryScreen": True,
            })
        )
        print(f"  Viewport set to {width}x{height}")

        # Navigate
        nav_resp = await agent.wait_for(
            await agent.send("Page.navigate", url={"url": url})
        )
        nav_error = nav_resp.get("result", {}).get("error")
        if nav_error:
            print(f"  NAVIGATION ERROR: {nav_error}")
            return None
        print(f"  Navigating to {url}...")

        # Wait for load
        await asyncio.sleep(2)

        # Check if page loaded
        info_resp = await agent.wait_for(
            await agent.send("Page.getFrameTree", frameId="page_0" if "page_0" else None)
        )
        # Try a simpler approach - just evaluate
        try:
            eval_resp = await agent.wait_for(
                await agent.send("Runtime.evaluate", {
                    "expression": "document.title",
                    "returnByValue": True,
                })
            )
            title = eval_resp.get("result", {}).get("value")
            print(f"  Page title: {title}")
        except Exception as e:
            print(f"  Could not get title: {e}")
            title = ""

        # Measure body overflow
        try:
            measure = await agent.wait_for(
                await agent.send("Runtime.evaluate", {
                    "expression": """
                      (() => {
                        const body = document.body;
                        const html = document.documentElement;
                        const bodySW = body.scrollWidth;
                        const bodyCW = body.clientWidth;
                        const htmlSW = html.scrollWidth;
                        const htmlCW = html.clientWidth;
                        const overflow = bodySW > bodyCW || htmlSW > htmlCW;
                        return {
                          bodyScrollWidth: bodySW,
                          bodyClientWidth: bodyCW,
                          htmlScrollWidth: htmlSW,
                          htmlClientWidth: htmlCW,
                          overflow: overflow,
                          overflowPixels: Math.max(bodySW - bodyCW, htmlSW - htmlCW, 0),
                          docWidth: Math.max(bodySW, htmlSW, bodyCW, htmlCW)
                        };
                      })()
                    """,
                    "returnByValue": True,
                })
            )
            metrics = measure.get("result", {}).get("value", {})
            print(f"  BODY OVERFLOW: {'YES' if metrics.get('overflow') else 'NO'}")
            print(f"    body scrollWidth={metrics.get('bodyScrollWidth')}, clientWidth={metrics.get('bodyClientWidth')}")
            print(f"    html scrollWidth={metrics.get('htmlScrollWidth')}, clientWidth={metrics.get('htmlClientWidth')}")
            print(f"    overflow pixels: {metrics.get('overflowPixels')}")
            print(f"    document width: {metrics.get('docWidth')}")
        except Exception as e:
            print(f"  Could not measure overflow: {e}")
            metrics = {}

        # Check specific elements
        elements_to_check = [
            ("body", "body"),
            ("app-shell", ".app-shell"),
            ("app-sidebar", ".app-sidebar"),
            ("app-main", ".app-main"),
            ("workspace-layout", ".workspace-layout"),
            ("projects-column", ".projects-column"),
            ("issues-column", ".issues-column"),
        ]

        for name, selector in elements_to_check:
            try:
                resp = await agent.wait_for(
                    await agent.send("Runtime.evaluate", {
                        "expression": f"""
                          (() => {{
                            const el = document.querySelector('{selector}');
                            if (!el) return {{found: false}};
                            const r = el.getBoundingClientRect();
                            const sw = el.scrollWidth;
                            const cw = el.clientWidth;
                            const ow = el.offsetWidth;
                            return {{
                              found: true,
                              selector: '{selector}',
                              offsetWidth: ow,
                              clientWidth: cw,
                              scrollWidth: sw,
                              overflow: sw > cw,
                              overflowPx: Math.max(sw - cw, 0),
                              rect: {{x: r.x, y: r.y, w: r.width, h: r.height}}
                            }};
                          }})()
                        """,
                        "returnByValue": True,
                    })
                )
                el_data = resp.get("result", {}).get("value", {})
                if el_data.get("found"):
                    status = "OVERFLOW" if el_data.get("overflow") else "ok"
                    print(f"  [{status}] {name}: offsetW={el_data.get('offsetWidth')}, clientW={el_data.get('clientWidth')}, scrollW={el_data.get('scrollWidth')}, overflowPx={el_data.get('overflowPx')}")
            except Exception as e:
                pass

        # Take screenshot
        try:
            os.makedirs(SCREENSHOT_DIR, exist_ok=True)
            screenshot_resp = await agent.wait_for(
                await agent.send("Page.captureScreenshot", {
                    "format": "png",
                    "fromSurface": True,
                    "captureBeyondViewport": False,
                })
            )
            data = screenshot_resp.get("result", {}).get("data", "")
            if data:
                b64 = data.split(",")[-1] if "," in data else data
                png_data = base64.b64decode(b64)
                fname = f"{SCREENSHOT_DIR}/{page_id}_{viewport_name.replace('x','x').replace(' ','_')}.png"
                with open(fname, "wb") as f:
                    f.write(png_data)
                print(f"  Screenshot: {fname} ({len(png_data)} bytes)")
        except Exception as e:
            print(f"  Screenshot failed: {e}")

        return metrics


async def main():
    cookie = load_cookie()
    print(f" Cookie loaded: {'YES' if cookie else 'NO'} (length={len(cookie) if cookie else 0})")
    print(f" Viewport audit: {len(VIEWPORTS)} sizes x {len(PAGES)} pages")

    # First, find the page target by listing targets
    async with websockets.connect(BROWSER_WS) as ws:
        agent = CDPAgent(ws)
        resp = await agent.wait_for(
            await agent.send("Target.getTargetInfo")
        )
        targets = resp.get("result", {}).get("targetInfos", [])
        print(f"\n Available targets: {len(targets)}")
        for t in targets:
            print(f"  - {t.get('type')}: {t.get('title', 'unknown')[:50]} (id={t.get('targetId')[:20]})")

        # Find existing page target
        page_target = None
        for t in targets:
            if t.get("type") == "page":
                page_target = t
                break

        if not page_target:
            print("No page target found - creating one")
            # Create a new page target
            resp = await agent.wait_for(
                await agent.send("Target.createTarget", {
                    "url": f"{BASE_URL}/workspaces/8777ecfd-37a7-4e01-a96d-49e20ddb0c5378",
                    "background": True,
                })
            )
            new_id = resp.get("result", {}).get("targetId")
            print(f" Created target: {new_id[:20]}")
            page_target = {"type": "page", "targetId": new_id}
            await asyncio.sleep(1)

        page_id = page_target.get("targetId")

        # Inject cookie if available
        if cookie:
            try:
                await agent.wait_for(
                    await agent.send("Network.setCookie", {
                        "name": "session_id",
                        "value": cookie,
                        "domain": "localhost",
                        "path": "/",
                    })
                )
                print(" Cookie injected")
            except Exception as e:
                print(f" Cookie injection failed: {e}")

        # Audit each page at each viewport
        results = {}
        for viewport_name, width, height in VIEWPORTS:
            for page_name, page_url in PAGES:
                # Navigate to the page first
                if page_name == "workspace":
                    url = f"{BASE_URL}{page_url}"
                elif page_name == "issue":
                    url = f"{BASE_URL}{page_url}"
                elif page_name == "my-issues":
                    url = f"{BASE_URL}{page_url}"
                elif page_name == "dashboard":
                    url = f"{BASE_URL}{page_url}"
                else:
                    continue

                metrics = await navigate_and_audit(page_id, url, viewport_name, width, height)
                if metrics:
                    key = f"{page_name}@{viewport_name}"
                    results[key] = metrics

        # Summary
        print(f"\n{'='*60}")
        print("AUDIT SUMMARY")
        print(f"{'='*60}")
        overflow_count = 0
        total_checked = 0
        for key, metrics in sorted(results.items()):
            total_checked += 1
            has_overflow = metrics.get("overflow", False)
            if has_overflow:
                overflow_count += 1
            status = "OVERFLOW" if has_overflow else "clean"
            print(f"  [{status}] {key}: overflowPx={metrics.get('overflowPixels')}, docWidth={metrics.get('docWidth')}")

        print(f"\n Total: {total_checked} page/viewport combinations checked")
        print(f" Overflow detected: {overflow_count}/{total_checked}")
        if overflow_count > 0:
            print(" ISSUES FOUND - see details above")
        else:
            print(" All clear - no horizontal overflow detected")

        return results


if __name__ == "__main__":
    asyncio.run(main())
