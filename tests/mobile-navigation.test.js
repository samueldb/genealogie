const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');

// Load the browser's pure ES module without changing the Node backend module format.
const helpers = fs.readFile(path.resolve(__dirname, '../site/scripts/people.js'), 'utf8')
  .then(source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`));
const person = (id, first, last, birthday, rels = {}) => ({
  id, data: { 'first name': first, 'last name': last, birthday }, rels
});

test('search ignores accents, hyphens and name order while preserving string ids', async () => {
  const { searchPeople } = await helpers;
  const theo = person('theo-1996', 'Théo', 'DESCHAMPS-BERGER', '1996-09-19');
  const older = person('theo-2006', 'Théo', 'DESCHAMPS-BERGER', '2006-03-02');
  const data = [theo, older];
  assert.deepEqual(searchPeople(data, 'berger theo 1996'), [theo]);
  assert.deepEqual(searchPeople(data, 'ThÉo Deschamps-Berger'), data);
  assert.deepEqual(searchPeople(data, 'theo deschampsberger 1996'), [theo]);
  assert.deepEqual(searchPeople(data, 'personne absente'), []);
});

test('the search excludes library placeholders and reads the current source only', async () => {
  const { searchPeople, knownPeople } = await helpers;
  const sourceA = [person('1', 'Alice', 'Dupont')];
  const sourceB = [person('1', 'Béatrice', 'Martin')];
  const placeholders = [{...person('add', '', ''), to_add: true}, {...person('new', 'ADD', ''), _new_rel_data: {}}];
  assert.equal(knownPeople([...sourceA, ...placeholders]).length, 1);
  assert.deepEqual(searchPeople(sourceB, 'Alice'), []);
  assert.equal(searchPeople(sourceB, 'beatrice')[0].id, '1');
});

test('the mobile family resolves parents, spouses and children without mutating relationships', async () => {
  const { familyOf } = await helpers;
  const parent = person('parent', 'Anne', 'Parent');
  const focus = person('focus', 'Luc', 'Famille', '', {parents: ['parent'], spouses: ['spouse'], children: ['child']});
  const spouse = person('spouse', 'Camille', 'Famille');
  const child = person('child', 'Lou', 'Famille', '2001-05-01', {father: 'focus'});
  const secondChild = person('other-child', 'Jules', 'Famille', '1999-01-01', {parents: ['focus']});
  const data = [focus, parent, spouse, child, secondChild];
  const original = JSON.stringify(data);
  const family = familyOf(data, 'focus');
  assert.deepEqual(family.parents, [parent]);
  assert.deepEqual(family.spouses, [spouse]);
  assert.deepEqual(family.children, [secondChild, child]);
  assert.equal(JSON.stringify(data), original);
  assert.equal(familyOf(data, 'absent'), null);
});

test('unknown dates and deceased people get unambiguous result subtitles', async () => {
  const { lifeDates } = await helpers;
  assert.equal(lifeDates(person(1, 'A', 'B', '1970-01-01T00:00:00.000Z')), 'Dates non renseignées');
  assert.equal(lifeDates({data: {birthday: '1868-07-21', lastday: '1938-06-18'}}), '1868 – 1938');
});

test('siblings include full and half siblings, deduplicated and ordered by birth', async () => {
  const { familyOf } = await helpers;
  const mother = person(1, 'Anne', 'Parent');
  const father = person('father', 'Luc', 'Parent');
  const focus = person('focus', 'Camille', 'Famille', '1990-01-01', {parents: ['1', 'father']});
  const older = person('older', 'Lou', 'Famille', '1988-05-01', {mother: 1, father: 'father'});
  const younger = person('younger', 'Jules', 'Famille', '1995-01-01', {parents: [1]});
  const undated = person('undated', 'Alex', 'Famille', '', {father: 'father'});
  const stranger = person('stranger', 'Sam', 'Autre', '1980-01-01');
  const placeholder = {...person('add', '', '', '', {parents: [1]}), to_add: true};
  const data = [focus, mother, father, younger, undated, stranger, older, placeholder];
  const original = JSON.stringify(data);
  assert.deepEqual(familyOf(data, 'focus').siblings, [older, younger, undated]);
  assert.equal(JSON.stringify(data), original);
});

test('siblings also resolve from a parent’s child list when reverse links are missing', async () => {
  const { familyOf } = await helpers;
  const mother = person('parent', 'Anne', 'Parent', '', {children: ['focus', 'sibling', 'sibling']});
  const focus = person('focus', 'Camille', 'Famille');
  const sibling = person('sibling', 'Lou', 'Famille');
  const family = familyOf([focus, sibling, mother], 'focus');
  assert.deepEqual(family.parents, [mother]);
  assert.deepEqual(family.siblings, [sibling]);
});

test('absent or placeholder parents never establish a sibling relationship', async () => {
  const { familyOf } = await helpers;
  const focus = person('focus', 'Camille', 'Famille', '', {parents: ['unknown', 'add']});
  const stranger = person('stranger', 'Lou', 'Famille', '', {father: 'unknown', mother: 'add'});
  const placeholder = {...person('add', '', ''), to_add: true};
  const unrelated = person('unrelated', 'Jules', 'Famille');
  const data = [focus, stranger, placeholder, unrelated];
  assert.deepEqual(familyOf(data, 'focus').siblings, []);
  assert.deepEqual(familyOf(data, 'unrelated').siblings, []);
});
