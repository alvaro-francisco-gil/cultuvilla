# Entidad jurídica — asociación vs fundación

> **Status:** Exploración pre-spec, derivada de una conversación del 2026-08-24.
> No es asesoramiento legal: es lectura de la normativa y hay que validarla con
> una gestoría o un despacho del tercer sector antes de firmar nada. Las
> decisiones abiertas están al final.
>
> **Idioma:** en español a propósito — todo el vocabulario (Protectorado,
> utilidad pública, dotación) es normativa española y traducirlo lo empeora.

Documento no técnico: no toca código. Vive aquí porque la elección condiciona
quién es el titular en [docs/legal/](../../legal/) y quién puede ser
beneficiario de las subvenciones que financien el proyecto.

---

## Punto de partida

Hoy **Cultuvilla es una persona física**, y está documentado así a propósito:
[politica-de-privacidad.md](../../legal/politica-de-privacidad.md) y
[terminos-de-uso.md](../../legal/terminos-de-uso.md) nombran a Álvaro Francisco
Gil como titular con NIF, y
[store-release.md](../ongoing/store-release.md) razona la cuenta personal de Play
sobre esa misma base.

El objetivo que motiva el cambio: **que una entidad jurídica sea beneficiaria de
subvenciones públicas**. No hay intención de captar dinero de particulares.

---

## Las dos figuras

| | Asociación (LO 1/2002) | Fundación (Ley 50/2002) |
|---|---|---|
| Capital | 0 € | **dotación 30.000 €** (25 % al constituir, resto en 5 años; admite bienes/derechos) |
| Constitución | acta + estatutos, sin notario | escritura notarial + informe del Protectorado + Registro de Fundaciones |
| Plazo real | **3–6 semanas** | **4–7 meses** |
| Coste externo | 0–600 € | 1.500–3.000 € + la dotación |
| Gobierno | asamblea soberana (un socio, un voto) | patronato autorrenovado, sin socios |
| Supervisión | ninguna | **Protectorado**: plan de actuación + cuentas anuales |
| Cuentas anuales | se aprueban en asamblea, no se depositan | se presentan al Protectorado |
| Regla de destino | ninguna | **70 % de ingresos a los fines** en 4 años |
| Retribuir al órgano de gobierno | **sí**, si lo prevén los estatutos | **no** por el cargo; otro contrato exige autorización del Protectorado |
| Reversibilidad | disolver es trivial | irreversible: el patrimonio nunca vuelve |
| Mantenimiento anual | horas + 500–1.500 € | ciclo anual + 1.500–3.000 € |

**No hay diferencia de techo.** Las dos formas albergan organizaciones enormes
(Greenpeace España o el Real Madrid son asociaciones; Fundación ONCE o Ayuda en
Acción son fundaciones). La diferencia es de **origen** —patrimonio afectado vs
personas que se juntan—, no de destino.

---

## Uso del dinero de una subvención

Prácticamente idéntico. Las restricciones vienen de la **Ley 38/2003 General de
Subvenciones y de las bases de la convocatoria**, no de la forma jurídica:
gastos subvencionables, tres ofertas por encima de los umbrales del contrato
menor, afectación de bienes inventariables (5 años los inscribibles, 2 el
resto), límite de subcontratación, IVA no subvencionable si es recuperable, y el
mismo régimen de justificación y reintegro. Ninguna de las dos puede repartir
excedentes.

**La única diferencia práctica es si puedes cobrar tú:**

- Asociación sin utilidad pública → la más permisiva.
- Asociación **de utilidad pública** → la ley prohíbe retribuir al órgano de
  gobierno **con cargo a fondos o subvenciones públicas**.
- Fundación → cargo de patrono gratuito por ley; contratarte para otra función
  exige autorización del Protectorado.

En los tres casos la vía limpia es un **contrato laboral por un trabajo real**,
separado del asiento en el órgano de gobierno. Ojo: muchas convocatorias excluyen
expresamente retribuir a órganos de gobierno.

---

## El eje que de verdad decide: de dónde entra y hacia dónde sale el dinero

| Flujo | Quién gana |
|---|---|
| Entra **patrocinio de empresas** | empate — funciona ya en ambas |
| Entra **donación pura con deducción** | fundación (asociación, a los 2 años vía utilidad pública) |
| Entra **facturación** a ayuntamientos | **asociación**, con holgura |
| Entra **subvención pública** | empate total |
| Sale a **premios a terceros** | empate |
| Sale a **sueldos propios** | **asociación** sin utilidad pública |

Dos hallazgos que reordenan la intuición inicial:

**1. Patrocinio ≠ donación.** Si una empresa financia premios a cambio de
visibilidad, es un **contrato de patrocinio publicitario** y ella se lo deduce
como gasto de publicidad por el régimen general. No hace falta la Ley 49/2002.
Es decir: *dinero privado de empresas para premiar a quien digitalice su pueblo
funciona con una asociación desde el primer día*. Válido para ambas formas:
premiar a individuos exige **convocatoria pública abierta con criterios
objetivos**; a dedo dispara la alarma del "beneficia a personas determinadas".

**2. Cobrar a ayuntamientos favorece a la asociación por estar menos regulada**,
no por ser más humilde. La fundación arrastra el 70 % y un Protectorado
preguntando si no serás una empresa disfrazada.

---

## El eje "pueblos"

Aquí no hay empate. El tejido del pueblo **ya es asociativo** (peñas, vecinos,
culturales, AMPA, cofradías) — y son literalmente los usuarios del producto. Ser
asociación os pone *dentro* del ecosistema como un par más; fundación se lee como
patrimonio, ciudad y benefactor de fuera, y abre la pregunta *¿de quién es esto y
quién lo paga?*.

El argumento estructural: **en una asociación los socios pueden ser personas
jurídicas**, así que ayuntamientos y asociaciones de los pueblos pueden ser
socios. Eso permite una **red o federación de pueblos** donde los pueblos son
parte de la entidad y no clientes de ella. Una fundación no puede: no tiene
socios. Además, buena parte del dinero europeo de desarrollo rural se canaliza
por **LEADER a través de Grupos de Acción Local**, constituidos como
asociaciones.

---

## Si aun así se va a fundación: los cuellos de botella

1. **Coherencia "quiero cobrar" vs "interés general".** Una fundación cuya única
   actividad es una app desarrollada por su patrono, con la propiedad intelectual
   en manos de ese patrono, se lee como vehículo para financiar un proyecto
   privado. *Decidido en la conversación: donar el código a la fundación, y no
   salir del patronato.* Donar la PI resuelve la incoherencia; quedarse de
   patrono es sostenible (patrono + director contratado con autorización), pero
   es un peaje recurrente, no un trámite único.
2. **La dotación se mide contra el plan, no contra los 30.000 €.** Cuanto más
   ambicioso el plan de actuación, más fácil es que el Protectorado declare la
   dotación insuficiente. Hay que calibrar el plan a la dotación.
3. **Tres patronos** dispuestos a asumir responsabilidad jurídica gratis.
4. **Calendario ajeno**: cada ronda de correcciones suma semanas. Lo único que
   controlas es la calidad del primer envío.

El Protectorado, para dimensionarlo: es la Administración competente según el
**ámbito de actuación** declarado (estatal si actuáis en más de una CCAA;
autonómico si no — y varias CCAA tienen ley propia). No aprueba el gasto
corriente. Pesa en el parto y en la rigidez posterior, no en el día a día.

---

## Cambiar de socios, y pasar de una a otra

- **Quitar y meter socios es fácil.** Salida voluntaria: inmediata y protegida
  por ley. Expulsión: solo por causas estatutarias, con acuerdo motivado y
  **audiencia previa** al interesado, e impugnable judicialmente. Admitir es
  trivial. Mantén siempre ≥3 (entra el nuevo antes de que salga el viejo). El
  registro solo lleva **junta directiva**, estatutos y domicilio — no la lista de
  socios.
- **No existe transformación de asociación a fundación.** Habría que constituir
  una fundación nueva desde cero y disolver la asociación destinando el remanente
  a aquella. Se pierde la **antigüedad** (que es lo único que no se puede comprar
  ni acelerar) y las **subvenciones en curso no se traspasan**.
- **Por eso la ruta buena es sumar, no sustituir:** la asociación crea la
  fundación y aporta la dotación. Conserva antigüedad e histórico.

---

## ¿Hace falta gestoría?

Obligatorio solo el **notario**, y solo en la fundación. Todo lo demás es
opcional.

| | ¿Imprescindible? |
|---|---|
| Revisión puntual de estatutos por asesor del tercer sector | No, pero es el dinero mejor gastado — las cláusulas de control no las cubre una plantilla |
| Gestoría fiscal/contable recurrente | No, mientras no haya nóminas ni volumen |
| **Gestoría laboral** | **Sí, desde el primer contrato** — recargos automáticos, cadencia mensual |
| Notario | Solo fundación |

Antes de pagar: muchas CCAA y diputaciones tienen **oficinas de apoyo al
asociacionismo** gratuitas, y el técnico de participación ciudadana del
ayuntamiento suele ayudar.

**Qué automatiza la IA:** redacción de estatutos, plan de actuación y memorias,
justificación de subvenciones, rastreo de convocatorias (BDNS, BOE, boletines
provinciales) y preparación contable. **Qué no toca:** los 30.000 €, el
calendario del Protectorado, los plazos registrales, la antigüedad y la firma
profesional. Es decir, **reduce mucho el mantenimiento de la fundación y casi
nada su constitución** — ataca el eje que ya era el menor de los dos problemas.

---

## Recomendación

**Asociación ahora.** El modelo de negocio planteado (facturar a ayuntamientos +
premios financiados por patrocinio empresarial) no exige fundación; lo hace mejor
una asociación, y encaja además con el eje "pueblos".

1. **Constituir la asociación** con estatutos que blinden el control (mandatos
   largos en la junta, requisitos de admisión de socios, mayorías reforzadas para
   cambiar fines, baja automática por impago de cuota) y que admitan **personas
   jurídicas como socios**. Incluir la cláusula estándar de destino del remanente
   a otra entidad sin ánimo de lucro de fines análogos.
2. **Alta en el registro municipal de entidades ciudadanas** — puerta a las
   convocatorias locales, y empieza a correr la antigüedad.
3. **Premios financiados por patrocinio**, no por donación. Disponible ya.
4. **A los 2 años, evaluar la utilidad pública**, sabiendo que el precio es no
   retribuir al órgano de gobierno con fondos públicos.
5. **La fundación, si llega**, la constituye la asociación como fundadora, con
   dinero conseguido y sin perder antigüedad. **Guardar la donación del código
   para ese momento**: es la dotación perfecta, pero cederlo hoy a una fundación
   que aún no se sabe si hace falta es la decisión más irreversible de la lista.

Independiente de la forma jurídica, lo que se paga solo desde el día uno es
montar el **rastreo de convocatorias y el circuito de justificación**.

---

## Preguntas abiertas

- ¿Ámbito de actuación: una CCAA o estatal? Determina registro y, si algún día
  hay fundación, qué Protectorado.
- ¿Quiénes son los 3 socios fundadores, y quién entra en la junta directiva?
- ¿Los ayuntamientos entran como socios (modelo federación) o como clientes?
- ¿El modelo de ingresos previsto es principalmente facturación? Si acabara
  siendo mayoritario y se quiere repartir excedente, ninguna de las dos formas
  sirve y la conversación es autónomo/SL.
- ¿Hay ya empresas candidatas a patrocinar los premios?
- Al constituirse: actualizar titular y CIF en
  [politica-de-privacidad.md](../../legal/politica-de-privacidad.md),
  [terminos-de-uso.md](../../legal/terminos-de-uso.md), la ficha de las stores y
  [play-declarations.md](../../store/play-declarations.md).
