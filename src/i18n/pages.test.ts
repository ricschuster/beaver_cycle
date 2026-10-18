// The manual and the privacy page come once per language (public/manual.de.html next to public/manual.html). A translation
// may not drift from the English page in shape: the same sections, boxes, steps, pictures, and the same links.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { manualUrl } from '../ui/helpPanel';
import { pageFile } from './index';

const read = (file: string): string => readFileSync(new URL(`../../public/${file}`, import.meta.url), 'utf8');
const body = (html: string): string => html.slice(html.indexOf('<body>'));
const all = (html: string, re: RegExp): string[] => [...html.matchAll(re)].map((m) => m[1]!);

describe('pageFile', () => {
  it('names the English page plain and the others with their language', () => {
    expect(pageFile('manual', 'en')).toBe('manual.html');
    expect(pageFile('manual', 'de')).toBe('manual.de.html');
    expect(pageFile('privacy', 'de')).toBe('privacy.de.html');
  });

  it('gives the manual under the base path', () => {
    expect(manualUrl('/')).toBe('/manual.html');
  });
});

describe.each(['manual', 'privacy'])('%s in German', (name) => {
  const en = body(read(`${name}.html`));
  const de = body(read(`${name}.de.html`));

  it('has the same shape as the English page', () => {
    for (const tag of ['h1', 'h2', 'details', 'summary', 'li', 'tr', 'figure', 'img', 'kbd', 'span class="btn"', 'a ']) {
      expect(de.split(`<${tag}`).length, `<${tag}`).toBe(en.split(`<${tag}`).length);
    }
    expect(all(de, /<h2 id="(\w+)"/g)).toEqual(all(en, /<h2 id="(\w+)"/g));
  });

  it('uses the same pictures and links', () => {
    // The German page has its own pictures, with German words on the screen, in manual/de/.
    expect(all(de, /<img src="([^"]+)"/g).map((src) => src.replace('manual/de/', 'manual/'))).toEqual(all(en, /<img src="([^"]+)"/g));
    const external = (html: string): string[] => all(html, /href="(https?:[^"]+|mailto:[^"]+)"/g);
    expect(external(de)).toEqual(external(en));
  });

  it('links to the page of the other language', () => {
    expect(read(`${name}.html`)).toContain(`href="${name}.de.html"`);
    expect(read(`${name}.de.html`)).toContain(`href="${name}.html"`);
  });

  it('has a language tag and no em dash', () => {
    expect(read(`${name}.de.html`)).toContain('<html lang="de">');
    expect(read(`${name}.de.html`)).not.toContain(String.fromCharCode(0x2014));
  });
});
