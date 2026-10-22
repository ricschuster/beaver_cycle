// The question a friend's bed puts to the others (#661, docs/design/42_multiplayer.md, Q91 and Q92): "Pip wants to sleep until morning.
// Come along?" with Yes and No. A yes lets the clock skip once all are asleep or said yes, a no stops it. DOM only.
import { t } from '../i18n';
import type { Goal } from '../net/sleepCheck';

export interface SleepAsk {
  /** Show the question from `name` (null: a friend with no name) for `goal`, or hide the card with `null`. */
  set(ask: { name: string | null; goal: Exclude<Goal, 'dream'> } | null): void;
}

export interface SleepAskOptions {
  onAnswer(yes: boolean): void;
}

const BUTTON = 'padding:12px 18px;border:0;border-radius:10px;background:#f3e3b5;color:#2a1f0e;font:16px system-ui,sans-serif;cursor:pointer';

export function createSleepAsk(parent: HTMLElement, opts: SleepAskOptions): SleepAsk {
  const card = document.createElement('div');
  card.id = 'sleep-ask';
  card.style.cssText =
    'display:none;position:fixed;left:50%;top:72px;transform:translateX(-50%);z-index:7;flex-direction:column;align-items:center;gap:10px;padding:12px 16px;' +
    'max-width:calc(100vw - 16px);box-sizing:border-box;border-radius:14px;background:rgba(0,0,0,.6);color:#f3e3b5;font:16px system-ui,sans-serif;text-align:center';
  const line = document.createElement('div');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center';
  const yes = document.createElement('button');
  yes.textContent = t('sleep.ask.yes');
  yes.dataset.action = 'sleep-ask-yes';
  yes.style.cssText = BUTTON;
  const no = document.createElement('button');
  no.textContent = t('sleep.ask.no');
  no.dataset.action = 'sleep-ask-no';
  no.style.cssText = BUTTON;
  yes.onclick = () => opts.onAnswer(true);
  no.onclick = () => opts.onAnswer(false);
  row.append(yes, no);
  card.append(line, row);
  parent.append(card);
  let shown = '';
  return {
    set(ask) {
      if (!ask) {
        card.style.display = 'none';
        shown = '';
        return;
      }
      const next = t(`sleep.ask.${ask.goal}`, { name: ask.name || t('sleep.ask.friend') });
      if (next !== shown) {
        shown = next;
        line.textContent = next;
      }
      card.style.display = 'flex';
    },
  };
}
