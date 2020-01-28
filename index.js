'use strict';

const { LanguageClient, SettingMonitor, ExecuteCommandRequest } = require('vscode-languageclient');
const { workspace, commands: Commands, window: Window } = require('vscode');

const defaultLanguages = [
	'css',
	'html',
	'javascript',
	'javascriptreact',
	'less',
	'markdown',
	'postcss',
	'sass',
	'scss',
	'source.css.styled',
	'source.markdown.math',
	'styled-css',
	'sugarss',
	'svelte',
	'typescript',
	'typescriptreact',
	'vue',
	'vue-html',
	'vue-postcss',
	'xml',
	'xsl',
];

function getDocumentSelector() {
	const config = workspace.getConfiguration('stylelint');
	const validateLanguages = config.get('validate', defaultLanguages);

	const documentSelector = [];

	for (const language of validateLanguages) {
		documentSelector.push({ language, scheme: 'file' }, { language, scheme: 'untitled' });
	}

	return documentSelector;
}

exports.activate = ({ subscriptions }) => {
	const documentSelector = getDocumentSelector();
	const serverPath = require.resolve('./server.js');

	const client = new LanguageClient(
		'stylelint',
		{
			run: {
				module: serverPath,
			},
			debug: {
				module: serverPath,
				options: {
					execArgv: ['--nolazy', '--inspect=6004'],
				},
			},
		},
		{
			documentSelector,
			diagnosticCollectionName: 'stylelint',
			synchronize: {
				configurationSection: 'stylelint',
				fileEvents: workspace.createFileSystemWatcher(
					'**/{.stylelintrc{,.js,.json,.yaml,.yml},stylelint.config.js,.stylelintignore}',
				),
			},
		},
	);

	subscriptions.push(
		Commands.registerCommand('stylelint.executeAutofix', async () => {
			const textEditor = Window.activeTextEditor;

			if (!textEditor) {
				return;
			}

			const textDocument = {
				uri: textEditor.document.uri.toString(),
				version: textEditor.document.version,
			};
			const params = {
				command: 'stylelint.applyAutoFix',
				arguments: [textDocument],
			};

			await client.sendRequest(ExecuteCommandRequest.type, params).then(undefined, () => {
				Window.showErrorMessage(
					'Failed to apply styleint fixes to the document. Please consider opening an issue with steps to reproduce.',
				);
			});
		}),
	);
	subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());
};
