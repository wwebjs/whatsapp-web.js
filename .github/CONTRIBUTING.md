# Contributing

If you want to contribute to whatsapp-web.js, start by forking the repository and opening a pull request with your changes. The project uses ESLint and Prettier to enforce a consistent coding style, so setting them up in your development environment is recommended to ensure your contributions meet the formatting standards.

## Questions

Do not open issues for general questions or support requests. For help, please join the [Discord Server][discord] instead. Installation instructions and general guidance are available in the documentation. Issues opened for questions will be closed.

### Issue Tracker

Before creating a new issue, review the existing [issue tracker][issue-tracker] to avoid duplicates.

## Issues and Pull Requests

- **Bug reports** must include a minimal reproduction and clear steps to reproduce the problem.
- **Feature requests** should clearly describe the use case and explain why the feature belongs in the library.
- **Pull requests and commit messages** must follow the conventional commit format for both commit messages and the PR title (e.g. `feat(client): add sendMessage option`). The commit type is case-insensitive (`feat`, `Feat`, and `FEAT` are all valid).
- All pull requests should target the `main` branch unless discussed otherwise.
- Ensure that linting and tests pass before submitting your pull request.

## Setup

To prepare your development environment:

1. Fork and clone the repository, and ensure you are on the `main` branch.
2. Run `npm install` to install all dependencies.
3. Implement your changes or improvements.
4. Run `npm run check` to execute ESLint and Prettier checks.
5. Run `npm test` to ensure the test suite passes.
6. Submit a pull request (make sure it follows the conventional commit format).

## Testing Locally

To test your changes within your own project:

1. Clone the repository and apply your modifications.
2. Run `npm install` inside the cloned directory.
3. In your project, run `npm link <path-to-your-clone>` to create a symlink to your local version.
4. Import the package and verify your changes.
5. If everything works as expected, you’ve successfully implemented your changes without breaking the library.

[discord]: https://discord.wwebjs.dev/
[issue-tracker]: https://github.com/wwebjs/whatsapp-web.js/issues
