const http = require('http');
const fs = require('fs');
const path = require('path');
const { normalizeSourceId, parseDataSources } = require('../backend/data-sources');

const ROOT_DIR = path.resolve(__dirname, '..');
const MAX_BODY_SIZE = 5 * 1024 * 1024;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function createServer({ rootDir = ROOT_DIR } = {}) {
  const siteDir = path.join(rootDir, 'site');
  const sources = parseDataSources(process.env.DATA_SOURCES,
    (process.env.TARGET_DATA_FILES || '').split(',').filter(Boolean));
  const defaultSourceId = normalizeSourceId(process.env.DEFAULT_DATA_SOURCE) || sources[0]?.id;
  if (!sources.length || !sources.some(source => source.id === defaultSourceId)) {
    throw new Error('Invalid data source configuration.');
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/family-data' && req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY'
        });
        return res.end();
      }
      if (url.pathname === '/api/family-data' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
            return sendJson(res, 413, { error: 'Payload too large' });
          }
        }
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          return sendJson(res, 400, { error: 'Invalid JSON payload' });
        }
        if (!Array.isArray(payload?.data) || !payload.data.length) {
          return sendJson(res, 400, { error: 'Payload must include non-empty array "data"' });
        }
        const sourceId = normalizeSourceId(payload.source) || defaultSourceId;
        const source = sources.find(item => item.id === sourceId);
        if (!source) return sendJson(res, 400, { error: 'Unknown data source' });
        await fs.promises.writeFile(path.join(rootDir, source.path), JSON.stringify(payload.data, null, 2), 'utf8');
        return sendJson(res, 200, { success: true });
      }

      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        return res.end();
      }
      let requestPath;
      try {
        requestPath = decodeURIComponent(url.pathname);
      } catch {
        return sendJson(res, 400, { error: 'Invalid URL' });
      }
      if (requestPath.includes('\0') || requestPath.split('/').some(part => part.startsWith('.'))) {
        return notFound(res);
      }
      let filePath = path.resolve(siteDir, `.${requestPath}`);
      if (!filePath.startsWith(`${siteDir}${path.sep}`) && filePath !== siteDir) return notFound(res);
      let stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        stats = await fs.promises.stat(filePath);
      }
      if (!stats.isFile()) return notFound(res);

      // Local editing saves locally; published HTML keeps its Render configuration.
      let contents = await fs.promises.readFile(filePath);
      if (filePath === path.join(siteDir, 'index.html')) {
        contents = contents.toString().replace('</head>',
          '<script>window.GENEA_API_CONFIG = {baseUrl: "", apiKey: ""};</script>\n</head>');
      }
      res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) return notFound(res);
      console.error('Local server request failed', error);
      sendJson(res, 500, { error: 'Unable to process request' });
    }
  });
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(body));
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`Genealogy editor listening on http://localhost:${port}`);
  });
}

module.exports = { createServer };
