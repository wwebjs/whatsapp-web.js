name: Update

on:
    schedule:
        - cron: '0 12 * * 0'
    workflow_dispatch:

permissions:
    contents: write
    pull-requests: write

concurrency:
    group: wa-update
    cancel-in-progress: false

jobs:
    update:
        if: github.repository_owner == 'wwebjs'
        runs-on: ubuntu-latest
        defaults:
            run:
                working-directory: ./tools/version-checker

        steps:
            - name: Checkout
              uses: actions/checkout@v4

            - name: Setup Node.js
              uses: actions/setup-node@v4
              with:
                  node-version: '20'

            - name: Install dependencies
              run: npm install

            - name: Run Updater
              run: ./update-version

            - name: Store WA Version
              run: echo "WA_VERSION=$(cat ./.version)" >> $GITHUB_ENV

            - name: Create Pull Request
              uses: peter-evans/create-pull-request@v7
              with:
                  branch: auto-wa-web-update/patch
                  delete-branch: true
                  commit-message: 'chore: update supported WhatsApp Web version to v${{ env.WA_VERSION }}'
                  title: 'chore: update WhatsApp Web version (${{ env.WA_VERSION }})'
                  body: |
                      A new version of WhatsApp Web has been detected!

                      Tests should be run against this new version before merging.
                  labels: whatsapp change
                  reviewers: wwebjs
