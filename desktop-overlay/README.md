# Echo Desktop Overlay Prototype

Run:

```bash
npm run overlay
```

The Electron window is transparent, frameless, always-on-top, and mouse-through by default. It asks for microphone permission, checks screen-recording access for wrapping screenshots, loads MediaPipe Audio Classifier, and keeps audio in RAM only.

## Status Dashboard

- Open the Echo app, click the Echo tray icon, or press `Cmd/Ctrl + Alt + D` to view the desktop status dashboard. The shortcut still toggles it for quick checks.
- The dashboard shows microphone permission, screen-recording permission, open-at-login state, current user, MediaPipe status, recent sound classes, and local aggregation progress.
- The overlay remains mouse-through when the dashboard is closed.

## Product Rules

- `Keyboard_heavy`: MediaPipe labels like `Computer keyboard` / `Typing`, score >= `0.68`, local aggregation reaches `20:00`, then drop candy.
- `Mouse_click`: MediaPipe labels like `Clicking` / `Mouse click`, score >= `0.58`, high-frequency click aggregation reaches `05:00`, then drop candy.
- `Sigh`: MediaPipe label `Sigh`, score >= `0.62`, continuous event reaches `1.0s`, then drop candy.
- Ambient classes such as `Speech`, `Music`, `Air_conditioner`, `Traffic`, and `Door_knock`: recognized and accumulated as soundscape context for candy variety and history.
- `Silence`: tracked as low-activity state only. It never drops candy.

## Debug Hotkeys

The keyboard candy test shortcut is enabled in tester builds.

- `Cmd/Ctrl + Alt + E`: direct keyboard candy drop.
- Extra debug shortcuts are disabled by default. Launch with `ECHO_DEBUG_SHORTCUTS=1 npm run overlay` to enable them.
- `Cmd/Ctrl + Alt + W`: direct wrapped sigh candy drop.
