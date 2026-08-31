import tasks = require('azure-pipelines-task-lib/task');
import path = require('path');
import { processFrontMatterDriven, processFileList, parseFileList } from './converter';
import { sanitizeOutputVariableValue } from './output-variable';

async function run(): Promise<void> {
    try {
        tasks.setResourcePath(path.join(__dirname, '..', 'task.json'));
        const mode = tasks.getInput('mode', true)!;
        const outputFile = tasks.getInput('outputFile', true)!;
        const title = tasks.getInput('title', false) ?? 'Combined Markdown Files';
        const sections = tasks.getBoolInput('sections', false);
        const dividers = tasks.getBoolInput('dividers', false);
        const debug = tasks.getBoolInput('debug', false);

        const outPath = path.resolve(outputFile);

        if (mode === 'frontMatter') {
            const primaryFile = tasks.getInput('primaryFile', true)!;
            await processFrontMatterDriven(primaryFile, outPath, {
                titleOverride: title !== 'Combined Markdown Files' ? title : undefined,
                debug,
            });
        } else {
            // filelist mode
            const inputFilesRaw = tasks.getInput('inputFiles', true) ?? '';
            const inputFiles = parseFileList(inputFilesRaw);

            if (inputFiles.length === 0) {
                throw new Error(tasks.loc('NoInputFilesProvided'));
            }

            await processFileList(inputFiles, outPath, {
                title,
                addSections: sections,
                addDividers: dividers,
                debug,
            });
        }

        // Emitted as `##vso[task.setvariable ...]` and macro-expanded by later
        // steps, so the path is validated before it crosses that boundary.
        const safeHtmlFilePath = sanitizeOutputVariableValue(outPath);
        if (safeHtmlFilePath === null) {
            tasks.warning(tasks.loc('OutputVariableRejected', 'htmlFilePath'));
        } else {
            tasks.setVariable('htmlFilePath', safeHtmlFilePath, false, true);
        }
        tasks.setResult(tasks.TaskResult.Succeeded, tasks.loc('HtmlWrittenTo', outPath));
    } catch (error) {
        tasks.setResult(
            tasks.TaskResult.Failed,
            error instanceof Error ? error.message : String(error)
        );
    }
}

void run();
