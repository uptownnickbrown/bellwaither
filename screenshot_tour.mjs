/**
 * End-to-end screenshot tour of Meridian (Lincoln Innovation Academy).
 * Run: npx playwright test screenshot_tour.mjs --headed  (or without --headed)
 * Or:  node screenshot_tour.mjs
 */

import { chromium } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function screenshot(page, name, fullPage = false) {
  await delay(1500); // let renders settle
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage,
  });
  console.log(`  📸 ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // ─── 1. Dashboard ────────────────────────────────────
  console.log('\n1. Dashboard');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await delay(2000);
  await screenshot(page, '01_dashboard');

  // ─── 2. Framework Explorer ───────────────────────────
  console.log('\n2. Framework Explorer');
  // Click Framework tab
  const frameworkTab = page.locator('button, a, [role="tab"]').filter({ hasText: /framework/i }).first();
  if (await frameworkTab.count() > 0) {
    await frameworkTab.click();
    await delay(2000);
    await screenshot(page, '02_framework_overview');

    // Click on a dimension to expand
    const dimension = page.locator('text=/Organizational/i').first();
    if (await dimension.count() > 0) {
      await dimension.click();
      await delay(1500);
      await screenshot(page, '03_framework_dimension_expanded');
    }
  }

  // ─── 3. Evidence Management ──────────────────────────
  console.log('\n3. Evidence Management');
  const evidenceTab = page.locator('button, a, [role="tab"]').filter({ hasText: /evidence/i }).first();
  if (await evidenceTab.count() > 0) {
    await evidenceTab.click();
    await delay(2000);
    await screenshot(page, '04_evidence_list');
  }

  // ─── 4. Data Requests ────────────────────────────────
  console.log('\n4. Data Requests');
  const dataTab = page.locator('button, a, [role="tab"]').filter({ hasText: /data req/i }).first();
  if (await dataTab.count() > 0) {
    await dataTab.click();
    await delay(2000);
    await screenshot(page, '05_data_requests');
  }

  // ─── 5. Scoring ──────────────────────────────────────
  console.log('\n5. Scoring');
  const scoringTab = page.locator('button, a, [role="tab"]').filter({ hasText: /scor/i }).first();
  if (await scoringTab.count() > 0) {
    await scoringTab.click();
    await delay(2000);
    await screenshot(page, '06_scoring_overview');

    // Click on a dimension to see component scores
    const scoreDim = page.locator('text=/Purpose/i, text=/Academic/i, text=/Culture/i').first();
    if (await scoreDim.count() > 0) {
      await scoreDim.click();
      await delay(2000);
      await screenshot(page, '07_scoring_dimension_detail');
    }
  }

  // ─── 6. Action Plan ─────────────────────────────────
  console.log('\n6. Action Plan');
  const actionTab = page.locator('button, a, [role="tab"]').filter({ hasText: /action/i }).first();
  if (await actionTab.count() > 0) {
    await actionTab.click();
    await delay(2000);
    await screenshot(page, '08_action_plan');
  }

  // ─── 7. Messaging ───────────────────────────────────
  console.log('\n7. Messaging');
  const messagingTab = page.locator('button, a, [role="tab"]').filter({ hasText: /messag/i }).first();
  if (await messagingTab.count() > 0) {
    await messagingTab.click();
    await delay(2000);
    await screenshot(page, '09_messaging');
  }

  // ─── 8. AI Copilot ──────────────────────────────────
  console.log('\n8. AI Copilot');
  // Go back to dashboard first
  const dashTab = page.locator('button, a, [role="tab"]').filter({ hasText: /dashboard/i }).first();
  if (await dashTab.count() > 0) {
    await dashTab.click();
    await delay(1500);
  }

  // Look for copilot button / trigger
  const copilotBtn = page.locator('button').filter({ hasText: /copilot|ask ai|ai assistant/i }).first();
  if (await copilotBtn.count() > 0) {
    await copilotBtn.click();
    await delay(1500);
    await screenshot(page, '10_copilot_panel');
  } else {
    // Try looking for a floating action button or icon button
    const fabBtn = page.locator('[aria-label*="copilot" i], [aria-label*="assistant" i], [title*="copilot" i]').first();
    if (await fabBtn.count() > 0) {
      await fabBtn.click();
      await delay(1500);
      await screenshot(page, '10_copilot_panel');
    }
  }

  // ─── 9. Role Switcher ───────────────────────────────
  console.log('\n9. Role Switcher');
  // Look for the role toggle
  const roleSwitch = page.locator('button, select, [role="switch"]').filter({ hasText: /school|admin|consultant|role/i }).first();
  if (await roleSwitch.count() > 0) {
    await roleSwitch.click();
    await delay(2000);
    await screenshot(page, '11_role_switched');
  } else {
    // Try toggle/switch elements
    const toggle = page.locator('label:has(input[type="checkbox"]), [class*="toggle"], [class*="switch"]').first();
    if (await toggle.count() > 0) {
      await toggle.click();
      await delay(2000);
      await screenshot(page, '11_role_switched');
    }
  }

  // ─── 10. Full page scroll captures ──────────────────
  console.log('\n10. Full page captures');
  // Go back to dashboard for a full-page shot
  if (await dashTab.count() > 0) {
    await dashTab.click();
    await delay(2000);
    await screenshot(page, '12_dashboard_full', true);
  }

  await browser.close();
  console.log(`\nDone! Screenshots saved to ${SHOTS}/`);
})();
