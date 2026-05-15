'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { expect } = require('chai');

const MessageMedia = require('../../../src/structures/MessageMedia');

describe('MessageMedia', function () {
    describe('constructor', function () {
        it('stores all four fields', function () {
            const media = new MessageMedia('image/png', 'AAAA', 'a.png', 4);
            expect(media.mimetype).to.equal('image/png');
            expect(media.data).to.equal('AAAA');
            expect(media.filename).to.equal('a.png');
            expect(media.filesize).to.equal(4);
        });

        it('allows filename and filesize to be omitted', function () {
            const media = new MessageMedia('text/plain', 'AAAA');
            expect(media.filename).to.equal(undefined);
            expect(media.filesize).to.equal(undefined);
        });
    });

    describe('fromFilePath', function () {
        let tempFile;

        before(function () {
            tempFile = path.join(os.tmpdir(), `wwebjs-mm-${Date.now()}.txt`);
            fs.writeFileSync(tempFile, 'hello world');
        });

        after(function () {
            fs.unlinkSync(tempFile);
        });

        it('reads the file, picks a mime type and uses the basename', function () {
            const media = MessageMedia.fromFilePath(tempFile);
            expect(media).to.be.instanceOf(MessageMedia);
            expect(media.mimetype).to.equal('text/plain');
            expect(media.filename).to.equal(path.basename(tempFile));
            expect(
                Buffer.from(media.data, 'base64').toString('utf-8'),
            ).to.equal('hello world');
        });
    });

    describe('fromUrl', function () {
        it('rejects URLs with an undetectable mime type unless unsafeMime is set', async function () {
            // No extension → mime.getType returns null → must throw without unsafeMime
            let err;
            try {
                await MessageMedia.fromUrl('https://example.com/no-extension');
            } catch (e) {
                err = e;
            }
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.match(/unable to determine mime type/i);
        });
    });
});
