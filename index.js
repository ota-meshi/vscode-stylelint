'use strict';

const { LanguageClient, ExecuteCommandRequest, Disposable } = require('vscode-languageclient');
const { workspace, commands: Commands, window: Window } = require('vscode');

function buildDocumentSelector(validate) {
	const languages = validate && validate.length ? validate : ['css', 'less', 'postcss', 'scss'];

	const documentSelector = [];

	for (const language of languages) {
		documentSelector.push({ language, scheme: 'file' }, { language, scheme: 'untitled' });
	}

	return documentSelector;
}

exports.activate = ({ subscriptions }) => {
	let stylelintConfigurations = getConfigurations();
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
			documentSelector: buildDocumentSelector(stylelintConfigurations.validate),
			diagnosticCollectionName: 'stylelint',
			synchronize: {
				configurationSection: 'stylelint',
				fileEvents: workspace.createFileSystemWatcher(
					'**/{.stylelintrc{,.js,.json,.yaml,.yml},stylelint.config.js,.stylelintignore}',
				),
			},
		},
	);

	if (stylelintConfigurations.enable) {
		client.start();
	}

	workspace.onDidChangeConfiguration(configurationChanged);

	subscriptions.push(
		Disposable.create(() => {
			if (client.needsStop()) {
				client.stop();
			}
		}),
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

	function getConfigurations() {
		const configuration = workspace.getConfiguration('stylelint');

		return {
			validate: configuration.get('validate', ['css', 'less', 'postcss', 'scss']),
			enable: configuration.get('enable', true),
		};
	}

	async function configurationChanged() {
		const oldConfigurationsJSON = JSON.stringify(stylelintConfigurations);

		stylelintConfigurations = getConfigurations();

		const isChanged = JSON.stringify(stylelintConfigurations) !== oldConfigurationsJSON;

		if (!isChanged) {
			return;
		}

		if (client.needsStop()) {
			await client.stop();
		}

		client.clientOptions.documentSelector = buildDocumentSelector(stylelintConfigurations.validate);

		if (stylelintConfigurations.enable && client.needsStart()) {
			client.start();
		}
	}
};
