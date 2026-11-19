# Ship

Only when the user wants a GitHub Release:

1. `/verify`
2. Bump version in `package.json`, `extension/package.json`, `server.mjs`, README asset links, CHANGELOG
3. Commit (if asked), push `main`, tag `vX.Y.Z`, watch `release.yml`
4. Optionally sideload APK / MSI as requested
