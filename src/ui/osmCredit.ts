// The map data credit (NOTICE.md): the water and land cover come from OpenStreetMap, whose licence (ODbL) asks for a
// credit that the player can see and follow. A small line along the bottom edge, always on the screen. DOM only.

export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

export function createOsmCredit(parent: HTMLElement): HTMLElement {
  const box = document.createElement('div');
  box.id = 'osm-credit';
  box.style.cssText =
    'position:fixed;left:50%;bottom:max(2px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:5;padding:0 8px;border-radius:6px;' +
    'background:rgba(0,0,0,.35);font:11px/16px system-ui,sans-serif;color:#fff;white-space:nowrap;pointer-events:none;';
  box.append('Map data © ');
  const link = document.createElement('a');
  link.href = OSM_COPYRIGHT_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'OpenStreetMap contributors';
  link.style.cssText = 'color:#fff;pointer-events:auto;';
  box.append(link);
  parent.appendChild(box);
  return box;
}
