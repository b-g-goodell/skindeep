# 0005 Skin isolation: data, not code

Status: accepted 2026-10-11, revised 2026-10-12 for skin sounds
(decision 0024).

## Context

A skin is a directory of a manifest, images, fonts and CSS. It runs no
scripts, since the app runs beside the user's credentials, and it may
not hide the identity strip or the terminal.

## Decision

- The main process reads and validates `skin.json` through fs. The
  renderer never fetches it.
- Skin files reach the renderer through a custom protocol `skin://`
  whose handler serves a file only when its realpath lies inside the
  selected skin's realpath and its extension is one of .css .png .jpg
  .gif .webp .svg .ttf .otf .woff .woff2, or the sounds .ogg .opus .mp3
  .wav of decision 0024, with byte ranges.
- CSP of the main window: `default-src 'none'`, `script-src 'self'`,
  `style-src 'self' 'unsafe-inline' skin:`, `img-src 'self' skin: data:`,
  `font-src 'self' skin:`, `media-src skin:`. No connect, no object, no
  frame.
- Skin CSS goes into a shadow root on a host element. The host sits
  inside an app-owned wrapper with `position: absolute; z-index: 0;
  isolation: isolate; contain: strict; overflow: hidden`. No skin
  selector reaches the wrapper (a `:host` rule with `!important` can
  restyle the host, never its parent), so nothing a skin paints escapes
  it.
- The identity strip and the terminal are siblings of the wrapper,
  outside the shadow root, with higher z-indexes.
- Fonts are registered by the app with the FontFace API from the
  manifest's font list.
- SVG is used only as an image (img or CSS url), never inline.
- Panel elements are divs the app creates, with class names the
  manifest gives, restricted to `[a-z0-9-]+`.

## Why

CSS cannot run script, and with no script source a skin can name, the
skin is inert data. Containment on an element no skin can select is the
only boundary `!important` in a shadow stylesheet cannot breach.

## Rejected

- Containment on the shadow host: `:host { ... !important }` overrides
  it.
- `@font-face` in skin CSS: it does not register inside a shadow root in
  Chromium.
- Serving .json or .txt through skin://: nothing in the renderer needs
  them.
