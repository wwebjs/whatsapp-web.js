const { expect } = require('chai');
const sinon = require('sinon');

const Client = require('../src/Client');
const GroupChat = require('../src/structures/GroupChat');

function createPage(modules) {
    return {
        evaluate: async (callback, argument) => {
            global.window = {
                require: (name) => modules[name],
            };

            try {
                return await callback(argument);
            } finally {
                delete global.window;
            }
        },
    };
}

describe('Group invite bundle', function () {
    it('loads the invite bundle before accepting an invite', async function () {
        const modules = {};
        const joinGroupViaInvite = sinon.stub().resolves({
            gid: { _serialized: '123@g.us' },
        });
        const requireBundle = sinon.stub().callsFake(async () => {
            modules.WAWebGroupInviteJob = { joinGroupViaInvite };
        });

        modules.WAWebGroupQueryJob = {
            queryGroupInvite: sinon
                .stub()
                .resolves({ membershipApprovalMode: true }),
        };
        modules.WAWebGroupInviteLinkDrawerLoadable = { requireBundle };

        const client = Object.create(Client.prototype);
        client.pupPage = createPage(modules);

        const groupId = await client.acceptInvite('invite-code');

        expect(groupId).to.equal('123@g.us');
        expect(requireBundle.calledOnce).to.equal(true);
        expect(joinGroupViaInvite.calledOnceWith('invite-code', true)).to.equal(
            true,
        );
    });

    it('loads the invite bundle before fetching an invite code', async function () {
        const modules = {};
        const fetchMexGroupInviteCode = sinon
            .stub()
            .resolves({ code: 'invite-code' });
        const requireBundle = sinon.stub().callsFake(async () => {
            modules.WAWebMexFetchGroupInviteCodeJob = {
                fetchMexGroupInviteCode,
            };
        });

        modules.WAWebGroupInviteLinkDrawerLoadable = { requireBundle };

        const group = Object.create(GroupChat.prototype);
        group.client = { pupPage: createPage(modules) };
        group.id = { _serialized: '123@g.us' };

        const inviteCode = await group.getInviteCode();

        expect(inviteCode).to.equal('invite-code');
        expect(requireBundle.calledOnce).to.equal(true);
        expect(fetchMexGroupInviteCode.calledOnceWith('123@g.us')).to.equal(
            true,
        );
    });
});
