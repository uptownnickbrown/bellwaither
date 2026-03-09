/**
 * Deep-dive screenshots: Scoring/Diagnostic, Evidence detail, Framework component detail,
 * Action Plan detail, and School Admin role view.
 */
import { chromium } from 'playwright-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:3000';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function screenshot(page, name, fullPage = false) {
  await delay(1500);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
  console.log(`  📸 ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await delay(2000);

  // ─── Diagnostic/Scoring tab ──────────────────────────
  console.log('\n1. Diagnostic/Scoring');
  const diagTab = page.locator('button, a, [role="tab"]').filter({ hasText: /diagnostic/i }).first();
  if (await diagTab.count() > 0) {
    await diagTab.click();
    await delay(2500);
    await screenshot(page, '06_diagnostic_overview');

    // Try to click on a scored dimension/component
    const scoredItem = page.locator('text=/Organizational Purpose/i, text=/Mission/i, text=/1A/i').first();
    if (await scoredItem.count() > 0) {
      await scoredItem.click();
      await delay(2000);
      await screenshot(page, '06b_diagnostic_dimension_detail');
    }

    // Try clicking a component that has a score
    const componentLink = page.locator('text=/Mission, Vision/i, text=/Financial Health/i, text=/Staff Culture/i').first();
    if (await componentLink.count() > 0) {
      await componentLink.click();
      await delay(2000);
      await screenshot(page, '06c_diagnostic_component_score');
    }
  }

  // ─── Evidence detail view ────────────────────────────
  console.log('\n2. Evidence detail');
  const evidenceTab = page.locator('button, a, [role="tab"]').filter({ hasText: /evidence/i }).first();
  if (await evidenceTab.count() > 0) {
    await evidenceTab.click();
    await delay(2000);

    // Click first evidence item
    const firstEvidence = page.locator('text=/Student Achievement/i, text=/Classroom Observation/i, text=/Teacher Retention/i').first();
    if (await firstEvidence.count() > 0) {
      await firstEvidence.click();
      await delay(2000);
      await screenshot(page, '04b_evidence_detail');

      // Scroll down to see AI extractions
      await page.evaluate(() => {
        const panel = document.querySelector('[class*="detail"], [class*="panel"], [class*="right"]');
        if (panel) panel.scrollTop = panel.scrollHeight;
        else window.scrollBy(0, 500);
      });
      await delay(1000);
      await screenshot(page, '04c_evidence_extractions');
    }
  }

  // ─── Framework component detail ──────────────────────
  console.log('\n3. Framework component detail');
  const frameworkTab = page.locator('button, a, [role="tab"]').filter({ hasText: /framework/i }).first();
  if (await frameworkTab.count() > 0) {
    await frameworkTab.click();
    await delay(2000);

    // Click on Organizational Purpose
    const dim1 = page.locator('text=/Organizational Purpose/i').first();
    if (await dim1.count() > 0) {
      await dim1.click();
      await delay(1500);

      // Click on Mission, Vision and Values (1A) to see detail panel
      const comp1a = page.locator('text=/Mission, Vision/i').first();
      if (await comp1a.count() > 0) {
        await comp1a.click();
        await delay(2000);
        await screenshot(page, '03b_framework_component_detail');
      }
    }
  }

  // ─── Action Plan item detail ─────────────────────────
  console.log('\n4. Action Plan detail');
  const actionTab = page.locator('button, a, [role="tab"]').filter({ hasText: /action/i }).first();
  if (await actionTab.count() > 0) {
    await actionTab.click();
    await delay(2000);

    // Click first action item
    const firstAction = page.locator('text=/Strengthen Instructional/i, text=/Develop Formal/i, text=/Build Cash/i').first();
    if (await firstAction.count() > 0) {
      await firstAction.click();
      await delay(2000);
      await screenshot(page, '08b_action_plan_detail');
    }
  }

  // ─── School Admin role view ──────────────────────────
  console.log('\n5. School Admin view');
  const schoolAdminBtn = page.locator('button').filter({ hasText: /school admin/i }).first();
  if (await schoolAdminBtn.count() > 0) {
    await schoolAdminBtn.click();
    await delay(2000);

    // Dashboard in school admin view
    const dashTab = page.locator('button, a, [role="tab"]').filter({ hasText: /dashboard/i }).first();
    if (await dashTab.count() > 0) {
      await dashTab.click();
      await delay(1500);
    }
    await screenshot(page, '11a_school_admin_dashboard');

    // Evidence tab in school admin view
    const evTab = page.locator('button, a, [role="tab"]').filter({ hasText: /evidence/i }).first();
    if (await evTab.count() > 0) {
      await evTab.click();
      await delay(1500);
      await screenshot(page, '11b_school_admin_evidence');
    }

    // Data requests in school admin view
    const drTab = page.locator('button, a, [role="tab"]').filter({ hasText: /data req/i }).first();
    if (await drTab.count() > 0) {
      await drTab.click();
      await delay(1500);
      await screenshot(page, '11c_school_admin_data_requests');
    }

    // Messages in school admin view
    const msgTab = page.locator('button, a, [role="tab"]').filter({ hasText: /messag/i }).first();
    if (await msgTab.count() > 0) {
      await msgTab.click();
      await delay(1500);
      await screenshot(page, '11d_school_admin_messages');
    }
  }

  // ─── Full-page Diagnostic ───────────────────────────
  console.log('\n6. Full-page Diagnostic');
  // Switch back to consultant
  const consultantBtn = page.locator('button').filter({ hasText: /consultant/i }).first();
  if (await consultantBtn.count() > 0) {
    await consultantBtn.click();
    await delay(1000);
  }
  const diagTab2 = page.locator('button, a, [role="tab"]').filter({ hasText: /diagnostic/i }).first();
  if (await diagTab2.count() > 0) {
    await diagTab2.click();
    await delay(2000);
    await screenshot(page, '06d_diagnostic_full', true);
  }

  await browser.close();
  console.log(`\nDone!`);
})();
