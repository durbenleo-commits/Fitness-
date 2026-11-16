// Reading log: books, pages read per day, and the daily reading quest. Pure logic, unit-tested.
import { READ_QUEST, completeQuest, uncheckQuest, type GameState } from './game';

export interface ReadingLogEntry {
  date: string; // YYYY-MM-DD
  from: number; // page before this session
  to: number; // page reached
}

export interface Book {
  id: string;
  title: string;
  startedOn: string;
  lastPage: number;
  finishedOn?: string;
  photo?: string; // data URL of the latest page photo (small JPEG)
  photoDate?: string;
  log: ReadingLogEntry[];
}

export interface LogPagesInput {
  bookId: string;
  page: number; // the page the player has reached now
  photo: string; // data URL of a photo of that page: the proof
  finished?: boolean; // the book is done
}

export interface LogPagesResult {
  state: GameState; // unchanged when there is an error
  pagesToday: number; // pages read today over all books, after this entry
  needed: number | null; // pages today's reading quest asks for; null when today has none
  completed: boolean; // today's reading quest is done (now or before)
  justCompleted: boolean; // this entry ticked it off
  error?: string; // German, for the UI
}

/** All books that are not finished yet, oldest first. */
export function unfinishedBooks(state: GameState): Book[] {
  return state.reading.books.filter((b) => !b.finishedOn);
}

/** True when at least one page was actually read in this book (a log entry with to > from). */
export function hasReadPages(book: Book): boolean {
  return book.log.some((l) => l.to > l.from);
}

/** The book being read: the newest one that is not finished. */
export function currentBook(state: GameState): Book | undefined {
  const books = state.reading.books;
  for (let i = books.length - 1; i >= 0; i--) if (!books[i].finishedOn) return books[i];
  return undefined;
}

/** Start a new book. An empty title changes nothing. */
export function startBook(state: GameState, title: string, today: string, startPage = 0): GameState {
  const name = title.trim();
  if (!name) return state;
  const books = state.reading.books;
  let n = books.length + 1;
  while (books.some((b) => b.id === `book-${n}`)) n++;
  const page = Number.isFinite(startPage) ? Math.max(0, Math.floor(startPage)) : 0;
  const book: Book = { id: `book-${n}`, title: name, startedOn: today, lastPage: page, log: [] };
  return { ...state, reading: { ...state.reading, books: [...books, book] } };
}

/** Pages read on one day, summed over all books. */
export function pagesReadOn(state: GameState, date: string): number {
  let sum = 0;
  for (const b of state.reading.books) for (const l of b.log) if (l.date === date) sum += l.to - l.from;
  return sum;
}

/** All pages ever logged. */
export function totalPagesRead(state: GameState): number {
  return state.reading.books.reduce((s, b) => s + b.log.reduce((t, l) => t + (l.to - l.from), 0), 0);
}

/** Finished books, in the order they were finished. */
export function finishedBooks(state: GameState): Book[] {
  return state.reading.books.filter((b) => b.finishedOn).sort((a, b) => a.finishedOn!.localeCompare(b.finishedOn!));
}

/** Today's reading quest is reached: enough pages today, or a book was finished today. */
function readGoalReached(state: GameState, today: string, needed: number): boolean {
  return pagesReadOn(state, today) >= needed || state.reading.books.some((b) => b.finishedOn === today);
}

function summary(state: GameState, today: string, before: boolean, error?: string): LogPagesResult {
  const quest = state.days[today]?.quests.find((q) => q.templateId === READ_QUEST);
  const completed = !!quest?.done;
  return {
    state,
    pagesToday: pagesReadOn(state, today),
    needed: quest ? quest.amount : null,
    completed,
    justCompleted: completed && !before,
    ...(error ? { error } : {}),
  };
}

/**
 * Log the page reached in a book, with a photo of it. This is the only way the reading
 * quest gets ticked off: when today's pages (all books) reach the quest amount, or when a
 * book is finished today.
 */
export function logPages(state: GameState, today: string, input: LogPagesInput): LogPagesResult {
  const wasDone = !!state.days[today]?.quests.find((q) => q.templateId === READ_QUEST)?.done;
  const fail = (error: string) => summary(state, today, wasDone, error);
  const book = state.reading.books.find((b) => b.id === input.bookId);
  if (!book) return fail('Das Buch gibt es nicht.');
  if (book.finishedOn) return fail('Dieses Buch hast du schon beendet.');
  const page = input.page;
  if (!Number.isFinite(page) || page < 0 || Math.floor(page) !== page) return fail('Gib eine gültige Seitenzahl ein.');
  if (page < book.lastPage) return fail(`Die Seite liegt vor deiner letzten Seite (S. ${book.lastPage}).`);
  if (page === book.lastPage && !input.finished) return fail(`Du bist noch auf derselben Seite wie beim letzten Mal (S. ${book.lastPage}).`);
  if (input.finished && !hasReadPages(book) && page <= book.lastPage) return fail('Lies zuerst mindestens eine Seite in diesem Buch.');
  if (!input.photo) return fail('Mach ein Foto von der Seite, dann zählt sie.');

  const updated: Book = {
    ...book,
    lastPage: page,
    photo: input.photo,
    photoDate: today,
    log: page > book.lastPage ? [...book.log, { date: today, from: book.lastPage, to: page }] : book.log,
    ...(input.finished ? { finishedOn: today } : {}),
  };
  let next: GameState = { ...state, reading: { ...state.reading, books: state.reading.books.map((b) => (b.id === book.id ? updated : b)) } };

  const day = next.days[today];
  const quest = day?.quests.find((q) => q.templateId === READ_QUEST);
  if (day && quest && !quest.done && readGoalReached(next, today, quest.amount)) {
    next = { ...next, days: { ...next.days, [today]: completeQuest(day, quest.id) } };
  }
  return summary(next, today, wasDone);
}

/**
 * Take back the last entry of a book (a typo in the page number). The page goes back, a
 * finish on that day is undone, and today's reading quest is unticked if it no longer holds.
 */
export function undoLastPages(state: GameState, today: string, bookId: string): GameState {
  const book = state.reading.books.find((b) => b.id === bookId);
  const last = book?.log[book.log.length - 1];
  if (!book || !last) return state;
  const { finishedOn, ...rest } = book;
  const log = book.log.slice(0, -1);
  // the finish goes too when its entry is taken back, when it happened today, or when no page is left
  const keepFinish = !!finishedOn && finishedOn !== last.date && finishedOn !== today && log.some((l) => l.to > l.from);
  const updated: Book = {
    ...rest,
    lastPage: last.from,
    log,
    ...(keepFinish ? { finishedOn } : {}),
  };
  let next: GameState = { ...state, reading: { ...state.reading, books: state.reading.books.map((b) => (b.id === bookId ? updated : b)) } };
  const day = next.days[today];
  const quest = day?.quests.find((q) => q.templateId === READ_QUEST);
  if (day && quest?.done && !readGoalReached(next, today, quest.amount)) {
    next = { ...next, days: { ...next.days, [today]: uncheckQuest(day, quest.id) } };
  }
  return next;
}
