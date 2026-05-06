/**
 * Charge les SKILL.md depuis le dossier `apolline-skills/` à la racine du repo.
 *
 * Chaque sous-dossier = 1 skill. La fonction lit le SKILL.md, qui devient
 * le system prompt envoyé à Claude lors d'un appel via `generate()`.
 *
 * Layout attendu :
 *   apolline-skills/
 *     ├── ddp-pdf/SKILL.md
 *     ├── dossier-html/SKILL.md
 *     ├── ...
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

const SKILLS_DIR = process.env.APOLLINE_SKILLS_DIR
  ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..', 'apolline-skills')

export type LoadedSkill = {
  name: string
  /** Frontmatter de SKILL.md (YAML simple parsé) */
  meta: Record<string, string>
  /** Corps du SKILL.md (sans le frontmatter) */
  prompt: string
  /** Chemin absolu du dossier du skill — utile pour récupérer les references/scripts */
  dir: string
}

/** Parse simple du frontmatter YAML d'un SKILL.md (3 dashes encadrants). */
function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const lines = content.split(/\r?\n/)
  if (lines[0] !== '---') return { meta: {}, body: content }
  const meta: Record<string, string> = {}
  let i = 1
  while (i < lines.length && lines[i] !== '---') {
    const line = lines[i] ?? ''
    const colon = line.indexOf(':')
    if (colon > 0) {
      const key = line.slice(0, colon).trim()
      let value = line.slice(colon + 1).trim()
      // Retire les guillemets entourants si présents
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      meta[key] = value
    }
    i++
  }
  const body = lines.slice(i + 1).join('\n').trim()
  return { meta, body }
}

let _cache: Map<string, LoadedSkill> | null = null

/** Recharge le cache (utile en dev avec HMR). */
export function refreshSkills(): Map<string, LoadedSkill> {
  const out = new Map<string, LoadedSkill>()
  if (!existsSync(SKILLS_DIR)) {
    console.warn(`[skills] dossier introuvable : ${SKILLS_DIR}`)
    _cache = out
    return out
  }
  for (const entry of readdirSync(SKILLS_DIR)) {
    const dir = path.join(SKILLS_DIR, entry)
    if (!statSync(dir).isDirectory()) continue
    const skillFile = path.join(dir, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    try {
      const raw = readFileSync(skillFile, 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      out.set(entry, { name: entry, meta, prompt: body, dir })
    } catch (e) {
      console.warn(`[skills] échec chargement ${entry}`, e)
    }
  }
  console.log(`[skills] ${out.size} skill(s) chargé(s) depuis ${SKILLS_DIR} : ${[...out.keys()].join(', ')}`)
  _cache = out
  return out
}

export function getAllSkills(): Map<string, LoadedSkill> {
  if (!_cache) refreshSkills()
  return _cache!
}

export function getSkill(name: string): LoadedSkill | null {
  return getAllSkills().get(name) ?? null
}

export function listSkillNames(): string[] {
  return [...getAllSkills().keys()]
}
