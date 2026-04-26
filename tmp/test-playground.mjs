import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:3333');
await page.waitForLoadState('networkidle');

// Fill in the prompt
const promptInput = page.locator('input[name="agent.specializations"]');
await promptInput.fill('landing page for dentist');
console.log('Filled specializations');

// Find and click the Pick Only button
const pickButton = page.locator('button:has-text("Pick Only")');
await pickButton.click();
console.log('Clicked Pick Only');

// Wait for output
await page.waitForTimeout(5000);

// Get the output
const output = await page.locator('.output-content, .pick-result, pre, .result').first().textContent().catch(() => 'No output found');
console.log('\n=== OUTPUT ===\n', output?.slice(0, 3000));

// Get any console errors
page.on('console', msg => {
  if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
});

// Screenshot of output
await page.screenshot({ path: './tmp/output.png', fullPage: true });

await browser.close();
console.log('\nDone');
