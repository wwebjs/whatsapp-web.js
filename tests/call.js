const chai = require('chai');
const sinon = require('sinon');

const Call = require('../src/structures/Call');
const Client = require('../src/Client');

const expect = chai.expect;

const noVideo = { orientation: undefined, resolution: undefined };

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
                expect(args.slice(1)).to.deep.equal([
                    'call-id',
                    false,
                    true,
                    noVideo,
                ]);
            });

            it('answers with video when requested', async function () {
                await call.accept({ video: true });
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['call-id', true, true, noVideo]);
            });

            it('can disable audio injection to use the real microphone', async function () {
                await call.accept({ injectAudio: false });
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['call-id', false, false, noVideo]);
            });

            it('forwards the video orientation and resolution', async function () {
                await call.accept({
                    video: true,
                    orientation: 'portrait',
                    resolution: 480,
                });
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal([
                    'call-id',
                    true,
                    true,
                    { orientation: 'portrait', resolution: 480 },
                ]);
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

        describe('showImage', function () {
            it('defaults the mimetype for a base64 string', async function () {
                await call.showImage('IMG64');
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['IMG64', 'image/jpeg']);
            });

            it('forwards a MessageMedia mimetype', async function () {
                await call.showImage({ mimetype: 'image/png', data: 'PNG64' });
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['PNG64', 'image/png']);
            });
        });

        describe('playVideo', function () {
            it('defaults the mimetype and passes the options', async function () {
                await call.playVideo('VID64', { loop: true });
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['VID64', 'video/mp4', { loop: true }]);
            });
        });

        describe('setVideoResolution', function () {
            it('forwards the resolution', async function () {
                await call.setVideoResolution(720);
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal([720]);
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
                noVideo,
            ]);
        });

        it('forwards video, waitForAnswer, answerTimeout, injectAudio and video options', async function () {
            await Client.prototype.call.call(client, '15551234567', {
                video: true,
                waitForAnswer: true,
                answerTimeout: 1000,
                injectAudio: false,
                orientation: 'portrait',
                resolution: 480,
            });
            expect(
                client.pupPage.evaluate.firstCall.args.slice(1),
            ).to.deep.equal([
                '15551234567',
                true,
                true,
                1000,
                false,
                { orientation: 'portrait', resolution: 480 },
            ]);
        });
    });
});
