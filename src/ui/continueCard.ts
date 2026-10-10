// The card at the start when a saved game exists: Continue it, or begin a new game (which replaces it). DOM only.
// Starting over is asked twice, since it throws the saved game away.

export type StartChoice = 'continue' | 'new';

const BUTTON = 'min-width:44px;min-height:44px;padding:8px 16px;border:0;border-radius:10px;font:16px system-ui,sans-serif;cursor:pointer;';

/** Shows the card over the page and resolves with the player's choice. `when` is the words after "Last played", e.g. "2 hours ago". */
export function askContinue(parent: HTMLElement, when: string): Promise<StartChoice> {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.id = 'continue-card';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Saved game');
    root.style.cssText = 'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(20,30,20,.85);font:16px/1.5 system-ui,sans-serif';
    const card = document.createElement('div');
    card.style.cssText = 'box-sizing:border-box;max-width:min(26rem,92vw);padding:18px 20px;border-radius:14px;background:#f6f1e4;color:#2a1f0e';
    const heading = document.createElement('div');
    heading.textContent = 'Welcome back';
    heading.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:6px';
    const text = document.createElement('p');
    text.style.cssText = 'margin:6px 0';
    text.textContent = `Your beaver is waiting. Last played ${when}.`;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;justify-content:space-between';
    const fresh = document.createElement('button');
    fresh.type = 'button';
    fresh.dataset.action = 'save-new';
    fresh.textContent = 'New game';
    fresh.style.cssText = `${BUTTON}background:#e3d6b0;color:#2a1f0e;`;
    const keep = document.createElement('button');
    keep.type = 'button';
    keep.dataset.action = 'save-continue';
    keep.textContent = 'Continue';
    keep.style.cssText = `${BUTTON}background:#2f6a30;color:#fff;`;
    row.append(fresh, keep);
    card.append(heading, text, row);
    root.appendChild(card);
    parent.appendChild(root);

    const done = (choice: StartChoice): void => {
      root.remove();
      resolve(choice);
    };
    keep.addEventListener('click', () => done('continue'));
    let sure = false;
    fresh.addEventListener('click', () => {
      if (sure) return done('new');
      // The first press only asks again.
      sure = true;
      text.textContent = 'Start over? Your saved beaver and its lodge will be gone.';
      fresh.textContent = 'Yes, new game';
      keep.textContent = 'Keep my game';
    });
  });
}
