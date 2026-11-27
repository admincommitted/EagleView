// Static check of src/: every relative import points at a file that exists, and every named import is exported by
// that file. Also lists any require( / module.exports left in src.
//   node tests/checkImports.mjs
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(import.meta.dirname, '..', 'src');

const listFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });

const exportCache = new Map();

function exportedNames(file) {
  if (exportCache.has(file)) return exportCache.get(file);
  const text = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g))
    names.add(match[1]);
  for (const match of text.matchAll(/export\s*\{([^}]*)\}(\s*from\s*['"]([^'"]+)['"])?/g)) {
    for (const part of match[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default\b/.test(text)) names.add('default');
  for (const match of text.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (fs.existsSync(target)) for (const name of exportedNames(target)) if (name !== 'default') names.add(name);
  }
  for (const match of text.matchAll(/export\s+const\s+\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.split(':').pop().trim();
      if (name) names.add(name);
    }
  }
  exportCache.set(file, names);
  return names;
}

const problems = [];
const files = listFiles(SRC_DIR);

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(SRC_DIR, file);
  if (/(^|[^.\w])require\s*\(/.test(text.replace(/createRequire[\s\S]*?\n/g, '')))
    problems.push(`${relative}: uses require(`);
  if (/module\.exports|exports\.\w+\s*=/.test(text)) problems.push(`${relative}: uses module.exports`);
  const importStatements = [
    ...text.matchAll(/import\s+([^'";()]*?)\s+from\s+['"]([^'"]+)['"]/g),
    ...text.matchAll(/export\s+(\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g),
  ];
  for (const [, clause, specifier] of importStatements) {
    if (!specifier.startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), specifier);
    if (!fs.existsSync(target)) {
      problems.push(`${relative}: missing file ${specifier}`);
      continue;
    }
    if (!target.endsWith('.js')) continue;
    const exported = exportedNames(target);
    const defaultName = clause.split('{')[0].replace(/,\s*$/, '').trim();
    if (defaultName && !defaultName.startsWith('*') && !exported.has('default'))
      problems.push(`${relative}: ${specifier} has no default export`);
    const named = /\{([^}]*)\}/.exec(clause)?.[1];
    if (!named) continue;
    for (const part of named.split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        .trim();
      if (name && name !== 'default' && !exported.has(name))
        problems.push(`${relative}: ${specifier} does not export ${name}`);
    }
  }
  for (const [, specifier] of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (specifier.startsWith('.') && !fs.existsSync(path.resolve(path.dirname(file), specifier)))
      problems.push(`${relative}: dynamic import of missing ${specifier}`);
  }
}

console.log(`${files.length} files checked, ${problems.length} problems`);
for (const problem of problems) console.log('  ' + problem);
process.exit(problems.length ? 1 : 0);
