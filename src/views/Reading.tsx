// Reading quest: start a book (cover photo and page count optional), then log the page reached
// with a photo of it. Today's pages count up to 2× the quest.
import { useEffect, useRef, useState } from 'react';
import { READ_QUEST, formatDate, isDoubled, maxAchieved, questXp } from '../game';
import { bookProgress, currentBook, pagesReadOn, unfinishedBooks, type Book, type LogPagesResult } from '../reading';
import type { Game } from '../store';
import { Badge3D, Icon } from './Icons';
import { Sheet } from './ui';

/** Page photos are stored small: about 320 px wide, JPEG. */
const PHOTO_WIDTH = 320;
const PHOTO_QUALITY = 0.7;

function toDataUrl(source: CanvasImageSource, width: number, height: number): string {
  const w = Math.min(PHOTO_WIDTH, width);
  const h = Math.round((height / (width || 1)) * w);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
}

/** Read a picked image file and shrink it like a camera snapshot. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(toDataUrl(img, img.naturalWidth, img.naturalHeight));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Bild konnte nicht gelesen werden.'));
    };
    img.src = url;
  });
}

type Mode = 'log' | 'new' | 'edit';

interface LoggedResult {
  res: LogPagesResult;
  bookId: string;
  title: string;
  page: number;
  photo: string;
  finished: boolean;
}

export function ReadingSheet({
  game,
  today,
  startNew = false,
  startEdit = false,
  onClose,
  onCompleted,
}: {
  game: Game;
  today: string;
  startNew?: boolean; // open on the "new book" form
  startEdit?: boolean; // open on the "edit book" form of the current book
  onClose: () => void;
  onCompleted?: () => void;
}) {
  const { state } = game;
  const books = unfinishedBooks(state);
  // the player may pick which unfinished book to continue; the newest one is the default
  const [pickedId, setPickedId] = useState<string | null>(null);
  const book = books.find((b) => b.id === pickedId) ?? currentBook(state);
  const [mode, setMode] = useState<Mode>(!book || startNew ? 'new' : startEdit ? 'edit' : 'log');
  const [result, setResult] = useState<LoggedResult | null>(null);
  const [endAsked, setEndAsked] = useState(false); // "last page reached" answered with "not yet"
  const [finishError, setFinishError] = useState<string | null>(null);

  const quest = state.days[today]?.quests.find((q) => q.templateId === READ_QUEST);
  const pagesToday = pagesReadOn(state, today);

  /** The last page was logged: mark the book finished on that same page (same photo). */
  const finishBook = () => {
    if (!result) return;
    const res = game.logPages({ bookId: result.bookId, page: result.page, photo: result.photo, finished: true });
    if (res.error) return setFinishError(res.error);
    setFinishError(null);
    setResult({ ...result, res, finished: true });
    if (res.justCompleted) onCompleted?.();
  };

  return (
    <Sheet title="Lesen" onClose={onClose}>
      {quest && mode !== 'edit' && (
        <div className={`read-today ${quest.done ? 'done' : ''} ${isDoubled(quest) ? 'doubled' : ''}`}>
          <Badge3D icon={quest.done ? 'check' : 'book'} tone={isDoubled(quest) ? 'gold' : 'intelligenz'} size={34} shape={quest.done ? 'coin' : 'tile'} />
          <span>
            <strong>
              Heute: {pagesToday} von {quest.amount} Seiten <span className="read-max">(bis 2×: {maxAchieved(quest)})</span>
            </strong>
            <small>
              {isDoubled(quest)
                ? `Doppelt geschafft · ${questXp(quest)} XP`
                : quest.done
                  ? `Quest erledigt · ${questXp(quest)} XP. Jede Seite mehr zählt bis 2×.`
                  : 'Oder lies ein Buch zu Ende.'}
            </small>
          </span>
          <span className="read-meter double" aria-hidden>
            <span style={{ width: `${Math.min(pagesToday / maxAchieved(quest), 1) * 100}%` }} />
          </span>
        </div>
      )}

      {result ? (
        <div className="read-success">
          <Badge3D icon={result.finished ? 'trophy' : 'check'} tone={result.finished ? 'gold' : 'intelligenz'} shape="coin" size={64} />
          <strong className="display">{result.finished ? 'Buch beendet' : 'Eingetragen'}</strong>
          <p>
            {result.finished ? `„${result.title}“ ist fertig.` : `„${result.title}“: weiter bis Seite ${result.page}.`}{' '}
            {successLine(result.res, quest?.xp ?? 0)}
          </p>
          {result.res.reachedEnd && !result.finished && !endAsked ? (
            <div className="read-end" role="group" aria-label="Letzte Seite erreicht">
              <strong>Letzte Seite erreicht – Buch als fertig markieren?</strong>
              {finishError && (
                <p className="error" role="alert">
                  {finishError}
                </p>
              )}
              <div className="row">
                <button className="secondary" onClick={() => setEndAsked(true)}>
                  Noch nicht
                </button>
                <button className="primary grow" onClick={finishBook}>
                  Ja, Buch fertig
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="primary" onClick={onClose}>
                Fertig
              </button>
              {result.finished && (
                <button
                  className="link-button"
                  onClick={() => {
                    setResult(null);
                    setMode('new');
                  }}
                >
                  Neues Buch anfangen
                </button>
              )}
            </>
          )}
        </div>
      ) : mode === 'new' || !book ? (
        <NewBookForm
          game={game}
          canCancel={!!book}
          onCancel={() => setMode('log')}
          onStarted={() => {
            setPickedId(null); // the book just started is the newest one
            setMode('log');
          }}
        />
      ) : mode === 'edit' ? (
        <EditBookForm key={book.id} game={game} book={book} onDone={() => setMode('log')} />
      ) : (
        <LogForm
          key={book.id}
          game={game}
          book={book}
          books={books}
          onPick={setPickedId}
          today={today}
          onLogged={(res, page, photo, finished) => {
            setEndAsked(false);
            setFinishError(null);
            setResult({ res, bookId: book.id, title: book.title, page, photo, finished });
            if (res.justCompleted) onCompleted?.();
          }}
          onNewBook={() => setMode('new')}
          onEdit={() => setMode('edit')}
        />
      )}
    </Sheet>
  );
}

/** What the page entry did for today's reading quest. */
function successLine(res: LogPagesResult, xp: number): string {
  if (res.needed === null) return '';
  const max = res.needed * 2;
  if (res.justCompleted) {
    return res.pagesToday >= max ? `Die Lese-Quest ist doppelt geschafft.` : `Die Lese-Quest ist geschafft, +${xp} XP. Bis 2× fehlen noch ${max - res.pagesToday} Seiten.`;
  }
  if (!res.completed) return `Noch ${Math.max(res.needed - res.pagesToday, 0)} Seiten bis zur Quest.`;
  return res.pagesToday >= max ? 'Die Lese-Quest ist doppelt geschafft.' : `Heute ${res.pagesToday} Seiten. Bis 2× fehlen noch ${max - res.pagesToday}.`;
}

/** A book with its cover (or the latest page photo) and how far it is. Also used on the Stats tab. */
export function BookCard({ book, label, sub, big = false }: { book: Book; label?: string; sub?: string; big?: boolean }) {
  const p = bookProgress(book);
  const started = book.log.length > 0 || book.lastPage > 0;
  const thumb = book.cover ?? book.photo;
  return (
    <div className={`book-card ${big ? 'big attr-intelligenz' : ''}`}>
      {thumb ? (
        <img className={`page-thumb ${book.cover ? 'cover' : ''}`} src={thumb} alt={book.cover ? `Cover von „${book.title}“` : `Letztes Foto aus „${book.title}“`} />
      ) : (
        <span className="page-thumb empty" aria-hidden>
          <Icon name="book" size={26} />
        </span>
      )}
      <span className="book-info">
        {label && <span className="book-label">{label}</span>}
        <strong>{book.title}</strong>
        <span>
          {p.total !== undefined
            ? `Seite ${p.page} von ${p.total} · ${p.percent} %`
            : started
              ? `Seite ${p.page}`
              : 'Noch nichts eingetragen'}
          {sub && ` · ${sub}`}
        </span>
        {p.percent !== undefined && (
          <span className="book-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-label="Fortschritt im Buch">
            <span style={{ width: `${p.percent}%` }} />
          </span>
        )}
      </span>
    </div>
  );
}

/** A whole page count, or null for an empty field. NaN when the input is not a whole number ≥ 1. */
function parsePageCount(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 ? n : NaN;
}

function NewBookForm({ game, canCancel, onCancel, onStarted }: { game: Game; canCancel: boolean; onCancel: () => void; onStarted: () => void }) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [total, setTotal] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Gib den Titel des Buchs ein.');
    const page = start.trim() === '' ? 0 : Number(start);
    if (!Number.isInteger(page) || page < 0) return setError('Gib als Startseite eine ganze Zahl ein, oder lass das Feld leer.');
    const pages = parsePageCount(total);
    if (Number.isNaN(pages)) return setError('Gib als Seitenzahl eine ganze Zahl ein, oder lass das Feld leer.');
    if (pages !== null && pages < page) return setError(`Das Buch kann nicht weniger Seiten haben als deine Startseite (S. ${page}).`);
    game.startBook(title, page, { ...(cover ? { cover } : {}), ...(pages !== null ? { totalPages: pages } : {}) });
    onStarted();
  };

  return (
    <form className="read-form" onSubmit={submit}>
      <p className="small-text">Welches Buch liest du gerade? Danach trägst du jeden Tag ein, bis zu welcher Seite du gekommen bist, mit einem Foto der Seite.</p>
      <strong className="read-form-title">Neues Buch</strong>
      <label className="field">
        <span>Titel</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Der Hobbit" autoComplete="off" />
      </label>
      <div className="row align-end">
        <label className="field grow">
          <span>Startseite (optional)</span>
          <input type="text" inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
        </label>
        <label className="field grow">
          <span>Seitenzahl des Buchs (optional)</span>
          <input type="text" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^0-9]/g, ''))} placeholder="320" />
        </label>
      </div>
      <PhotoField
        label="Cover (optional)"
        value={cover}
        onChange={setCover}
        alt="Cover des Buchs"
        title="Foto vom Cover machen"
        hint="Damit du das Buch in der Liste sofort erkennst."
        removable
        small
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        {canCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Abbrechen
          </button>
        )}
        <button type="submit" className="primary grow">
          Buch starten
        </button>
      </div>
    </form>
  );
}

/** Change title, cover and page count of a book. */
function EditBookForm({ game, book, onDone }: { game: Game; book: Book; onDone: () => void }) {
  const [title, setTitle] = useState(book.title);
  const [total, setTotal] = useState(book.totalPages ? String(book.totalPages) : '');
  const [cover, setCover] = useState<string | null>(book.cover ?? null);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const pages = parsePageCount(total);
    if (Number.isNaN(pages)) return setError('Gib als Seitenzahl eine ganze Zahl ein, oder lass das Feld leer.');
    const res = game.updateBook(book.id, {
      title,
      totalPages: pages,
      ...(cover !== (book.cover ?? null) ? { cover } : {}),
    });
    if (res.error) return setError(res.error);
    onDone();
  };

  return (
    <form className="read-form" onSubmit={submit}>
      <strong className="read-form-title">Buch bearbeiten</strong>
      <label className="field">
        <span>Titel</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} autoComplete="off" />
      </label>
      <label className="field">
        <span>Seitenzahl des Buchs (optional)</span>
        <input type="text" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^0-9]/g, ''))} placeholder="320" />
        <small>Leer lassen, wenn du sie nicht weißt. Du bist bei Seite {book.lastPage}.</small>
      </label>
      <PhotoField
        label="Cover"
        value={cover}
        onChange={setCover}
        alt="Cover des Buchs"
        title="Foto vom Cover machen"
        hint="Damit du das Buch in der Liste sofort erkennst."
        removable
        small
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="button" className="secondary" onClick={onDone}>
          Abbrechen
        </button>
        <button type="submit" className="primary grow">
          Speichern
        </button>
      </div>
    </form>
  );
}

/** A photo taken with the back camera (or the system camera as fallback), stored small. */
function PhotoField({
  label,
  value,
  onChange,
  alt,
  title,
  hint,
  removable = false,
  small = false,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  alt: string;
  title: string;
  hint: string;
  removable?: boolean;
  small?: boolean;
}) {
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File) => {
    try {
      onChange(await fileToDataUrl(file));
      setError(null);
    } catch {
      setError('Das Foto konnte nicht gelesen werden. Versuch es noch einmal.');
    }
  };

  return (
    <div className="field">
      <span>{label}</span>
      {camera ? (
        <PageCamera
          onPhoto={(url) => {
            onChange(url);
            setCamera(false);
            setError(null);
          }}
          onFallback={() => {
            setCamera(false);
            fileRef.current?.click();
          }}
          onCancel={() => setCamera(false)}
        />
      ) : value ? (
        <div className={`photo-preview ${small ? 'small' : ''}`}>
          <img src={value} alt={alt} />
          <span className="photo-actions">
            <button type="button" className="secondary" onClick={() => setCamera(true)}>
              <Icon name="camera" size={18} />
              Neu aufnehmen
            </button>
            {removable && (
              <button type="button" className="link-button" onClick={() => onChange(null)}>
                Foto entfernen
              </button>
            )}
          </span>
        </div>
      ) : (
        <button type="button" className={`photo-button ${small ? 'small' : ''}`} onClick={() => setCamera(true)}>
          <Badge3D icon="camera" tone="intelligenz" size={small ? 32 : 38} />
          <span>
            <strong>{title}</strong>
            <small>{hint}</small>
          </span>
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function LogForm({
  game,
  book,
  books,
  onPick,
  today,
  onLogged,
  onNewBook,
  onEdit,
}: {
  game: Game;
  book: Book;
  books: Book[];
  onPick: (id: string) => void;
  today: string;
  onLogged: (res: LogPagesResult, page: number, photo: string, finished: boolean) => void;
  onNewBook: () => void;
  onEdit: () => void;
}) {
  const [page, setPage] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = book.log[book.log.length - 1];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = page.trim() === '' && finished ? book.lastPage : Number(page);
    if (page.trim() === '' && !finished) return setError('Trag ein, bis zu welcher Seite du gelesen hast.');
    const res = game.logPages({ bookId: book.id, page: n, photo: photo ?? '', finished });
    if (res.error) return setError(res.error);
    setError(null);
    onLogged(res, n, photo ?? '', finished);
  };

  const suggested = book.totalPages ? Math.min(book.lastPage + 10, book.totalPages) : book.lastPage + 10;

  return (
    <form className="read-form" onSubmit={submit}>
      {books.length > 1 && (
        <div className="field">
          <span>Welches Buch?</span>
          <div className="book-pick" role="radiogroup" aria-label="Welches Buch?">
            {books.map((b) => (
              <button key={b.id} type="button" role="radio" aria-checked={b.id === book.id} className="book-pick-item" onClick={() => onPick(b.id)}>
                <strong>{b.title}</strong>
                <small>{b.log.length > 0 || b.lastPage > 0 ? `Seite ${b.lastPage}` : 'Noch nichts gelesen'}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="book-card-row">
        <BookCard book={book} sub={book.photoDate ? `Foto ${formatDate(book.photoDate)}` : undefined} />
        <button type="button" className="icon-link" onClick={onEdit} aria-label={`„${book.title}“ bearbeiten`}>
          <Icon name="pencil" size={18} />
        </button>
      </div>

      <label className="field">
        <span>Bis Seite{book.totalPages ? ` (von ${book.totalPages})` : ''}</span>
        <input
          type="text"
          inputMode="numeric"
          value={page}
          onChange={(e) => setPage(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder={String(suggested)}
        />
      </label>

      <PhotoField
        label="Foto der Seite"
        value={photo}
        onChange={(url) => {
          setPhoto(url);
          if (url) setError(null);
        }}
        alt="Foto der Seite"
        title="Foto der Seite machen"
        hint="Das Foto ist dein Nachweis. Es bleibt auf dem Handy."
      />

      <label className="check">
        <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} />
        <span>
          Buch ist fertig
          <small>Ein beendetes Buch erledigt die Lese-Quest des Tages, wenn du darin Seiten gelesen hast.</small>
        </span>
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="primary" disabled={!photo}>
        {photo ? 'Seiten eintragen' : 'Erst das Foto machen'}
      </button>

      <div className="read-links">
        {last && last.date === today && (
          <button type="button" className="link-button" onClick={() => game.undoPages(book.id)}>
            Letzten Eintrag zurücknehmen (S. {last.from} bis {last.to})
          </button>
        )}
        <button type="button" className="link-button" onClick={onEdit}>
          Buch bearbeiten
        </button>
        <button type="button" className="link-button" onClick={onNewBook}>
          Anderes Buch anfangen
        </button>
      </div>
    </form>
  );
}

/** Back camera with a shutter button. Falls back to the system camera (file input) if it cannot start. */
function PageCamera({ onPhoto, onFallback, onCancel }: { onPhoto: (url: string) => void; onFallback: () => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // the parent passes a fresh callback on every render; the camera must not restart for that
  const fallback = useRef(onFallback);
  fallback.current = onFallback;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setReady(true);
        boxRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
      } catch {
        if (!stopped) fallback.current();
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    navigator.vibrate?.(30);
    onPhoto(toDataUrl(v, v.videoWidth, v.videoHeight));
  };

  return (
    <div className="page-camera" ref={boxRef}>
      <div className="page-camera-view">
        <video ref={videoRef} playsInline muted />
        {!ready && <span className="page-camera-wait">Kamera startet …</span>}
        <span className="page-camera-frame" aria-hidden />
      </div>
      <div className="row">
        <button type="button" className="secondary" onClick={onCancel}>
          Abbrechen
        </button>
        <button type="button" className="primary grow shutter" onClick={shoot} disabled={!ready}>
          <Icon name="camera" size={20} />
          Aufnehmen
        </button>
      </div>
    </div>
  );
}
