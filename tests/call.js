const chai = require('chai');
const sinon = require('sinon');
const { Readable } = require('stream');

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

        describe('playAudioStream', function () {
            // Routes the stubbed page calls by the injected function they run.
            const page = ({ queued = 0.2, remaining = 0 } = {}) => {
                const calls = { start: [], push: [], end: [] };
                client.pupPage.evaluate = sinon
                    .stub()
                    .callsFake(async (fn, ...args) => {
                        const source = fn.toString();
                        if (source.includes('startCallAudioStream')) {
                            calls.start.push(args);
                            return true;
                        }
                        if (source.includes('pushCallAudio')) {
                            calls.push.push(args);
                            return queued;
                        }
                        calls.end.push(args);
                        return remaining;
                    });
                return calls;
            };
            const sent = (calls) =>
                Buffer.concat(
                    calls.push.map(([, data]) => Buffer.from(data, 'base64')),
                );

            it('sends whole 16-bit samples at the given sample rate', async function () {
                const calls = page();
                const stream = Readable.from([
                    Buffer.from([1, 2, 3]),
                    Buffer.from([4, 5, 6, 7]),
                ]);
                const seconds = await call.playAudioStream(stream, {
                    sampleRate: 8000,
                });

                expect(calls.start[0][1]).to.equal(8000);
                for (const [, data] of calls.push) {
                    expect(Buffer.from(data, 'base64').length % 2).to.equal(0);
                }
                expect(sent(calls)).to.deep.equal(
                    Buffer.from([1, 2, 3, 4, 5, 6]),
                );
                expect(seconds).to.equal(6 / 2 / 8000);
                expect(calls.end[0][1]).to.equal(false);
            });

            it('defaults to 16 kHz and waits for the queued audio to play out', async function () {
                const calls = page({ remaining: 0.05 });
                const started = Date.now();
                await call.playAudioStream(Readable.from([Buffer.alloc(4)]));

                expect(calls.start[0][1]).to.equal(16000);
                expect(Date.now() - started).to.be.at.least(40);
            });

            it('stops when the call ends and leaves the stream open', async function () {
                const calls = page({ queued: false });
                const stream = new Readable({ read() {} });
                stream.push(Buffer.alloc(4));
                const seconds = await call.playAudioStream(stream);

                expect(seconds).to.equal(0);
                expect(stream.destroyed).to.equal(false);
                expect(calls.end[0][1]).to.equal(false);
            });

            it('cuts the playback off when the stream is destroyed', async function () {
                const calls = page();
                const stream = new Readable({ read() {} });
                stream.push(Buffer.alloc(4));
                const playing = call.playAudioStream(stream);
                await tick();
                stream.destroy();
                await playing;

                expect(calls.end.some(([, interrupt]) => interrupt)).to.equal(
                    true,
                );
            });

            it('rejects and cuts the playback off when the stream fails', async function () {
                const calls = page();
                const stream = new Readable({ read() {} });
                const playing = call.playAudioStream(stream);
                await tick();
                stream.destroy(new Error('tts failed'));

                let error;
                try {
                    await playing;
                } catch (err) {
                    error = err;
                }
                expect(error.message).to.equal('tts failed');
                expect(calls.end.some(([, interrupt]) => interrupt)).to.equal(
                    true,
                );
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
