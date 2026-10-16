// Fails when the release build in dist/ still holds dev tooling (ADR 0013). Run after `npm run build`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['To nearest spot', 'Finish dam here', 'Fill store but one', 'Sleep to dawn', '__game'];
const dir = process.argv[2] ?? 'dist';

function* files(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(js|mjs|html)$/.test(name)) yield p;
  }
}

const hits = [];
if (existsSync(join(dir, 'audio-candidates'))) hits.push(`${dir}/audio-candidates: staged sounds are not part of the game`);
for (const f of files(dir)) {
  const text = readFileSync(f, 'utf8');
  for (const m of MARKERS) if (text.includes(m)) hits.push(`${f}: ${m}`);
}
if (hits.length > 0) {
  console.error(`Dev tooling found in the release build:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`Release build in ${dir} holds no dev tooling.`);
