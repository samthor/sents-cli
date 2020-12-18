#!/usr/bin/env node

import mri from 'mri';
import buildWatcher from 'sents';
import pm from 'picomatch';
import path from 'path';
import childProcess from 'child_process';

const args = mri(process.argv.slice(2), {
  alias: {
    'debounce': ['d'],
    'command': ['c'],
    'root': ['r'],
  },
  default: {
    'debounce': 400,
  },
  boolean: ['initial', 'help'],
});

if (args.help) {
  const helpString = `Usage: sents-cli [options] <glob...>

Command-line file watcher with no native dependencies. Watches relative to your
current working directory (unless --root specified). Runs command if specified,
otherwise prints matched changes.

Globs:
  Uses \`picomatch\` for glob syntax. e.g., "src/**/*.js" or "blah/foo.css".
  If none specified, matches all files.

Options:
  -d, --debounce <ms>  debounce time for command
  -c, --command <cmd>  command to run on change, use quotes
  -r, --root <path>    root path to use, or uses current working directory
  --dotfiles           whether to match dotfiles
`;
  console.info(helpString);
  process.exit(0);
}

/**
 * Call when the comamnd should be triggered. Debounces based on args.
 */
const requestCommand = args.command ? (function() {
  const run = () => {
    // TODO(samthor): possibly broken
    childProcess.execFileSync(args.command, {shell: true, stdio: 'inherit'});
  };

  let timeoutCommand = 0;

  return () => {
    if (timeoutCommand !== 0) {
      return;
    }
    timeoutCommand = setTimeout(() => {
      timeoutCommand = 0;
      run();
    }, args.debounce);
  }
})() : null;

/**
 * Builds the filter passed to Sents.
 */
const filter = (function() {
  if (!args._.length) {
    return () => true;
  }

  const globs = args._.filter((cand) => {
    if (cand.startsWith('/')) {
      throw new Error('regexp unsupported');
    }
    return true;
  });

  const globMatch = pm(globs, {
    dot: true,  // dotfiles are handled in watcher
  });

  return (s) => {
    if (s.endsWith(path.sep)) {
      // TODO: do some kinda prefix match on left
      // e.g. input: "foo/bar/" against
      //      glob: "**/bar/zing/*.js" will pass
      return true;
    }
    return globMatch(s);
  };

}());

const root = args.root || process.cwd();

const watcher = buildWatcher(root, {
  dotfiles: Boolean(args.dotfiles),
  filter,
});
await watcher.ready;

watcher.on('error', (e) => {
  throw e;
});

if (args.command) {
  if (args.initial) {
    requestCommand();
  }
  watcher.on('change', () => {
    requestCommand();
  });
} else {
  watcher.on('change', (s, type) => {
    console.info(`${type}:${s}`);
  });
}
