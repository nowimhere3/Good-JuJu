# Into the VORTEX · V1

A local-first contemplation card library. Vanilla JavaScript, CSS and IndexedDB; locally packaged PDF.js for PDF imports; no accounts, backend, analytics, remote fonts or paid services.

## Start locally

From this project folder, using Node.js 20.19+ or 22.13+:

```powershell
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:4173** in a modern browser. Keep the terminal running; use Ctrl+C to stop. Do not open `index.html` directly as a file. Always use the same browser profile and address: `localhost`, `127.0.0.1`, another port, and a future hosted URL each have independent storage. An Internet connection is not needed to run the local app.

## Your practice

- Use **Shuffle & draw**, **Reveal back**, and the star on the card. **Enlarge card** opens a distraction-free viewport view with the favorite star and compact flip, shuffle and details controls directly below the card. **Minimize** or Escape returns to the normal interface with the same card, side and filters. Card details opens above the enlarged view; closing it returns to reading. Long digital cards scroll inside their face.
- Use **Dark / Light** in the top bar to change the application's theme. The preference persists per browser/profile/origin in localStorage (`vortex-theme`) and is applied before styles are painted on the next visit. It is separate from the IndexedDB card library and personal backups. Scanned artwork and custom digital-card colors remain unchanged. Clearing site data resets the preference to light.
- “A fresh card each time” draws without replacement until the current filtered pool is exhausted. The current draw round starts again after refresh or a filter change.
- **Settings → Shuffle Effects** offers six distinct comet-trail presets: Light Sparkle (sparse/delicate), Classic Sparkle (balanced), Super Sparkle (brighter gold stars), Stardust Trail (many tiny fading particles), Prismatic Wave (gold/violet/teal/white), and Comet Shower (small streaks with bright heads and fading tails). Each progressively reveals the next card behind the moving boundary, with particles trailing into the already revealed area. All eight directions remain available. The same saved effects, direction and duration animate Reveal back / Show front in both readers. The opposite image is decoded before switching; flip and shuffle controls share a brief busy guard. Flips never draw a card or change the no-repeat round. Reduced motion switches faces directly.
- **Random Effect** and **Random Direction** are independent. **Surprise Me** selects both without changing duration. **Sparkle Reveal Duration** is 0.5–3.5 seconds in 0.1-second steps, default 1.1 seconds. Every animation timeline uses that selected duration; it is never randomized. Reduced motion skips the sweep. Effects remain clipped to the card.
- Settings sections expand/collapse independently. Controls edit a draft and show **Unapplied changes**. Press **Apply Settings** to save and see **✓ Settings Saved**. Closing Settings discards unapplied edits. Applied values affect the next shuffle without refreshing and persist per browser/profile. The same Settings dialog is available from the enlarged reader's small gear control.
- **Preview Effect** uses the draft effect/direction/duration and the current card's two faces on an isolated preview surface. It never draws another card, changes the active card or face, advances the no-repeat bag, writes card metadata, or saves the draft. Closing Settings, changing draft values, or collapsing Shuffle Effects cancels an active preview. Empty libraries disable preview.
- **Settings → Default Experience** chooses Normal View, Enlarged View, or **Remember Last Used View** (factory default). Apply the choice for the next visit. The actual last view is tracked separately when you enlarge/minimize. Startup restoration uses the already selected initial card without shuffling; empty collections stay in the normal interface. Explicit Enlarged startup still allows minimizing during that visit.
- **Decks** lists built-in and personal decks with active/total counts. Select a deck there or in the Deck selector to browse and shuffle it. **All Decks** or **Reset filters** clears deck selection. Favorites, Tags and Archive always span all decks. Deck selection is also shown in the enlarged reader.
- Create a personal deck in **Decks**, choose it in **Add Card** for any creation/import method, or change an existing card's assignment in **Card details**. Browser deck renames are personal display names: they never rename disk folders. Deck definitions, display-name overrides and assignments are included in personal backups. Existing personal cards without an assignment appear in **My cards** without modifying their stored records.
- **All Cards**, **Favorites**, **Tags**, the card-type selector and search determine both browsing and drawing. **Reset filters** returns to all active cards. Archived cards never participate in shuffling.
- Open a card from the collection, then **Card details** to rename it, add/remove comma-separated tags, archive/restore it, or edit both text faces and colors of a digital card. Scanned faces are kept intact.
- **Add Card → Digital card** creates a personal text card.
- **Add Card → Google Docs text** accepts copied text or an exported `.txt` file. First line = title/front; remaining paragraphs = back. Put `==========` on its own line between cards. Preview before importing. No Google sign-in is needed. `.docx` and direct Google Docs links are not import formats in V1.
- **Add Card → Physical pairs** accepts F1/B1, F2/B2, etc. with case-insensitive JPG, JPEG, PNG, WebP, GIF, BMP and AVIF extensions. Complete valid pairs appear with front/back previews. Problems are listed explicitly. Two-page PDFs are also supported, individually or alongside image pairs (see below). Convert TIFF scans to PNG before personal browser import. Future batches can reuse numbering; identity is based on both image contents, so existing cards are not overwritten and exact reimports are skipped.
- **Backup & restore** exports a JSON file containing personal cards, image data, favorites, tags, archive state, edits and shuffle preference. Restore validates the complete file and decodes both faces of personal image cards before offering a merge. Matching IDs take backup values; other cards remain. R1 image files are distributed with the application and are not duplicated inside personal backups. Keep the app/master assets together with backups for complete reconstruction.

## Storage and portability

`data/cards.json` is the generated master catalog. R1 retains stable IDs `r1-001` through `r1-058`; new master card IDs combine the permanent deck ID with the card number. `assets/cards/<deck-id>/` holds display assets. The original `Vortex Cards-R1/` is unchanged. The active deck is indexed in `All Decks/Vortex Cards R1/` with manifest ID `r1`. `data/r1-inventory.json` retains original checksums; `data/deck-index-report.json` records indexed deck/card counts, issues and source hashes. Fronts 32 and 37 now use genuine JPEG sources rendered at 300 DPI, quality 95, without chroma subsampling. Their original PDFs remain in the R1 backup; `data/r1-jpeg-conversions.json` records provenance and checksums without changing the original integrity inventory. Other R1 display assets are exact source copies.

IndexedDB database `into-the-vortex`, version 1, contains the `personal` store. A single transactional library record contains user cards, metadata overlays keyed by stable card ID, and preferences. Optional additive `decks`, `deckNames` and `deckId` fields support personal organization; there is no destructive schema migration. Existing records and V1 backups still work without those fields. Image faces of personal imports are embedded data URLs, including in backups. Master metadata is never written into the master JSON. On every load the app merges the latest master with personal overlays, so new packaged cards appear without replacing personal changes. BroadcastChannel refreshes open tabs after a successful write; write transactions read the latest stored record to preserve unrelated concurrent updates.

Each browser profile has its own collection. There is no automatic synchronization between users, devices, browsers, or origins. Browser data can be removed by clearing site data or private browsing expiration. Export regularly. The app reports storage/write failures instead of claiming a successful save.

Applied reveal/startup settings use one atomic localStorage entry, `vortex-preferences-v2`. Existing `vortex-reveal-direction` and `vortex-reveal-seconds` values are read as a compatibility fallback until the first Apply; they are not deleted. Theme (`vortex-theme`) and actual last mode (`vortex-last-view`) remain separate. These browser preferences are not part of card-library backups. Settings do not migrate or rewrite IndexedDB card data.

V1 stores images as base64 for straightforward portable backups. Large libraries use more storage/memory than raw images. Personal import limits: 30 MB per image/PDF file, 120 MB selected batch, 100 MB rendered preview, and 200 MB projected personal library; text import: 5 MB; backup restore: 250 MB. Actual available storage depends on the browser/device. No OCR or invented scan content is used; image-pair cards start with numeric titles and PDF cards with filename titles, which you can rename. No offline service worker or installable PWA is included; the local server must be running, or the static site reachable, to open the application.

## Project structure

- `app/`: UI, library rules, IndexedDB adapter and styles.
- `data/`: master library and source inventory.
- `assets/cards/r1/`: packaged image assets.
- `All Decks/`: physical deck source folders, each with a permanent `deck.json` manifest.
- `tools/`: local server, build-time deck indexer, safe rename and migration utilities.
- `tests/`: unit tests and desktop/Android-emulated browser workflows.

## Checks and static packaging

```powershell
npm ci
npx playwright install chromium
npm test
npm run test:browser
npm run build
```

`dist/` contains only the static app, data and display assets. All URLs are relative and work under a static host subpath. **Commercial assets are private. Any eventual GitHub repository must be PRIVATE. Do not enable GitHub Pages or use public hosting.** No repository, hosting or publication is configured by these commands. Any future host must enforce access control; private repository visibility alone does not protect a separately hosted site.

The development server binds only to this computer's loopback address. Android layout and touch behavior are covered by Chromium Pixel 7 emulation; no physical Android device was connected for testing. Use a future static host or an intentionally configured LAN server for real-device access. Transfer a backup if moving from a local address to hosting.

## Add and index master decks

The initial R1 migration has already run. It copied and verified all 116 originals without moving or renaming the original folder. `npm run migrate:r1` is the repeat-safe migration utility; it reports an existing `r1` registration without creating another deck.

To add a deck:

1. Create a physical subfolder inside `All Decks/`, for example `All Decks/Future Deck/`.
2. Drop two-page PDF cards, complete F/B pairs, or both into it: `F1.jpg`, `B1.jpg`, `f2.PNG`, `b2.png`, etc. Numbers may repeat across decks. Do not place Favorites or Tags folders here.
3. Run `npm run index:decks`, or `npm run build` to index and package in one step. The first successful scan writes a `deck.json` with `schemaVersion: 1`, an automatically generated permanent `deck-<UUID>` ID, and the folder name as its initial title. **Keep that manifest with the source folder permanently. Never regenerate or change the ID.** You can supply the same explicit schema before first indexing with a unique UUID.
4. During local use, open **Decks** and press **Scan All Decks** instead of running a command. The button discovers new folders, renders PDF faces, updates the catalog, and refreshes the deck list and counts automatically. It preserves your current selection and browser data and does not draw a card. Progress, new deck/card counts, and validation errors appear below the button. Repeated scans preserve identities and skip unchanged PDF rendering. The server must be running the current `npm start` code; restart once if upgrading an already running older server. The CLI workflow remains available for packaging.

Scanning is local-only: the server binds to loopback, requires a local Host, same-origin POST, JSON body with no paths/options, and a session token. Only the configured project's `All Decks/` directory is indexed; filesystem browsing is not supported. Only one scan runs at a time. Validation and rendering finish before new manifests or the catalog are published, so failed validation preserves the current library. Correct the listed source problems and scan again. Static hosting and `SERVE_DIST=1` disable the endpoint; the button explains that local scanning is unavailable. Static packages still use `npm run build`.

Pairing is case insensitive for F/B names and extensions. JPG/JPEG, PNG, WebP, GIF, BMP and AVIF copy directly; Legacy single-page F/B PDF faces and TIFF master sources are converted to PNG with the Python dependencies below. Standalone two-page PDFs are complete cards, as described below. TIFF sources must have one frame. The two legacy R1 PDF fronts have already been converted to JPEG sources, so rebuilding R1 needs only Node. For new PDF/TIFF decks:

```powershell
python -m pip install -r tools/requirements.txt
npm run build
```

Missing partners, duplicate deck/card identities, numeric naming conflicts (including F1/F01 duplicates), unsupported assets, invalid manifests and missing previously indexed cards block catalog replacement. The report lists problems; the previous catalog remains available. No source files or stale generated assets are deleted. Correct problems and rerun. Only generated image outputs and the catalog are updated. Removing previously indexed master cards/decks is intentionally not supported by this non-destructive workflow; archive cards in the browser instead.

## Rename master decks safely

In the browser, **Decks → Rename** changes only your own display name and is backed up with your personal data.

To change the packaged master title and optionally its physical folder, run from the Game root:

```powershell
npm run rename:deck -- r1 "Vortex Cards R1" "Vortex Cards R1"
npm run build
```

Replace `r1` with the deck's permanent ID from `deck.json`, then supply a title and optional new single folder name. The utility checks that source and destination remain direct children of `All Decks/`, refuses an occupied destination, and preserves the manifest ID. It never renames `Vortex Cards-R1/`. You can also edit only `deck.json`'s `title`, keeping its ID unchanged, then rebuild. Personal title overrides remain in place until you rename them in that browser.

`npm run import:r1` and the old Python importer entry point now delegate to the deck indexer, preventing the previous single-deck importer from replacing a multi-deck catalog.

## Multi-format Card Importer V2

Supported methods share the existing deck library and physical/digital card model: F/B image pairs, complete two-page PDF cards, Google Docs pasted/exported text with the unchanged `==========` separator, and custom front/back digital cards. All retain deck assignment, shuffle, favorites, tags, archive/restore, details, themes, normal/enlarged viewing and sparkle reveals. Future structured text adapters can feed the existing digital-card import path; no quote-engine integration is included.

### Add a PDF deck from disk

Create `All Decks/Manifestation Deck/` and put `Card001.pdf`, `Gratitude.pdf`, etc. inside it. Every standalone PDF must contain **exactly two pages**: page 1 is front, page 2 is back. You can include image pairs in that same folder. Install Python dependencies with `python -m pip install -r tools/requirements.txt`, then run `npm run build`. Keep the resulting permanent `deck.json` and `data/cards.json` catalog; the latter retains source identity history. Reload the application to see the new deck.

Build-time rendering uses local **PyMuPDF** (`tools/pdf-card.py`), alongside the existing Pillow conversion for TIFF. Neither process modifies original sources. Pages render as lossless PNGs at 144 DPI, bounded to 2400 pixels on the longest edge, respecting page rotation and aspect ratio. No OCR or conversion service is used. Per-PDF limit is 30 MB, with a 60-second renderer process timeout. The existing dependency versions are listed in `tools/requirements.txt`.

Standalone PDF detection is case insensitive and allows descriptive or numbered filenames. For compatibility, an `F<number>.pdf` or `B<number>.pdf` with an opposite numbered face is treated as a **legacy single-page face pair**. A two-page PDF using one of those ambiguous pair names is rejected instead of replacing a paired card. Prefer descriptive PDF names such as `Card001.pdf`.

New master PDF identities are namespaced by permanent deck ID plus `pdf-` plus a SHA-256 source identifier. Existing F/B IDs and all R1 IDs stay unchanged. Rebuilds reuse PDF image derivatives when the source is unchanged. Byte-identical PDF copies within a deck are reported as duplicates. The same source may deliberately exist in different decks. A PDF rename preserves identity by source hash; replacing its contents at its existing filename preserves identity by the saved filename association. Rename and edit in separate successful builds. Renaming the whole folder preserves identity when its manifest stays with it. Filename/hash ambiguity, duplicate identities, missing old cards, incorrect page counts, encrypted files, unreadable/corrupt PDFs and unsupported files block catalog replacement, with details in `data/deck-index-report.json`. The indexer never silently deletes old cards or original files.

### Import personal PDFs in the browser

Run `npm run build` at least once to package the local renderer. Open **Add Card → Physical pairs**, select a target deck, and choose one or more PDFs (optionally alongside F/B images). The preview shows filenames, front then back thumbnails, target deck and validation errors. Change the target deck if needed, then press **Import previewed cards**. Only valid cards shown in the preview are imported; rejected files are listed for correction. Nothing is stored until confirmation.

Browser conversion uses the pinned **PDF.js 5.4.624** distribution copied from `node_modules` to generated `assets/pdfjs/` by the build, including its worker, fonts, CMaps and WASM decoders. Assets are served locally and included in `dist/`; no CDN or external conversion calls are needed. The implementation follows the [official PDF.js loading/rendering examples](https://mozilla.github.io/pdf.js/examples/). Original files selected from your device are not changed. Browser imports store both rendered PNG faces in the existing IndexedDB record, rather than retaining a second copy of the source PDF. Keep your original PDF files separately.

Browser limits are 30 MB per file, 120 MB selected source batch, 100 MB rendered preview and 200 MB projected personal library, plus available browser quota. Rendering has a 60-second timeout per PDF. Imported pages use the same resolution bounds as master PDFs. A new selection invalidates the old preview. Identical PDF bytes, including renamed copies, have the same personal identity and are skipped on reimport. Different bytes are treated as a new personal PDF card; PDF and image-pair identities cannot overwrite one another. Duplicate items within a selection import once. No destructive IndexedDB migration is required.

**Backup & restore** includes personal PDF cards' front/back images automatically in the existing image-inclusive JSON format; original PDF files are not embedded. The existing 250 MB restore limit remains. Restore validates and decodes both images before confirmation. Master PDF cards are packaged by the build, while their personal favorite/tag/archive/deck overrides are included in backups.

Run `npm test` and `npm run test:browser` for unit and desktop/Pixel 7 Android-emulated regressions. PDF fixtures are generated locally in temporary test locations; the production R1 deck stays at 58 cards. Physical Android hardware and arbitrary scanner-specific PDFs require real-device/source checks; encrypted or damaged documents should be re-exported as clean, unencrypted two-page PDFs.
