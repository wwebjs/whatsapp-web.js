'use strict';

const { expect } = require('chai');

const List = require('../../../src/structures/List');

describe('List', function () {
    it('stores description, buttonText, title and footer', function () {
        const list = new List(
            'body',
            'See options',
            [{ title: 's1', rows: [{ title: 'r1' }] }],
            'Title',
            'Footer',
        );

        expect(list.description).to.equal('body');
        expect(list.buttonText).to.equal('See options');
        expect(list.title).to.equal('Title');
        expect(list.footer).to.equal('Footer');
    });

    it('preserves custom row ids and defaults the description to empty string', function () {
        const list = new List('body', 'btn', [
            {
                title: 'Section',
                rows: [
                    { id: 'custom-id', title: 'r1', description: 'desc' },
                    { title: 'r2' },
                ],
            },
        ]);

        expect(list.sections).to.have.lengthOf(1);
        const [section] = list.sections;
        expect(section.title).to.equal('Section');
        expect(section.rows[0]).to.deep.equal({
            rowId: 'custom-id',
            title: 'r1',
            description: 'desc',
        });
        expect(section.rows[1].rowId).to.be.a('string').with.length(6);
        expect(section.rows[1].description).to.equal('');
    });

    it('throws when sections array is empty', function () {
        expect(() => new List('body', 'btn', [])).to.throw();
    });

    it('throws when a section has no rows', function () {
        expect(
            () => new List('body', 'btn', [{ title: 's', rows: [] }]),
        ).to.throw();
    });

    it('throws when a row has no title', function () {
        expect(
            () => new List('body', 'btn', [{ title: 's', rows: [{}] }]),
        ).to.throw();
    });

    it('throws when more than one section is missing a title', function () {
        expect(
            () =>
                new List('body', 'btn', [
                    { rows: [{ title: 'r1' }] },
                    { rows: [{ title: 'r2' }] },
                ]),
        ).to.throw();
    });
});
