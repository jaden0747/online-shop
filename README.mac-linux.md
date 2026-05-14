# macOS/Linux README

This guide lists npm commands used in this workspace on macOS and Linux.

## Prerequisites

- Node.js LTS (recommended)
- Git
- Bash or Zsh

## Setup

Run from the project root:

```bash
npm install
```

## App Commands

- Start Next.js dev server:

```bash
npm run dev
```

- Build app for production:

```bash
npm run build
```

- Start production app:

```bash
npm start
```

## Quality Commands

- Run ESLint:

```bash
npm run lint
```

- Run tests once:

```bash
npm run test
```

- Run tests in watch mode:

```bash
npm run test:watch
```

## Electron Commands

- Run Electron in development:

```bash
npm run electron:dev
```

- Prepare Next.js standalone output for Electron packaging:

```bash
npm run electron:prepare
```

- Build macOS Electron package:

```bash
npm run electron:build
```

- Build Windows Electron package:

```bash
npm run electron:build:win
```

## Release Commands

- macOS/Linux release script (bash):

```bash
npm run release -- 0.4.7
```

- Windows release script (from macOS/Linux using PowerShell command in package script):

```bash
npm run release:win -- 0.4.7
```

If version is omitted, release scripts use the current `package.json` version.
