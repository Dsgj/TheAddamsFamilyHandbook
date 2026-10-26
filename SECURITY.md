# Security policy

## Supported version

Security fixes target the current `main` branch and its published GitHub Pages build.
Older installed copies should be updated before restoring data or testing a reported fix.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/Dsgj/TheAddamsFamilyHandbook/security/advisories/new).
Include the affected page or commit, reproduction steps, and the expected and actual behavior.
Do not include real credentials, device backups, or personal service notes in public issues.
There is no guaranteed response time.

## Security boundaries

The app is a static site. It has no server-side account, secret store, or AI API integration.
Status, notes, checklists, and backups stay on the device unless the user exports or shares them.
Do not put API keys in source code, public assets, browser storage, or build-time frontend variables.

## Automated checks

- CodeQL analyzes JavaScript/TypeScript, Python tools, and GitHub Actions on pull requests,
  pushes to `main`, and weekly, using the `security-and-quality` query suite.
- Dependency review blocks pull requests introducing high or critical known vulnerabilities.
- Dependabot alerts and security updates track vulnerable dependencies independently of the
  monthly version-update schedule. Node and TypeScript major upgrades remain deliberate changes.
- Secret scanning and push protection are configured in the repository settings.
- Branch rules require pull requests, resolved review conversations, and successful checks.
  No independent approving review is required while the repository is maintained by one owner.

Automated checks do not establish that repair instructions or component data are correct.
Machine work still needs verification against the source material and the actual machine.
