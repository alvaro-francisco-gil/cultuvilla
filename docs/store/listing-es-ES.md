# Store listing — es-ES

Primary (and currently only) locale: **español (España)**. Both stores fall back
to it for every other locale.

## Shared

| Field | Value |
|---|---|
| Nombre / App Name | `Cultuvilla` (Play ≤ 30 · ASC ≤ 30) |
| Categoría | Play: **Estilo de vida** · ASC primary: **Estilo de vida**, secondary: **Redes sociales** |
| Email de contacto | `cultuvilla.app@gmail.com` |
| Web / Marketing URL | `https://cultuvilla.es` |
| Política de privacidad | `https://cultuvilla.es/legal/privacy` |
| Términos de uso | `https://cultuvilla.es/legal/terms` |
| Soporte | `https://cultuvilla.es` (o `mailto:cultuvilla.app@gmail.com` — ASC exige una URL) |
| Copyright (ASC) | `2026 Cultuvilla` |

## Google Play

**Descripción corta** (≤ 80 caracteres):

> La vida de tu pueblo: fiestas, eventos, peñas y vecinos, todo en un sitio.

**Descripción completa** (≤ 4000 caracteres):

> Cultuvilla reúne en una sola aplicación todo lo que pasa en tu pueblo.
>
> Descubre las fiestas, los eventos y los carteles de tu municipio, apúntate con
> un toque y lleva también la inscripción de tu familia. Consulta las peñas y
> asociaciones del pueblo, únete a las que te interesen y sigue sus
> publicaciones.
>
> **Qué puedes hacer**
>
> • Ver el calendario de eventos y fiestas de tu pueblo
> • Apuntarte a un evento, y apuntar a las personas a tu cargo
> • Descubrir las peñas, asociaciones y ayuntamientos del municipio
> • Leer las noticias y los avisos publicados por los organizadores
> • Explorar los barrios, los lugares y las personas del pueblo
> • Compartir cualquier evento o noticia con quien quieras
>
> **Para asociaciones y ayuntamientos**
>
> Publica tus eventos y noticias, gestiona quién forma parte de tu organización y
> llega a todos los vecinos sin depender de un grupo de mensajería.
>
> Cultuvilla es gratis y está hecha para los pueblos de España.

**Etiquetas / tags**: eventos, comunidad, pueblo

**Notas de la versión** (Play, ≤ 500 caracteres) — se escriben a mano en la
consola por release; usar el bloque `## vX.Y.Z` de [CHANGELOG.md](../../CHANGELOG.md)
como fuente.

## App Store

| Campo | Límite | Valor |
|---|---|---|
| Subtitle | 30 | `La agenda de tu pueblo` |
| Promotional text | 170 | `Fiestas, eventos, peñas y vecinos de tu pueblo, en una sola app. Apúntate tú y tu familia con un toque.` |
| Keywords | 100 (separadas por comas, **sin espacios**) | `pueblo,fiestas,eventos,agenda,peña,asociación,ayuntamiento,vecinos,municipio,comunidad` |
| Description | 4000 | Reutilizar la descripción completa de Play, **sin negritas ni viñetas Markdown** (ASC no las renderiza: usar guiones y saltos de línea). |
| What's New | 4000 | Igual que las notas de versión de Play. |

**No repetir el nombre de la app en las keywords** — Apple ya indexa `name` y
`subtitle`, y duplicar desperdicia el presupuesto de 100 caracteres.

## Reglas de escritura

- Nada de superlativos ni promesas de ranking ("la mejor app de…"): ambas
  tiendas lo rechazan.
- Nada de precios ni de "gratis" en el **nombre** ni en el subtítulo.
- No mencionar la otra plataforma ("también en Android") en la ficha de la App
  Store: es motivo de rechazo.
- Si la descripción menciona una función, esa función tiene que existir en la
  build enviada. Al añadir o quitar una viñeta, comprobar contra el código.
