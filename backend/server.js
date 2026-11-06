const express = require('express');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const dotenv = require('dotenv');
const { normalizeSourceId, parseDataSources } = require('./data-sources');

const localEnvPath = path.join(__dirname, '.env');
dotenv.config({ path: localEnvPath });
dotenv.config();

const PORT = process.env.PORT || 8788;
const REQUIRED_API_KEY = process.env.API_AUTH_TOKEN || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'dev';
const TARGET_FILES = (process.env.TARGET_DATA_FILES || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);
const DATA_SOURCES = parseDataSources(process.env.DATA_SOURCES, TARGET_FILES);
const DEFAULT_SOURCE_ID = normalizeSourceId(process.env.DEFAULT_DATA_SOURCE) || DATA_SOURCES[0]?.id;
const COMMIT_AUTHOR_NAME = process.env.COMMIT_AUTHOR_NAME || 'Genealogie Bot';
const COMMIT_AUTHOR_EMAIL = process.env.COMMIT_AUTHOR_EMAIL || 'genealogie-bot@example.com';
const ALLOWED_ORIGIN = process.env.CORS_ALLOW_ORIGIN || '*';

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  throw new Error('Missing required GitHub configuration. Please set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO.');
}

if (!DATA_SOURCES.length || !DATA_SOURCES.some(source => source.id === DEFAULT_SOURCE_ID)) {
  throw new Error('DATA_SOURCES and DEFAULT_DATA_SOURCE must identify a valid source.');
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,X-API-KEY');
  next();
});

app.options('/api/family-data', (req, res) => {
  res.sendStatus(204);
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    branch: GITHUB_BRANCH,
    defaultSource: DEFAULT_SOURCE_ID,
    sources: DATA_SOURCES.map(source => ({ id: source.id, path: source.path }))
  });
});

app.post('/api/family-data', ensureAuthorizedRequest, async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload || !Array.isArray(payload.data)) {
      return res.status(400).json({ error: 'Payload must include "data" array.' });
    }
    if (!payload.data.length) {
      return res.status(400).json({ error: 'Received empty dataset. Nothing to persist.' });
    }

    const source = resolveDataSource(payload.source);
    if (!source) {
      return res.status(400).json({ error: 'Unknown data source.' });
    }

    const commitSha = await commitDataset(payload.data, source);
    res.json({ success: true, commit: commitSha });
  } catch (error) {
    console.error('Failed to persist dataset', error);
    if (error.status === 401 || error.status === 403) {
      return res.status(502).json({ error: 'GitHub token rejected the request.' });
    }
    if (error.status === 409 || error.status === 422) {
      return res.status(409).json({ error: 'Repository reference is out of date. Retry the save.' });
    }
    res.status(500).json({ error: 'Unable to save dataset.' });
  }
});

function ensureAuthorizedRequest(req, res, next) {
  if (!REQUIRED_API_KEY) {
    return next();
  }
  const apiKey = req.header('x-api-key');
  if (apiKey !== REQUIRED_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function resolveDataSource(sourceId) {
  const normalizedId = normalizeSourceId(sourceId) || DEFAULT_SOURCE_ID;
  return DATA_SOURCES.find(source => source.id === normalizedId) || null;
}

async function commitDataset(dataset, source) {
  const normalizedContent = formatDataset(dataset);
  const latestRef = await octokit.git.getRef({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: `heads/${GITHUB_BRANCH}`
  });

  const latestCommitSha = latestRef.data.object.sha;
  const currentDataset = await fetchCurrentDataset(latestCommitSha, source);
  const commitData = await octokit.git.getCommit({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    commit_sha: latestCommitSha
  });

  const baseTreeSha = commitData.data.tree.sha;
  const treeEntries = [{
    path: source.path,
    mode: '100644',
    type: 'blob',
    content: normalizedContent
  }];

  const newTree = await octokit.git.createTree({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    base_tree: baseTreeSha,
    tree: treeEntries
  });

  const message = buildCommitMessage(currentDataset, dataset, source);
  const author = {
    name: COMMIT_AUTHOR_NAME,
    email: COMMIT_AUTHOR_EMAIL,
    date: new Date().toISOString()
  };

  const newCommit = await octokit.git.createCommit({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    message,
    tree: newTree.data.sha,
    parents: [latestCommitSha],
    author,
    committer: author
  });

  await octokit.git.updateRef({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: `heads/${GITHUB_BRANCH}`,
    sha: newCommit.data.sha,
    force: false
  });

  return newCommit.data.sha;
}

function formatDataset(dataset) {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}

async function fetchCurrentDataset(ref, source) {
  const filePath = source.path;

  try {
    const response = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      ref
    });

    if (Array.isArray(response.data) || response.data.type !== 'file') {
      return [];
    }

    const content = await readGitHubFileContent(response.data, filePath, ref);
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.status === 404) {
      return [];
    }
    throw error;
  }
}

async function readGitHubFileContent(fileData, filePath, ref) {
  if (fileData.encoding === 'base64' || !fileData.encoding) {
    return Buffer.from(fileData.content || '', 'base64').toString('utf8');
  }

  if (fileData.encoding === 'utf-8' || fileData.encoding === 'utf8') {
    return fileData.content || '';
  }

  if (fileData.encoding === 'none') {
    return fetchRawGitHubFileContent(filePath, ref);
  }

  throw new Error(`Unsupported GitHub content encoding: ${fileData.encoding}`);
}

async function fetchRawGitHubFileContent(filePath, ref) {
  const response = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: filePath,
    ref,
    mediaType: {
      format: 'raw'
    }
  });

  return typeof response.data === 'string'
    ? response.data
    : Buffer.from(response.data).toString('utf8');
}

function buildCommitMessage(previousDataset, nextDataset, source) {
  const change = detectProfileChange(previousDataset, nextDataset);
  return `database: 🗞️  ${change.action} "${change.profileName}" in ${source.path}`;
}

function detectProfileChange(previousDataset, nextDataset) {
  const previousById = createProfileMap(previousDataset);
  const nextById = createProfileMap(nextDataset);

  for (const profile of nextDataset) {
    const id = getProfileId(profile);
    if (!previousById.has(id)) {
      return { action: 'create', profileName: formatProfileName(profile) };
    }
  }

  for (const profile of previousDataset) {
    const id = getProfileId(profile);
    if (!nextById.has(id)) {
      return { action: 'delete', profileName: formatProfileName(profile) };
    }
  }

  for (const profile of nextDataset) {
    const id = getProfileId(profile);
    const previousProfile = previousById.get(id);
    if (JSON.stringify(previousProfile) !== JSON.stringify(profile)) {
      return { action: 'update', profileName: formatProfileName(profile) };
    }
  }

  return { action: 'update', profileName: 'dataset' };
}

function createProfileMap(dataset) {
  return new Map(dataset.map(profile => [getProfileId(profile), profile]));
}

function getProfileId(profile) {
  return String(profile?.id ?? '');
}

function formatProfileName(profile) {
  const data = profile?.data || {};
  const name = [data['first name'], data['last name']]
    .filter(Boolean)
    .join(' ')
    .trim();

  return escapeCommitProfileName(name || `profil ${getProfileId(profile)}`);
}

function escapeCommitProfileName(name) {
  return String(name).replace(/"/g, '\\"');
}

app.listen(PORT, () => {
  console.log(`Genealogy backend listening on http://localhost:${PORT}`);
});
