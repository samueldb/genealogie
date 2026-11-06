const DEFAULT_DATA_SOURCES = [
  { id: 'principal', path: 'site/data/principal.json' },
  { id: 'racine', path: 'site/data/racine.json' }
];

// Accept the previous Render configuration while always writing to the new paths.
const LEGACY_PATHS = {
  'index/data_db.json': 'site/data/principal.json',
  'deschampsberger/index/data_db.json': 'site/data/principal.json',
  'data_db.json': 'site/data/racine.json'
};

function normalizeSourceId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9_-]+$/.test(normalized) ? normalized : '';
}

function normalizeSourcePath(value) {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) return '';
  if (normalized.split('/').some(part => part === '..')) return '';
  return LEGACY_PATHS[normalized] || normalized;
}

function sourceIdFromPath(filePath) {
  const normalized = normalizeSourcePath(filePath);
  const knownSource = DEFAULT_DATA_SOURCES.find(source => source.path === normalized);
  if (knownSource) return knownSource.id;
  return normalized.replace(/\.json$/i, '').replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '').toLowerCase();
}

function parseDataSources(rawValue, fallbackFiles = []) {
  const rawItems = (rawValue || '').split(',').map(item => item.trim()).filter(Boolean);
  const sourceItems = rawItems.length ? rawItems : [
    ...DEFAULT_DATA_SOURCES.map(source => `${source.id}:${source.path}`),
    ...fallbackFiles
      .filter(filePath => !DEFAULT_DATA_SOURCES.some(source => source.path === normalizeSourcePath(filePath)))
      .map(filePath => `${sourceIdFromPath(filePath)}:${filePath}`)
  ];
  const seenIds = new Set();
  return sourceItems.map(item => {
    const separatorIndex = item.indexOf(':');
    const rawId = separatorIndex >= 0 ? item.slice(0, separatorIndex) : sourceIdFromPath(item);
    const rawPath = separatorIndex >= 0 ? item.slice(separatorIndex + 1) : item;
    const id = normalizeSourceId(rawId);
    const sourcePath = normalizeSourcePath(rawPath);
    if (!id || !sourcePath || seenIds.has(id)) return null;
    seenIds.add(id);
    return { id, path: sourcePath };
  }).filter(Boolean);
}

module.exports = { DEFAULT_DATA_SOURCES, normalizeSourceId, parseDataSources };
