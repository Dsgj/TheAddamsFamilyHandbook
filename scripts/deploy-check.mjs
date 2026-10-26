// Stamp the Pages artifact, then verify its commit and bytes through the public URL after deploy.
// No packages are needed: the deploy job only needs Node.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const commit = process.env.EXPECTED_SHA ?? process.env.GITHUB_SHA ?? '';
if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('A full commit SHA is required.');

if (process.argv[2] === 'stamp') {
  const assets = readdirSync('dist/_astro', { recursive: true })
    .map((file) => String(file).replaceAll('\\', '/'))
    .filter((file) => /\.(?:js|css)$/.test(file))
    .sort()
    .map((file) => `_astro/${file}`);
  if (!assets.length) throw new Error('No built JavaScript or CSS assets found.');
  const paths = [
    'index.html',
    'workshop.html',
    'setup.html',
    'map.html',
    'sw.js',
    'manifest.webmanifest',
    ...assets,
  ];
  const files = paths.map((path) => ({ path, sha256: hash(readFileSync(join('dist', path))) }));
  writeFileSync('dist/release.json', JSON.stringify({ commit, files }) + '\n');
  console.log(`Stamped ${files.length} deployment files for ${commit}.`);
} else if (process.argv[2] === 'check') {
  const base = new URL(process.env.DEPLOY_URL ?? '');
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Expected an HTTP(S) URL.');
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  base.search = '';
  base.hash = '';
  const attempts = Number(process.env.DEPLOY_CHECK_ATTEMPTS ?? 12);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 12)
    throw new Error('DEPLOY_CHECK_ATTEMPTS must be between 1 and 12.');
  let round = 0;

  async function get(path) {
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
      throw new Error(`Path outside the deployment: ${path}`);
    url.searchParams.set('deploy-check', `${commit}-${round}`);
    return fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  }

  async function verify() {
    round++;
    const response = await get('release.json');
    if (!response.ok) throw new Error(`release.json: HTTP ${response.status}`);
    const release = await response.json();
    if (release.commit !== commit) throw new Error('The expected commit is not live yet.');
    if (!Array.isArray(release.files) || release.files.length < 7 || release.files.length > 250)
      throw new Error('Invalid release file list.');
    const paths = new Set(release.files.map((file) => file.path));
    for (const path of [
      'index.html',
      'workshop.html',
      'setup.html',
      'map.html',
      'sw.js',
      'manifest.webmanifest',
    ])
      if (!paths.has(path)) throw new Error(`Release is missing ${path}.`);
    for (const file of release.files) {
      if (typeof file.path !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256))
        throw new Error('Invalid release file entry.');
    }
    // Four concurrent requests keep the check small without serializing every generated chunk.
    for (let i = 0; i < release.files.length; i += 4) {
      await Promise.all(
        release.files.slice(i, i + 4).map(async ({ path, sha256 }) => {
          const res = await get(path);
          if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
          if (hash(Buffer.from(await res.arrayBuffer())) !== sha256)
            throw new Error(`${path}: published bytes differ from the build.`);
        }),
      );
    }
    const missing = await get(`__deploy_probe_missing_${commit}`);
    if (missing.status !== 404)
      throw new Error(`Unknown route returned ${missing.status}, expected 404.`);
    console.log(
      `Verified ${release.files.length} files, 404 handling and commit ${commit} at ${base.href}`,
    );
  }

  for (let attempt = 1; ; attempt++) {
    try {
      await verify();
      break;
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.warn(`Deployment check ${attempt}/${attempts}: ${error.message}`);
      await delay(5000);
    }
  }
} else {
  throw new Error('Usage: node scripts/deploy-check.mjs stamp|check');
}
