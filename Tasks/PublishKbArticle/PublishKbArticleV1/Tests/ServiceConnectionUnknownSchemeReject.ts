// Full-task test: a serviceConnection whose authorization scheme is set to
// something resolveAuth() doesn't recognize (neither a basic-shaped scheme
// nor OAuth/OAuth2) must NOT be silently treated as OAuth. Before the fix,
// resolveAuth()'s scheme check was `if (usernamepassword/basic) ... else
// (treat as oauth)`, so ANY unrecognized scheme fell into the OAuth branch by
// default. This connection presents a 'Certificate' scheme (a real ADO
// built-in, but not one resolveAuth() has ever handled) and DOES have
// clientId/clientSecret endpoint parameters available -- exactly the shape
// that would let the old code silently proceed into a real OAuth token
// exchange the operator never explicitly chose. The fix must reject this
// before any network client runs.
//
// (A completely UNSET scheme is a separate, already-covered case: task-lib's
// own getEndpointAuthorizationScheme(id, /*optional*/ false) throws
// "Endpoint auth data not present" before resolveAuth's scheme check ever
// runs, since resolveAuth always calls it non-optional.)
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const tp = path.join(__dirname, '..', 'src', 'index.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);

tr.setInput('serviceConnection', 'MyUnknownSchemeConnection');
tr.setInput('articleId', 'existing-art-id');
tr.setInput('workflowState', 'publish');
tr.setInput('dryRun', 'false');

process.env['ENDPOINT_URL_MyUnknownSchemeConnection'] = 'https://sc-instance.service-now.com';
process.env['ENDPOINT_AUTH_SCHEME_MyUnknownSchemeConnection'] = 'Certificate';
process.env['ENDPOINT_AUTH_PARAMETER_MyUnknownSchemeConnection_CLIENTID'] = 'sc-client-id';
process.env['ENDPOINT_AUTH_PARAMETER_MyUnknownSchemeConnection_CLIENTSECRET'] = 'sc-client-secret';

// If the missing-scheme guard were bypassed, these would be invoked -- fail
// loudly so an escaped call (and a real un-mocked network attempt) is
// unmistakable, mirroring the sibling instance-SSRF-guard fixtures.
tr.registerMock('./auth', {
  getOAuthToken: async () => { throw new Error('NETWORK_CALLED: getOAuthToken'); },
  getAuthHeaders: () => { throw new Error('NETWORK_CALLED: getAuthHeaders'); },
});
tr.registerMock('./servicenow-client', {
  getKnowledgeBases: async () => { throw new Error('NETWORK_CALLED: getKnowledgeBases'); },
  getArticle: async () => { throw new Error('NETWORK_CALLED: getArticle'); },
  createKnowledgeArticle: async () => { throw new Error('NETWORK_CALLED: createKnowledgeArticle'); },
  updateKnowledgeArticle: async () => { throw new Error('NETWORK_CALLED: updateKnowledgeArticle'); },
  changeWorkflowState: async () => { throw new Error('NETWORK_CALLED: changeWorkflowState'); },
  findArticleBySourceKey: async () => { throw new Error('NETWORK_CALLED: findArticleBySourceKey'); },
  updateArticleBody: async () => { throw new Error('NETWORK_CALLED: updateArticleBody'); },
});

const a: ma.TaskLibAnswers = {};
tr.setAnswers(a);
tr.run();
