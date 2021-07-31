Command-line filesystem watcher, useful for running commands when something changes.
Has only three direct dependencies and uses no native code!

⚠️ This uses [sents](https://www.npmjs.com/package/sents) under the hood, which is a fast watcher with zero dependencies and no native code.
Try it out if you'd like even fewer dependencies!

# Usage

```bash
npm install sents-cli

# for info on command-line args
sents --help

# to print all CSS files that have changed
sents "foo/**/*.css"

# to print everything in a folder
sents "path/to/folder"

# to rebuild JS after any file changes, deduped to every second
sents "**/*.js" -c "rollup" -d 1000
```

# Notes

- This doesn't support polling, so don't use it on network filesystems, but you shouldn't really be doing interactive dev work from there anyway

- You can't exclude files from this right now, so it might watch your whole `node_modules` folder

# Dependencies

All of these dependencies have zero further dependencies.
Therefore, using this package will add at most three dependencies to your project.

- `mri`: for parsing arguments
- `picomatch`: for supporting glob syntax
- `sents`: the underlying watcher library
