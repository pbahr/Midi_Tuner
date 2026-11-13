# Installation log

Recorded November 13, 2026.

## Installed components

- Node.js `v26.13.1` with npm `11.20.0`, installed as a portable user-local runtime under `%LOCALAPPDATA%\Programs\nodejs-v26.13.1`. The downloaded ZIP was checked against the SHA-256 checksum published by Node.js.
- `soundfont-player@0.12.0`, which loads the sampled acoustic grand piano instrument for browser audio.
- `webmidi@3.3.1`, the MIDI library used by the app.
- `vite@6.4.6`, the development server and build tool.
- npm installed 27 packages total and reported 0 vulnerabilities.

`package-lock.json` records the resolved package versions. The manifest uses version ranges (`soundfont-player: ^0.12.0`, `webmidi: ^3.1.12`, and `vite: ^6.0.0`).

## Commands and outcomes

1. Checked for `node`, `npm`, `npx`, `corepack`, and Windows package managers. Node.js and npm were not initially available; `winget` was available.
2. `winget show --id OpenJS.NodeJS.LTS --exact` could not run non-interactively because the Microsoft Store source requested agreement input.
3. `winget show --id OpenJS.NodeJS.LTS --exact --source winget --accept-source-agreements` found Node.js LTS `v26.13.1`.
4. `winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-source-agreements --accept-package-agreements --silent` downloaded and verified the MSI, but the installer requested administrator approval and did not complete in this environment. The pending attempt was stopped.
5. Installed the portable Node.js ZIP from the official Node.js distribution site after validating its published SHA-256 checksum. Equivalent PowerShell commands:

   ```powershell
   $version = 'v26.13.1'
   $archiveName = "node-$version-win-x64.zip"
   $baseUrl = "https://nodejs.org/dist/$version"
   $archive = Join-Path $env:TEMP $archiveName
   $sumsFile = Join-Path $env:TEMP "SHASUMS256-$version.txt"

   Invoke-WebRequest -Uri "$baseUrl/$archiveName" -OutFile $archive
   Invoke-WebRequest -Uri "$baseUrl/SHASUMS256.txt" -OutFile $sumsFile
   $sumLine = Get-Content $sumsFile |
     Where-Object { $_ -match "\s$([regex]::Escape($archiveName))$" } |
     Select-Object -First 1
   $expectedHash = ($sumLine -split '\s+')[0]
   $actualHash = (Get-FileHash -Path $archive -Algorithm SHA256).Hash
   if ($actualHash -ne $expectedHash) {
     throw 'Downloaded Node.js archive SHA256 did not match the official checksum.'
   }

   $installRoot = Join-Path $env:LOCALAPPDATA 'Programs\nodejs-v26.13.1'
   New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
   Expand-Archive -Path $archive -DestinationPath $installRoot -Force
   Remove-Item -LiteralPath $archive, $sumsFile -Force
   ```

   Verified versions with:

   ```powershell
   & "$env:LOCALAPPDATA\Programs\nodejs-v26.13.1\node-v26.13.1-win-x64\node.exe" --version
   & "$env:LOCALAPPDATA\Programs\nodejs-v26.13.1\node-v26.13.1-win-x64\npm.cmd" --version
   ```

6. An initial direct `npm install` failed because the portable Node.js folder was not on `PATH` for npm's install scripts. Retried with:

   ```powershell
   $nodeDir = Join-Path $env:LOCALAPPDATA 'Programs\nodejs-v26.13.1\node-v26.13.1-win-x64'
   $env:PATH = "$nodeDir;$env:PATH"
   npm install
   npm test
   npm run build
   ```

   All three commands succeeded on retry. Tests passed (2/2), and Vite created the production build in `dist/`. npm reported that the `esbuild` install script was not covered by its script-approval configuration; the tests and production build nevertheless completed successfully.
7. Added sampled piano audio. An initial attempt to add `@tonejs/piano` was rejected by npm because its declared `webmidi@^2.5.1` peer dependency conflicts with this project's WebMidi.js 3. That incompatible dependency was not forced. Installed the compatible soundfont player instead:

   ```powershell
   npm install
   ```

   The manifest now includes `soundfont-player@^0.12.0`. npm resolved `soundfont-player@0.12.0`, installed 7 additional packages, and reported 0 vulnerabilities. npm noted that its transitive `audio-loader@0.5.0` dependency is deprecated. The application fetches the MusyngKite acoustic grand piano soundfont from an external host when audio is enabled, so internet access is needed unless the browser can reuse cached samples. MIDI velocity controls playback volume, and MIDI note-off releases the sample.
8. Verified the sampled-audio changes with `npm test` (8 tests passed) and `npm run build` (Vite production build succeeded). The browser check confirmed the app page and piano rendered and audio loading completed, but browser MIDI permission was denied in the automated check; test actual playback with a MIDI device in a browser where MIDI access is allowed.

## Running the project in a new PowerShell session

The portable Node.js install is user-local and was not added to the machine-wide `PATH`. To start the project on localhost, open PowerShell in the project folder and run:

```powershell
.\start-localhost.ps1
```

The script adds the portable Node.js install to the current session's `PATH`, runs `npm install` if Vite is not installed yet, and starts Vite bound only to `127.0.0.1`. Open the URL printed by Vite (normally `http://localhost:5173/`). Leave the PowerShell window open while using the app; press `Ctrl+C` there to stop the server. The server is not exposed to other devices on the network. The browser still needs internet access to fetch the piano soundfont when audio is enabled.

To start the server manually after adding Node.js to `PATH`, use `npm run start`. Use `npm test` for tests and `npm run build` to create the production build.
