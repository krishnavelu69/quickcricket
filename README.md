# QuickCricket prototype

A mobile-friendly cricket scoring PWA prototype. This version stores matches in the browser's local storage. It does **not yet** provide cloud sync, spectator live links, user accounts, batter/bowler scorecards, or production-grade cricket rule coverage.

## Run locally

1. Extract the project folder.
2. Open a terminal in this folder.
3. Run a local web server, for example with Python installed:
   `python -m http.server 8000`
4. Open `http://localhost:8000` in your browser.

Service workers and installable PWA behavior require localhost or HTTPS. Opening `index.html` directly still allows basic local scoring, but offline caching won't be enabled.

## Before real-world use

This is an early prototype and must be tested. In particular, review wicket rules, strike rotation, extras, innings transitions, undo behavior and data recovery before using it to publish official match scores. The current wicket action assumes a legal delivery; the prototype does not yet track batter-by-batter or bowler-by-bowler figures.
