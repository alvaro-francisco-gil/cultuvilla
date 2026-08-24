# Store graphic assets

Qué hay que producir, con qué medidas, y de dónde sale cada cosa. Los originales
de marca viven en [apps/mobile/assets/](../../apps/mobile/assets/) (`icon.png` y
`adaptive-icon.png` son 1024×1024).

Guardar los entregables finales en `docs/store/assets/` (fuera de git si pesan;
en ese caso anotar aquí dónde están).

## Google Play

| Asset | Formato | Obligatorio | Notas |
|---|---|---|---|
| Icono de la app | 512×512 PNG 32-bit, **sin transparencia** | Sí | derivar de `icon.png`; Play recorta las esquinas por su cuenta |
| Gráfico de funciones (feature graphic) | 1024×500 PNG/JPG, sin transparencia | Sí | se muestra arriba de la ficha; sin texto pequeño |
| Capturas de teléfono | mín. 2, máx. 8; **16:9 o 9:16**; lado entre 320 y 3840 px | Sí | la consola pide 9:16 exacto, y el AVD `Cultuvilla_Big` dispara 1080×2400 (9:20) — ver *Cómo capturar* |
| Capturas de tablet 7" y 10" | mismas reglas | No | `supportsTablet: true` en iOS, pero Play no las exige si no se declara soporte de tablet |
| Vídeo promocional | URL de YouTube | No | |

## App Store

| Asset | Formato | Obligatorio |
|---|---|---|
| App icon | 1024×1024 PNG, sin transparencia ni esquinas redondeadas | Sí (va en el binario, lo genera Expo desde `icon.png`) |
| Capturas iPhone 6.9" (1290×2796 o 1320×2868) | PNG/JPG | Sí |
| Capturas iPhone 6.5" (1242×2688 o 1284×2778) | PNG/JPG | Sí, salvo que ASC las derive de las 6.9" |
| Capturas iPad 13" | 2064×2752 | Sólo si se publica para iPad |
| App previews (vídeo) | — | No |

Apple escala hacia abajo desde el tamaño mayor, así que **basta con capturar en
6.9" e iPad 13"**.

## Qué enseñar en las capturas

Un guion de 5, en este orden, que cuenta la propuesta de valor sin leer texto:

1. **Portada del pueblo** — el feed del municipio con eventos y carteles.
2. **Detalle de un evento** — con el botón de inscripción visible.
3. **Inscribir a la familia** — la hoja de personas a cargo.
4. **Peñas y asociaciones** — el listado de organizaciones del pueblo.
5. **Noticias** — una publicación de un organizador.

Reglas: mismo pueblo y mismos datos en las cinco (datos de `demo_1`, no de
producción, y sin nombres de personas reales), estado de batería y hora
limpios, sin bordes de dispositivo si se capturan a pantalla completa.

## Cómo capturar

`pnpm seed:dev` deja el dataset `demo_1` cargado; la skill `drive-android-avd`
arranca el AVD y hace las capturas de Android.

**Dos trampas del AVD.** (1) El subcomando `shot` de `scripts/avd-dev.sh` escribe
0 bytes bajo WSL: la redirección de `adb exec-out ... > fichero` se pierde. Captura
con `adb shell screencap -p /sdcard/x.png` + `adb pull`. (2) `Cultuvilla_Big` es
1080×2400 (9:20), que **no** es el 9:16 que pide la consola; las entregas en
`assets/phone-9x16/` están escaladas a 1080×1920 con relleno crema
(`palette.cream`), que sobre el fondo de la app no se nota. Recorta y perderías
la barra de pestañas. Para iOS, el simulador de Xcode
con el perfil de build `preview-dev`. Las capturas de la ficha deben salir de
una build que se parezca a producción — nada de banners de dev ni del prefijo
`Dev` en el nombre.
