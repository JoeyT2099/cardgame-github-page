# Card Game Sandbox

Card Game Sandbox is a lightweight browser tabletop simulator built with React, TypeScript, and Vite. It is designed to run as a static GitHub Pages site with no backend server.

## Features

- Upload reusable image assets for cards, boards, tokens, decks, and miscellaneous table pieces.
- Save asset library, deck templates, current session, named sessions, and reusable game bundles in IndexedDB.
- Set one central board image.
- Create reusable deck templates from asset library images.
- Place deck instances on the board, shuffle/reset them, and draw random cards into player hands.
- Move, rotate, resize, flip, duplicate, delete, bring forward, and send back board objects.
- Create discard piles, colored tokens, image tokens, and generic placed images.
- Export/import game JSON with the required assets, deck templates, and table setup.
- Rotate the table locally to view it from any player's side, with local-only card hover readability.
- Use local mode fully in one browser.
- Optionally connect browsers with WebRTC DataChannels using manual offer/answer copy-paste signaling.

## Running Locally

```bash
npm install
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173/`.

## Building

```bash
npm run build
```

The static build is written to `dist/`.

## Deploying To GitHub Pages

This repo includes `.github/workflows/deploy.yml`. In GitHub:

1. Go to repository Settings.
2. Open Pages.
3. Set Source to GitHub Actions.
4. Push to `main`.

`vite.config.ts` sets the production base path to `/cardgame-sandbox/`, which is the correct GitHub Pages project path for this repository.

## Local Storage

The app uses IndexedDB in the browser. There is no server database, login, or backend API. Saved data is local to the browser profile unless exported as JSON or shared during a multiplayer session.

Stored locally:

- Asset Library
- Deck Templates
- Current Game Session
- Saved Game Sessions
- Saved Games

Starting a new session clears the table only. It does not delete uploaded assets or saved deck templates.

## Saved Games

Use `Save Game` to capture the current board game setup as a reusable game bundle. A saved game includes the current session, board image, placed decks, card state, discard piles, tokens, generic images, layers, required asset images, and required deck templates.

This lets you keep one setup for one card game and another setup for a different board or card game. Loading a saved game replaces the current table and adds any missing assets or deck templates to the local library.

Game exports are JSON files. Importing a game JSON loads that setup and stores it in the Saved Games list when the export is marked as a game bundle.

## Asset Library

Upload PNG, JPG/JPEG, WEBP, or GIF images. Assets can be renamed, categorized, deleted, reused as board images, used in decks, placed as tokens, or placed directly on the board.

Large images can consume browser storage and may sync slowly over WebRTC. A future version should add optional compression.

## Local Assets Vs Shared Session Assets

Local assets stay in your browser and are not sent to peers by default. When an asset is used by the active shared session, it becomes a shared session asset and can be sent to connected peers so they can render the same board, cards, tokens, and placed images.

The multiplayer MVP syncs only assets needed by the current session instead of broadcasting the entire private asset library.

## Creating Decks

Open `Create Deck`, choose existing card images or upload new ones, name the deck, optionally choose a card back, and save it. A deck template is reusable and is not consumed by drawing cards. Deck instances placed on the board have their own remaining-card list.

## Player Perspective

Use the `View From` selector in the hand panel to rotate the tabletop for a chosen player's side of the table. This is local-only and does not change the shared board state.

Object rotation still works as a normal game action and syncs to other users. Hovering a board card temporarily turns and enlarges it toward the local viewer for readability without changing how that card is displayed to other players.

## Starting A New Game

Use `New Session` to clear the board, hands, decks, discard piles, tokens, placed images, and active board image. Saved assets and deck templates remain available.

In multiplayer, the host should start the new shared session and sync it to connected clients.

## Hosting Multiplayer

1. Open `Multiplayer`.
2. Click `Host Game`.
3. Copy the generated offer code and send it to another player.
4. Paste the player’s answer code.
5. After the DataChannel opens, use `Sync Full Session` if needed.

The host is authoritative. Host-approved actions are broadcast to clients. Random draws should be resolved by the host so every peer gets the same result.

## Joining Multiplayer

1. Open `Multiplayer`.
2. Paste the host offer code.
3. Click `Generate Answer`.
4. Copy the answer code and send it back to the host.
5. Wait for the host to accept and sync the session.

## Multiplayer Asset Syncing

When the board, deck, token, or placed image references an asset, the host can send the required asset data to peers with a full session sync. New peers receive the session snapshot, required shared assets, and deck templates.

## Known Multiplayer Limitations

- GitHub Pages cannot run a backend.
- Manual WebRTC signaling requires copy/paste.
- Some networks require TURN servers, which are not included in this static MVP.
- Private hands are not implemented; all hands are visible.
- Browser storage has size limits.
- Large image uploads may sync slowly.
- Refreshing during multiplayer may require reconnecting.
- There is no public room browser.
- A future signaling server could add room codes, reconnects, usernames, and persistent online sessions.

## Future Improvements

- Real signaling server and optional TURN configuration.
- Room codes and reconnect support.
- Private hands and permissions.
- Asset compression and blob-backed storage.
- More precise discard/deck interactions.
- Multi-select and alignment tools.
- Better conflict handling for simultaneous edits.
