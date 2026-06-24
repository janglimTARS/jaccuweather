const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadBuildFunctions() {
  const source = fs.readFileSync(path.join(root, 'build.js'), 'utf8');
  const start = source.indexOf('function hasNumericValue');
  const end = source.indexOf('function tomorrowIndexToPollenValue');
  assert.ok(start > -1 && end > start, 'expected Google pollen helpers in build.js');
  const sandbox = { console, POLLEN_HOURLY_PARAMS: 'alder_pollen,birch_pollen,grass_pollen,weed_pollen,mugwort_pollen,olive_pollen,ragweed_pollen' };
  vm.runInNewContext(`${source.slice(start, end)}; this.normalizeGooglePollen = normalizeGooglePollen;`, sandbox);
  return sandbox;
}

test('Google WEED/RAGWEED entries present without indexInfo are marked as none-display metadata without fake numeric pollen', () => {
  const { normalizeGooglePollen } = loadBuildFunctions();
  const normalized = normalizeGooglePollen({
    dailyInfo: [{
      date: { year: 2026, month: 6, day: 1 },
      pollenTypeInfo: [
        { code: 'GRASS', indexInfo: { value: 4 } },
        { code: 'WEED' }
      ],
      plantInfo: [
        { code: 'RAGWEED' }
      ]
    }]
  });

  assert.equal(normalized.current.grass_pollen, 200);
  assert.equal(normalized.current.weed_pollen, null);
  assert.equal(normalized.current.ragweed_pollen, null);
  assert.equal(normalized.current.mugwort_pollen, null);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.pollen_null_display_as_none.current)), {
    weed_pollen: true,
    ragweed_pollen: true
  });
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.pollen_null_display_as_none.hourly[0])), {
    weed_pollen: true,
    ragweed_pollen: true
  });
});

test('Google categories absent from provider remain unavailable rather than none', () => {
  const { normalizeGooglePollen } = loadBuildFunctions();
  const normalized = normalizeGooglePollen({
    dailyInfo: [{
      date: { year: 2026, month: 6, day: 1 },
      pollenTypeInfo: [{ code: 'GRASS', indexInfo: { value: 4 } }],
      plantInfo: []
    }]
  });

  assert.equal(normalized.current.weed_pollen, null);
  assert.equal(normalized.current.ragweed_pollen, null);
  assert.equal(normalized.pollen_null_display_as_none.current.weed_pollen, undefined);
  assert.equal(normalized.pollen_null_display_as_none.current.ragweed_pollen, undefined);
});

test('pollen section appears after weather radar in page order', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const radarIndex = html.indexOf('<!-- Weather Radar -->');
  const pollenIndex = html.indexOf('<!-- Pollen Forecast -->');
  assert.ok(radarIndex > -1, 'weather radar section exists');
  assert.ok(pollenIndex > -1, 'pollen forecast section exists');
  assert.ok(pollenIndex > radarIndex, 'pollen section should be after weather radar');
});
