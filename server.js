const http = require('http')
const fs = require('fs')
const path = require('path')
const {URL} = require('url')

const ROOT_DIR = __dirname
const DATA_FILE_PATH = path.join(ROOT_DIR, 'deschampsberger/index/data_db.json')
const PORT = process.env.PORT || 3000
const MAX_BODY_SIZE = 5 * 1024 * 1024

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'OPTIONS' && parsedUrl.pathname === '/api/family-data') {
    return handlePreflight(res)
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/family-data') {
    return handleSaveRequest(req, res)
  }

  return serveStaticFile(parsedUrl.pathname, res)
})

function handlePreflight(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600'
  })
  res.end()
}

function handleSaveRequest(req, res) {
  let body = ''
  req.on('data', chunk => {
    body += chunk
    if (body.length > MAX_BODY_SIZE) {
      res.writeHead(413, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({error: 'Payload too large'}))
      req.connection.destroy()
    }
  })

  req.on('end', () => {
    let payload
    try {
      payload = JSON.parse(body || '{}')
    } catch (err) {
      console.error('Invalid JSON received', err)
      return sendJson(res, 400, {error: 'Invalid JSON payload'})
    }

    if (!payload || !Array.isArray(payload.data)) {
      return sendJson(res, 400, {error: 'Payload must include array "data"'})
    }

    const fileContents = JSON.stringify(payload.data, null, 2)
    fs.writeFile(DATA_FILE_PATH, fileContents, 'utf8', (err) => {
      if (err) {
        console.error('Failed to write data_db.json', err)
        return sendJson(res, 500, {error: 'Unable to save data'})
      }
      sendJson(res, 200, {success: true})
    })
  })
}

function serveStaticFile(requestPath, res) {
  let safePath = decodeURIComponent(requestPath)
  if (safePath.includes('\0')) {
    return send404(res)
  }
  if (safePath.endsWith('/')) safePath += 'index.old.html'
  if (safePath === '/' || safePath === '') safePath = '/index.old.html'

  safePath = path.normalize(safePath).replace(/^(\.\.[\\/])+/, '')
  let filePath = path.join(ROOT_DIR, safePath)

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      const directoryIndex = path.join(filePath, 'index.old.html')
      return streamFile(directoryIndex, res)
    }
    if (err) {
      return send404(res)
    }
    if (stats.isFile()) {
      return streamFile(filePath, res)
    }
    return send404(res)
  })
}

function streamFile(filePath, res) {
  const fileStream = fs.createReadStream(filePath)
  fileStream.on('error', () => send404(res))

  res.writeHead(200, {
    'Content-Type': getMimeType(path.extname(filePath))
  })
  fileStream.pipe(res)
}

function send404(res) {
  res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'})
  res.end('Not Found')
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  })
  res.end(JSON.stringify(body))
}

function getMimeType(ext) {
  return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream'
}

server.listen(PORT, () => {
  console.log(`Genealogy editor server listening on http://localhost:${PORT}`)
})
