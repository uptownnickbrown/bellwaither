import { chromium } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:3000';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function screenshot(page, name) {
  await delay(1500);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  console.log(`  📸 ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  // ─── Evidence Detail ─────────────────────────────────
  console.log('\n1. Evidence Detail');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await delay(2000);

  // Navigate to Evidence tab
  await page.click('text=Evidence');
  await delay(2000);

  // Click the first list item in the evidence list
  const evidenceItems = page.locator('[class*="cursor-pointer"], [class*="hover"]').filter({ hasText: /Student Achievement|Teacher Retention|Classroom Observation|Board Meeting/i });
  const count = await evidenceItems.count();
  console.log(`  Found ${count} evidence items`);
  if (count > 0) {
    await evidenceItems.first().click();
    await delay(2500);
    await screenshot(page, '04b_evidence_detail');
  }

  // Click a different evidence item
  const retention = page.locator('text=Teacher Retention').first();
  if (await retention.count() > 0) {
    await retention.click();
    await delay(2500);
    await screenshot(page, '04c_evidence_retention_detail');
  }

  // ─── Diagnostic with expanded dimension ──────────────
  console.log('\n2. Diagnostic expanded');
  await page.click('text=Diagnostic');
  await delay(2000);

  // Click chevron/expand on Organizational Purpose
  const orgPurpose = page.locator('text=Organizational Purpose').first();
  if (await orgPurpose.count() > 0) {
    await orgPurpose.click();
    await delay(1500);
    await screenshot(page, '06b_diagnostic_expanded');

    // Now try to click one of the colored component indicators (A, B)
    // Look for the actual component links inside the expanded view
    const missionLink = page.locator('text=/Mission, Vision/i, text=/1A.*Mission/i').first();
    if (await missionLink.count() > 0) {
      await missionLink.click();
      await delay(2500);
      await screenshot(page, '06c_diagnostic_component_detail');
    }
  }

  // ─── Action Plan detail ──────────────────────────────
  console.log('\n3. Action Plan detail');
  await page.click('text=Action Plan');
  await delay(2000);

  // Click the first action item
  const actionItems = page.locator('text=Strengthen Instructional').first();
  if (await actionItems.count() > 0) {
    await actionItems.click();
    await delay(2500);
    await screenshot(page, '08b_action_plan_detail');
  }

  // Click a different action item
  const mathGap = page.locator('text=Address Math Achievement').first();
  if (await mathGap.count() > 0) {
    await mathGap.click();
    await delay(2000);
    await screenshot(page, '08c_action_plan_math');
  }

  // ─── Copilot with a question typed ───────────────────
  console.log('\n4. Copilot interaction');
  await page.click('text=Dashboard');
  await delay(1500);

  // Open copilot
  const copilotBtn = page.locator('button').filter({ hasText: /AI Copilot/i }).first();
  if (await copilotBtn.count() > 0) {
    await copilotBtn.click();
    await delay(1500);

    // Type a question
    const input = page.locator('input[placeholder*="Ask"], textarea[placeholder*="Ask"], input[placeholder*="ask"], textarea[placeholder*="ask"], input[placeholder*="question"], textarea').first();
    if (await input.count() > 0) {
      await input.fill('What are the biggest gaps in our assessment so far?');
      await delay(500);
      await screenshot(page, '10b_copilot_with_question');
    }
  }

  await browser.close();
  console.log('\nDone!');
})();
