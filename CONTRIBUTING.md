# Contributing Guidelines

When contributing to this project/repository, please first discuss the change you wish to make via issue,
email, or any other method with the owners/maintainers of this repository before making a change.

Please note we have a [code of conduct](https://github.com/neosubhamoy/neodlp?tab=coc-ov-file), please follow it in all your interactions with the project.

## Creating an Issue

### When to create an issue

- Noticed any bug or inconstencies? report it!
- Want a feature? request it!
- Want to contribute to this project? communicate with the maintainers.
- Want to give us some suggetions? or you have any other question regarding this project.

### Steps to create an issue

1. Go to [issues](https://github.com/neosubhamoy/neodlp/issues) tab
2. Click on the 'New Issue' button
3. Choose a issue template:  [Report a Bug](https://github.com/neosubhamoy/neodlp/issues/new?template=bug_report.md) / [Request a Feature](https://github.com/neosubhamoy/neodlp/issues/new?template=feature_request.md) / [Other Issue](https://github.com/neosubhamoy/neodlp/issues/new?template=BLANK_ISSUE)
4. Fill-up all the issue template fields in detail
5. Click on the 'Create' button to submit the issue
6. Wait for the maintainers to review your issue! If everything goes well, You will most likely hear back from us within 24-48hrs. (You can view the status of your issue anytime at the [isuues](https://github.com/neosubhamoy/neodlp/issues) tab)

> [!NOTE]
> DO NOT SKIP ANY REQUIRED FIELD INTENTINALY WHILE CREATING AN ISSUE, INCOMPLETE ISSUES WILL BE CLOSED WITHOUT FURTHER  NOTICE. Always make sure to include as much detail as possible to clearly explain the matter! Attach screenshots/links whenever needed.

## Sending a Pull Request

### PR Guidelines

- Each pull request must be tied to resolve a sole pourpose/goal, it should not change anything extra out of it's primary scope.
- The pull request body should briefly describe the notable changes made through the PR and why it is done in that way!
- The PR body should include screenshots/links if applicable.
- The PR title must be related to the primary goal (it should be short, precise and easy to understand)
- If the PR is resolving any issue, it must reference the issues at the end of the PR title using the `#` notation.

### Steps to send a pull request

1. First find an isuue you would like to resolve. View the [open issues](https://github.com/neosubhamoy/neodlp/issues) tab. (comment on the issue to attract the attention of the maintainers and ask them that you would like to work on it) Once you get the approval you can start working...!!
2. Make sure to install [Rust](https://www.rust-lang.org/tools/install), [Node.js](https://nodejs.org/en), [Git](https://git-scm.com/downloads) and [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform (OS) before proceeding.
3. Fork this repo in your GitHub account (click on the 'fork' button on the top right corner of the repo)
4. Clone the forked repo in your local machine: `git clone https://github.com/<your_username>/neodlp.git`
5. Go inside the cloned project directory: `cd neodlp`
6. Create a new git feature branch (name it based on the changes you are about to make): `git checkout -b <new-branch-name>`
7. Install Node.js dependencies: `npm install`
8. Download required external binaries (for your platform): `npm run download`
9. Run build / dev process (run the command based on your platform and architecture, run the build command once before running the dev command for the first time to avoid compile time errors)
```shell
# build commands for windows users
npm run tauri:build:windows-x64     # for x64 devices
npm run tauri:build:windows-arm64   # for ARM64 devices

# development commands for windows users
npm run tauri:dev:windows-x64       # for x64 devices
npm run tauri:dev:windows-arm64     # for ARM64 devices

# build commands for linux users
npm run tauri:build:linux-x64       # for x64 devices
npm run tauri:build:linux-arm64     # for ARM64 devices

# development commands for linux users
npm run tauri:dev:linux-x64         # for x64 devices
npm run tauri:dev:linux-arm64       # for ARM64 devices

# build commands for macOS users
npm run tauri:build:macos-arm64     # for apple silicon macs
npm run tauri:build:macos-x64       # for intel x86 macs

# development commands for macOS users
npm run tauri:dev:macos-arm64       # for apple silicon macs
npm run tauri:dev:macos-x64         # for intel x86 macs
```
10. Do the required code changes (following the style guidelines)
11. Add and commit the changes: `git add .` then `git commit -m "prefix: your message here"`
12. Push the commits: `git push origin <new-branch-name>`
13. Visit GitHub and send the pull request. (following the PR guidelines)
14. Wait for the maintainers to review your PR! You will most likely hear back from us within 24-48hrs. (You can view the status of your PR anytime at the [pull requests](https://github.com/neosubhamoy/neodlp/pulls) tab)
15. You might be asked to do more changes if required. (try to resolve the requested changes ASAP, and always follow-up the maintainers). If everything goes well, your pull request will be merged by the maintainers.

## Style Guidelines

- Write maintainable and easy to understand code and follow existing code conventions
- Use meaningful variable and function names
- Explain complex code using comments
- Use [conventional commit messages](https://www.conventionalcommits.org/en/v1.0.0/)
- Follow [semantic versioning](https://semver.org/) conventions

## AI Guidelines

In this era of Artificial Intelligence, Using AI for your coding help is fine! But, contributions made purely using vibe-coding / AI automations without proper human intervention is not acceptable! If we identify such cases your Issue/PR will be closed/rejected without further notice and repeating such action more than one time will result in a permanent ban from this repo.

## License

By contributing to this project/repository, You agree that your code will be published under the [MIT License](https://github.com/neosubhamoy/neodlp/blob/main/LICENSE).

Thanks for your contribution, We appreciate your efforts :)
