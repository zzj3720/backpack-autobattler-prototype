# Contribution And Triage Policy

This prototype uses GitHub Issues as the playtest feedback inbox.

## Issue Response Rules

Every issue should receive a response. Silence is not an acceptable triage outcome.

Accepted issues:

- Comment that the issue is accepted.
- Apply `accepted` and, when relevant, `needs-work`.
- Create a branch for the work.
- Open a pull request with a closing keyword such as `Closes #123`.
- After the pull request is merged, reply on the issue with the PR/deploy reference.

Rejected issues:

- Comment with a concise rationale.
- Apply `declined`.
- Close the issue if no follow-up is needed.

Deferred issues:

- Comment with the reason it is deferred.
- Apply `deferred`.
- Leave the issue open only when future review is useful.

Needs more information:

- Ask for the missing details.
- Apply `needs-info`.
- Include the specific seed, build code, browser/device, screenshot, or repro details needed.

## Pull Request Rules

Pull requests that implement accepted issues should:

- Link the issue using `Closes #123`, `Fixes #123`, or `Resolves #123`.
- Include the user-facing impact.
- List the verification commands run.
- Keep gameplay logic changes covered by headless tests when practical.
