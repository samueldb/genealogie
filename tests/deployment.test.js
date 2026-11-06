const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_DATA_SOURCES, parseDataSources } = require('../backend/data-sources');
const { createServer } = require('../scripts/serve');
const { checkSite } = require('../scripts/check-site');

test('legacy Render paths resolve to the relocated datasets', () => {
  assert.deepEqual(parseDataSources(), DEFAULT_DATA_SOURCES);
  assert.deepEqual(parseDataSources('principal:index/data_db.json,racine:data_db.json'), DEFAULT_DATA_SOURCES);
  assert.deepEqual(parseDataSources('principal:deschampsberger/index/data_db.json,racine:data_db.json'), DEFAULT_DATA_SOURCES);
  assert.deepEqual(parseDataSources('', ['data_db.json', 'index/data_db.json']), DEFAULT_DATA_SOURCES);
  assert.deepEqual(parseDataSources('principal:site/data/principal.json,racine:site/data/racine.json'), DEFAULT_DATA_SOURCES);
  assert.deepEqual(parseDataSources('bad:../../backend/.env'), []);
});

test('the published site has valid assets, relationships and matching save paths', () => {
  assert.equal(checkSite().sources, 2);
});

test('the local server serves only site/ and saves each source independently', async t => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'genealogie-test-'));
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }));
  await fs.mkdir(path.join(rootDir, 'site/data'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'backend'));
  await fs.writeFile(path.join(rootDir, 'site/index.html'), '<html><head></head><body>Genealogy</body></html>');
  await fs.writeFile(path.join(rootDir, 'backend/.env'), 'test configuration');
  for (const source of DEFAULT_DATA_SOURCES) {
    await fs.writeFile(path.join(rootDir, source.path), JSON.stringify([{ id: source.id }]));
  }
  const server = createServer({ rootDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /window.GENEA_API_CONFIG = \{baseUrl: "", apiKey: ""\}/);
  for (const url of ['/backend/.env', '/docs/', '/package.json', '/%2e%2e%2fbackend/.env']) {
    assert.equal((await fetch(baseUrl + url)).status, 404, url);
  }
  assert.equal((await fetch(baseUrl + '/%E0%A4%A')).status, 400);
  for (const source of DEFAULT_DATA_SOURCES) {
    const data = [{ id: `edited-${source.id}` }];
    const response = await fetch(`${baseUrl}/api/family-data`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: source.id, data })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await (await fetch(`${baseUrl}/data/${source.id}.json`)).json(), data);
  }
  const unknownSource = await fetch(`${baseUrl}/api/family-data`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'unknown', data: [{ id: 1 }] })
  });
  assert.equal(unknownSource.status, 400);
  await assert.rejects(fs.access(path.join(rootDir, 'data_db.json')));
  await assert.rejects(fs.access(path.join(rootDir, 'index/data_db.json')));
});

test('GitHub saves use only the relocated source path with legacy Render settings', async () => {
  const vm = require('node:vm');
  const code = await fs.readFile(path.resolve(__dirname, '../backend/server.js'), 'utf8');
  const writtenTrees = [];
  const fetchedPaths = [];
  let saveHandler;
  const app = {
    use() {}, options() {}, get() {}, listen() {},
    post(_url, ...handlers) { saveHandler = handlers.at(-1); }
  };
  const express = Object.assign(() => app, { json: () => () => {} });
  class Octokit {
    constructor() {
      this.git = {
        getRef: async () => ({ data: { object: { sha: 'base-commit' } } }),
        getCommit: async () => ({ data: { tree: { sha: 'base-tree' } } }),
        createTree: async args => {
          writtenTrees.push(JSON.parse(JSON.stringify(args.tree)));
          return { data: { sha: 'new-tree' } };
        },
        createCommit: async () => ({ data: { sha: 'new-commit' } }),
        updateRef: async () => ({})
      };
      this.repos = {
        getContent: async args => {
          fetchedPaths.push(args.path);
          return { data: { type: 'file', encoding: 'base64', content: Buffer.from('[]').toString('base64') } };
        }
      };
    }
  }
  vm.runInNewContext(code, {
    __dirname: path.resolve(__dirname, '../backend'), Buffer, console,
    process: { env: {
      GITHUB_TOKEN: 'test-only', GITHUB_OWNER: 'test', GITHUB_REPO: 'test',
      DATA_SOURCES: 'principal:index/data_db.json,racine:data_db.json'
    } },
    require(name) {
      if (name === 'express') return express;
      if (name === '@octokit/rest') return { Octokit };
      if (name === 'dotenv') return { config() {} };
      if (name === './data-sources') return require('../backend/data-sources');
      return require(name);
    }
  });
  for (const source of DEFAULT_DATA_SOURCES) {
    const data = [{ id: source.id, data: { 'first name': 'Test' } }];
    let result;
    await saveHandler({ body: { source: source.id, data } }, {
      json(value) { result = value; },
      status(value) { assert.fail(`Unexpected save status: ${value}`); }
    });
    assert.equal(result.success, true);
    const tree = writtenTrees.at(-1);
    assert.equal(tree.length, 1);
    assert.equal(tree[0].path, source.path);
    assert.deepEqual(JSON.parse(tree[0].content), data);
    assert.equal(fetchedPaths.at(-1), source.path);
  }
});
