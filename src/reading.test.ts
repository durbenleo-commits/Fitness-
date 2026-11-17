import { describe, expect, it } from 'vitest';
import { achievementStatus } from './achievements';
import {
  READ_QUEST,
  attributes,
  completeQuest,
  dayFor,
  dayOutdated,
  emptyState,
  fixedQuests,
  generateDay,
  isCleared,
  isDailyInstance,
  normalize,
  playerClass,
  setReading,
  type GameState,
  type Profile,
} from './game';
import {
  bookProgress,
  currentBook,
  finishedBooks,
  logPages,
  pagesReadOn,
  startBook,
  totalPagesRead,
  undoLastPages,
  unfinishedBooks,
  updateBook,
} from './reading';
import { questXp } from './game';

const TODAY = '2026-11-16';
const PHOTO = 'data:image/jpeg;base64,AAAA';
const profile: Profile = { name: 'A', difficulty: 2, seasonDays: 66, startDate: '2026-11-01' };

/** A started game with today's quests and one book at page 100. */
function withBook(p: Profile = profile): GameState {
  const s: GameState = { ...emptyState(), profile: p };
  return startBook({ ...s, days: { [TODAY]: dayFor(s, TODAY, 1) } }, 'Der Hobbit', '2026-11-10', 100);
}
const readQuest = (s: GameState, date = TODAY) => s.days[date].quests.find((q) => q.templateId === READ_QUEST);

describe('daily reading quest', () => {
  it('is a fixed required quest scaled by difficulty only', () => {
    const day = generateDay(TODAY, 30, 2);
    expect(day.quests.map((q) => q.templateId).slice(0, 5)).toEqual(['steps', 'pushups', 'squats', 'plank', 'read']);
    expect(day.quests.filter((q) => q.attr !== 'intelligenz')).toHaveLength(8);
    expect(readQuest({ ...emptyState(), days: { [TODAY]: day } })).toMatchObject({ title: 'Lesen', unit: 'Seiten', amount: 10, xp: 30 });
    expect(readQuest({ ...emptyState(), days: { [TODAY]: day } })!.extra).toBeUndefined();
    expect(generateDay(TODAY, 1, 1).quests[4].amount).toBe(6);
    expect(generateDay(TODAY, 1, 3).quests[4].amount).toBe(15);
  });

  it('is on unless the profile switches it off, and cannot be swapped', () => {
    expect(fixedQuests(profile).map((t) => t.id)).toEqual(['steps', 'pushups', 'squats', 'plank', 'read']);
    expect(fixedQuests({ ...profile, reading: false }).map((t) => t.id)).toEqual(['steps', 'pushups', 'squats', 'plank']);
    const off = dayFor({ ...emptyState(), profile: { ...profile, reading: false } }, TODAY, 1);
    expect(off.quests.some((q) => q.templateId === READ_QUEST)).toBe(false);
    expect(off.quests).toHaveLength(8);
    const on = dayFor({ ...emptyState(), profile }, TODAY, 1);
    // the random picks stay the same with or without reading
    expect(on.quests.filter((q) => q.templateId !== READ_QUEST).map((q) => q.templateId)).toEqual(off.quests.map((q) => q.templateId));
    expect(isDailyInstance(emptyState(), readQuest({ ...emptyState(), days: { [TODAY]: on } })!)).toBe(true);
  });

  it('marks untouched days without the reading quest as outdated', () => {
    const old = dayFor({ ...emptyState(), profile: { ...profile, reading: false } }, TODAY, 1);
    expect(dayOutdated(old, profile)).toBe(true);
    expect(dayOutdated(old, { ...profile, reading: false })).toBe(false);
    expect(dayOutdated(completeQuest(old, old.quests[5].id), profile)).toBe(false); // something ticked: keep it
    expect(dayOutdated(undefined, profile)).toBe(false);
  });

  it('switches on and off for today without taking a clear away', () => {
    const base: GameState = { ...emptyState(), profile: { ...profile, reading: false } };
    const s: GameState = { ...base, days: { [TODAY]: dayFor(base, TODAY, 1) } };
    const on = setReading(s, TODAY, true);
    expect(on.profile!.reading).toBe(true);
    expect(readQuest(on)).toMatchObject({ amount: 10, done: false });
    expect(new Set(on.days[TODAY].quests.map((q) => q.id)).size).toBe(9);
    const off = setReading(on, TODAY, false);
    expect(off.profile!.reading).toBe(false);
    expect(readQuest(off)).toBeUndefined();
    // a cleared day stays cleared
    const cleared: GameState = { ...s, days: { [TODAY]: { ...s.days[TODAY], quests: s.days[TODAY].quests.map((q) => ({ ...q, done: true })) } } };
    expect(isCleared(setReading(cleared, TODAY, true).days[TODAY])).toBe(true);
    // a done reading quest stays when switching off
    const done = { ...on, days: { [TODAY]: completeQuest(on.days[TODAY], readQuest(on)!.id) } };
    expect(readQuest(setReading(done, TODAY, false))?.done).toBe(true);
  });
});

describe('intelligence and the scholar', () => {
  it('gives one point per finished reading quest', () => {
    const s = withBook();
    const done = { ...s, days: { [TODAY]: completeQuest(s.days[TODAY], readQuest(s)!.id) } };
    expect(attributes(done).intelligenz).toBe(1);
    expect(attributes(s).intelligenz).toBe(0);
  });

  it('makes you a Gelehrter only when Intelligenz clearly leads', () => {
    expect(playerClass({ staerke: 4, ausdauer: 6, beweglichkeit: 2, intelligenz: 12, disziplin: 3 }).name).toBe('Gelehrter');
    expect(playerClass({ staerke: 0, ausdauer: 0, beweglichkeit: 0, intelligenz: 6, disziplin: 0 }).name).toBe('Gelehrter');
    expect(playerClass({ staerke: 12, ausdauer: 6, beweglichkeit: 2, intelligenz: 12, disziplin: 3 }).name).toBe('Krieger'); // a tie is not enough
    expect(playerClass({ staerke: 12, ausdauer: 11, beweglichkeit: 2, intelligenz: 11, disziplin: 3 }).name).toBe('Gladiator');
    expect(playerClass({ staerke: 1, ausdauer: 0, beweglichkeit: 0, intelligenz: 3, disziplin: 0 }).name).toBe('Rekrut');
  });
});

describe('reading log', () => {
  it('starts books and finds the current one', () => {
    let s = withBook();
    expect(currentBook(s)).toMatchObject({ title: 'Der Hobbit', startedOn: '2026-11-10', lastPage: 100, log: [] });
    expect(startBook(s, '   ', TODAY)).toBe(s);
    s = startBook(s, 'Momo', TODAY);
    expect(currentBook(s)).toMatchObject({ title: 'Momo', lastPage: 0 });
    expect(new Set(s.reading.books.map((b) => b.id)).size).toBe(2);
  });

  it('rejects pages before the last one, the same page, and missing photos', () => {
    const s = withBook();
    const id = currentBook(s)!.id;
    const back = logPages(s, TODAY, { bookId: id, page: 90, photo: PHOTO });
    expect(back.error).toBe('Die Seite liegt vor deiner letzten Seite (S. 100).');
    expect(back.state).toBe(s);
    expect(logPages(s, TODAY, { bookId: id, page: 100, photo: PHOTO }).error).toBeDefined();
    expect(logPages(s, TODAY, { bookId: id, page: 105, photo: '' }).error).toBe('Mach ein Foto von der Seite, dann zählt sie.');
    expect(logPages(s, TODAY, { bookId: id, page: 10.5, photo: PHOTO }).error).toBe('Gib eine gültige Seitenzahl ein.');
    expect(logPages(s, TODAY, { bookId: 'nope', page: 105, photo: PHOTO }).error).toBeDefined();
  });

  it('logs pages and completes the quest once today reaches the amount', () => {
    let s = withBook();
    const id = currentBook(s)!.id;
    const first = logPages(s, TODAY, { bookId: id, page: 104, photo: PHOTO });
    expect(first).toMatchObject({ pagesToday: 4, needed: 10, completed: false, justCompleted: false });
    s = first.state;
    expect(currentBook(s)).toMatchObject({ lastPage: 104, photo: PHOTO, photoDate: TODAY, log: [{ date: TODAY, from: 100, to: 104 }] });
    const second = logPages(s, TODAY, { bookId: id, page: 112, photo: PHOTO });
    expect(second).toMatchObject({ pagesToday: 12, needed: 10, completed: true, justCompleted: true });
    expect(readQuest(second.state)!.done).toBe(true);
    const third = logPages(second.state, TODAY, { bookId: id, page: 113, photo: PHOTO });
    expect(third).toMatchObject({ completed: true, justCompleted: false });
    expect(pagesReadOn(third.state, TODAY)).toBe(13);
    expect(pagesReadOn(third.state, '2026-11-15')).toBe(0);
  });

  it('sums pages over books, and another book may be on a lower page', () => {
    let s = withBook();
    const hobbit = currentBook(s)!.id;
    s = logPages(s, TODAY, { bookId: hobbit, page: 105, photo: PHOTO }).state;
    s = startBook(s, 'Momo', TODAY);
    const momo = currentBook(s)!.id;
    const r = logPages(s, TODAY, { bookId: momo, page: 5, photo: PHOTO });
    expect(r.error).toBeUndefined();
    expect(r).toMatchObject({ pagesToday: 10, completed: true });
    expect(totalPagesRead(r.state)).toBe(10);
  });

  it('completes the quest when a book ends, even with few pages', () => {
    const s = withBook();
    const id = currentBook(s)!.id;
    const r = logPages(s, TODAY, { bookId: id, page: 102, photo: PHOTO, finished: true });
    expect(r).toMatchObject({ pagesToday: 2, completed: true });
    expect(r.state.reading.books[0].finishedOn).toBe(TODAY);
    expect(currentBook(r.state)).toBeUndefined();
    expect(finishedBooks(r.state).map((b) => b.title)).toEqual(['Der Hobbit']);
    expect(logPages(r.state, TODAY, { bookId: id, page: 110, photo: PHOTO }).error).toBe('Dieses Buch hast du schon beendet.');
  });

  it('does not let a book with no pages read count as finished', () => {
    const s = withBook();
    const id = currentBook(s)!.id;
    const r = logPages(s, TODAY, { bookId: id, page: 100, photo: PHOTO, finished: true });
    expect(r.error).toBe('Lies zuerst mindestens eine Seite in diesem Buch.');
    expect(r.state).toBe(s);
    expect(readQuest(r.state)!.done).toBe(false);
    expect(finishedBooks(r.state)).toHaveLength(0);
    // the same page together with `finished` is fine once the book has read pages
    const read = logPages(s, '2026-11-15', { bookId: id, page: 110, photo: PHOTO }).state;
    const same = logPages(read, TODAY, { bookId: id, page: 110, photo: PHOTO, finished: true });
    expect(same.error).toBeUndefined();
    expect(same.state.reading.books[0].finishedOn).toBe(TODAY);
    expect(same.state.reading.books[0].log).toHaveLength(1);
    expect(same.completed).toBe(true);
    // finishing with pages in the same call counts
    expect(logPages(s, TODAY, { bookId: id, page: 101, photo: PHOTO, finished: true }).error).toBeUndefined();
  });

  it('lists all unfinished books, oldest first', () => {
    let s = withBook();
    s = startBook(s, 'Momo', TODAY);
    expect(unfinishedBooks(s).map((b) => b.title)).toEqual(['Der Hobbit', 'Momo']);
    s = logPages(s, TODAY, { bookId: s.reading.books[0].id, page: 101, photo: PHOTO, finished: true }).state;
    expect(unfinishedBooks(s).map((b) => b.title)).toEqual(['Momo']);
  });

  it('works without a reading quest today', () => {
    const s = withBook({ ...profile, reading: false });
    const r = logPages({ ...s, days: { [TODAY]: dayFor(s, TODAY, 1) } }, TODAY, { bookId: currentBook(s)!.id, page: 130, photo: PHOTO });
    expect(r).toMatchObject({ pagesToday: 30, needed: null, completed: false });
  });

  it('takes back the last entry and the quest with it', () => {
    let s = withBook();
    const id = currentBook(s)!.id;
    s = logPages(s, TODAY, { bookId: id, page: 120, photo: PHOTO, finished: true }).state;
    const undone = undoLastPages(s, TODAY, id);
    expect(undone.reading.books[0]).toMatchObject({ lastPage: 100, log: [] });
    expect(undone.reading.books[0].finishedOn).toBeUndefined();
    expect(readQuest(undone)!.done).toBe(false);
    expect(undoLastPages(undone, TODAY, id)).toBe(undone);
  });

  it('clears the finish when the finishing entry is taken back', () => {
    let s = withBook();
    const id = currentBook(s)!.id;
    s = logPages(s, '2026-11-15', { bookId: id, page: 110, photo: PHOTO }).state;
    s = logPages(s, TODAY, { bookId: id, page: 120, photo: PHOTO, finished: true }).state;
    expect(s.reading.books[0].finishedOn).toBe(TODAY);
    const undone = undoLastPages(s, TODAY, id);
    expect(undone.reading.books[0].finishedOn).toBeUndefined();
    expect(undone.reading.books[0].lastPage).toBe(110);
    expect(currentBook(undone)?.id).toBe(id);
    // a finish without a new entry today is cleared too when today's entry is undone
    let t = logPages(withBook(), TODAY, { bookId: id, page: 105, photo: PHOTO }).state;
    t = logPages(t, TODAY, { bookId: id, page: 105, photo: PHOTO, finished: true }).state;
    expect(t.reading.books[0].finishedOn).toBe(TODAY);
    expect(undoLastPages(t, TODAY, id).reading.books[0].finishedOn).toBeUndefined();
  });

  it('loads old saves with an empty reading log and reading switched on', () => {
    const old = { version: 1, profile, days: {} } as unknown as GameState;
    const loaded = normalize(old);
    expect(loaded.reading).toEqual({ books: [] });
    expect(fixedQuests(loaded.profile).some((t) => t.id === READ_QUEST)).toBe(true);
    const broken = normalize({ ...emptyState(), reading: { books: [{ id: 'b', title: 'X', startedOn: TODAY } as never] } });
    expect(broken.reading.books[0]).toMatchObject({ lastPage: 0, log: [] });
  });

  it('unlocks the reading achievements', () => {
    let s = withBook();
    for (let i = 0; i < 5; i++) {
      s = startBook(s, `Buch ${i}`, TODAY);
      s = logPages(s, TODAY, { bookId: currentBook(s)!.id, page: 100, photo: PHOTO, finished: true }).state;
    }
    const byId = Object.fromEntries(achievementStatus(s, TODAY).map((a) => [a.achievement.id, a]));
    expect(byId['book-1']).toMatchObject({ unlocked: true });
    expect(byId['book-5']).toMatchObject({ unlocked: true, value: 5 });
    expect(byId['pages-500']).toMatchObject({ unlocked: true, value: 500 });
    expect(byId['book-1'].achievement).toMatchObject({ title: 'Bücherwurm', tier: 'bronze', icon: 'book' });
    expect(achievementStatus(withBook(), TODAY).find((a) => a.achievement.id === 'pages-500')!.value).toBe(0);
  });
});

describe('reading more than asked', () => {
  it('counts today\'s pages as achieved, up to twice the amount', () => {
    let s = withBook();
    const id = currentBook(s)!.id;
    s = logPages(s, TODAY, { bookId: id, page: 104, photo: PHOTO }).state;
    expect(readQuest(s)).toMatchObject({ done: false });
    expect(readQuest(s)!.achieved).toBeUndefined();
    s = logPages(s, TODAY, { bookId: id, page: 112, photo: PHOTO }).state;
    expect(readQuest(s)).toMatchObject({ done: true, achieved: 12 });
    expect(questXp(readQuest(s)!)).toBe(36);
    s = logPages(s, TODAY, { bookId: id, page: 118, photo: PHOTO }).state;
    expect(readQuest(s)!.achieved).toBe(18);
    s = logPages(s, TODAY, { bookId: id, page: 150, photo: PHOTO }).state;
    expect(readQuest(s)!.achieved).toBe(20); // capped at 2×
    expect(attributes(s).intelligenz).toBe(2); // +1 bonus at 2×
  });

  it('a finished book completes at 1× with few pages, and undo lowers achieved again', () => {
    const s = withBook();
    const id = currentBook(s)!.id;
    const fin = logPages(s, TODAY, { bookId: id, page: 103, photo: PHOTO, finished: true }).state;
    expect(readQuest(fin)).toMatchObject({ done: true, achieved: 10 });
    let t = logPages(s, TODAY, { bookId: id, page: 112, photo: PHOTO }).state;
    t = logPages(t, TODAY, { bookId: id, page: 125, photo: PHOTO }).state;
    expect(readQuest(t)!.achieved).toBe(20);
    t = undoLastPages(t, TODAY, id);
    expect(readQuest(t)).toMatchObject({ done: true, achieved: 12 });
  });
});

describe('book cover and page count', () => {
  it('starts a book with a cover and a page count, ignoring bad counts', () => {
    const s = startBook(withBook(), 'Momo', TODAY, 0, { cover: PHOTO, totalPages: 320 });
    expect(currentBook(s)).toMatchObject({ title: 'Momo', cover: PHOTO, totalPages: 320 });
    const bad = startBook(withBook(), 'X', TODAY, 50, { totalPages: 20 });
    expect(currentBook(bad)!.totalPages).toBeUndefined();
    expect(currentBook(startBook(withBook(), 'Y', TODAY, 0, { totalPages: 12.5 }))!.totalPages).toBeUndefined();
    expect(currentBook(startBook(withBook(), 'Z', TODAY))!.cover).toBeUndefined();
  });

  it('updates title, cover and page count with checks', () => {
    const s = withBook(); // Der Hobbit at page 100
    const id = currentBook(s)!.id;
    const r = updateBook(s, id, { title: ' Der kleine Hobbit ', cover: PHOTO, totalPages: 310 });
    expect(r.error).toBeUndefined();
    expect(currentBook(r.state)).toMatchObject({ title: 'Der kleine Hobbit', cover: PHOTO, totalPages: 310 });
    const low = updateBook(s, id, { totalPages: 90 });
    expect(low.error).toBe('Das Buch hat weniger Seiten als deine letzte Seite (S. 100).');
    expect(low.state).toBe(s);
    expect(updateBook(s, id, { totalPages: 0 }).error).toBe('Gib eine gültige Seitenzahl ein.');
    expect(updateBook(s, id, { title: '  ' }).error).toBe('Gib einen Titel ein.');
    expect(updateBook(s, 'nope', { title: 'X' }).error).toBe('Das Buch gibt es nicht.');
    const cleared = updateBook(r.state, id, { cover: null, totalPages: null }).state;
    expect(currentBook(cleared)!.cover).toBeUndefined();
    expect(currentBook(cleared)!.totalPages).toBeUndefined();
  });

  it('rejects pages beyond the end and flags the last page', () => {
    const s = updateBook(withBook(), 'book-1', { totalPages: 320 }).state;
    const over = logPages(s, TODAY, { bookId: 'book-1', page: 321, photo: PHOTO });
    expect(over.error).toBe('Das Buch hat nur 320 Seiten.');
    expect(over.reachedEnd).toBe(false);
    const mid = logPages(s, TODAY, { bookId: 'book-1', page: 200, photo: PHOTO });
    expect(mid.reachedEnd).toBe(false);
    const end = logPages(s, TODAY, { bookId: 'book-1', page: 320, photo: PHOTO });
    expect(end.error).toBeUndefined();
    expect(end.reachedEnd).toBe(true);
    expect(end.state.reading.books[0].finishedOn).toBeUndefined(); // no auto-finish
    expect(logPages(end.state, TODAY, { bookId: 'book-1', page: 320, photo: PHOTO, finished: true }).reachedEnd).toBe(false);
    expect(logPages(withBook(), TODAY, { bookId: 'book-1', page: 900, photo: PHOTO }).reachedEnd).toBe(false); // no count known
  });

  it('reports progress with and without a page count', () => {
    const s = withBook();
    expect(bookProgress(currentBook(s)!)).toEqual({ page: 100 });
    const withTotal = updateBook(s, 'book-1', { totalPages: 400 }).state;
    expect(bookProgress(currentBook(withTotal)!)).toEqual({ page: 100, total: 400, percent: 25 });
    const done = logPages(withTotal, TODAY, { bookId: 'book-1', page: 390, photo: PHOTO, finished: true }).state;
    expect(bookProgress(done.reading.books[0])).toEqual({ page: 390, total: 400, percent: 100 });
  });

  it('repairs covers and page counts in old saves', () => {
    const books = [
      { id: 'a', title: 'A', startedOn: TODAY, lastPage: 10, log: [] },
      { id: 'b', title: 'B', startedOn: TODAY, lastPage: 10, log: [], cover: PHOTO, totalPages: 200 },
      { id: 'c', title: 'C', startedOn: TODAY, lastPage: 50, log: [], cover: 5, totalPages: 20 },
      { id: 'd', title: 'D', startedOn: TODAY, lastPage: 0, log: [], cover: '', totalPages: -3 },
      { id: 'e', title: 'E', startedOn: TODAY, lastPage: 0, log: [], totalPages: 'x' },
    ];
    const loaded = normalize({ ...emptyState(), reading: { books: books as never } });
    const [a, b, c, d, e] = loaded.reading.books;
    expect(a.cover).toBeUndefined();
    expect(a.totalPages).toBeUndefined();
    expect(b).toMatchObject({ cover: PHOTO, totalPages: 200 });
    for (const x of [c, d, e]) {
      expect('cover' in x).toBe(false);
      expect('totalPages' in x).toBe(false);
    }
  });
});
