import assert from 'node:assert/strict';

const base = (process.argv.slice(2).find(arg => arg.startsWith('http')) || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(/\/$/, '');
async function get(path) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10000), redirect: 'manual' });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return response;
}
try {
  const html = await (await get('/')).text();
  assert.ok(html.includes('보안길잡이'), 'Expected application title');
  console.log('PASS: application HTML');
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(match => match[1]))];
  assert.ok(assets.some(path => path.endsWith('.js')) && assets.some(path => path.endsWith('.css')), 'Expected JS and CSS assets');
  for (const path of assets) await get(path);
  console.log(`PASS: ${assets.length} JavaScript / CSS assets`);
  const font = await get('/vendor/krds/fonts/PretendardGOV-Regular.subset.woff2');
  assert.ok((await font.arrayBuffer()).byteLength > 1000);
  console.log('PASS: Korean font');
  if (process.argv.includes('--api')) {
    const drafts = await (await get('/api/v1/drafts')).json();
    assert.ok(Array.isArray(drafts));
    console.log('PASS: Spring Boot draft API via Next.js proxy');
  }
  console.log('Smoke checks passed. UI workflow uses sessionStorage.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
