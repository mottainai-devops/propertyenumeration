import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourcePath = resolve('src/services/arcgisService.ts');
const source = await readFile(sourcePath, 'utf8');

if (/\btoken\s*:/.test(source) || /[?&]token=/.test(source)) {
  throw new Error('ArcGIS regression: the public-layer client must not send a token parameter.');
}

const queryUrl =
  'https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/New_Footprints_gdb_b1422/FeatureServer/0/query';
const body = new URLSearchParams({
  where: '1=1',
  returnCountOnly: 'true',
  f: 'json',
});

const response = await fetch(queryUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
  signal: AbortSignal.timeout(15_000),
});

if (!response.ok) {
  throw new Error(`ArcGIS public-layer regression check failed with HTTP ${response.status}.`);
}

const payload = await response.json();
if (payload.error || !Number.isInteger(payload.count) || payload.count < 1) {
  throw new Error(`ArcGIS public-layer regression check returned an invalid payload: ${JSON.stringify(payload)}.`);
}

console.log(`ArcGIS public-layer verification passed: ${payload.count} building polygons available.`);

