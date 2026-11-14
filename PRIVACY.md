# ASCII Animals: Privacy Policy

Last updated: 2026-11-15

This policy covers two products with the same name: the **ASCII Animals** Chrome extension (it replaces the new tab page) and the **ASCII Animals** wallpaper for Wallpaper Engine.

In short: there are no accounts, no analytics, no ads and no servers run by the developer. Nothing you type or set is sent to the developer. The only data that leaves your computer goes to Google (for search suggestions, voice search and image search) or to your default search engine (for the searches you run), and only when you use those features.

## Chrome extension

### What the extension stores

| Data | Where | Details |
| --- | --- | --- |
| Settings: chosen animal, the optional name used in the greeting, and the slider and checkbox values | `chrome.storage.sync` | If you are signed in to Chrome with sync turned on, Chrome syncs these settings between your devices through your Google account. The developer has no access to them. |
| Recent searches (up to 50) | `chrome.storage.local` | Stays on this device and is never synced. Remove one entry with its x button, remove all of them with **Clear search history** in the extension's settings, or uninstall the extension. |

Address-like input (for example `example.com`) is opened directly and is not added to recent searches.

### What is sent over the network, and when

1. **Search suggestions.** While you type in the search box, the text in the box is sent to `https://suggestqueries.google.com/complete/search?client=chrome&q=...` to get suggestions. This happens about 150 ms after you stop typing. It is sent without cookies, over HTTPS, and Google also receives what every web request carries (your IP address and browser details). Nothing is sent when the box is empty, when the text looks like a web address, or when it is longer than 100 characters. The suggestions are shown in the dropdown and are not stored. This is Google's own service and is governed by [Google's Privacy Policy](https://policies.google.com/privacy).
2. **Your searches.** When you press Enter or pick a suggestion, the search is run through Chrome's `chrome.search` API with your default search engine. Which engine receives it, and what it does with it, depends on the engine you chose in Chrome's settings. The extension does not see the results.
3. **Voice search.** The microphone button uses the browser's built-in speech recognition (`webkitSpeechRecognition`). Chrome asks for microphone permission first, and the microphone is only on after you click the button. The extension never receives or stores audio. In Chrome, speech recognition may send the audio to Google's speech service to be turned into text; that is Chrome's own behaviour and is covered by Google's policies, not by the extension. The recognised text is then searched like typed text.
4. **Search by image.** The image button opens a Google page in the current tab (the Google image upload dialog, or Google Lens if the search box holds a link to an image). If the box holds an image link, that link is passed to Google Lens in the page address. No image files are read or uploaded by the extension.

The extension runs no remote code: every script it uses ships inside the extension package.

### What the extension does not do

- It does not read the pages you visit, your browsing history, bookmarks or tabs.
- It does not use analytics, tracking, advertising, or crash reporting.
- It does not create accounts or ask for personal information. The name in the settings is optional, is only used to greet you on the new tab page, and stays in your Chrome storage.
- It does not sell or share data, and it does not send data to the developer.

### Permissions

- `storage`: saves your settings and recent searches.
- `search`: runs your searches with your default search engine.
- `https://suggestqueries.google.com/*`: fetches search suggestions as described above.

## Wallpaper Engine wallpaper

The wallpaper draws its animation locally. It makes no network requests, stores nothing and collects nothing. Its settings are the Properties panel of Wallpaper Engine, which Wallpaper Engine and Steam handle under their own terms and privacy policies.

## Chrome Web Store user data policy

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements. Data handled by the extension is used only to provide its single purpose (the new tab page with its search box), is not transferred to third parties other than as described above to provide the search features, is not used for advertising, and is not read by humans.

## Children

The extension and wallpaper do not knowingly collect any personal information from anyone, including children.

## Changes

If this policy changes, the new version will be published at this address with a new date.

## Contact

https://github.com/bothuany/ascii-animals/issues
