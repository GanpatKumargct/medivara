// Lists every interface string (the first argument of t("...") calls in src/) and reports how
// many each language catalog translates (DEC-29). Writes src/locales/_keys.json, the source
// list for translators. Plural keys (containing {{count}}) need `<key>_one` / `<key>_other`
// forms in each catalog, as i18next pluralisation expects.
//   node scripts/i18n-extract.mjs            report
//   node scripts/i18n-extract.mjs --check    also fail if a catalog has unknown keys or
//                                            placeholders that differ from the English key
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const ts = createRequire(join(root, 'package.json'))('typescript')
const files = []
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) { if (!['dummy-data', 'locales'].includes(f)) walk(p) }
    else if (/\.(ts|tsx)$/.test(f)) files.push(p)
  }
}
walk(join(root, 'src'))

const keys = new Map() // key -> first location
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  if (!text.includes('t(')) continue
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't') {
      const a = n.arguments[0]
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && !keys.has(a.text)) {
        keys.set(a.text, `${relative(root, file)}:${sf.getLineAndCharacterOfPosition(a.getStart(sf)).line + 1}`)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

const sorted = [...keys.keys()].sort((a, b) => a.localeCompare(b))
const plural = sorted.filter((k) => k.includes('{{count}}'))
writeFileSync(join(root, 'src/locales/_keys.json'), JSON.stringify(sorted, null, 2) + '\n')
console.log(`${sorted.length} interface strings (${plural.length} with plural forms) → src/locales/_keys.json`)

const placeholders = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g)].map((m) => m[1] ?? m[2]).sort().join(',')
let problems = 0
for (const f of readdirSync(join(root, 'src/locales')).filter((f) => /^[a-z]{2}\.json$/.test(f)).sort()) {
  const cat = JSON.parse(readFileSync(join(root, 'src/locales', f), 'utf8'))
  const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '')
  const done = sorted.filter((k) => (k.includes('{{count}}') ? `${k}_other` in cat : k in cat)).length
  const unknown = Object.keys(cat).filter((k) => !keys.has(k) && !keys.has(base(k)))
  const broken = Object.entries(cat).filter(([k, v]) => keys.has(base(k)) && placeholders(base(k)) !== placeholders(v))
  console.log(`${f.padEnd(8)} ${String(done).padStart(4)}/${sorted.length} translated${unknown.length ? ` · ${unknown.length} unknown keys` : ''}${broken.length ? ` · ${broken.length} placeholder mismatches` : ''}`)
  if (process.argv.includes('--check')) {
    for (const k of unknown) console.log(`  unknown key: ${k}`)
    for (const [k] of broken) console.log(`  placeholders differ: ${k}`)
    problems += unknown.length + broken.length
  }
}
if (problems) process.exit(1)
