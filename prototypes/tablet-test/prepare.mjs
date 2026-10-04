// Assemble www/ from the camera demo plus the bench script. Run after
// export_scene.py and npm install in prototypes/camera-demo.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
const demo = '../camera-demo', out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/node_modules/three/examples/jsm`, { recursive: true });
cpSync(`${demo}/scene.json`, `${out}/scene.json`);
cpSync(`${demo}/node_modules/three/build`, `${out}/node_modules/three/build`, { recursive: true });
cpSync(`${demo}/node_modules/three/examples/jsm/utils`, `${out}/node_modules/three/examples/jsm/utils`, { recursive: true });
cpSync('bench.js', `${out}/bench.js`);
const html = readFileSync(`${demo}/index.html`, 'utf8').replace('</body>', '<script type="module" src="bench.js"></script>\n</body>');
writeFileSync(`${out}/index.html`, html);
