# Self-hosted fonts

The public site serves two typefaces from `public/fonts/`, both under the SIL Open Font License 1.1.
No font is requested from a third party: the CSP is `font-src 'self'`, and `scripts/validate.mjs` accepts
`@font-face` only when every `url()` is a local `/fonts/*.woff2` path (the WOFF2 signature is checked).

The files are the latin-subset WOFF2 builds shipped in the public npm packages below. They were copied
byte for byte; no package is a dependency of this repository.

| Family | Weight | File | Source package | Version | Upstream | sha256 |
| --- | --- | --- | --- | --- | --- | --- |
| Inter | 400 | `inter-latin-400-normal.woff2` | `@fontsource/inter` | 5.3.0 | https://github.com/rsms/inter (via https://fontsource.org/fonts/inter) | `8909904ab6c872eb994093482a88a28eca2cd95912d7b6fecd72103b0dc07edc` |
| Inter | 500 | `inter-latin-500-normal.woff2` | `@fontsource/inter` | 5.3.0 | same | `f3779f1efccc4bdcdf9c0a02ab95bf6bd092ed09c48c08cedc725889edd1d19f` |
| Inter | 600 | `inter-latin-600-normal.woff2` | `@fontsource/inter` | 5.3.0 | same | `f9a06e79cd3a2a20951c0f0e28f66dd0e6d3fda73911d640a2125c8fcb78f21a` |
| IBM Plex Mono | 400 | `ibm-plex-mono-latin-400-normal.woff2` | `@fontsource/ibm-plex-mono` | 5.3.0 | https://github.com/IBM/plex (via https://fontsource.org/fonts/ibm-plex-mono) | `08949f728dc52d528e69b1667d15c89a5686a4ee9a296ff90983985f99c380f7` |
| IBM Plex Mono | 500 | `ibm-plex-mono-latin-500-normal.woff2` | `@fontsource/ibm-plex-mono` | 5.3.0 | same | `01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22` |

## Licenses

The license texts are shipped next to the fonts and are the packages' `LICENSE` files:

| File | sha256 |
| --- | --- |
| `public/fonts/OFL-Inter.txt` (Copyright 2016 The Inter Project Authors) | `3b0a5fca3d17942cde889069889dedbbbd075e9b599968c82a95f4d944e9b345` |
| `public/fonts/OFL-IBM-Plex-Mono.txt` (Copyright 2017 IBM Corp.) | `23b0a9d0c6d3f140a0b77e483c5cfa6bba574325ef5cb189ed9f2fec4884533f` |

To verify: `shasum -a 256 public/fonts/*`.
