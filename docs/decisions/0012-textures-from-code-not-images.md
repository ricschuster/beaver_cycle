# Surface texture from code, not image files

## Status

Accepted (2026-10-16). The author looked at `/tools/texture-preview/` and chose B. Answers #458. Builds on
the art pass of #105, which chose per face colour without a decision on record.

## Context

The game has no image textures. Rocks, bark, logs, lodge and dam are low poly with one colour per face
(`src/render/propShapes.ts`). The ground has a small tiling noise laid by position (`groundDetail.ts`), and the animals have
64 px grain textures made in code (`modelKit.ts`). #458 asks whether image textures would be better, and what they cost.

The limits that matter: the tablet holds 90 fps up to about 3 million triangles with 2.5 million as the budget
(`docs/design/14_m2_streamed_core_plan.md`), memory is 170 to 177 MB with 65 MB of graphics, the release bundle is 16.4 MB,
the look is stylized and not photoreal (CLAUDE.md), and the players are children from 6 to 8.

## What was tried

`tools/texture-preview/` draws one boulder with moss and one log with two sticks, close up and from afar, three ways. The
textures are laid on by position and surface direction (triplanar), so no model needs UVs.

- **A**, today: one colour per face.
- **B**, a 64 px grey texture made in code, multiplied into the face colour.
- **C**, a 256 px grey image (`rock.png`, `bark.png`, 40 KB each, made by `make_textures.py`, own work, CC0), multiplied the
  same way. It stands in for an artist's or a CC0 image.

What it showed:

- Close up, bark gains most: furrows along the log make it read as wood. B and C both do it; C is sharper.
- Close up, rock: B gives soft cloudy patches that sit well with flat faces. C's cracks look like contour lines or camouflage,
  busier than the faceted style and more photographic.
- From a few metres on, A, B and C are hard to tell apart. Mipmaps average a texture to grey, so the gain is only in the
  close view, which is where the third person camera sits much of the time.

## Cost

| Item | Cost |
| --- | --- |
| GPU memory, RGBA with mipmaps | 64 px 0.02 MB, 256 px 0.33 MB, 512 px 1.33 MB, 1024 px 5.33 MB |
| A set of six surfaces at 256 px | about 2 MB, of the 65 MB of graphics |
| Bundle | about 40 KB per 256 px PNG, so a set of six is about 250 KB of 16.4 MB |
| Fill rate | triplanar reads 3 texels per pixel on the prop; the ground already reads 2 |
| Draw calls, triangles | none: the props keep their meshes and one material each |
| Loading | PNGs decode at start; code made textures cost a few ms and no download |

Memory and the bundle are not the problem at these sizes. The costs that are real are fill rate on the tablet (not measured,
see below), the look, and keeping every texture consistent in style.

## Licensing

Only own work or CC0 fits AGPL-3.0 and the Play Store without credit lines, and CC0 needs no credit. Anything CC-BY or from a
photo needs a credit page and a check of its terms. Code made textures need no licence at all.

## Decision

Stay with per face colour as the base, and do not add image files. Where close up detail is wanted, add small grey textures
made in code (as B), laid by position, starting with bark and rock, and keep them under 128 px. Revisit image textures only if
an artist supplies a whole consistent set in the stylized look.

Why: B gets most of the close up gain, matches how the animals and ground already work, adds nothing to the bundle and has no
licence to track. C looks more photographic than the scope allows, and each image file is another thing to keep in one style.

## Not decided here

- Whether to build bark and rock grain into the game. That is a separate change, with a frame rate check on a tablet.
- The beaver's fur, the lodge and the dam were not prototyped. Fur already has a code made grain.
- Fill rate on the tablet and a look judged on its screen. Run `npx vite --port 5203`, open `/tools/texture-preview/` on the
  tablet, and compare.
