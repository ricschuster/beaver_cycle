// The stash screen: the food store as a chest. A grid of the store's fixed places and, under it, the mouth. Tapping a
// place moves a piece between the two (the rules are `tapped` in sim/food.ts). Opens when the sim says so
// (`WorldState.stashOpen`) and stays until the player closes it. DOM only; it hands taps to the caller as plain data.
import { t } from '../i18n';
import { stockMeals, stockTotal, type Food, type Stock } from '../sim/food';

export interface StashPanel {
  /** Show the panel for a store, the piece in the mouth, and the places in use, or hide it when `open` is false. */
  set(open: boolean, stock: Stock, carry: Food | null, capacity: number): void;
}

/** Places in a row: eight by five fits a tablet held sideways. */
export const STASH_COLUMNS = 8;

/** What one place of the grid shows: its piece or empty, and whether wear has taken the place away. */
export interface Cell {
  food: Food | null;
  lost: boolean;
}

/** The cells of the grid in order. A place from `capacity` on is lost to wear. */
export function stashCells(stock: Stock, capacity: number): Cell[] {
  return stock.map((food, i) => ({ food, lost: i >= capacity }));
}

const NAME: Record<Food, () => string> = { branch: () => t('stash.branch'), lily: () => t('stash.lily') };

/** The line over the grid: pieces, places in use, and meals, for example "12 of 40 places, 18 meals". */
export function stashSummary(stock: Stock, capacity: number): string {
  const meals = stockMeals(stock);
  return capacity === 0 ? t('stash.broken') : t(meals === 1 ? 'stash.summaryOne' : 'stash.summaryMany', { places: stockTotal(stock), capacity, meals });
}

/** A piece drawn as a small picture: a brown stick for a branch, a green disc for a lily pad. */
function drawPiece(food: Food): HTMLElement {
  const piece = document.createElement('span');
  piece.style.cssText =
    food === 'branch'
      ? 'display:block;width:38px;height:8px;border-radius:4px;background:#8a6a42;box-shadow:0 0 0 1px #5c4526;transform:rotate(-35deg)'
      : 'display:block;width:30px;height:30px;border-radius:50%;background:#4f9d4b;box-shadow:0 0 0 1px #2f6a30;clip-path:polygon(50% 50%,100% 38%,100% 0,0 0,0 100%,100% 100%,100% 62%)';
  return piece;
}

export function createStashPanel(parent: HTMLElement, handlers: { onTap(slot: number): void; onClose(): void }): StashPanel {
  const root = document.createElement('div');
  root.id = 'stash';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', t('stash.label'));
  root.style.cssText = 'display:none;position:fixed;inset:0;z-index:8;background:rgba(0,0,0,.5);align-items:center;justify-content:center;font:14px system-ui,sans-serif;color:#fff';
  const box = document.createElement('div');
  box.style.cssText = 'padding:14px 16px;border-radius:12px;background:rgba(32,40,36,.95);border:2px solid rgba(255,255,255,.5);max-width:96vw;max-height:96vh;overflow:auto';
  const summary = document.createElement('div');
  summary.style.cssText = 'margin-bottom:10px;font-weight:600';
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${STASH_COLUMNS},56px);gap:4px`;
  const foot = document.createElement('div');
  foot.style.cssText = 'display:flex;align-items:center;gap:12px;margin-top:12px';
  const mouth = document.createElement('div');
  mouth.id = 'stash-mouth';
  mouth.style.cssText = 'display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:8px;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.6)';
  const mouthLabel = document.createElement('span');
  const close = document.createElement('button');
  close.id = 'stash-close';
  close.type = 'button';
  close.textContent = t('stash.done');
  close.style.cssText = 'margin-left:auto;padding:12px 24px;border-radius:8px;border:2px solid rgba(255,255,255,.6);background:rgba(255,255,255,.18);color:#fff;font:600 16px system-ui,sans-serif';
  close.addEventListener('click', () => handlers.onClose());
  foot.append(mouth, mouthLabel, close);
  box.append(summary, grid, foot);
  root.appendChild(box);
  // Taps on the dark around the box close it too.
  root.addEventListener('click', (e) => {
    if (e.target === root) handlers.onClose();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.style.display !== 'none') handlers.onClose();
  });
  parent.appendChild(root);
  let shown = '';
  return {
    set(open, stock, carry, capacity) {
      root.style.display = open ? 'flex' : 'none';
      if (!open) {
        shown = '';
        return;
      }
      const key = `${stock.map((f) => (f === null ? '-' : f[0])).join('')}|${carry}|${capacity}`;
      if (key === shown) return;
      shown = key;
      summary.textContent = stashSummary(stock, capacity);
      grid.replaceChildren(
        ...stashCells(stock, capacity).map((cell, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.dataset.slot = String(i);
          b.disabled = cell.lost;
          b.setAttribute('aria-label', cell.lost ? t('stash.lostPlace') : cell.food ? NAME[cell.food]() : t('stash.emptyPlace'));
          b.style.cssText = `display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:8px;border:2px solid rgba(255,255,255,${cell.lost ? 0.12 : 0.5});background:${cell.lost ? 'rgba(90,90,90,.35)' : 'rgba(255,255,255,.1)'};padding:0`;
          if (cell.food) b.appendChild(drawPiece(cell.food));
          b.addEventListener('click', () => handlers.onTap(i));
          return b;
        }),
      );
      mouth.replaceChildren(...(carry ? [drawPiece(carry)] : []));
      mouthLabel.textContent = carry ? t(carry === 'branch' ? 'stash.mouthBranch' : 'stash.mouthLily') : t('stash.mouthEmpty');
    },
  };
}
