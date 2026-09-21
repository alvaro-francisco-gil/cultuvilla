# LEADER vía pueblos — que el beneficiario sea el pueblo, no nosotros

> **Status:** Exploración pre-spec, derivada de una pregunta de Álvaro del
> 2026-09-20. No es asesoramiento legal ni de subvenciones: hay que validarlo con
> el grupo de acción local antes de contar con él.
>
> **Idioma:** en español a propósito — todo el vocabulario (grupo de acción local,
> gasto elegible, beneficiario, estrategia de desarrollo local) es normativa
> española y europea, y traducirlo lo empeora.

Documento no técnico. Vive aquí porque cambia el modelo de financiación del
proyecto, no su arquitectura. Hermano de
[entidad-juridica.md](entidad-juridica.md).

---

## La pregunta

Verificando [ADEFO Cinco Villas](../../../project/entidades/adefoincovillas.md) se
descartó por territorio: LEADER solo financia proyectos ejecutados en la comarca
del propio grupo de acción local, y Matabuena está en Segovia, a 400 km de las
Cinco Villas. Conclusión inicial: no nos sirve.

Álvaro preguntó lo obvio, que se había pasado por alto:

> ¿y si en ADEFO conectamos con algún pueblo de allí, para que implementen
> Cultuvilla? ¿eso funcionaría?

**Sí. Y probablemente es mejor modelo que pedir la subvención nosotros.**

---

## Por qué funciona

El razonamiento que descartó ADEFO tenía un error de sujeto. LEADER exige que el
**proyecto** se ejecute en el territorio, no que el **proveedor** viva allí. Si
una asociación, comisión de festejos o ayuntamiento de las Cinco Villas implanta
Cultuvilla en su pueblo:

- El proyecto **se ejecuta en las Cinco Villas**. Requisito cumplido.
- El **beneficiario de la subvención es el pueblo**, no nosotros.
- Nosotros somos **proveedor**, no solicitante.

Y ahí está lo importante:

| | Pedirla nosotros | Que la pida el pueblo |
|---|---|---|
| Territorio | Solo nuestro GAL (uno) | Cualquier GAL de España (~80) |
| Entidad jurídica nuestra | **Imprescindible** | **Irrelevante** |
| Quién escribe la memoria | Nosotros, cada vez | El GAL ayuda al pueblo: es su trabajo |
| Si nos la deniegan | No hay dinero | Otro pueblo lo intenta |
| Repetible | No, es un premio | **Sí, es un canal** |

La segunda fila es la que más pesa hoy. Las tres convocatorias descartadas esta
semana —[Town Twinning](../../../project/convocatorias/town-twinning-cerv-2026.md),
[Horizon](../../../project/convocatorias/horizon-europe-cl2-heritage-2026.md) y de
facto [MITECO](../../../project/convocatorias/miteco-despoblacion-2026.md)— nos
excluyen por ser persona física. **En este modelo eso deja de bloquear**, porque
el que pide no somos nosotros. Un ayuntamiento o una asociación de vecinos ya
tiene CIF, ya es beneficiario elegible y ya sabe cómo se piden estas ayudas.

Además, el GAL tiene **técnicos cuyo trabajo es ayudar a los proyectos de su
comarca a redactar la solicitud**. Deja de ser nuestra tarea.

---

## Lo que cambia en el modelo de negocio

De **«nos dan una subvención»** a **«los pueblos reciben ayudas para adoptarnos»**.

Lo primero es un premio: se gana una vez, con suerte. Lo segundo es un canal de
distribución con financiación pública integrada, replicable en ~80 comarcas
LEADER. Y encaja con lo que el producto ya es: multi-pueblo por diseño y con el
`municipalityId` como eje, no una instalación por cliente.

El cuello de botella deja de ser la financiación y pasa a ser **encontrar el
pueblo**. Que es el cuello de botella que
[¡Chispa! Galera](../../../project/eventos/epa-encuentro-galera-2026.md) ataca
directamente: 25 proyectos rurales de comarcas distintas en una sala.

---

## Las tres dudas que deciden si esto es real

**1. ¿Es gasto elegible un servicio digital?** Es la duda que puede tumbarlo
todo. Muchas estrategias LEADER están escritas para **inversión física** —obra,
maquinaria, local, equipamiento— y una cuota de software o un servicio puede
quedar fuera, o solo entrar como parte de un proyecto mayor. La respuesta está en
la **Estrategia de Desarrollo Local 2023-2027** de cada GAL, que es pública. Hay
que leer una antes de contar esta historia a nadie.

**2. ¿Hay reglas sobre el proveedor?** Suele exigirse comparar ofertas por encima
de cierto importe, y a veces hay condiciones sobre vinculación entre beneficiario
y proveedor. Nada de esto es un impedimento, pero sí obliga a que
**seamos facturables**: y eso devuelve a
[entidad-juridica.md](entidad-juridica.md) por otra puerta. No para pedir la
subvención, sino para poder **cobrar** limpiamente lo que el pueblo subvencionado
quiere pagar.

**3. ¿Y la cooperación interterritorial?** LEADER financia explícitamente
proyectos de cooperación entre territorios, y ADEFO ya coordina uno («Pon Aragón
en tu Mesa») entre GALs aragoneses. Un proyecto *«herramienta digital compartida
entre pueblos de varias comarcas»* es esa figura casi literalmente, y sería mucho
más grande que una ayuda suelta — con Matabuena y
[CODINSE](../../../project/entidades/codinse.md) de un lado y las Cinco Villas
del otro. Es la versión ambiciosa, y probablemente también la más lenta.

---

## Siguientes pasos, en orden

1. **Leer una Estrategia de Desarrollo Local** (la de CODINSE o la de ADEFO) y
   contestar la duda 1. Es gratis, es público y decide todo lo demás.
2. **Preguntar en Galera** a proyectos de otras comarcas si han usado LEADER y
   para qué. Información de primera mano de gente que ya lo ha pedido.
3. **Hablar con el técnico del GAL de Matabuena**, presentados por el
   ayuntamiento, que es socio del grupo. Preguntar por el caso hipotético antes
   de traer un pueblo concreto.
4. Solo entonces, **buscar el pueblo piloto** en otra comarca.

---

## Decisiones abiertas

- ¿Se persigue esto en paralelo a las convocatorias directas, o las sustituye?
  Recomendación: en paralelo — MITECO sigue siendo el mejor encaje directo y no
  depende de esto.
- ¿La asociación se constituye para pedir subvenciones, para poder facturar, o
  para las dos? Cambia la urgencia y quizá la figura.
- ¿Cuánto se cobra a un pueblo? Hoy no hay precio, y este modelo exige tener uno.
