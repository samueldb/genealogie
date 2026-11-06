const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DEFAULT_DATA_SOURCES } = require('../backend/data-sources');

function checkSite(siteDir = path.resolve(__dirname, '../site')) {
  const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  const window = {};
  for (const [, attributes, contents] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc\s*=/.test(attributes) && contents.includes('window.GENEA_DATA_SOURCES')) {
      vm.runInNewContext(contents, { window }, { timeout: 1000 });
    }
  }
  assert(Array.isArray(window.GENEA_DATA_SOURCES), 'Missing data source configuration');
  const visited = new Set();
  function localFile(reference, from = 'index.html') {
    if (/^(?:https?:|data:|#|\/\/)/.test(reference)) return;
    assert(!reference.startsWith('/'), `Absolute URL breaks previews: ${reference}`);
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(from), reference.split(/[?#]/)[0]));
    assert(!relative.startsWith('../'), `Reference outside site: ${reference}`);
    const absolute = path.join(siteDir, relative);
    assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `Missing ${relative}, referenced by ${from}`);
    if (visited.has(relative)) return;
    visited.add(relative);
    const contents = fs.readFileSync(absolute, 'utf8');
    if (relative.endsWith('.html')) {
      const markup = contents.replace(/<!--[\s\S]*?-->/g, '');
      for (const [, reference] of markup.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) localFile(reference, relative);
    }
    if (relative.endsWith('.js')) {
      for (const [, reference] of contents.matchAll(/\bimport\s+[^\n]*?from\s+["']([^"']+)["']/g)) localFile(reference, relative);
      // Images in the application are resolved relative to the HTML document.
      for (const [, reference] of contents.matchAll(/["'](assets\/[^"']+)["']/g)) localFile(reference);
      for (const [, reference] of contents.matchAll(/dataUrl:\s*["']([^"']+)["']/g)) localFile(reference);
    }
    if (relative.endsWith('.css')) {
      for (const [, reference] of contents.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g)) localFile(reference, relative);
    }
  }
  localFile('index.html');
  localFile('includes/header.html');
  for (const source of window.GENEA_DATA_SOURCES) {
    const backendSource = DEFAULT_DATA_SOURCES.find(item => item.id === source.id);
    assert(backendSource && backendSource.path === `site/${source.dataUrl}`, `Frontend/backend source mismatch: ${source.id}`);
    localFile(source.dataUrl);
    const dataset = JSON.parse(fs.readFileSync(path.join(siteDir, source.dataUrl), 'utf8'));
    assert(Array.isArray(dataset) && dataset.length, `Empty dataset: ${source.id}`);
    const ids = new Set(dataset.map(person => String(person.id)));
    assert.equal(ids.size, dataset.length, `Duplicate person ids: ${source.id}`);
    for (const person of dataset) {
      for (const relation of Object.values(person.rels || {})) {
        for (const id of (Array.isArray(relation) ? relation : [relation])) {
          if (id != null) assert(ids.has(String(id)), `Missing relationship target in ${source.id}: ${id}`);
        }
      }
      if (person.data?.avatar) localFile(person.data.avatar);
    }
  }
  assert.equal(window.GENEA_DATA_SOURCES.length, DEFAULT_DATA_SOURCES.length, 'Missing frontend source');
  return { files: visited.size, sources: window.GENEA_DATA_SOURCES.length };
}

if (require.main === module) {
  const result = checkSite();
  console.log(`Site checked: ${result.files} local resources, ${result.sources} datasets. Relative URLs support production and preview.`);
}

module.exports = { checkSite };
