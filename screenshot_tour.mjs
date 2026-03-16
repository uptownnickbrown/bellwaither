/**
 * End-to-end screenshot tour of Meridian (Lincoln Innovation Academy).
 * Run:  node screenshot_tour.mjs
 */

import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, 'screenshots');
const BASE = process.env.MERIDIAN_URL || 'https://meridian.uptownnickbrown.com';

// Ensure screenshots dir exists
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function screenshot(page, name, fullPage = false) {
  await delay(1800);
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage,
  });
  console.log(`  📸 ${name}.png`);
}

async function clickTab(page, pattern) {
  const tab = page.locator('nav button').filter({ hasText: pattern }).first();
  if (await tab.count() > 0) {
    await tab.click();
    await delay(1500);
    return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // ─── 1. CONSULTANT DASHBOARD ────────────────────────
  console.log('\n1. Consultant Dashboard');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await delay(2500);
  await screenshot(page, '01_dashboard');

  // Scroll down to capture below-fold content (Key Findings + Recent Evidence)
  const mainContent = page.locator('main').first();
  await mainContent.evaluate(el => el.scrollTo(0, el.scrollHeight));
  await delay(1000);
  await screenshot(page, '01b_dashboard_below_fold');
  // Scroll back up
  await mainContent.evaluate(el => el.scrollTo(0, 0));
  await delay(500);

  // ─── 2. FRAMEWORK EXPLORER ──────────────────────────
  console.log('\n2. Framework Explorer');
  await clickTab(page, /Framework/);
  await screenshot(page, '02_framework_overview');

  // Click first dimension in the left column
  const dim1 = page.locator('text=/Organizational Purpose/i').first();
  if (await dim1.count() > 0) {
    await dim1.click();
    await delay(1500);
  }
  // Click a specific component row (1A - Mission)
  const comp1a = page.locator('text=/Mission, Vision, and Values/i').first();
  if (await comp1a.count() > 0) {
    await comp1a.click();
    await delay(1500);
    await screenshot(page, '02b_framework_component_detail');
  }

  // ─── 3. EVIDENCE REPOSITORY ─────────────────────────
  console.log('\n3. Evidence Repository');
  await clickTab(page, /Evidence/);
  await screenshot(page, '03_evidence_list');

  // Click first evidence item for detail
  const evItem = page.locator('text=/Board_Governance|New_Teacher|Grade_Level/i').first();
  if (await evItem.count() > 0) {
    await evItem.click();
    await delay(1500);
    await screenshot(page, '03b_evidence_detail');
  }

  // ─── 4. DATA REQUESTS ──────────────────────────────
  console.log('\n4. Data Requests');
  await clickTab(page, /Data Requests/);
  await screenshot(page, '04_data_requests');

  // Click a request with comments
  const drItem = page.locator('[class*="cursor-pointer"]').filter({ hasText: /Discipline|Disagg|Curriculum/i }).first();
  if (await drItem.count() > 0) {
    await drItem.click();
    await delay(1500);
    await screenshot(page, '04b_data_request_detail');
  }

  // ─── 5. DIAGNOSTIC WORKSPACE ───────────────────────
  console.log('\n5. Diagnostic Workspace');
  await clickTab(page, /Diagnostic/);
  await delay(2000);
  await screenshot(page, '05_diagnostic_overview');

  // Click on a dimension to expand
  const scoreDim = page.locator('text=/Academic Program/i').first();
  if (await scoreDim.count() > 0) {
    await scoreDim.click();
    await delay(1500);
    await screenshot(page, '05b_diagnostic_expanded');
  }

  // Click a scored component to see detail
  const scoredComp = page.locator('[class*="cursor-pointer"]').filter({ hasText: /Instruction|Curriculum/i }).first();
  if (await scoredComp.count() > 0) {
    await scoredComp.click();
    await delay(1500);
    await screenshot(page, '05c_diagnostic_component_detail');
  }

  // Switch to Dimensions tab
  const dimTab = page.locator('button').filter({ hasText: /^Dimensions$/ }).first();
  if (await dimTab.count() > 0) {
    await dimTab.click();
    await delay(1500);
    await screenshot(page, '05d_dimension_synthesis');
  }

  // Switch to Executive Summary tab (was "Global Summary (Layer 4)")
  const globalTab = page.locator('button').filter({ hasText: /Executive Summary/ }).first();
  if (await globalTab.count() > 0) {
    await globalTab.click();
    await delay(1500);
    await screenshot(page, '05e_executive_summary');
  }

  // ─── 6. ACTION PLAN ────────────────────────────────
  console.log('\n6. Action Plan');
  await clickTab(page, /Action Plan/);
  await delay(1500);
  await screenshot(page, '06_action_plan');

  // Click the first action item in the list.
  const actionItem = page.locator('[class*="cursor-pointer"]').filter({ hasText: /Strengthen|Family|Cash|Math|Retention/i }).first();
  if (await actionItem.count() > 0) {
    await actionItem.click();
    await delay(1500);
    await screenshot(page, '06b_action_plan_detail');
  }

  // ─── 7. MESSAGING ──────────────────────────────────
  console.log('\n7. Messaging');
  await clickTab(page, /Messages/);
  await delay(2000);
  await screenshot(page, '07_messaging');

  // Click a data request thread if visible
  const drThread = page.locator('text=/DR:|Data Request/i').first();
  if (await drThread.count() > 0) {
    await drThread.click();
    await delay(1500);
    await screenshot(page, '07b_messaging_dr_thread');
  }

  // Click back to a regular channel
  const generalChannel = page.locator('text=/General/i').first();
  if (await generalChannel.count() > 0) {
    await generalChannel.click();
    await delay(1000);
  }

  // ─── 8. ACTIVITY LOG ────────────────────────────────
  console.log('\n8. Activity Log');
  await clickTab(page, /Activity/);
  await delay(1500);
  await screenshot(page, '08_activity_log');

  // ─── 9. AI COPILOT ─────────────────────────────────
  console.log('\n9. AI Copilot');
  await clickTab(page, /Dashboard/);
  await delay(1000);

  const copilotBtn = page.locator('button').filter({ hasText: /Copilot/i }).first();
  if (await copilotBtn.count() > 0) {
    await copilotBtn.click();
    await delay(1500);
    await screenshot(page, '09_copilot_panel');
  }

  // ─── 10. SCHOOL ADMIN VIEW ──────────────────────────
  console.log('\n10. School Admin View');
  // Close copilot first if open
  const closeCopilot = page.locator('button').filter({ hasText: /Copilot/i }).first();
  if (await closeCopilot.count() > 0) {
    await closeCopilot.click();
    await delay(500);
  }

  // Switch to school admin
  const schoolAdminBtn = page.locator('button').filter({ hasText: /School Admin/i }).first();
  if (await schoolAdminBtn.count() > 0) {
    await schoolAdminBtn.click();
    await delay(2000);
    await screenshot(page, '10_admin_dashboard');

    // Scroll to show the full admin dashboard
    await mainContent.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await delay(1000);
    await screenshot(page, '10b_admin_dashboard_lower');
    await mainContent.evaluate(el => el.scrollTo(0, 0));
    await delay(500);

    // Admin scoring view
    await clickTab(page, /Diagnostic|Assessment/);
    await delay(1500);
    await screenshot(page, '10c_admin_scoring');

    // Admin data requests
    await clickTab(page, /Data Requests/);
    await delay(1500);
    await screenshot(page, '10d_admin_data_requests');

    // Admin messages
    await clickTab(page, /Messages/);
    await delay(1500);
    await screenshot(page, '10e_admin_messages');
  }

  await browser.close();
  console.log(`\n✅ Done! Screenshots saved to ${SHOTS}/`);
})();
