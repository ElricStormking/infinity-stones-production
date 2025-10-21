# Cross-Browser Test Plan - Infinity Storm

Goal: Validate functional parity and rendering correctness on major browsers/devices.

## Targets
- Chrome (latest, -1, -2)
- Firefox (latest, -1)
- Edge (latest)
- Safari macOS (latest)
- iOS Safari (two latest iOS) – real device if possible
- Android Chrome (two latest Android) – real device if possible

## Core Scenarios
1. Load game, no console errors
2. Demo spin flow (/api/demo-spin)
3. Game state fetch (/api/game-state) with demo bypass
4. Audio playback on user interaction
5. WebGL render stability (shaders, particles, tweens)
6. Orientation handling on mobile
7. Performance – 60 FPS baseline (FrameMonitor overlay)
8. Network error handling – offline/slow 3G throttling

## Visual Validation Checklist
- Texture decoding (gems, glove, portraits)
- Sprite sheets/animations (scatter, redwitch attack)
- Shaders (lightning, fire, blackhole)
- Text and UI scaling in DPR 1.0–3.0

## Functional Validation
- Quick spin flag propagation
- Free spins trigger and display
- Accumulated multipliers carry over visually

## Known Sensitivities
- Autoplay/audio policy on Safari/iOS – requires user gesture
- WebGL context loss – ensure graceful handling
- CSP differences (prod only; disabled/reduced in dev)

## How to Run
1. Start server on 3000
2. Open `http://localhost:3000/?debug=1`
3. Use DevTools > Performance for 30s capture during spin
4. Use Throttling: Slow 3G + 4x CPU for mobile baseline

## Acceptance Criteria
- No blocking console errors
- P95 frame time under 16.7ms on desktop, under 33ms on mid-tier mobile
- Audio plays after first click/tap
- All assets render; no missing textures






