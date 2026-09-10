# Archivo

Copyright 2019 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo),
licensed under the SIL Open Font License 1.1 — https://scripts.sil.org/OFL

Committed rather than fetched at build time: Satori needs the font as a buffer,
and a cold start that reaches out to a font CDN adds latency and a failure mode
to every Wrapped render.
