---
id: mashumano
kind: propuesta
titulo: "Candidatura al Premio Jóvenes Máshumano 2026"
status: enviada
para: premio-jovenes-mashumano-2026
---

# Candidatura al Premio Jóvenes Máshumano 2026

**Enviada.** Primera candidatura de Cultuvilla y el paquete de referencia del que
se reutiliza todo lo demás:

- [formulario.md](formulario.md) — respuestas del formulario
- [plan-de-negocio.md](plan-de-negocio.md) → PDF adjunto
- [render.mjs](render.mjs) — genera el PDF desde el Markdown
- `cv/` — CVs de los dos

El resultado de la convocatoria (`won` / `lost`) vive en
[su ficha](../../convocatorias/premio-jovenes-mashumano-2026.md), no aquí: esta
propuesta ya hizo su trabajo el día que se envió.

## Corrección 2026-09-23: las cifras que se enviaron eran falsas

**No se reescribe nada de lo enviado** — este folder es el registro de lo que
salió, no un borrador. Pero lo que salió tenía tres cifras mal, y quien reutilice
este texto tiene que saberlo antes de copiarlo:

| Lo enviado | Lo real (2026-09-23) |
|---|---|
| «~50 % del censo» en el plan de negocio y «~25 % del censo» en el formulario — **la candidatura se contradice a sí misma** | No calculable. 174 vecinos registrados de 204 habitantes, pero estar registrado no es residir: la app es también para quien se marchó |
| «~80 % de los jóvenes», en los dos documentos | **Inventado.** Nunca hubo export, censo ni método detrás (Álvaro, 2026-09-23) |
| Órdago «1.000 usuarios» en el formulario | **904** jugadores registrados, leído de la BI `ordago-prod` |

Las cifras se leyeron de `cultuvilla-prod` con un `count()` de solo lectura. La
regla que sale de esto vive en el repo personal de Álvaro, en
`docs/decisions/venture-figures-are-sourced-before-they-go-out.md`.

`[unknown: ¿se corrige ante Máshumano si la candidatura sigue viva, o se deja?]`

## Material reutilizable

El resumen del proyecto, el problema y los beneficiarios. **Las cifras no**: ver
la corrección de arriba y coger las buenas de
[chispa-galera-2026/formulario.md](../chispa-galera-2026/formulario.md). El resto
es el texto base de cualquier candidatura siguiente — y está en
español, así que para
[Europa Nostra](../../convocatorias/european-heritage-awards-2027.md) habrá que
traducirlo al inglés y reenfocarlo hacia participación ciudadana.

Quedan `[[...]]` sin resolver en el formulario, y es correcto: eran los datos que
se rellenaron a mano al enviarlo y no se volcaron aquí.
