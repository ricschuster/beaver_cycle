// The look card: the player chooses fur (five browns in five shades), hat, scarf, tail colour, and a name, with the beaver turning
// above. Shown at the start of a game and when each new life begins. DOM only: the caller gives it a preview to draw the beaver.
import { t, tList } from '../i18n';
import { NAME_MAX } from '../persist/save';
import { HATS, SCARVES, TAILS, coatColours } from '../render/beaverModel';
import type { Coat } from '../sim/family';
import { HAT_COUNT, SCARF_COUNT, TAIL_COUNT, furChoices, nearestShade, type Look } from '../sim/look';

export interface LookChoice {
  coat: Coat;
  look: Look;
}

/** What draws the beaver for the card: given the canvas, shows a choice and stops when the card is done. */
export type PreviewFactory = (canvas: HTMLCanvasElement) => { show(coat: Coat, look: Look): void; dispose(): void };

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
const BASE = 'min-width:44px;min-height:44px;border-radius:10px;font:16px system-ui,sans-serif;cursor:pointer;';

/** Shows the card over the page and resolves with the choice. `initial` is what shows first, so a player who taps Go changes nothing. */
export function askLook(parent: HTMLElement, initial: LookChoice, preview?: PreviewFactory): Promise<LookChoice> {
  return new Promise((resolve) => {
    let coat: Coat = { coat: initial.coat.coat, shade: nearestShade(initial.coat.shade) };
    const look: Look = { ...initial.look };

    const root = document.createElement('div');
    root.id = 'look-card';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', t('look.label'));
    root.style.cssText = 'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(20,30,20,.85);font:16px/1.5 system-ui,sans-serif;overflow-y:auto';
    const card = document.createElement('div');
    card.style.cssText = 'box-sizing:border-box;width:min(34rem,94vw);max-height:96vh;overflow-y:auto;padding:14px 18px;border-radius:14px;background:#f6f1e4;color:#2a1f0e';
    root.appendChild(card);
    parent.appendChild(root);

    const heading = document.createElement('div');
    heading.textContent = t('look.heading');
    heading.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:6px';
    const canvas = document.createElement('canvas');
    canvas.dataset.look = 'preview';
    canvas.style.cssText = 'display:block;width:100%;height:170px;border-radius:10px;background:#cfe3ee';
    card.append(heading, canvas);
    const shown = preview?.(canvas);
    const refresh = (): void => shown?.show(coat, look);

    /** A labelled row of buttons; `mark` says which one is chosen, and the redraw after a click keeps the marks right. */
    const marks: (() => void)[] = [];
    const row = (label: string, count: number, make: (i: number) => HTMLButtonElement, chosen: () => number, pick: (i: number) => void): void => {
      const title = document.createElement('div');
      title.textContent = label;
      title.style.cssText = 'font-weight:700;margin:8px 0 4px';
      const box = document.createElement('div');
      box.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
      const buttons = Array.from({ length: count }, (_, i) => {
        const b = make(i);
        b.type = 'button';
        b.onclick = () => {
          pick(i);
          marks.forEach((m) => m());
          refresh();
        };
        return b;
      });
      const mark = (): void => buttons.forEach((b, i) => {
        b.style.outline = i === chosen() ? '4px solid #2f6a30' : 'none';
        b.setAttribute('aria-pressed', String(i === chosen()));
      });
      marks.push(mark);
      mark();
      box.append(...buttons);
      card.append(title, box);
    };
    const swatch = (colour: number | null, name: string, action: string): HTMLButtonElement => {
      const b = document.createElement('button');
      b.dataset.action = action;
      b.setAttribute('aria-label', name);
      b.style.cssText = `${BASE}border:2px solid #7a6a48;${colour === null ? 'background:repeating-linear-gradient(45deg,#fff,#fff 6px,#ddd 6px,#ddd 12px)' : `background:${hex(colour)}`};`;
      return b;
    };

    // The 25 furs: a row for each brown, a column for each shade step.
    const furs = furChoices();
    const furIndex = (): number => furs.findIndex((f) => f.coat === coat.coat && f.shade === coat.shade);
    row(t('look.fur'), furs.length, (i) => swatch(Number.parseInt(coatColours(furs[i]!.coat, furs[i]!.shade).fur.getHexString(), 16), t('look.furN', { n: i + 1 }), 'look-fur'), furIndex, (i) => {
      coat = furs[i]!;
    });
    const furBox = card.lastElementChild as HTMLElement;
    furBox.style.cssText = 'display:grid;grid-template-columns:repeat(5,44px);gap:6px';

    const hatNames = tList('look.hats');
    row(t('look.hat'), HAT_COUNT, (i) => {
      const b = document.createElement('button');
      b.dataset.action = 'look-hat';
      b.textContent = hatNames[i] ?? t('look.none');
      b.style.cssText = `${BASE}padding:6px 12px;border:2px solid #7a6a48;background:${HATS[i] ? '#fbf8ee' : '#e3d6b0'};color:#2a1f0e;`;
      return b;
    }, () => look.hat, (i) => {
      look.hat = i;
    });
    row(t('look.scarf'), SCARF_COUNT, (i) => swatch(SCARVES[i] ?? null, i === 0 ? t('look.none') : t('look.scarfN', { n: i }), 'look-scarf'), () => look.scarf, (i) => {
      look.scarf = i;
    });
    row(t('look.tail'), TAIL_COUNT, (i) => swatch(TAILS[i] ?? null, t('look.tailN', { n: i + 1 }), 'look-tail'), () => look.tail, (i) => {
      look.tail = i;
    });

    const nameTitle = document.createElement('div');
    nameTitle.textContent = t('look.name');
    nameTitle.style.cssText = 'font-weight:700;margin:8px 0 4px';
    const name = document.createElement('input');
    name.type = 'text';
    name.maxLength = NAME_MAX;
    name.value = look.name;
    name.placeholder = t('look.namePlaceholder');
    name.dataset.action = 'look-name';
    name.setAttribute('aria-label', t('look.name'));
    name.style.cssText = 'box-sizing:border-box;width:100%;min-height:44px;padding:6px 10px;font:inherit;border-radius:8px;border:1px solid #b9a97d;background:#fff;color:inherit';
    const go = document.createElement('button');
    go.type = 'button';
    go.dataset.action = 'look-go';
    go.textContent = t('look.go');
    go.style.cssText = `${BASE}margin-top:12px;padding:8px 22px;border:0;background:#2f6a30;color:#fff;`;
    go.onclick = () => {
      shown?.dispose();
      root.remove();
      resolve({ coat, look: { ...look, name: name.value.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) } });
    };
    card.append(nameTitle, name, go);
    refresh();
  });
}
