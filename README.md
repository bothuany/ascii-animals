# ASCII Animals

Swarms of animals drawn from keyboard characters. One folder, one engine (`engine.js`), two hosts. No dependencies, and no build step to run it (packaging for the stores is under Publishing).

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

- **Animal** (never random) and **Name** for the greeting.
- **Tweaks**, in four groups. **Reset** puts every tweak back to its default (animal and name stay); **Copy** puts the settings JSON on the clipboard.
  - *Movement*: Density (how many), Corner to corner (head along the screen diagonal; disables Direction), Direction (degrees, counter-clockwise from right: 90 = up), Speed, Sway (weaving), Spread (individual headings fan out), Size (body size), Farthest depth (size of the farthest layer), Far bias (more of them far away), Hold course (how fast they return to the heading after a scatter or a wobble), Separation (how strongly neighbours keep apart).
  - *Flight*: Flutter (erratic jitter), Glide (spells of held wings / coasting; frogs and crabs: longer pauses), Flap rate (wing beat, pulse, tail beat, hop and leg speed).
  - *Look*: Hue shift, Shimmer (a drifting band of lighter tiles), Sparkle (single tiles flashing), Distance fade (far ones fade into the background), Trail (wake length), Trail fade (how fast the wake fades), Grid (grid line strength), ASCII detail (smaller character cells), Background (0 = near-black, 1 = white, in between greys; glyphs, grid and the new tab text follow it).
  - *Chat glass* (new tab search panel only): Blur, Refraction, Ripple, Tint, Edge, Corner radius, Width. Refraction and Ripple drive an SVG displacement filter in `backdrop-filter` (approximate; marked "approx." in the settings).
  One set of tweaks applies to every species; each value scales that species' own default.
- **Clear search history** removes the recent searches.

Settings saved by older versions (`count`, a 6-20 character `size`, `trail` on/off, `random` animal) are mapped to the new ones.

### Search box

- Enter searches with Chrome's default search engine (`chrome.search`); something that looks like a URL is opened directly.
- **Suggestions** appear while typing (arrow keys move, Enter runs the highlighted one or the typed text, Escape closes). They come from `https://suggestqueries.google.com/complete/search?client=chrome&q=...`: **the text in the box is sent to Google as you type** (after a 150 ms pause, no cookies). This is the extension's only host permission. Failures are silent.
- **Recent searches** (up to 50, stored locally in `chrome.storage.local`, never synced) show when the box is empty and focused, and first among the suggestions while typing; each has a remove button.
- **Voice search** (microphone button, shown when the browser supports speech recognition): words appear as you speak and the final result is searched. Chrome's speech recognition sends the audio to Google.
- **Search by image** (lens button): opens Google's image upload dialog (`https://www.google.com/?olud`), or, if the box holds an image URL (`.png .jpg .jpeg .webp .gif`), searches that image with Google Lens.

Permissions: `storage` (settings and recents), `search` (default search engine), host access to `suggestqueries.google.com` (suggestions).

## Wallpaper Engine

1. In the Wallpaper Editor choose **Create Wallpaper** and drop `wallpaper.html` onto it (or pick it with the file dialog). Wallpaper Engine **copies** the folder into `...\projects\myprojects\`. After editing `engine.js` here, re-import (or copy the file into that folder).
2. Select the wallpaper in the **Installed** tab. Settings are on the right: animal plus the Movement, Flight and Look tweaks (defined in `project.json`, keys are the tweak names in lowercase, e.g. `farbias`). The FPS limit from Wallpaper Engine's performance settings is respected.

## Preview without a host

Both hosts draw the same background: a faint grid of character-shaped cells, animals built from glyph tiles that travel together along one heading (small, dim ones further back), spaced apart; where two overlap, the nearer one is drawn whole with a one-cell gap around it. A click turns nearby animals away before they rejoin the flock; koi get food instead and bend toward it.

The whole scene scales with the window width: the grid is 160 cells wide at the default ASCII detail (so a cell is about 5 x 7 px in a 760 px window, 9 x 13 at 1440, 12 x 17 at 1920), animals keep their size in cells, and the number of animals does not depend on the window. Density multiplies the count; a Size above the default divides it by Size squared (bigger bodies, fewer of them), which also keeps the drawing cost bounded.

Open `wallpaper.html` (or `newtab.html`) from a local static server, with optional overrides using the tweak names:

    wallpaper.html?animal=koi&density=2&speed=1.5&size=1.6&direction=90&trail=0&hue=40

`animal` is one of `butterfly jellyfish dragonfly koi frog crane crab` (default `butterfly`; `bird` is accepted as an old name for `crane`). Values are clamped to the slider ranges. Without the extension, `newtab.html` searches go to google.com, recents are kept in memory only, and suggestions are blocked by CORS (they work inside the extension).

## Publishing

    node tools/build.js

This clears and rebuilds `dist/` and fails if a required file (manifest, icons, `preview.gif`, ...) is missing or an HTML reference does not resolve:

- `dist/ascii-animals-extension.zip` (and the unpacked `dist/extension/`): upload this to the Chrome Web Store.
- `dist/wallpaper/`: import this folder (not the project folder) into Wallpaper Engine before sharing to the Workshop, so the demo video and extension files are not uploaded with it.

Store text, permission justifications, data-usage answers and the checklist of manual steps are in `store/listing.md`; the privacy policy to host at a public URL is `PRIVACY.md`.

## Check

    node test.js
