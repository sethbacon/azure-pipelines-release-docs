/**
 * Regression for #133 finding 1: tasks.setResourcePath() must run INSIDE the
 * task's own try/catch, not before it. Patches setResourcePath to throw
 * before the real entry point runs, so a genuine early-setup failure is
 * reported as a clean Failed result instead of an unhandled rejection that
 * crashes the process before tasks.setResult ever runs.
 */

import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const tp = path.join(__dirname, '..', 'src', 'index.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

// TaskMockRunner replaces the entire 'azure-pipelines-task-lib/task' module
// the real entry point sees with its own mock-task module, so overriding
// setResourcePath must go through registerMockExport (the mock instance)
// rather than patching the real module directly, which the entry point
// would never observe.
tr.registerMockExport('setResourcePath', () => {
    throw new Error('boom-from-setResourcePath');
});

tr.run();
