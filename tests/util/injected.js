const { expect } = require('chai');
const sinon = require('sinon');

const { LoadUtils } = require('../../src/util/Injected/Utils');

describe('Injected Utils', function () {
    let originalWindow;

    beforeEach(function () {
        originalWindow = global.window;
        global.window = {
            require() {
                return undefined;
            },
        };
        LoadUtils();
    });

    afterEach(function () {
        global.window = originalWindow;
        sinon.restore();
    });

    describe('resolveMediaBlob', function () {
        function createMessage(overrides = {}) {
            return {
                mediaData: { mediaStage: 'INIT' },
                mediaObject: { filehash: 'file-hash' },
                directPath: '/media/path',
                encFilehash: 'encrypted-file-hash',
                filehash: 'file-hash',
                mediaKey: 'media-key',
                mediaKeyTimestamp: 123,
                type: 'image',
                mimetype: 'image/jpeg',
                filename: 'photo.jpg',
                size: 3,
                downloadMedia: sinon.stub().resolves(),
                ...overrides,
            };
        }

        it('uses the media blob cache without invoking the fallback', async function () {
            const cachedBlob = new Blob([new Uint8Array([1, 2, 3])], {
                type: 'image/jpeg',
            });
            const message = createMessage();
            const downloadAndMaybeDecrypt = sinon.stub();

            window.require = (module) => {
                if (module === 'WAWebCollections') {
                    return { Msg: { get: () => message } };
                }
                if (module === 'WAWebMediaInMemoryBlobCache') {
                    return {
                        InMemoryMediaBlobCache: { get: () => cachedBlob },
                    };
                }
                if (module === 'WAWebDownloadManager') {
                    return { downloadManager: { downloadAndMaybeDecrypt } };
                }
            };

            const result = await window.WWebJS.resolveMediaBlob('message-id');

            expect(result.blob).to.equal(cachedBlob);
            expect(downloadAndMaybeDecrypt.called).to.equal(false);
        });

        it('downloads uncached media with its declared MIME type', async function () {
            const decryptedMedia = new Uint8Array([1, 2, 3]).buffer;
            const message = createMessage();
            const downloadAndMaybeDecrypt = sinon
                .stub()
                .resolves(decryptedMedia);

            window.require = (module) => {
                if (module === 'WAWebCollections') {
                    return { Msg: { get: () => message } };
                }
                if (module === 'WAWebMediaInMemoryBlobCache') {
                    return { InMemoryMediaBlobCache: { get: () => null } };
                }
                if (module === 'WAWebDownloadManager') {
                    return { downloadManager: { downloadAndMaybeDecrypt } };
                }
            };

            const result = await window.WWebJS.resolveMediaBlob('message-id');

            expect(downloadAndMaybeDecrypt.calledOnce).to.equal(true);
            expect(downloadAndMaybeDecrypt.firstCall.args[0]).to.include({
                directPath: message.directPath,
                encFilehash: message.encFilehash,
                filehash: message.filehash,
                mediaKey: message.mediaKey,
                mediaKeyTimestamp: message.mediaKeyTimestamp,
                type: message.type,
                mimetype: message.mimetype,
            });
            expect(result.mimetype).to.equal('image/jpeg');
            expect(result.blob.type).to.equal('image/jpeg');
            expect(
                new Uint8Array(await result.blob.arrayBuffer()),
            ).to.deep.equal(new Uint8Array(decryptedMedia));
        });
    });
});
