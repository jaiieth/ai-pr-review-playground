# ai-pr-review-playground

Synthetic NestJS + Prisma "sale order" code used to try three AI pull-request reviewers side by side
on the OpenCode Go subscription. **Not real ERP code** — the feature branches contain deliberately planted bugs.

| Workflow | Tool | Runs on |
|---|---|---|
| `.github/workflows/opencode.yml` | [OpenCode GitHub action](https://opencode.ai/docs/github/) | PR opened / reopened / ready for review, `/oc` comments |
| `.github/workflows/ocr-review.yml` | [alibaba/open-code-review](https://github.com/alibaba/open-code-review) | PR opened / reopened / ready / every push, manual dispatch |
| `.github/workflows/pr-agent.yml` | [PR-Agent](https://github.com/the-pr-agent/pr-agent) | PR opened / reopened / ready / every push (`/review`), PR comments |

Drafts are skipped by all three. Commands in comments are accepted only from the owner and collaborators.
