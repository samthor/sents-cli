
import * as path from 'path';
import pm from 'picomatch';

const debug = false;

/**
 * @param {string} a
 * @param {string} b
 */
const highestPath = (a, b) => {
  if (a === '') {
    return b;
  } else if (b === '') {
    return a;
  }

  // Make 'a' smaller than 'b'.
  if (b.length < a.length) {
    ({b, a} = {a, b});
  }
  a = path.join(a, path.sep);
  b = path.join(b, path.sep);

  const len = Math.min(a.length, b.length);

  let i = 0;
  let sep = 0;
  for (; i < len; ++i) {
    if (a.charAt(i) !== b.charAt(i)) {
      break;
    } else if (a.charAt(i) === path.sep) {
      sep = i;
    }
  }

  return a.substr(0, sep);
};

/**
 * @param {string[]} cands
 * @param {string} root source root for filters
 * @return {{root: string, filter: (s: string) => boolean}}
 */
export const build = (cands, root) => {
  if (!cands.length) {
    return {root: '.', filter: () => true};
  }

  // Resolve all the globs and sort shortest first.
  const resolvedGlobs = cands.map((cand) => {
    // This enables an odd syntax we see supported in other places, allowing "**.js" to mean
    // "**/*.js". Notably this only seems to work on the left of the basename.
    const basename = path.basename(cand);
    if (basename.startsWith('**.')) {
      cand = path.join(path.dirname(cand), '**', path.sep, basename.substr(1));
    }

    return path.resolve(path.join(root, cand));
  }).sort();

  // Find the top-most _real_ directory that we're globbing, but limit this to the current working
  // directory. This allows folks to do odd things like watching "../*".
  let updatedRoot = '';
  for (const resolved of resolvedGlobs) {
    const {base} = pm.scan(resolved);
    if (!resolved.startsWith(base)) {
      throw new Error(`resolved should start with '${base}': '${resolved}`);
    }
    if (updatedRoot === '') {
      updatedRoot = base;
      continue;
    }
    updatedRoot = highestPath(base, updatedRoot);
  }
  if (updatedRoot.startsWith(path.join(root, path.sep))) {
    updatedRoot = root;  // don't escape actual root
  }

  // Find the globs relative to the new, possibly parent root.
  let abortSolo = false;
  const relativeGlobs = resolvedGlobs.map((cand) => {
    const rel = path.relative(updatedRoot, cand);
    if (!rel || rel === '.') {
      abortSolo = true;
    }
    return rel;
  });
  if (abortSolo) {
    // We are just watching everything in a parent folder. Abort now.
    return {root: updatedRoot, filter: () => true};
  }

  // If a user passes a directory name, then match everything inside it.
  // This is basically a no-op if we match a file, e.g. "foo/**" will match "foo" directly.
  const extendedRelativeGlobs = relativeGlobs.map((cand) => path.join(cand, path.sep, '**'));
  const globMatch = pm(extendedRelativeGlobs, {
    dot: true,  // dotfiles are handled in watcher
  });

  // Find all possible parent directory names. This is kind of awkward but we basically want to do
  // a prefix match and this is the laziest way to do it.
  const allDirs = new Set();
  for (let p of extendedRelativeGlobs) {
    for (;;) {
      if (p === '.' || !p) {
        break;
      }
      allDirs.add(path.join(p, path.sep));
      p = path.dirname(p);
    }
  }
  const dirMatch = pm([...allDirs], {dot: true});

  debug && console.warn('really watching for', extendedRelativeGlobs, 'in', updatedRoot, 'with dirs', allDirs);

  const filter = (s) => {
    if (s.endsWith(path.sep)) {
      debug && console.warn('dir', s, dirMatch(s));
      return dirMatch(s);
    }
    debug && console.warn('file', s, globMatch(s));
    return globMatch(s);
  };
  return {root: updatedRoot, filter};
};
