#!/usr/bin/env node

import mri from 'mri';
import buildWatcher from 'sents';
import * as childProcess from 'child_process';
import {build as buildFilter} from './lib/filter.js';
import * as sentsTypes from 'sents';

const args = mri(process.argv.slice(2), {
  alias: {
    'delay': ['d'],
    'debounce': ['d'],
    'command': ['c'],
    'root': ['r'],
    'initial': ['i'],
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
  -d, --debounce <ms>  debounce for command (run at most every, default 400ms)
  -c, --command <cmd>  command to run on change, use quotes
  -i, --initial        run command once at start
  -r, --root <path>    root path to use, or uses current working directory
  --dotfiles           whether to match dotfiles
  --delay <ms>         tell sents to delay change detection by this long
`;
  console.info(helpString);
  process.exit(0);
}


const {filter, root} = buildFilter(args._, args.root || process.cwd());

const paths = args._;
if (!paths.length) {
  paths.push('.');
}

/** @type {Partial<sentsTypes.CorpusOptions>} */
const options = {
  dotfiles: Boolean(args.dotfiles),
  filter,
};
if ('delay' in args) {
  options.delay = +args.delay;
}

const watcher = buildWatcher(root, options);

// TODO(samthor): This actually doesn't work right now because none of watcher uses async: it
// won't yield to this code.
const timeout = setTimeout(() => {
  console.warn('Taking a long time, did you specify too many files?');
}, 1250);
await watcher.ready;
clearTimeout(timeout);

console.warn('Watching', paths.map((r) => JSON.stringify(r)).join(', '), '...');

watcher.on('error', (e) => {
  throw e;
});

if (args.command) {
  /**
   * Call when the comamnd should be triggered. Debounces based on args.
   */
  const requestCommand = (function() {
    /** @type {NodeJS.Timeout?} */
    let timeoutCommand = null;

    return () => {
      if (timeoutCommand) {
        return;
      }
      timeoutCommand = setTimeout(() => {
        timeoutCommand = null;
        childProcess.execSync(args.command, {stdio: 'inherit'});
      }, args.debounce);
    };
  })();

  args.initial && requestCommand();
  watcher.on('raw', requestCommand);
} else {
  watcher.on('raw', (s, type) => {
    console.info(`${type}:${s}`);
  });
}
