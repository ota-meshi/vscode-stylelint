'use strict';

const path = require('path');
const pWaitFor = require('p-wait-for');
const test = require('tape');
const { extensions, workspace, window, Uri, commands, languages } = require('vscode');
/**
 * @typedef { import('vscode').TextDocument } TextDocument
 * @typedef { import('vscode').Diagnostic } Diagnostic
 */

const run = () =>
	test('vscode-stylelint with "stylelint.validate"', async (t) => {
		await commands.executeCommand('vscode.openFolder', Uri.file(__dirname));

		const vscodeStylelint = extensions.getExtension('stylelint.vscode-stylelint');

		// Open the './test.css' file.
		const cssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.css'));

		await window.showTextDocument(cssDocument);

		await pWaitFor(() => vscodeStylelint.isActive, { timeout: 2000 });

		// Wait 2 second to wait for stylelint processing.
		await wait(2000);

		// Check the result.
		t.deepEqual(
			languages.getDiagnostics(cssDocument.uri).length,
			0,
			'Should be no errors if "css" is not included in the "validate".',
		);

		await executeAutofix();

		// Check the fixed text result.
		t.equal(
			cssDocument.getText(),
			'/* prettier-ignore */\n.foo .bar {\n  color: red;\n}\n',
			'Should be no changes if "css" is not included in the "validate".',
		);

		// Open the './test.scss' file.
		const scssDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.scss'));

		await window.showTextDocument(scssDocument);

		// Check the result.
		t.deepEqual(
			(await getDiagnostics(scssDocument)).length,
			1,
			'Should has errors if "scss" is included in the "validate".',
		);

		await executeAutofix();

		// Check the fixed text result.
		t.equal(
			scssDocument.getText(),
			'/* prettier-ignore */\n.foo .bar {\n    color: red;\n}\n',
			'Should to changes if "scss" is included in the "validate".',
		);

		// Open the './test.txt' file.
		const txtDocument = await workspace.openTextDocument(path.resolve(__dirname, 'test.txt'));

		await window.showTextDocument(txtDocument);

		// Check the result.
		t.deepEqual(
			(await getDiagnostics(txtDocument)).length,
			1,
			'Should has errors if "plaintext" is included in the "validate".',
		);

		await executeAutofix();

		// Check the fixed text result.
		t.equal(
			txtDocument.getText(),
			'.foo .bar {\n    color: red;\n}\n',
			'Should to changes if "plaintext" is included in the "validate".',
		);

		t.end();
	});

exports.run = (root, done) => {
	test.onFinish(done);
	run();
};

function wait(timeout) {
	return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * @param {TextDocument} document
 * @returns {Diagnostic[]}
 */
async function getDiagnostics(document) {
	function getStylelintDiagnostics() {
		const diagnostics = languages.getDiagnostics(document.uri);

		return diagnostics.filter((d) => d.source === 'stylelint');
	}

	// Wait until the stylelint errors is detected.
	await pWaitFor(() => getStylelintDiagnostics().length > 0, { timeout: 2000 });

	return getStylelintDiagnostics();
}

async function executeAutofix() {
	// Wait until the Autofix command is available.
	await pWaitFor(
		async () => {
			const names = await commands.getCommands();

			return names.includes('stylelint.executeAutofix') && names.includes('stylelint.applyAutoFix');
		},
		{ timeout: 2000 },
	);

	// Execute the Autofix command.
	await commands.executeCommand('stylelint.executeAutofix');
}
