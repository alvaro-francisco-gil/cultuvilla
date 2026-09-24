import { useMemo } from 'react';
import type { FiestasDataset } from '@cultuvilla/shared/models';
import { chipStyles } from './theme';
import { urgencyChip } from './labels';
import { Chip } from './components';
import { ANILLO_LABEL, cobertoraVerificada, pendientes, porAnillo, proximasFiestas, type ProximaFiesta } from './fiestas';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const diaMes = (iso: string): string =>
  `${String(Number(iso.slice(8, 10)))} ${MESES[Number(iso.slice(5, 7)) - 1] ?? ''}`;

/**
 * A `bop` date is the liturgical anchor a municipality declared, not the week it
 * celebrates; a `verificada` one has a dated public source. Showing them alike
 * would make the panel confidently wrong, which is worse than incomplete.
 */
function FuenteChip({ tipo }: { tipo: 'declarada' | 'verificada' }) {
  return tipo === 'verificada' ? (
    <Chip label="verificada" style="logrado" />
  ) : (
    <Chip label="declarada" style="neutral" />
  );
}

function ProximaRow({ item }: { item: ProximaFiesta }) {
  const { style } = urgencyChip(item.dias);
  const { fg, bg } = chipStyles[style];
  return (
    <li>
      <div className="fiesta">
        <span className="daybadge wide" style={{ color: fg, background: bg }}>
          {diaMes(item.fecha)}
        </span>
        <span className="body">
          <span className="titulo">
            {item.pueblo} · {item.fiesta.nombre}
          </span>
          <span className="chips">
            <Chip label={item.dias === 0 ? 'hoy' : `${String(item.dias)} días`} style={style} />
            <FuenteChip tipo={item.fiesta.tipo} />
            {item.fiesta.recurrencia === 'movil' && !item.fiesta.regla ? (
              <Chip label="fecha sin regla" style="aviso" />
            ) : null}
            {item.km > 0 ? <Chip label={`${item.km.toFixed(1)} km`} style="fitBajo" /> : null}
          </span>
          {item.fiesta.cuando ? <span className="detail">{item.fiesta.cuando}</span> : null}
          <span className="detail fuente" title={item.fiesta.fuente}>
            {item.fiesta.fuente} · comprobado {item.fiesta.verificadoEl}
          </span>
        </span>
      </div>
    </li>
  );
}

export function FiestasView({ dataset, today }: { dataset: FiestasDataset; today: string }) {
  const proximas = useMemo(() => proximasFiestas(dataset, today, 25), [dataset, today]);
  const grupos = useMemo(() => porAnillo(dataset), [dataset]);

  const { verificadas, total } = useMemo(() => cobertoraVerificada(dataset), [dataset]);
  const abiertas = useMemo(() => pendientes(dataset), [dataset]);

  return (
    <>
      <section>
        <div className="sectionhead">
          <h2>Cobertura</h2>
        </div>
        <p className="hint">
          Lo que esta búsqueda abarcó. Fuera del radio no se buscó, así que la ausencia de un
          pueblo a más distancia no significa nada.
        </p>
        <div className="fiesta pueblo">
          <span className="body">
            <span className="chips">
              <Chip label={`radio ${String(dataset.cobertura.radioKm)} km`} style="comprometido" />
              <Chip label={`${String(dataset.pueblos.length)} pueblos`} style="neutral" />
              <Chip label={`BOP ${String(dataset.anioBop)}`} style="neutral" />
              <Chip
                label={`${String(verificadas)}/${String(total)} verificadas`}
                style={verificadas * 2 >= total ? 'logrado' : 'aviso'}
              />
              {abiertas.length > 0 ? (
                <Chip label={`${String(abiertas.length)} por confirmar`} style="aviso" />
              ) : null}
            </span>
            <span className="detail">
              Centro {dataset.cobertura.centro.nombre} · {dataset.cobertura.metodo}
            </span>
            {dataset.cobertura.barridos.map((barrido) => (
              <span className="detail" key={barrido.fecha}>
                Barrido {barrido.fecha}: {String(barrido.radioKm)} km ·{' '}
                {barrido.provincias.join(', ')} · BOP {String(barrido.anioBop)} ·{' '}
                {String(barrido.pueblosHallados)} pueblos
              </span>
            ))}
          </span>
        </div>
      </section>

      <section>
        <div className="sectionhead">
          <h2>Próximas fiestas</h2>
          <span className="count">{proximas.length}</span>
        </div>
        <p className="hint">
          Las 25 más cercanas en el tiempo, de {String(dataset.pueblos.length)} pueblos alrededor de{' '}
          {dataset.referencia}. Una fiesta ya pasada cuenta para el año que viene.
        </p>
        <ul className="cards">
          {proximas.map((item) => (
            <ProximaRow key={`${item.pueblo}-${item.fiesta.md}-${item.fiesta.nombre}`} item={item} />
          ))}
        </ul>
      </section>

      <section>
        <div className="sectionhead">
          <h2>Los pueblos</h2>
          <span className="count">{dataset.pueblos.length}</span>
        </div>
        <p className="hint">{dataset.nota}</p>
        {grupos.map((grupo) => (
          <div className="anillo" key={grupo.anillo}>
            <h3>{ANILLO_LABEL[grupo.anillo]}</h3>
            <ul className="cards">
              {grupo.pueblos.map((pueblo) => (
                <li key={pueblo.nombre}>
                  <div className="fiesta pueblo">
                    <span className="body">
                      <span className="titulo">{pueblo.nombre}</span>
                      <span className="detail">
                        {pueblo.km > 0 ? `${pueblo.km.toFixed(1)} km · ` : ''}
                        {String(pueblo.habitantes)} hab. · {pueblo.provincia}
                      </span>
                      <span className="chips">
                        {pueblo.fiestas.map((fiesta) => (
                          <Chip
                            key={`${pueblo.nombre}-${fiesta.md}-${fiesta.nombre}`}
                            label={`${diaMes(`0000-${fiesta.md}`)} · ${fiesta.nombre}`}
                            style={fiesta.tipo === 'verificada' ? 'logrado' : 'neutral'}
                          />
                        ))}
                      </span>
                      {pueblo.confirmar?.map((marca) => (
                        <span className="detail confirmar" key={marca}>
                          {marca}
                        </span>
                      ))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="hint" style={{ marginTop: 24 }}>
        Fuentes: BOP de Segovia (16-sep-2025) y BOCM (12-dic-2025) para las fiestas locales
        declaradas; ayuntamientos y prensa local para las semanas verificadas. Datos de{' '}
        {dataset.actualizado}. El razonamiento completo está en{' '}
        <a
          href="https://github.com/alvaro-francisco-gil/cultuvilla/blob/develop/project/mercado/pueblos-vecinos-matabuena.md"
          target="_blank"
          rel="noreferrer"
        >
          project/mercado
        </a>
        .
      </p>
    </>
  );
}
