const fs = require('fs');
const path = require('path');
const { BSON } = require('../Backend/node_modules/bson');

const DIRS = [
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_backup_20260826_081725',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_corrompu',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_corrompu_final',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_backup_20260824_230308',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_backup_20260823_000648',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\data_backup_20260822_235219',
  'C:\\Program Files\\MongoDB\\Server\\7.0\\data',
  'C:\\data_sauvegarde_secours',
  'C:\\secours_bis',
  'C:\\temp\\data_rescue',
  'C:\\temp\\data_repair'
];

const allDocs = new Map();
for (const d of DIRS) {
  if (!fs.existsSync(d)) continue;
  const files = fs.readdirSync(d).filter(f => f.endsWith('.wt'));
  for (const f of files) {
    const buf = fs.readFileSync(path.join(d, f));
    for (let i = 0; i < buf.length - 5; i++) {
      const len = buf.readInt32LE(i);
      if (len >= 15 && len <= 4 * 1024 * 1024 && i + len <= buf.length && buf[i + len - 1] === 0) {
        try {
          const doc = BSON.deserialize(buf.subarray(i, i + len));
          if (doc && doc._id) {
            allDocs.set(doc._id.toString(), doc);
          }
        } catch(e){}
      }
    }
  }
}
console.log('Total unique documents extracted across all WT files:', allDocs.size);
const keysCount = {};
for (const [id, doc] of allDocs) {
  const keys = Object.keys(doc).sort().join(',');
  keysCount[keys] = (keysCount[keys] || 0) + 1;
}
console.log('Document signatures found:');
for (const [k, v] of Object.entries(keysCount)) {
  console.log(`- (${v} docs): ${k}`);
}
