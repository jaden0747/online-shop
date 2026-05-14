# Windows README

This guide lists npm commands used in this workspace on Windows.

## Prerequisites

- Node.js LTS (recommended)
- Git
- PowerShell

## Setup

Run from the project root:

```powershell
npm install
```

## App Commands

- Start Next.js dev server:

```powershell
npm run dev
```

- Build app for production:

```powershell
npm run build
```

- Start production app:

```powershell
npm start
```

## Quality Commands

- Run ESLint:

```powershell
npm run lint
```

- Run tests once:

```powershell
npm run test
```

- Run tests in watch mode:

```powershell
npm run test:watch
```

## Electron Commands

- Run Electron in development:

```powershell
npm run electron:dev
```

- Prepare Next.js standalone output for Electron packaging:

```powershell
npm run electron:prepare
```

- Build macOS Electron package (for mac environments):

```powershell
npm run electron:build
```

- Build Windows Electron package:

```powershell
npm run electron:build:win
```

## Release Commands

- macOS release script (bash):

```powershell
npm run release -- 0.4.7
```

- Windows release script:

```powershell
npm run release:win -- 0.4.7
```

If version is omitted, release scripts use the current `package.json` version.
