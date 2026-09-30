const chai = require('chai');
const sinon = require('sinon');

const Call = require('../src/structures/Call');
const Client = require('../src/Client');

chai.use(require('chai-as-promised'));
const expect = chai.expect;

// These are unit tests: the injected browser functions run inside WhatsApp Web,
// so the pupPage.evaluate calls are stubbed and only the API surface (the
// arguments handed to the injected layer) is asserted. No live session needed.
describe('Calls', function () {
    describe('Call', function () {
        const callData = {
            id: 'call-id',
            peerJid: 'peer@c.us',
            offerTime: 1700000000,
            isVideo: false,
            isGroup: false,
            outgoing: true,
        };

        let client;
        let call;

        beforeEach(function () {
            client = { pupPage: { evaluate: sinon.stub().resolves(true) } };
            call = new Call(client, callData);
        });

        it('exposes the call data', function () {
            expect(call.id).to.equal('call-id');
            expect(call.from).to.equal('peer@c.us');
            expect(call.timestamp).to.equal(1700000000);
            expect(call.isVideo).to.equal(false);
            expect(call.isGroup).to.equal(false);
            expect(call.fromMe).to.equal(true);
        });

        describe('accept', function () {
            it('answers with audio and injection on by default', async function () {
                await call.accept();
                expect(client.pupPage.evaluate.calledOnce).to.equal(true);
                const args = client.pupPage.evaluate.firstCall.args;
                expect(args[0]).to.be.a('function');
                expect(args.slice(1)).to.deep.equal(['call-id', false, true]);
            });

            it('answers with video when requested', async function () {
                await call.accept({ video: true });
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['call-id', true, true]);
            });

            it('can disable audio injection to use the real microphone', async function () {
                await call.accept({ injectAudio: false });
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['call-id', false, false]);
            });
        });

        describe('reject', function () {
            it('rejects using the peer jid and the call id', async function () {
                await call.reject();
                const args = client.pupPage.evaluate.firstCall.args;
                expect(args[0]).to.be.a('function');
                expect(args.slice(1)).to.deep.equal(['peer@c.us', 'call-id']);
            });
        });

        describe('end', function () {
            it('ends the call by id', async function () {
                await call.end();
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['call-id']);
            });
        });

        describe('playAudio', function () {
            it('accepts a base64 string', async function () {
                await call.playAudio('BASE64DATA');
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['BASE64DATA']);
            });

            it('accepts a MessageMedia and forwards its data', async function () {
                await call.playAudio({
                    mimetype: 'audio/ogg',
                    data: 'MEDIA64',
                });
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['MEDIA64']);
            });
        });

        describe('isConnected', function () {
            it('returns the resolved connection state', async function () {
                client.pupPage.evaluate.resolves(true);
                const result = await call.isConnected();
                expect(result).to.equal(true);
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['call-id']);
            });
        });

        describe('addParticipant', function () {
            it('adds a participant using the current call id', async function () {
                client.addParticipantToCall = sinon.stub().resolves();

                await call.addParticipant('987654321@c.us');

                expect(
                    client.addParticipantToCall.calledOnceWithExactly(
                        '987654321@c.us',
                        'call-id',
                    ),
                ).to.equal(true);
            });
        });

        describe('removeParticipant', function () {
            it('removes a participant using the current call id', async function () {
                client.removeParticipantFromCall = sinon.stub().resolves();

                await call.removeParticipant('987654321@c.us');

                expect(
                    client.removeParticipantFromCall.calledOnceWithExactly(
                        '987654321@c.us',
                        'call-id',
                    ),
                ).to.equal(true);
            });
        });
    });

    describe('Client.call', function () {
        let client;

        beforeEach(function () {
            client = {
                pupPage: {
                    evaluate: sinon.stub().resolves({
                        id: 'new-call',
                        peerJid: 'peer@c.us',
                        isVideo: false,
                        isGroup: false,
                        outgoing: true,
                    }),
                },
            };
        });

        it('places a voice call with injection on by default', async function () {
            const result = await Client.prototype.call.call(
                client,
                '15551234567',
            );
            expect(result).to.be.instanceOf(Call);
            expect(result.id).to.equal('new-call');
            const args = client.pupPage.evaluate.firstCall.args;
            expect(args[0]).to.be.a('function');
            expect(args.slice(1)).to.deep.equal([
                '15551234567',
                false,
                false,
                60000,
                true,
            ]);
        });

        it('forwards video, waitForAnswer, answerTimeout and injectAudio', async function () {
            await Client.prototype.call.call(client, '15551234567', {
                video: true,
                waitForAnswer: true,
                answerTimeout: 1000,
                injectAudio: false,
            });
            expect(
                client.pupPage.evaluate.firstCall.args.slice(1),
            ).to.deep.equal(['15551234567', true, true, 1000, false]);
        });
    });

    describe('Client.startGroupCall', function () {
        let client;

        beforeEach(function () {
            client = new Client();
            client.info = {};
            client.pupPage = {
                evaluate: sinon.stub().resolves({
                    id: 'group-call',
                    peerJid: 'group-call@call',
                    isVideo: false,
                    isGroup: true,
                    outgoing: true,
                }),
            };
            sinon.stub(client, 'getNumberId').callsFake(async (contactId) => ({
                _serialized: contactId,
            }));
        });

        it('rejects non-array contactIds', async function () {
            await expect(
                client.startGroupCall('123456789@c.us'),
            ).to.be.rejectedWith('Invalid contactIds');
        });

        it('requires at least two participants', async function () {
            await expect(
                client.startGroupCall(['123456789@c.us']),
            ).to.be.rejectedWith('At least two participants');
        });

        it('rejects group chat IDs', async function () {
            await expect(
                client.startGroupCall(['123456789@c.us', '987654321@g.us']),
            ).to.be.rejectedWith('Group chat IDs cannot be used');
        });

        it('requires a ready client', async function () {
            const unreadyClient = new Client();

            await expect(
                unreadyClient.startGroupCall([
                    '123456789@c.us',
                    '987654321@c.us',
                ]),
            ).to.be.rejectedWith('Client is not ready');
        });

        it('rejects unreachable contacts', async function () {
            client.getNumberId.withArgs('987654321@c.us').resolves(null);

            await expect(
                client.startGroupCall(['123456789@c.us', '987654321@c.us']),
            ).to.be.rejectedWith('Contact is not registered or reachable');
        });

        it('passes resolved contacts and video option to the injected controller', async function () {
            const call = await client.startGroupCall(
                ['123456789@c.us', '987654321@c.us'],
                { video: true },
            );

            expect(call).to.be.instanceOf(Call);
            expect(call.id).to.equal('group-call');
            expect(client.pupPage.evaluate.firstCall.args[1]).to.deep.equal([
                '123456789@c.us',
                '987654321@c.us',
            ]);
            expect(client.pupPage.evaluate.firstCall.args[2]).to.deep.equal({
                video: true,
            });
        });
    });

    describe('Client.getActiveCallParticipantCount', function () {
        it('returns the serialized active-call participant count', async function () {
            const client = {
                pupPage: {
                    evaluate: sinon.stub().resolves(2),
                },
            };

            const count =
                await Client.prototype.getActiveCallParticipantCount.call(
                    client,
                );

            expect(count).to.equal(2);
            expect(client.pupPage.evaluate.firstCall.args[0]).to.be.a(
                'function',
            );
        });
    });

    describe('Client.addParticipantToCall', function () {
        let client;

        beforeEach(function () {
            client = new Client();
            client.info = {};
            client.pupPage = {
                evaluate: sinon.stub().resolves(),
            };
            sinon.stub(client, 'getNumberId').resolves({
                _serialized: '123456789@c.us',
            });
        });

        it('rejects missing contactId', async function () {
            await expect(client.addParticipantToCall()).to.be.rejectedWith(
                'Invalid contactId',
            );
        });

        it('rejects invalid contactId', async function () {
            await expect(
                client.addParticipantToCall('123456789'),
            ).to.be.rejectedWith("ending with '@c.us'");
        });

        it('rejects group IDs', async function () {
            await expect(
                client.addParticipantToCall('123456789@g.us'),
            ).to.be.rejectedWith('Group IDs cannot be added');
        });

        it('rejects invalid callId values', async function () {
            await expect(
                client.addParticipantToCall('123456789@c.us', 123),
            ).to.be.rejectedWith('Invalid callId');
        });

        it('requires a ready client', async function () {
            const unreadyClient = new Client();

            await expect(
                unreadyClient.addParticipantToCall('123456789@c.us'),
            ).to.be.rejectedWith('Client is not ready');
        });

        it('rejects unreachable contacts', async function () {
            client.getNumberId.resolves(null);

            await expect(
                client.addParticipantToCall('123456789@c.us'),
            ).to.be.rejectedWith('Contact is not registered or reachable');
        });

        it('passes the participant and callId guard to the injected controller', async function () {
            await client.addParticipantToCall('123456789@c.us', 'call-id');

            expect(client.pupPage.evaluate.firstCall.args[1]).to.equal(
                '123456789@c.us',
            );
            expect(client.pupPage.evaluate.firstCall.args[2]).to.equal(
                'call-id',
            );
        });

        it('propagates internal controller errors', async function () {
            client.pupPage.evaluate.rejects(new Error('No active call'));

            await expect(
                client.addParticipantToCall('123456789@c.us', 'call-id'),
            ).to.be.rejectedWith('No active call');
        });
    });

    describe('Client.removeParticipantFromCall', function () {
        let client;

        beforeEach(function () {
            client = new Client();
            client.info = {};
            client.pupPage = {
                evaluate: sinon.stub().resolves(),
            };
            sinon.stub(client, 'getNumberId').resolves({
                _serialized: '123456789@c.us',
            });
        });

        it('rejects missing contactId', async function () {
            await expect(client.removeParticipantFromCall()).to.be.rejectedWith(
                'Invalid contactId',
            );
        });

        it('rejects invalid contactId', async function () {
            await expect(
                client.removeParticipantFromCall('123456789'),
            ).to.be.rejectedWith("ending with '@c.us'");
        });

        it('rejects group IDs', async function () {
            await expect(
                client.removeParticipantFromCall('123456789@g.us'),
            ).to.be.rejectedWith('Group IDs cannot be removed');
        });

        it('rejects invalid callId values', async function () {
            await expect(
                client.removeParticipantFromCall('123456789@c.us', 123),
            ).to.be.rejectedWith('Invalid callId');
        });

        it('requires a ready client', async function () {
            const unreadyClient = new Client();

            await expect(
                unreadyClient.removeParticipantFromCall('123456789@c.us'),
            ).to.be.rejectedWith('Client is not ready');
        });

        it('rejects unreachable contacts', async function () {
            client.getNumberId.resolves(null);

            await expect(
                client.removeParticipantFromCall('123456789@c.us'),
            ).to.be.rejectedWith('Contact is not registered or reachable');
        });

        it('passes the participant and callId guard to the injected controller', async function () {
            await client.removeParticipantFromCall('123456789@c.us', 'call-id');

            expect(client.pupPage.evaluate.firstCall.args[1]).to.equal(
                '123456789@c.us',
            );
            expect(client.pupPage.evaluate.firstCall.args[2]).to.equal(
                'call-id',
            );
        });

        it('propagates internal controller errors', async function () {
            client.pupPage.evaluate.rejects(new Error('No active call'));

            await expect(
                client.removeParticipantFromCall('123456789@c.us', 'call-id'),
            ).to.be.rejectedWith('No active call');
        });
    });
});
