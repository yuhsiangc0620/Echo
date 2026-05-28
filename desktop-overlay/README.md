# Echo Desktop Overlay Prototype

Run:

```bash
npm run overlay
```

The Electron window is transparent, frameless, always-on-top, and mouse-through by default. It asks for microphone permission, checks screen-recording access for wrapping screenshots, loads MediaPipe Audio Classifier, and keeps audio in RAM only.

## Product Rules

- `Keyboard_heavy`: MediaPipe labels like `Computer keyboard` / `Typing`, score >= `0.72`, local aggregation reaches `40:00`, then drop candy.
- `Mouse_click`: MediaPipe labels like `Clicking` / `Mouse click`, score >= `0.65`, high-frequency click aggregation reaches `10:00`, then drop candy.
- `Sigh`: MediaPipe label `Sigh`, score >= `0.68`, continuous event reaches `1.4s`, then drop candy.
- Ambient classes such as `Speech`, `Music`, `Air_conditioner`, `Traffic`, and `Door_knock`: recognized and accumulated as soundscape context for candy variety and history.
- `Silence`: tracked as low-activity state only. It never drops candy.

## Debug Hotkeys

Debug hotkeys are disabled by default for tester builds. Launch with `ECHO_DEBUG_SHORTCUTS=1 npm run overlay` to enable them.

- `Cmd/Ctrl + Alt + E`: direct keyboard candy drop.
- `Cmd/Ctrl + Alt + W`: direct wrapped sigh candy drop.
