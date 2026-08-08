#!/usr/bin/env node
/**
 * Recorta la fuente de iconos a los que el proyecto realmente usa.
 *
 * Material Symbols completo pesa 3,7 MB (6.510 glifos) y la app usa ~215. En
 * conexiones lentas eso hace que los iconos se vean como texto ("lock",
 * "login") durante segundos, y da sensación de pantalla colgada.
 *
 * La lista se DERIVA DEL CÓDIGO, nunca se escribe a mano: si alguien agrega un
 * icono y el subset no se regenera, ese icono saldría como texto en
 * producción. Por eso esto corre en el build, no como paso manual.
 *
 * ── Por qué el subset "obvio" no funciona ──────────────────────────────────
 *
 * Un `pyftsubset --text="edit delete ..."` deja 2 KB **sin ningún icono**: los
 * iconos se dibujan con ligaduras (la secuencia `e-d-i-t` se sustituye por un
 * glifo), así que pedir los caracteres solo conserva las letras.
 *
 * Y esta fuente no usa la feature `liga` sino `rlig`/`rclt`. Pedir
 * `--layout-features=liga` las borra y se pierden todos los iconos.
 *
 * Conservando `rclt`, en cambio, el *layout closure* de pyftsubset arrastra
 * casi los 6.510 glifos (3,5 MB): no puede saber qué secuencias son
 * alcanzables, así que se guarda todo por seguridad.
 *
 * La salida es resolver cada nombre a su glifo con HarfBuzz (shaping real, el
 * mismo que hace el navegador), pasar esos glifos explícitos y desactivar el
 * closure. Resultado: 150 KB con las ligaduras intactas.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const SRC = new URL('../src/', import.meta.url).pathname;
const FONT = join(SRC, 'assets/fonts/material-symbols-outlined.woff2');
/**
 * La copia íntegra vive FUERA de `src/assets/`: si estuviera ahí, Angular la
 * empaquetaría en el build y se desplegarían los 3,8 MB igual, anulando todo
 * el recorte. Solo la necesita este script para regenerar.
 */
const FULL = new URL('../fonts-source/material-symbols-outlined.full.woff2', import.meta.url)
  .pathname;
const LIST = join(SRC, 'assets/fonts/icons-used.txt');
const PYFTSUBSET = process.env.PYFTSUBSET ?? `${process.env.HOME}/.local/bin/pyftsubset`;

/**
 * `--check` no regenera nada: solo verifica que todo icono usado en el código
 * esté en la fuente recortada, y falla si no. Es lo que protege de la
 * regresión — alguien agrega un icono, olvida regenerar, y en producción se
 * vería el texto. No necesita pyftsubset, solo leer la fuente.
 */
const CHECK_ONLY = process.argv.includes('--check');

/**
 * Iconos elegidos en runtime, que el análisis estático no puede ver.
 * Mantener corta: cada entrada es algo que alguien tuvo que recordar agregar.
 *
 * El recolector solo mira plantillas, así que un icono que sale de un mapa en
 * TypeScript (`{ imaging: 'camera_alt' }`) se le escapa: el guardarraíl daba
 * verde y el icono se veía como texto en pantalla. Estos cuatro estaban así
 * (encontrados el 2026-08-07). Al agregar un mapa de iconos en un `.ts`, hay
 * que sumar aquí sus valores.
 */
const EXTRA_ICONS = [
  'camera_alt',             // categoría "imagenología" en laboratorio y expedientes
  'priority_high',          // cita urgente
  'radio_button_unchecked', // acción sin icono propio en la auditoría
  'inbox',                  // icono por defecto de <app-empty-state>
  'monitor_heart',          // módulo Estudios Especiales — sale de lab-module.config.ts, no de una plantilla
];

/** Iconos de `AlertService.fire({ icon })`, ajenos a Material Symbols. */
const ALERT_ICONS = new Set(['success', 'error', 'warning', 'info', 'question']);

async function collectIcons() {
  const icons = new Set();

  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'generated'].includes(entry.name)) await walk(path);
        continue;
      }
      if (!['.html', '.ts'].includes(extname(entry.name))) continue;

      const text = readFileSync(path, 'utf8');
      for (const { re, isAlertCall, allLiterals } of [
        { re: /material-symbols-outlined[^>]*>\s*([^<>{}\n]+?)\s*</g },
        { re: /<mat-icon[^>]*>\s*([^<>{}\n]+?)\s*<\/mat-icon>/g },
        // Solo aquí aplica la lista de AlertService: es su forma de llamada.
        { re: /\bicon:\s*'([a-z0-9_]+)'/g, isAlertCall: true },
        // Iconos pasados como input a un componente: `<app-stat-card icon="trending_up">`.
        // Faltaba este patrón y por eso 8 iconos quedaron fuera del recorte y se
        // veían como texto literal en producción — entre ellos `man`/`woman` en el
        // listado de pacientes. El `(?<!let-)` descarta el `let-icon="icon"` de los
        // `ng-template`, que no nombra ningún icono.
        { re: /(?<!let-)\bicon="([a-z0-9_]+)"/g },
        // Icono elegido por interpolación:
        //   <span class="material-symbols-outlined">{{ x ? 'hourglass_top' : 'table_chart' }}</span>
        // Las dos primeras expresiones excluyen `{}` a propósito, así que se
        // saltaban estos por completo. Aquí se capta la expresión entera y se
        // sacan todos los literales entrecomillados que haya dentro.
        { re: /material-symbols-outlined[^>]*>\s*\{\{([^}]+)\}\}\s*</g, allLiterals: true },
        { re: /<mat-icon[^>]*>\s*\{\{([^}]+)\}\}\s*<\/mat-icon>/g, allLiterals: true },
      ]) {
        for (const m of text.matchAll(re)) {
          const values = allLiterals
            ? [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(l => l[1])
            : [m[1].trim()];

          for (const value of values) {
            // `warning` y `error` son a la vez iconos de AlertService y de Material
            // Symbols: descartarlos siempre dejaba fuera del recorte los usos reales.
            if (isAlertCall && ALERT_ICONS.has(value)) continue;
            if (/^[a-z0-9_]+$/.test(value)) icons.add(value);
          }
        }
      }
    }
  };

  await walk(SRC);
  return [...new Set([...icons, ...EXTRA_ICONS])].sort();
}

/** Nombres que la fuente indicada NO puede dibujar como un único glifo. */
function missingFromFont(fontPath, names) {
  const script = `
import sys, io, json
import uharfbuzz as hb
from fontTools.ttLib import TTFont
tt = TTFont(sys.argv[1]); tt.flavor = None
buf = io.BytesIO(); tt.save(buf)
font = hb.Font(hb.Face(buf.getvalue()))
missing = []
for name in json.load(open(sys.argv[2])):
    b = hb.Buffer(); b.add_str(name); b.guess_segment_properties(); hb.shape(font, b)
    if len({i.codepoint for i in b.glyph_infos}) != 1 or len(b.glyph_infos) != 1:
        missing.append(name)
print(json.dumps(missing))
`;
  const f = join(tmpdir(), 'icon-check.json');
  writeFileSync(f, JSON.stringify(names));
  return JSON.parse(execFileSync('python3', ['-c', script, fontPath, f], { encoding: 'utf8' }));
}

/**
 * Los nombres se recogen de expresiones de plantilla, así que entre ellos caen
 * literales que no son iconos: `{{ tipo === 'financial' ? 'x' : 'y' }}` aporta
 * `financial` además del icono. Se descartan validándolos contra la fuente
 * ÍNTEGRA, que es la única autoridad sobre qué nombre es un icono real; si no,
 * acabarían en la lista y dejarían el guardarraíl en rojo para siempre.
 */
function keepRealIcons(names) {
  if (!existsSync(FULL)) return names; // primera ejecución: aún no hay copia íntegra
  const notIcons = new Set(missingFromFont(FULL, names));
  return names.filter(name => !notIcons.has(name));
}

const icons = keepRealIcons(await collectIcons());
writeFileSync(LIST, icons.join('\n') + '\n');

if (CHECK_ONLY) {
  const missing = missingFromFont(FONT, icons);
  if (missing.length) {
    console.error(
      `\n✘ ${missing.length} icono(s) usados en el código NO están en la fuente recortada:\n` +
        `   ${missing.join(', ')}\n\n` +
        `   Ejecuta 'npm run icons:subset' y commitea la fuente regenerada,\n` +
        `   o esos iconos se verán como texto en producción.\n`,
    );
    process.exit(1);
  }
  console.log(`✔ Los ${icons.length} iconos usados están en la fuente recortada.`);
  process.exit(0);
}

// El subset es destructivo: sin copia íntegra no se podría regenerar al
// agregar iconos nuevos.
if (!existsSync(FULL)) {
  copyFileSync(FONT, FULL);
  console.log('Guardada copia íntegra en material-symbols-outlined.full.woff2');
}

// HarfBuzz resuelve cada nombre a su glifo aplicando las mismas ligaduras que
// aplicará el navegador. Un nombre que no colapsa a un único glifo no es un
// icono real de la fuente y se reporta.
const resolver = `
import sys, io, json
import uharfbuzz as hb
from fontTools.ttLib import TTFont
tt = TTFont(sys.argv[1]); tt.flavor = None
buf = io.BytesIO(); tt.save(buf)
font = hb.Font(hb.Face(buf.getvalue()))
gids, missing = set(), []
for name in json.load(open(sys.argv[2])):
    b = hb.Buffer(); b.add_str(name); b.guess_segment_properties(); hb.shape(font, b)
    ids = [i.codepoint for i in b.glyph_infos]
    if len(ids) == 1: gids.add(ids[0])
    else: missing.append(name)
print(json.dumps({"gids": sorted(gids), "missing": missing}))
`;

const namesFile = join(tmpdir(), 'icon-names.json');
writeFileSync(namesFile, JSON.stringify(icons));
const resolved = JSON.parse(
  execFileSync('python3', ['-c', resolver, FULL, namesFile], { encoding: 'utf8' }),
);

if (resolved.missing.length) {
  console.warn(
    `\n⚠  ${resolved.missing.length} nombre(s) no existen en Material Symbols y ya se ven ` +
      `como texto en la app:\n   ${resolved.missing.join(', ')}\n`,
  );
}

const textFile = join(tmpdir(), 'icon-text.txt');
writeFileSync(textFile, icons.join(' '));

const before = statSync(FULL).size;
execFileSync(
  PYFTSUBSET,
  [
    FULL,
    `--gids=${resolved.gids.join(',')}`,
    `--text-file=${textFile}`,
    // `rlig` es la feature real de esta fuente; `liga` no existe aquí.
    '--layout-features=rlig,rclt',
    // Sin esto el closure arrastra los 6.510 glifos "por si acaso".
    '--no-layout-closure',
    '--flavor=woff2',
    `--output-file=${FONT}`,
  ],
  { stdio: 'inherit' },
);

const after = statSync(FONT).size;
const kb = n => (n / 1024).toFixed(0);
// Los dos números difieren a propósito: Material Symbols tiene alias, así que
// varios nombres pueden resolver al mismo glifo. Decirlo evita que el siguiente
// crea que `icons:check` y esto se contradicen.
console.log(
  `Iconos: ${icons.length} nombres → ${resolved.gids.length} glifos | ` +
    `fuente ${kb(before)} KB → ${kb(after)} KB ` +
    `(${(100 - (after / before) * 100).toFixed(1)}% menos)`,
);
