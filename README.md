# SheetCraft

> Automate Excel sheet creation from image directories — macOS app built with Electron + React.

## Features (base)

- 🖼️ Drag & drop a folder (or browse) to scan for images
- 🔍 Recursively finds JPG, PNG, GIF, WebP, SVG, BMP, TIFF
- 📸 Live image grid preview with lazy batch loading
- 📊 Excel sheet creation (coming soon)

## Download

Download the latest release from the [Releases](../../releases) page:

- `SheetCraft-x.x.x-arm64.dmg` — Apple Silicon (M1/M2/M3)
- `SheetCraft-x.x.x.dmg` — Intel Mac

Open the `.dmg`, drag to Applications, done.

## Development

```bash
npm install
npm run dev
```

## Releasing a new version

Tag a commit with `v*` and push — GitHub Actions will build and publish a release automatically:

```bash
git tag v1.0.0
git push origin v1.0.0
```
