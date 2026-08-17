#!/usr/bin/env node
// Verificacion ejecutable del proyecto: corre el detector de anti-patrones de
// Impeccable sobre el directorio de codigo fuente.
//
//   npm run design:check          -> revisa src/
//   npm run design:check -- src/components
//
// El detector se distribuye con la skill de Impeccable, no con este repo, asi
// que se resuelve desde el home del usuario o desde IMPECCABLE_SKILL_DIR.
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const CANDIDATES = [
  process.env.IMPECCABLE_SKILL_DIR,
  resolve(process.cwd(), '.claude/skills/impeccable'),
  join(homedir(), '.claude/skills/impeccable'),
].filter(Boolean)

const skillDir = CANDIDATES.find((dir) => existsSync(join(dir, 'scripts/detect.mjs')))

if (!skillDir) {
  console.error(
    [
      'No se encontro el detector de anti-patrones de Impeccable.',
      'Rutas probadas:',
      ...CANDIDATES.map((c) => `  - ${c}`),
      '',
      'Instala la skill de Impeccable o define IMPECCABLE_SKILL_DIR apuntando a su carpeta.',
    ].join('\n'),
  )
  process.exit(2)
}

const targets = process.argv.slice(2)
const args = [join(skillDir, 'scripts/detect.mjs'), '--json', ...(targets.length ? targets : ['src'])]

const child = spawn(process.execPath, args, { stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))
