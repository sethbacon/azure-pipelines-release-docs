#!/usr/bin/env node
'use strict'

// Single source of truth for "what is a task directory?".
//
// Three scripts used to answer that question independently — check-versions.js
// and for-each-task.js each walked exactly two directory levels looking for a
// task.json, while copy-build.js walked Tasks/ recursively and packaged whatever
// it found. Only the gates were restrictive, so a task.json one level deeper was
// validated by nobody and shipped anyway (issue #37). The fix is not a better
// filter in copy-build.js; it is that composition and enumeration stop being two
// functions with two definitions.
//
// Canonical layout, matching the sibling extensions:
//
//   Tasks/<Family>/<TaskDirVn>/task.json
//
// exactly two directory levels below Tasks/. Anything else under Tasks/ is a
// layout error, not a thing to be quietly copied or quietly skipped.

const fs = require('node:fs')
const path = require('node:path')

// Directory levels below Tasks/ at which a task.json is canonical.
// Tasks/<Family>/<TaskDir>/task.json === 2.
const TASK_DIR_DEPTH = 2

function toPosix(p) {
  return p.split(path.sep).join('/')
}

/**
 * Every immediate subdirectory of Tasks/<Family>/ that contains a task.json,
 * as sorted repo-relative POSIX paths ('Tasks/<Family>/<TaskDir>').
 *
 * This is the enumeration every gate and the packager agree on.
 */
function discoverTaskDirs(root) {
  const tasksRoot = path.join(root, 'Tasks')
  if (!fs.existsSync(tasksRoot)) return []

  const dirs = []
  for (const family of fs.readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!family.isDirectory()) continue
    const familyPath = path.join(tasksRoot, family.name)
    for (const taskDir of fs.readdirSync(familyPath, { withFileTypes: true })) {
      if (!taskDir.isDirectory()) continue
      if (fs.existsSync(path.join(familyPath, taskDir.name, 'task.json'))) {
        dirs.push(`Tasks/${family.name}/${taskDir.name}`)
      }
    }
  }
  return dirs.sort()
}

/**
 * Every entry under `dir`, recursively, WITHOUT following symlinks.
 *
 * `fs.readdirSync(.., { withFileTypes: true })` reports a symlink dirent as
 * isSymbolicLink() — isFile() and isDirectory() are both false for it. That is
 * the exact property copy-build.js used to get wrong: its `if (isDirectory)`
 * / `else` fell through to `copyFileSync`, which FOLLOWS the link and copies
 * the target's bytes (issue #40). Here a symlink is reported as a symlink and
 * never descended into, so callers decide what to do about it rather than
 * silently dereferencing it.
 *
 * Returns entries as { rel, kind } where rel is repo-relative POSIX and kind is
 * one of 'file' | 'dir' | 'symlink' | 'other'.
 */
function walkTree(root, relDir, shouldDescend = () => true) {
  const out = []
  const absDir = path.join(root, relDir)
  if (!fs.existsSync(absDir)) return out

  const stack = [relDir]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(path.join(root, current), { withFileTypes: true })) {
      const rel = toPosix(path.join(current, entry.name))
      if (entry.isSymbolicLink()) {
        out.push({ rel, kind: 'symlink' })
      } else if (entry.isDirectory()) {
        out.push({ rel, kind: 'dir' })
        if (shouldDescend(rel)) stack.push(rel)
      } else if (entry.isFile()) {
        out.push({ rel, kind: 'file' })
      } else {
        out.push({ rel, kind: 'other' })
      }
    }
  }
  return out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
}

/** True when `rel` is inside one of `taskDirs` (or is one of them). */
function insideTaskDir(rel, taskDirs) {
  return taskDirs.some((dir) => rel === dir || rel.startsWith(`${dir}/`))
}

/** True when `rel` is an ancestor directory of one of `taskDirs`. */
function ancestorOfTaskDir(rel, taskDirs) {
  return taskDirs.some((dir) => dir.startsWith(`${rel}/`))
}

module.exports = { TASK_DIR_DEPTH, discoverTaskDirs, walkTree, insideTaskDir, ancestorOfTaskDir, toPosix }
