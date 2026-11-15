# Contributing to segl.

Repository: [Naerverk/segl](https://github.com/Naerverk/segl).
Anyone can propose changes through a fork and a pull request. Only maintainers merge and deploy.
Contributions are reviewed as capacity allows; there is no promise of response time or that a
proposal will be accepted. Please discuss larger features in an issue before you start. Small
fixes can be sent directly.

## Local development

Use the Node.js version in `.nvmrc`, then run `npm ci` and `npm run dev`.
Keep pull requests small and describe the problem, the change and how it was verified.
Run `npm run typecheck`, `npm test` and `npm run build`.
For changes to document processing, privacy or the user flow, install Chromium with
`npx playwright install chromium` and run `npm run test:e2e`.
Add regression tests for bug fixes.

## Documents and security

Only use synthetic test files. Never attach ID documents, personal data, passwords, API keys or
real user documents to issues, pull requests, screenshots or logs.
Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
Changes must preserve local document processing, permanent redaction and explicit errors on
incomplete rendering. New network requests and dependencies must be justified.

Contributions are made under the project's [MIT license](LICENSE). Be considerate and keep
discussions on topic.
