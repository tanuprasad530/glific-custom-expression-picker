// Runs test-cases.json against the actual picker HTML's logic.
// Exits with code 1 (failure) if anything doesn't match, so GitHub Actions
// shows a red X on the pull request. Exits 0 (success) if everything passes.
//
// Run locally with: node test-runner.js

const fs = require('fs');
const path = require('path');

function extractLogic(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  if (!scriptMatch) throw new Error('Could not find <script> section in ' + htmlPath);
  const js = scriptMatch[1];
  const cutoff = js.indexOf('// ---------- rendering ----------');
  return cutoff === -1 ? js : js.slice(0, cutoff);
}

function parseFields(fieldStr) {
  const fields = {};
  fieldStr.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    let val = pair.slice(idx + 1);
    val = val.replace(/\\n/g, '\n'); // literal backslash-n means a real newline within this field
    fields[key] = val;
  });
  return fields;
}

// minimal browser stubs so the picker's logic runs under plain Node
global.document = {
  getElementById: () => ({ appendChild(){}, addEventListener(){}, style:{}, classList:{toggle(){}} }),
  createElement: () => ({ appendChild(){}, setAttribute(){}, style:{}, classList:{toggle(){}} })
};

const htmlPath = path.join(__dirname, 'glific-expression-picker-v4.html');
const logic = extractLogic(htmlPath);
eval(logic); // defines CATEGORIES and all helper functions in this scope

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-cases.json'), 'utf8'));

let pass = 0;
const failures = [];

cases.forEach((c, i) => {
  const catIndex = CATEGORIES.findIndex(cat => cat.id === c.category);
  if (catIndex === -1) {
    failures.push({ i, reason: `Unknown category id: "${c.category}"`, expected: c.expected, actual: null });
    return;
  }
  let actual;
  try {
    const result = CATEGORIES[catIndex].build(parseFields(c.fields));
    actual = result ? result.code : '(build returned null)';
  } catch (e) {
    actual = '(threw: ' + e.message + ')';
  }
  if (actual.trim() === (c.expected || '').trim()) {
    pass++;
  } else {
    failures.push({ i, category: c.category, fields: c.fields, expected: c.expected, actual });
  }
});

console.log(`${pass}/${cases.length} test cases passed.`);

if (failures.length > 0) {
  console.log('\nFAILURES:');
  failures.forEach(f => {
    console.log(`\n  Row ${f.i + 2} (${f.category || '?'}): ${f.fields || ''}`);
    console.log(`    expected: ${f.expected}`);
    console.log(`    actual:   ${f.actual}`);
  });
  process.exit(1); // non-zero exit = GitHub Actions marks this run as failed
}

console.log('All tests passed.');
process.exit(0);
