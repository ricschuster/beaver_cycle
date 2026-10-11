# Notices and third party material

Beaver Cycle is Copyright (c) 2026 Richard Schuster, licensed under the GNU
Affero General Public License version 3 (`LICENSE`). That covers the source
code and the content the author made: design notes, the manual text, the
pictures and models drawn in code, and the sounds and music made in code.

Anyone who changes the game and lets others play it, including over a network
as a web page, must offer them the changed source under the same licence.

The material below is not covered by that licence. It keeps its own terms.

## Map data (ODbL)

Water and land cover in the game tiles (`public/tiles/`, published with the
site and in the `tiles` release) are derived from OpenStreetMap:
(c) OpenStreetMap contributors, Open Database License (ODbL) 1.0,
<https://www.openstreetmap.org/copyright>. These tiles are a derived database.
They stay under the ODbL: credit OpenStreetMap contributors and share any
changed version under the ODbL. The six pictures in `public/manual/` are drawn
from them.

## Terrain (CC BY 4.0)

Elevation comes from the BEV, Austria (Bundesamt fuer Eich- und
Vermessungswesen), Creative Commons Attribution 4.0
(<https://creativecommons.org/licenses/by/4.0/>), see
`docs/decisions/0002-terrain-source.md`. The terrain in the tiles is a
processed version of it.

## Sounds

The recordings in `public/audio/` are CC0, except one cheer clip (CC BY 4.0)
and three tree falling clips (CC BY 3.0). Source, author and licence of every
file are in `public/audio/CREDITS.md`. Those two credits must stay with any
copy of the files.

## Software

- three.js, MIT, Copyright (c) 2010-2026 three.js authors,
  <https://github.com/mrdoob/three.js>. Bundled into the built game.
- Build and test tools (Vite, TypeScript, Vitest, Playwright, Capacitor, and
  the Python tools with GDAL, numpy and Pillow) are used as installed from
  their own packages and are not part of this repository.
