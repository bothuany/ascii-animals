# ASCII Animals

![ASCII Animals as a new tab page: koi, butterflies and jellyfish drawn from keyboard characters drift behind a search box](store/preview-browser.gif)

Swarms of animals drawn from keyboard characters. One folder, one engine (`engine.js`), two hosts. No dependencies, and no build step to run it (packaging for the stores is under Publishing). How it is put together is under How it works.

## Install

Download the files from the [latest release](https://github.com/bothuany/ascii-animals/releases/latest).

**Chrome, Edge or Brave (new tab page)**

1. Download `ascii-animals-extension.zip` and unzip it somewhere you will keep it (the browser loads it from that folder).
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder.
4. Open a new tab. If the browser asks whether to keep the new tab page, choose **Keep it**.
5. Click the extension's toolbar icon to change the animal and the look.

To update, download the new zip, replace the folder's contents and press the reload button on the extension's card.

Chrome adds a footer bar with the extension's name to any new tab page an extension replaces. The extension cannot remove it, but you can: click **Customize Chrome** in that bar, find **Footer** in the side panel and turn off showing the footer on the New Tab page.

**Wallpaper Engine (desktop wallpaper)**

1. Download `ascii-animals-wallpaper.zip` and unzip it.
2. In Wallpaper Engine open the **Wallpaper Editor**, choose **Create Wallpaper** and pick `wallpaper.html` from the unzipped folder.
3. The animal and the look are in the wallpaper's properties panel.

## Chrome new tab (from this folder)

1. Open `chrome://extensions`, turn on **Developer mode**.
2. **Load unpacked** and pick this folder.
3. Open a new tab. Chrome gives the address bar focus first on a new tab, so click the search box (or press Tab) before typing.

### Settings

Click the extension's toolbar icon: the settings open as a popup (the same page is also under **Details -> Extension options**). Changes are saved to `chrome.storage.sync` at once (slider drags after a short pause) and open new tabs update live. There are no controls on the new tab itself.

- **Animal** (Butterfly, Koi, Jellyfish, Dragonfly, Frog, Crane, Crab; never random) and **Name** for the greeting.
- **The animal's tweaks**, grouped as in the original's panel and rebuilt when you pick another animal. Each animal has its own values and remembers them while you look at another one. Movement (Density, Corner to corner, Direction, Speed, Sway, Spread, Size, Farthest depth, Far bias, Hold course, Separation), then the animal's own group (Flight: butterflies, dragonflies and cranes; Swimming and Feeding: koi; Swimming: jellyfish; Leaping: frogs; Scuttling: crabs), then Look (Hue shift, Shimmer, Sparkle, Distance fade, Trail, Trail fade, Grid, ASCII detail). A few shared tweaks are not shown for an animal that does not use them (Hold course for frogs, Shimmer for jellyfish and dragonflies). Hover a control for the original's explanation. The defaults are the original's, per animal, so every animal looks as it does in the original at its defaults.
- **Background**: 0 = the original's dark background, 1 = white, greys in between. The animals' colours, the grid and the new tab text follow it (see How it works).
- **Chat glass** (new tab search panel only; the same for every animal): Blur, Refraction, Ripple, Tint, Edge, Corner radius, Width. Refraction and Ripple drive an SVG displacement filter in `backdrop-filter` (approximate; marked "approx." in the settings).
- **Reset** puts the selected animal's tweaks, the background and the glass back to their defaults (animal, name and the other animals' tweaks stay). **Copy** puts the settings JSON on the clipboard. **Clear search history** removes the recent searches.

Settings saved by older versions (flat relative tweaks such as `density` or `hue`, `count`, a character `size`, `trail` on/off, singular animal ids, `random`) are migrated: the animal, name, background and glass values are kept, the old relative animal tweaks are dropped (they do not map onto the per-animal values).

### Search box

- Enter searches with Chrome's default search engine (`chrome.search`); something that looks like a URL is opened directly.
- **Suggestions** appear while typing (arrow keys move, Enter runs the highlighted one or the typed text, Escape closes). They come from `https://suggestqueries.google.com/complete/search?client=chrome&q=...`: **the text in the box is sent to Google as you type** (after a 150 ms pause, no cookies). This is the extension's only host permission. Failures are silent.
- **Recent searches** (up to 50, stored locally in `chrome.storage.local`, never synced) show when the box is empty and focused, and first among the suggestions while typing; each has a remove button.
- **Voice search** (microphone button, shown when the browser supports speech recognition): words appear as you speak and the final result is searched. Chrome's speech recognition sends the audio to Google.
- **Search by image** (lens button): opens Google's image upload dialog (`https://www.google.com/?olud`), or, if the box holds an image URL (`.png .jpg .jpeg .webp .gif`), searches that image with Google Lens.

Permissions: `storage` (settings and recents), `search` (default search engine), host access to `suggestqueries.google.com` (suggestions).

## Wallpaper Engine

1. In the Wallpaper Editor choose **Create Wallpaper** and drop `wallpaper.html` onto it (or pick it with the file dialog). Wallpaper Engine **copies** the folder into `...\projects\myprojects\`. After editing `engine.js` here, re-import (or copy the file into that folder).
2. Select the wallpaper in the **Installed** tab. The properties (defined in `project.json`) are a shorter set than the extension's settings: the full per-animal tweak panel is in the browser extension. The wallpaper has **Animal**, **Background**, and these, which act on the selected animal and are relative to its original defaults (1 = the original look): **Density**, **Speed**, **Size**, **Trail**, **Grid** and **ASCII detail** are multipliers (the result is clamped to the original's range; an animal whose default is 0, like the crane's trail, stays at 0), and **Hue shift** is in degrees. Wallpaper Engine's FPS limit is respected.

## How it works

`engine.js` is the original app's animation engine, carried over unchanged, plus a thin wrapper (about 210 lines at the end of the file). The engine is one generic flock simulation and renderer with a definition object per animal (shape, motion, colours, and the list of tweaks it has); the wrapper adds the settings, the background tone and `start()`. Lines marked `patch` inside the carried-over code are the only changes: an FPS limit, pausing while the page is hidden, the palette hook for the background tone (with a colour cap on light backgrounds), and guards for browsers that lack `ResizeObserver`, `IntersectionObserver` or `matchMedia`.

- **Settings** are `{ animal, name, background, tuning, glass }`. `tuning` is `{ <animal>: { <key>: value } }` and holds only the values that differ from that animal's defaults. `AsciiAnimals.normalize()` clamps and snaps everything, drops unknown keys and migrates older settings. The tweak list of each animal (`AsciiAnimals.TWEAKS`) is read from the carried-over definitions, so the settings page, the tests and the engine cannot disagree.
- **Background tone**: the background is the original dark one mixed toward white. At 0 the renderer gets the original dark palette untouched. Above 0 it gets the original light or dark palette, whichever has more contrast for its ink against the actual background, with the background colour replaced. On the light palette any colour brighter than a cap (about 2.5:1 against the background, `CAP_CONTRAST` in `engine.js`) is darkened, keeping its hue, and glyphs that the original brightens over their tile are darkened instead.
- **Fonts**: Geist and Geist Mono (SIL OFL 1.1) are bundled in `fonts/` and declared with local `@font-face` rules; nothing is loaded from the network. The animals are drawn in Geist Mono SemiBold (the canvas's CSS `font-family`), the new tab text is Geist. See `THIRD_PARTY.md` and `fonts/OFL.txt`.
- **Hosts**: `newtab.html` + `newtab.js` (the greeting, the search box, the glass panel) and `wallpaper.html` only create a canvas and call `AsciiAnimals.start(canvas, settings)`, which returns `{ update(settings), setFps(n), destroy() }`. Clicking the scene startles the animals (the new tab overlay lets clicks through to the canvas). With `prefers-reduced-motion` the scene is one still frame.

## Preview without a host

Open `wallpaper.html`, `newtab.html` or `options.html` from a local static server, with optional overrides. Here a tweak key is an absolute value for the chosen animal:

    wallpaper.html?animal=koi&background=0.5&speed=1.4&trail=2

`animal` is one of `butterflies koi jellyfish dragonflies frogs cranes crabs` (default `butterflies`; the singular names of earlier versions, such as `butterfly` or `bird`, are accepted). Values are clamped to the slider ranges; keys the animal does not have are ignored; glass keys (`blur`, `width`, ...) and `name` work on the new tab page. Without the extension, `newtab.html` searches go to google.com, recents are kept in memory only, and suggestions are blocked by CORS (they work inside the extension).

## Publishing

    node tools/build.js

This clears and rebuilds `dist/` and fails if a required file (manifest, icons, `preview.gif`, ...) is missing or an HTML reference does not resolve:

- `dist/ascii-animals-extension.zip` (and the unpacked `dist/extension/`): upload this to the Chrome Web Store.
- `dist/wallpaper/`: import this folder (not the project folder) into Wallpaper Engine before sharing to the Workshop, so the demo video and extension files are not uploaded with it.

Store text, permission justifications, data-usage answers and the checklist of manual steps are in `store/listing.md`; the privacy policy to host at a public URL is `PRIVACY.md`.

## Check

    node test.js
