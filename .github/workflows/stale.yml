name: Mark Stale Issues and PRs

on:
    schedule:
        - cron: '0 0 * * *'
    workflow_dispatch:

permissions:
    issues: write
    pull-requests: write

concurrency:
    group: stale
    cancel-in-progress: false

jobs:
    stale:
        if: github.repository_owner == 'wwebjs'
        runs-on: ubuntu-latest
        steps:
            - name: Mark stale issues and PRs
              uses: actions/stale@v10
              with:
                  repo-token: ${{ secrets.GITHUB_TOKEN }}
                  days-before-stale: 35
                  days-before-close: 7
                  stale-issue-label: 'stale'
                  stale-pr-label: 'stale'
                  start-date: '2026-03-03T00:00:00Z'
                  remove-stale-when-updated: true
                  exempt-issue-labels: 'pinned,security,feature request,issued high'
                  exempt-pr-labels: 'pinned,security,whatsapp change,approved,waiting for testers'
                  stale-issue-message: >
                      Marking this issue as stale due to inactivity. Comment or update the issue to
                      keep it open. It will be closed in 7 days otherwise. Thank you for your contributions.
                  stale-pr-message: >
                      Marking this pull request as stale due to inactivity. Push changes or comment
                      to keep it open. It will be closed in 7 days otherwise. Thank you for your contributions.
                  close-issue-message: >
                      Closing this issue due to inactivity. Feel free to reopen if it is still relevant.
                  close-pr-message: >
                      Closing this pull request due to inactivity. You can reopen it anytime to continue.
