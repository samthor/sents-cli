#!/usr/bin/env node

import mri from 'mri';
import buildWatcher from 'sents';
import pm from 'picomatch';
import path from 'path';
import childProcess from 'child_process';

const args = mri(process.argv.slice(2), {
  alias: {
    'delay': ['d'],
    'debounce': ['d'],
    'command': ['c'],
    'root': ['r'],
  },
  default: {
    'delay': undefined,
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
  Be sure to specify your globs in quotes "*.js" so that your shell doesn't
  expand them for you.

Options:
  -d, --debounce <ms>  debounce time for command
  -c, --command <cmd>  command to run on change, use quotes
  -r, --root <path>    root path to use, or uses current working directory
  --dotfiles           whether to match dotfiles
  --delay <ms>         tell sents to delay change detection by this long
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
    childProcess.execSync(args.command, {shell: true, stdio: 'inherit'});
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

  // TODO(samthor): Make noise about all the arguments which are not actually globs, so users
  // realise that their shell might have expanded them.

  const globMatch = pm(globs, {
    dot: true,  // dotfiles are handled in watcher
  });

  return (s) => {
    if (s.endsWith(path.sep)) {
      // TODO(samthor): do some kinda prefix match on left
      // e.g. input: "foo/bar/" against
      //      glob: "**/bar/zing/*.js" should pass
      return true;
    }
    return globMatch(s);
  };

}());

const root = args.root || process.cwd();

/** @type {import('sents').CorpusOptions} */
const options = {
  dotfiles: Boolean(args.dotfiles),
  filter,
};
if ('delay' in args) {
  options.delay = +args.delay;
}
const watcher = buildWatcher(root, options);
await watcher.ready;

watcher.on('error', (e) => {
  throw e;
});

if (args.command) {
  if (args.initial) {
    requestCommand();
  }
  watcher.on('raw', () => {
    requestCommand();
  });
} else {
  watcher.on('raw', (s, type) => {
    console.info(`${type}:${s}`);
  });
}
