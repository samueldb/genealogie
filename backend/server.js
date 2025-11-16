const express = require('express');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const dotenv = require('dotenv');

const localEnvPath = path.join(__dirname, '.env');
dotenv.config({ path: localEnvPath });
dotenv.config();

const PORT = process.env.PORT || 8788;
const REQUIRED_API_KEY = process.env.API_AUTH_TOKEN || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'dev';
const TARGET_FILES = (process.env.TARGET_DATA_FILES || 'data_db.json,index/data_db.json')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);
const COMMIT_AUTHOR_NAME = process.env.COMMIT_AUTHOR_NAME || 'Genealogie Bot';
const COMMIT_AUTHOR_EMAIL = process.env.COMMIT_AUTHOR_EMAIL || 'genealogie-bot@example.com';
const ALLOWED_ORIGIN = process.env.CORS_ALLOW_ORIGIN || '*';

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
  throw new Error('Missing required GitHub configuration. Please set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO.');
}

if (!TARGET_FILES.length) {
  throw new Error('TARGET_DATA_FILES must include at least one file path to update.');
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
  res.json({ ok: true, branch: GITHUB_BRANCH, targetFiles: TARGET_FILES });
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

    const commitSha = await commitDataset(payload.data);
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

async function commitDataset(dataset) {
  const normalizedContent = formatDataset(dataset);
  const latestRef = await octokit.git.getRef({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: `heads/${GITHUB_BRANCH}`
  });

  const latestCommitSha = latestRef.data.object.sha;
  const commitData = await octokit.git.getCommit({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    commit_sha: latestCommitSha
  });

  const baseTreeSha = commitData.data.tree.sha;
  const treeEntries = TARGET_FILES.map(filePath => ({
    path: filePath,
    mode: '100644',
    type: 'blob',
    content: normalizedContent
  }));

  const newTree = await octokit.git.createTree({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    base_tree: baseTreeSha,
    tree: treeEntries
  });

  const message = buildCommitMessage(dataset.length);
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

function buildCommitMessage(count) {
  const timestamp = new Date().toISOString();
  return `chore: update data_db.json (${count} entries @ ${timestamp})`;
}

app.listen(PORT, () => {
  console.log(`Genealogy backend listening on http://localhost:${PORT}`);
});
