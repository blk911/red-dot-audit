import puppeteer from "@cloudflare/puppeteer";
import { env } from "cloudflare:workers";

// Renders a page with a real headless browser via Cloudflare's Browser
// Rendering binding, for sources a plain fetch can't read — pages that
// build their content with client-side JS after load. Google News' article
// links are the confirmed case: a plain fetch of that URL always returns
// Google's own unrendered SPA shell, never the article, verified directly
// by inspecting the response (it's a ~500KB-1MB JS app shell with no
// server-side redirect, regardless of Accept/User-Agent headers).
//
// This does NOT help against active anti-bot challenges. Reddit, MuckRock,
// and Flock's own transparency portal were all confirmed this session to
// actively fingerprint and block automated clients — a rendered headless
// browser still presents as automation to those, so this function will
// return null for them just as a plain fetch does. It only helps the
// "needs JS to build the page" case, not the "actively blocking bots" case.
//
// UNTESTED IN LOCAL DEV: Miniflare cannot simulate a real browser for the
// Browser Rendering binding without `remote: true` plus an authenticated
// Cloudflare account connection, which this project does not have
// configured (see vite.config.ts). This is written against Cloudflare's
// documented @cloudflare/puppeteer API and compiles cleanly, but its
// runtime behavior has not been — and could not be — verified end to end
// from this environment. Confirm it actually works before relying on it.
export async function renderPageText(url: string, timeoutMs = 15_000): Promise<string | null> {
  const binding = (env as Record<string, unknown>).BROWSER;
  if (!binding) return null;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch(binding as Parameters<typeof puppeteer.launch>[0]);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const text = await page.evaluate(() => document.body.innerText);
    return text && text.trim().length > 0 ? text : null;
  } catch (error) {
    console.error("Browser rendering failed", url, error);
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // best-effort cleanup; a failed close shouldn't mask the real result/error
      }
    }
  }
}
