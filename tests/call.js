const chai = require('chai');
const sinon = require('sinon');

const Call = require('../src/structures/Call');
const Client = require('../src/Client');

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
            client = {
                pupPage: { evaluate: sinon.stub().resolves(true) },
                _callAudioStreams: new Map(),
            };
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

        // The injected capture reports through Client's onCallAudioChunk and
        // onCallAudioEnd handlers; these mirror what they do with the streams.
        const deliver = (chunk) => {
            for (const stream of client._callAudioStreams.get('call-id')) {
                stream.push(chunk);
            }
        };
        const endCall = () => {
            const streams = client._callAudioStreams.get('call-id');
            client._callAudioStreams.delete('call-id');
            for (const stream of streams) stream.push(null);
        };
        const tick = () => new Promise((resolve) => setImmediate(resolve));

        describe('getAudioStream', function () {
            it('starts the capture for the call and registers the stream', async function () {
                const stream = await call.getAudioStream();
                expect(
                    client.pupPage.evaluate.firstCall.args.slice(1),
                ).to.deep.equal(['call-id']);
                expect(
                    client._callAudioStreams.get('call-id').has(stream),
                ).to.equal(true);
            });

            it('delivers the captured audio and ends with the call', async function () {
                const stream = await call.getAudioStream();
                const received = [];
                stream.on('data', (chunk) => received.push(chunk));
                const ended = new Promise((resolve) =>
                    stream.on('end', resolve),
                );

                deliver(Buffer.from([1, 2]));
                deliver(Buffer.from([3, 4]));
                endCall();
                await ended;

                expect(Buffer.concat(received)).to.deep.equal(
                    Buffer.from([1, 2, 3, 4]),
                );
            });

            it('stops the capture without an end notification when destroyed', async function () {
                const stream = await call.getAudioStream();
                stream.destroy();
                await tick();

                expect(client._callAudioStreams.has('call-id')).to.equal(false);
                const stop = client.pupPage.evaluate.secondCall.args;
                expect(stop.slice(1)).to.deep.equal(['call-id']);
                expect(stop[0].toString()).to.include(
                    'stopCallAudioCapture(id, false)',
                );
            });

            it('keeps the capture running while another stream is open', async function () {
                const first = await call.getAudioStream();
                await call.getAudioStream();
                first.destroy();
                await tick();

                expect(client.pupPage.evaluate.callCount).to.equal(2);
                expect(client._callAudioStreams.get('call-id').size).to.equal(
                    1,
                );
            });

            it('rejects and cleans up when the call is not ongoing', async function () {
                client.pupPage.evaluate.resolves(false);
                let error;
                try {
                    await call.getAudioStream();
                } catch (err) {
                    error = err;
                }
                await tick();

                expect(error.message).to.equal('The call is not ongoing');
                expect(client._callAudioStreams.has('call-id')).to.equal(false);
            });
        });

        describe('recordAudio', function () {
            it('returns the received audio as a 16 kHz mono WAV when the call ends', async function () {
                const recording = call.recordAudio();
                const pcm = Buffer.from([0x10, 0x00, 0xf0, 0xff, 0x00, 0x40]);
                deliver(pcm);
                endCall();
                const media = await recording;

                expect(media.mimetype).to.equal('audio/wav');
                expect(media.filename).to.equal('call-call-id.wav');
                const wav = Buffer.from(media.data, 'base64');
                expect(wav.toString('ascii', 0, 4)).to.equal('RIFF');
                expect(wav.readUInt32LE(4)).to.equal(36 + pcm.length);
                expect(wav.toString('ascii', 8, 16)).to.equal('WAVEfmt ');
                expect(wav.readUInt16LE(20)).to.equal(1);
                expect(wav.readUInt16LE(22)).to.equal(1);
                expect(wav.readUInt32LE(24)).to.equal(16000);
                expect(wav.readUInt32LE(28)).to.equal(32000);
                expect(wav.readUInt16LE(32)).to.equal(2);
                expect(wav.readUInt16LE(34)).to.equal(16);
                expect(wav.toString('ascii', 36, 40)).to.equal('data');
                expect(wav.readUInt32LE(40)).to.equal(pcm.length);
                expect(wav.subarray(44)).to.deep.equal(pcm);
            });

            it('stops after maxDuration and releases the capture', async function () {
                const recording = call.recordAudio({ maxDuration: 20 });
                deliver(Buffer.from([1, 0]));
                const media = await recording;

                const wav = Buffer.from(media.data, 'base64');
                expect(wav.readUInt32LE(40)).to.equal(2);
                await tick();
                expect(client._callAudioStreams.has('call-id')).to.equal(false);
                expect(
                    client.pupPage.evaluate.secondCall.args[0].toString(),
                ).to.include('stopCallAudioCapture');
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
});
