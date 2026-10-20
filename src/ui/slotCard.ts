// The start screen when a saved game exists: four slots. A used slot is continued, renamed or deleted; an empty one starts a new
// game, with a name if the player likes. Deleting is asked twice, since it throws the saved game away. DOM only: the caller owns
// the storage and passes what it needs in `SlotActions`.
import { t } from '../i18n';
import { cleanAddress } from '../net/pending';
import { NAME_MAX, type SlotInfo } from '../persist/save';
import { stageAt } from '../sim/life';

export interface SlotChoice {
  slot: number;
  action: 'continue' | 'new';
  /** The name for a new game, possibly empty. */
  name: string;
  /** The player ticked "Let friends join" (ADR 0014): the game starts hosting. */
  host?: boolean;
  /** The address of a friend's game to join, checked: the game is not this slot's but the friend's. */
  join?: string;
}

export interface SlotActions {
  /** Playing together: whether this app can host, and the address typed last time. Null leaves the section out. */
  together?: { canHost: boolean; lastHost: string } | null;
  /** The slots as they are now, read again after a rename or a delete. */
  slots(): SlotInfo[];
  rename(slot: number, name: string): void;
  remove(slot: number): void;
  /** "2 hours ago" for a time. */
  ago(savedAt: number): string;
}

const BUTTON = 'min-width:44px;min-height:44px;padding:8px 14px;border:0;border-radius:10px;font:16px system-ui,sans-serif;cursor:pointer;';
const STAGE_WORD = { baby: 'stage.baby', teenager: 'stage.teenager', adult: 'stage.adult' } as const;

/** The details line of a used slot: "Adult, generation 2, last played 3 hours ago". */
export function slotDetails(info: Extract<SlotInfo, { kind: 'used' }>, when: string): string {
  return t('slots.details', { stage: t(STAGE_WORD[stageAt(info.clock, info.bornAt)]), generation: info.generation + 1, when });
}

/** Shows the slots over the page and resolves with the player's choice. */
export function askSlot(parent: HTMLElement, actions: SlotActions): Promise<SlotChoice> {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.id = 'slot-card';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', t('slots.label'));
    root.style.cssText = 'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(20,30,20,.85);font:16px/1.5 system-ui,sans-serif;overflow-y:auto';
    const card = document.createElement('div');
    card.style.cssText = 'box-sizing:border-box;width:min(30rem,94vw);max-height:96vh;overflow-y:auto;padding:16px 18px;border-radius:14px;background:#f6f1e4;color:#2a1f0e';
    root.appendChild(card);
    parent.appendChild(root);

    let hostTicked = false;
    const done = (choice: SlotChoice): void => {
      root.remove();
      resolve(hostTicked ? { ...choice, host: true } : choice);
    };
    const button = (label: string, action: string, colours: string): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.action = action;
      b.textContent = label;
      b.style.cssText = `${BUTTON}${colours}`;
      return b;
    };
    const GREEN = 'background:#2f6a30;color:#fff;';
    const SAND = 'background:#e3d6b0;color:#2a1f0e;';
    const nameInput = (value: string, placeholder: string): HTMLInputElement => {
      const i = document.createElement('input');
      i.type = 'text';
      i.maxLength = NAME_MAX;
      i.value = value;
      i.placeholder = placeholder;
      i.dataset.action = 'slot-name';
      i.setAttribute('aria-label', t('slots.name'));
      i.style.cssText = 'box-sizing:border-box;width:100%;min-height:44px;padding:6px 10px;font:inherit;border-radius:8px;border:1px solid #b9a97d;background:#fff;color:inherit';
      return i;
    };

    /** What a slot is doing on the card: showing, being renamed, being asked about deleting, or an empty one taking a name. */
    let mode: { slot: number; kind: 'rename' | 'delete' | 'new' } | null = null;

    const draw = (): void => {
      const heading = document.createElement('div');
      heading.textContent = t('slots.heading');
      heading.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:8px';
      card.replaceChildren(heading, ...actions.slots().map(row), ...(actions.together ? [together(actions.together)] : []));
    };

    /** The Play together box under the slots: a tick to host the game picked above, and an address to join a friend's. */
    const together = (opts: { canHost: boolean; lastHost: string }): HTMLElement => {
      const box = document.createElement('div');
      box.dataset.role = 'together';
      box.style.cssText = 'padding:10px 12px;margin:12px 0 0;border-radius:10px;border:1px solid #b9a97d;background:#ebe2c8';
      const title = document.createElement('div');
      title.textContent = t('together.title');
      title.style.cssText = 'font-weight:700';
      box.append(title);
      if (opts.canHost) {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:10px;min-height:44px;margin-top:6px';
        const tick = document.createElement('input');
        tick.type = 'checkbox';
        tick.checked = hostTicked;
        tick.dataset.action = 'together-host';
        tick.style.cssText = 'width:24px;height:24px';
        tick.onchange = () => {
          hostTicked = tick.checked;
        };
        const words = document.createElement('span');
        words.textContent = t('together.hostTick');
        label.append(tick, words);
        box.append(label);
      }
      const joinRow = document.createElement('div');
      joinRow.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:6px';
      const address = document.createElement('input');
      address.type = 'text';
      address.inputMode = 'decimal';
      address.value = opts.lastHost;
      address.placeholder = '192.168.0.7';
      address.dataset.action = 'together-address';
      address.setAttribute('aria-label', t('together.address'));
      address.style.cssText = 'box-sizing:border-box;width:9rem;min-height:44px;padding:6px 10px;font:inherit;border-radius:8px;border:1px solid #b9a97d;background:#fff;color:inherit';
      const note = document.createElement('div');
      note.style.cssText = 'font-size:14px;color:#6b5d44;margin-top:4px;min-height:1.4em';
      note.textContent = t('together.startNote');
      const join = button(t('together.join'), 'together-join', SAND);
      join.onclick = () => {
        const a = cleanAddress(address.value);
        if (a) done({ slot: 0, action: 'new', name: '', join: a });
        else note.textContent = t('together.addressBad');
      };
      joinRow.append(address, join);
      box.append(joinRow, note);
      return box;
    };

    const row = (info: SlotInfo): HTMLElement => {
      const box = document.createElement('div');
      box.dataset.slot = String(info.slot);
      box.style.cssText = 'padding:10px 12px;margin:8px 0;border-radius:10px;border:1px solid #b9a97d;background:#fbf8ee';
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:700';
      const detail = document.createElement('div');
      detail.style.cssText = 'font-size:14px;color:#6b5d44';
      const buttons = document.createElement('div');
      buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:8px';
      box.append(title, detail);
      const here = mode?.slot === info.slot ? mode.kind : null;

      if (info.kind === 'empty' || info.kind === 'unreadable') {
        title.textContent = t('slots.game', { n: info.slot });
        detail.textContent = info.kind === 'empty' ? t('slots.empty') : t('slots.unreadable');
        if (here === 'new') {
          const input = nameInput('', t('slots.namePlaceholder'));
          const start = button(t('slots.start'), 'slot-start', GREEN);
          start.onclick = () => done({ slot: info.slot, action: 'new', name: input.value });
          const cancel = button(t('slots.back'), 'slot-back', SAND);
          cancel.onclick = () => {
            mode = null;
            draw();
          };
          buttons.append(start, cancel);
          box.append(input, buttons);
        } else {
          const fresh = button(t('slots.new'), 'slot-new', GREEN);
          fresh.onclick = () => {
            mode = { slot: info.slot, kind: 'new' };
            draw();
          };
          buttons.append(fresh);
          box.append(buttons);
        }
        return box;
      }

      title.textContent = info.name || t('slots.game', { n: info.slot });
      detail.textContent = slotDetails(info, actions.ago(info.savedAt));
      if (here === 'rename') {
        const input = nameInput(info.name, t('slots.game', { n: info.slot }));
        const ok = button(t('slots.saveName'), 'slot-rename-ok', GREEN);
        ok.onclick = () => {
          actions.rename(info.slot, input.value);
          mode = null;
          draw();
        };
        const cancel = button(t('slots.back'), 'slot-back', SAND);
        cancel.onclick = () => {
          mode = null;
          draw();
        };
        buttons.append(ok, cancel);
        box.append(input, buttons);
      } else if (here === 'delete') {
        const ask = document.createElement('div');
        ask.textContent = t('slots.askDelete');
        ask.style.cssText = 'margin-top:6px';
        const yes = button(t('slots.yesDelete'), 'slot-delete-yes', 'background:#a33a2a;color:#fff;');
        yes.onclick = () => {
          actions.remove(info.slot);
          mode = null;
          draw();
        };
        const keep = button(t('slots.keep'), 'slot-back', GREEN);
        keep.onclick = () => {
          mode = null;
          draw();
        };
        buttons.append(yes, keep);
        box.append(ask, buttons);
      } else {
        const go = button(t('slots.continue'), 'slot-continue', GREEN);
        go.onclick = () => done({ slot: info.slot, action: 'continue', name: info.name });
        const rename = button(t('slots.rename'), 'slot-rename', SAND);
        rename.onclick = () => {
          mode = { slot: info.slot, kind: 'rename' };
          draw();
        };
        const del = button(t('slots.delete'), 'slot-delete', SAND);
        del.onclick = () => {
          mode = { slot: info.slot, kind: 'delete' };
          draw();
        };
        buttons.append(go, rename, del);
        box.append(buttons);
      }
      return box;
    };

    draw();
  });
}
