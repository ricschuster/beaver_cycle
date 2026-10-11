import { afterEach, describe, expect, it, vi } from 'vitest';
import { OSM_COPYRIGHT_URL, createOsmCredit } from './osmCredit';

interface Fake {
  id: string;
  href: string;
  rel: string;
  target: string;
  textContent: string;
  style: { cssText: string };
  kids: (Fake | string)[];
  append(...k: (Fake | string)[]): void;
}

/** The credit only builds two elements, so plain objects stand in for the DOM. */
function fakeDom(): { made: Fake[]; parent: HTMLElement } {
  const made: Fake[] = [];
  vi.stubGlobal('document', {
    createElement: (): Fake => {
      const e: Fake = { id: '', href: '', rel: '', target: '', textContent: '', style: { cssText: '' }, kids: [], append: (...k) => void e.kids.push(...k) };
      made.push(e);
      return e;
    },
  });
  return { made, parent: { appendChild: () => {} } as unknown as HTMLElement };
}

describe('createOsmCredit', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says whose map data it is, with a link to the OpenStreetMap copyright page', () => {
    const { made, parent } = fakeDom();
    createOsmCredit(parent);
    const [box, link] = made;
    expect(box?.kids[0]).toBe('Map data © ');
    expect(box?.kids[1]).toBe(link);
    expect(link?.textContent).toBe('OpenStreetMap contributors');
    expect(link?.href).toBe(OSM_COPYRIGHT_URL);
    expect(link?.rel).toContain('noopener');
  });

  it('lets only the link take touches, so the credit never blocks the game', () => {
    const { made, parent } = fakeDom();
    createOsmCredit(parent);
    const [box, link] = made;
    expect(box?.style.cssText).toContain('pointer-events:none');
    expect(link?.style.cssText).toContain('pointer-events:auto');
  });
});
