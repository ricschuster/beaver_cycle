// The start screen when a saved game exists: four slots. A used slot is continued, renamed or deleted; an empty one starts a new
// game, with a name if the player likes. Deleting is asked twice, since it throws the saved game away. DOM only: the caller owns
// the storage and passes what it needs in `SlotActions`.
import { NAME_MAX, type SlotInfo } from '../persist/save';
import { stageAt } from '../sim/life';

export interface SlotChoice {
  slot: number;
  action: 'continue' | 'new';
  /** The name for a new game, possibly empty. */
  name: string;
}

export interface SlotActions {
  /** The slots as they are now, read again after a rename or a delete. */
  slots(): SlotInfo[];
  rename(slot: number, name: string): void;
  remove(slot: number): void;
  /** "2 hours ago" for a time. */
  ago(savedAt: number): string;
}

const BUTTON = 'min-width:44px;min-height:44px;padding:8px 14px;border:0;border-radius:10px;font:16px system-ui,sans-serif;cursor:pointer;';
const STAGE_WORD = { baby: 'Baby', teenager: 'Teenager', adult: 'Adult' } as const;

/** The details line of a used slot: "Adult, generation 2, last played 3 hours ago". */
export function slotDetails(info: Extract<SlotInfo, { kind: 'used' }>, when: string): string {
  return `${STAGE_WORD[stageAt(info.clock, info.bornAt)]}, generation ${info.generation + 1}, last played ${when}`;
}

/** Shows the slots over the page and resolves with the player's choice. */
export function askSlot(parent: HTMLElement, actions: SlotActions): Promise<SlotChoice> {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.id = 'slot-card';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Saved games');
    root.style.cssText = 'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(20,30,20,.85);font:16px/1.5 system-ui,sans-serif;overflow-y:auto';
    const card = document.createElement('div');
    card.style.cssText = 'box-sizing:border-box;width:min(30rem,94vw);max-height:96vh;overflow-y:auto;padding:16px 18px;border-radius:14px;background:#f6f1e4;color:#2a1f0e';
    root.appendChild(card);
    parent.appendChild(root);

    const done = (choice: SlotChoice): void => {
      root.remove();
      resolve(choice);
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
      i.setAttribute('aria-label', 'Name');
      i.style.cssText = 'box-sizing:border-box;width:100%;min-height:44px;padding:6px 10px;font:inherit;border-radius:8px;border:1px solid #b9a97d;background:#fff;color:inherit';
      return i;
    };

    /** What a slot is doing on the card: showing, being renamed, being asked about deleting, or an empty one taking a name. */
    let mode: { slot: number; kind: 'rename' | 'delete' | 'new' } | null = null;

    const draw = (): void => {
      const heading = document.createElement('div');
      heading.textContent = 'Your games';
      heading.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:8px';
      card.replaceChildren(heading, ...actions.slots().map(row));
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
        title.textContent = `Game ${info.slot}`;
        detail.textContent = info.kind === 'empty' ? 'Empty' : 'This game could not be read. It is kept aside, so this slot is free.';
        if (here === 'new') {
          const input = nameInput('', 'Name (you can leave it empty)');
          const start = button('Start', 'slot-start', GREEN);
          start.onclick = () => done({ slot: info.slot, action: 'new', name: input.value });
          const cancel = button('Back', 'slot-back', SAND);
          cancel.onclick = () => {
            mode = null;
            draw();
          };
          buttons.append(start, cancel);
          box.append(input, buttons);
        } else {
          const fresh = button('New game', 'slot-new', GREEN);
          fresh.onclick = () => {
            mode = { slot: info.slot, kind: 'new' };
            draw();
          };
          buttons.append(fresh);
          box.append(buttons);
        }
        return box;
      }

      title.textContent = info.name || `Game ${info.slot}`;
      detail.textContent = slotDetails(info, actions.ago(info.savedAt));
      if (here === 'rename') {
        const input = nameInput(info.name, `Game ${info.slot}`);
        const ok = button('Save name', 'slot-rename-ok', GREEN);
        ok.onclick = () => {
          actions.rename(info.slot, input.value);
          mode = null;
          draw();
        };
        const cancel = button('Back', 'slot-back', SAND);
        cancel.onclick = () => {
          mode = null;
          draw();
        };
        buttons.append(ok, cancel);
        box.append(input, buttons);
      } else if (here === 'delete') {
        const ask = document.createElement('div');
        ask.textContent = 'Delete this game? Its beaver and lodge will be gone.';
        ask.style.cssText = 'margin-top:6px';
        const yes = button('Yes, delete', 'slot-delete-yes', 'background:#a33a2a;color:#fff;');
        yes.onclick = () => {
          actions.remove(info.slot);
          mode = null;
          draw();
        };
        const keep = button('Keep it', 'slot-back', GREEN);
        keep.onclick = () => {
          mode = null;
          draw();
        };
        buttons.append(yes, keep);
        box.append(ask, buttons);
      } else {
        const go = button('Continue', 'slot-continue', GREEN);
        go.onclick = () => done({ slot: info.slot, action: 'continue', name: info.name });
        const rename = button('Rename', 'slot-rename', SAND);
        rename.onclick = () => {
          mode = { slot: info.slot, kind: 'rename' };
          draw();
        };
        const del = button('Delete', 'slot-delete', SAND);
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
