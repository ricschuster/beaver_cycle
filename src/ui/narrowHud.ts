// On a phone held upright the clock, the life readout and the buttons at the top right would run into each other, most of all in
// German, whose words are longer. Below this width the clock, the life readout and the lines under it stack down the left side, under the buttons, clear of the minimap. Inline styles of the panels are beaten with !important. DOM only.

/** The screen width, in CSS pixels, up to which the top left readouts stack. */
export const NARROW_PX = 480;

export function narrowHudCss(): string {
  return `@media (max-width:${NARROW_PX}px){
#clock-hud{top:60px !important;max-width:calc(100vw - 164px);box-sizing:border-box}
#life-hud{top:100px !important;left:8px !important;transform:none !important;text-align:left !important;max-width:calc(100vw - 164px);box-sizing:border-box}
#carry-hud{top:152px !important;max-width:calc(100vw - 164px);box-sizing:border-box}
#coach{top:264px !important;width:calc(100vw - 16px) !important}
}`;
}

export function installNarrowHud(): void {
  const style = document.createElement('style');
  style.id = 'narrow-hud';
  style.textContent = narrowHudCss();
  document.head.appendChild(style);
}
