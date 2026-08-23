import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = await readFile(resolve('src/services/arcgisService.ts'), 'utf8');
const mapReadStart = source.indexOf('export async function fetchCustomerPointsInBounds');
const mapReadEnd = source.indexOf('function convertArcGISFeatureToBuildingPolygon');

if (mapReadStart < 0 || mapReadEnd < 0) {
  throw new Error('ArcGIS regression: could not locate the public map-read section.');
}

const mapReadSource = source.slice(mapReadStart, mapReadEnd);
if (/\btoken\s*:|[?&]token=|ARCGIS_API_KEY/.test(mapReadSource)) {
  throw new Error('ArcGIS regression: public map reads must not send the invalid API token.');
}

const queryUrl =
  'https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/Nigeria_Building_Footprints/FeatureServer/0/query';
const response = await fetch(queryUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ where: '1=1', returnCountOnly: 'true', f: 'json' }),
  signal: AbortSignal.timeout(15_000),
});

if (!response.ok) {
  throw new Error(`ArcGIS public-layer regression check failed with HTTP ${response.status}.`);
}

const payload = await response.json();
if (payload.error || !Number.isInteger(payload.count) || payload.count < 1) {
  throw new Error(`ArcGIS public-layer regression check returned an invalid payload: ${JSON.stringify(payload)}.`);
}

console.log(`ArcGIS public-map verification passed: ${payload.count} building polygons available.`);

