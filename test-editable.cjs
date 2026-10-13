const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const result = await page.evaluate(function () {
    const ed = window.documentEditor;
    if (!ed) return { error: 'no editor' };

    const json = ed.getJSON ? ed.getJSON() : { content: [] };
    const features = {
      tables: 0, images: 0, headings: 0, links: 0, blockquotes: 0,
      taskLists: 0, pageBreaks: 0, charts: 0, shapes: 0, smartarts: 0,
    };
    function walk(node) {
      if (!node) return;
      if (node.type === 'table') features.tables++;
      if (node.type === 'image') features.images++;
      if (node.type === 'heading') features.headings++;
      if (node.type === 'blockquote') features.blockquotes++;
      if (node.type === 'taskList') features.taskLists++;
      if (node.type === 'pageBreak') features.pageBreaks++;
      if (node.type === 'chart') features.charts++;
      if (node.type === 'shape') features.shapes++;
      if (node.type === 'smartart') features.smartarts++;
      if (node.marks) node.marks.forEach(function (m) { if (m.type === 'link') features.links++; });
      if (node.content) node.content.forEach(walk);
    }
    walk(json);

    // Check for overflow on last page
    const sheets = document.querySelectorAll('.cde-virtual-sheet, [class*="sheet"]');
    let lastSheetOverflow = false;
    if (sheets.length > 0) {
      const last = sheets[sheets.length - 1];
      const rect = last.getBoundingClientRect();
      lastSheetOverflow = rect.height > 1200;
    }

    return {
      pageCount: ed.getPageCount ? ed.getPageCount() : 'unknown',
      features: features,
      lastSheetOverflow: lastSheetOverflow,
    };
  });

  console.log('Test result:', JSON.stringify(result, null, 2));

  await page.screenshot({ path: 'test-editable.png', fullPage: false });
  console.log('Screenshot saved');

  await browser.close();
})().catch(function (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
});
