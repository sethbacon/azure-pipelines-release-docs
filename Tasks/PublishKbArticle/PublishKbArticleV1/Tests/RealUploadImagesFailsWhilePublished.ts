// Full-task test: the article's update call already set workflow_state to
// 'published' (ServiceNow has no separate publish step on that path), and the
// subsequent image-upload phase then fails. The task must still fail, but it
// must ALSO warn that the article may already be live with unrewritten local
// image references (#126).
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import os = require('os');

const tp = path.join(__dirname, '..', 'src', 'index.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-real-upload-images-published-'));
const htmlFile = path.join(dir, 'article.html');
fs.writeFileSync(htmlFile, '<p>Body with an image</p><img src="pic.png">');

tr.setInput('instance', 'my-valid-instance');
tr.setInput('authType', 'basic');
tr.setInput('username', 'svc-user');
tr.setInput('password', 'svc-pass');
tr.setInput('articleId', 'existing-art-id');
tr.setInput('title', 'Article With Image');
tr.setInput('htmlFile', htmlFile);
tr.setInput('workflowState', 'publish');
tr.setInput('dryRun', 'false');
tr.setInput('skipJsonLookup', 'true');
tr.setInput('force', 'false');
tr.setInput('uploadImages', 'true');
tr.setInput('emitManifest', path.join(dir, 'manifest.json'));

tr.registerMock('./servicenow-client', {
  updateKnowledgeArticle: async () => ({ sys_id: 'existing-art-id', number: 'KB0052', workflow_state: 'published' }),
  updateArticleBody: async () => { throw new Error('updateArticleBody must not be called'); },
});
tr.registerMock('./attachments', {
  processArticleImages: async () => { throw new Error('simulated ServiceNow outage during image upload'); },
});

const a: ma.TaskLibAnswers = {};
tr.setAnswers(a);
tr.run();
