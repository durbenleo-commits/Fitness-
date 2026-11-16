// Reading quest: start a book, then log the page reached with a photo of it.
import { useEffect, useRef, useState } from 'react';
import { READ_QUEST, formatDate } from '../game';
import { currentBook, pagesReadOn, unfinishedBooks, type Book, type LogPagesResult } from '../reading';
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

export function ReadingSheet({
  game,
  today,
  startNew = false,
  onClose,
  onCompleted,
}: {
  game: Game;
  today: string;
  startNew?: boolean; // open on the "new book" form
  onClose: () => void;
  onCompleted?: () => void;
}) {
  const { state } = game;
  const books = unfinishedBooks(state);
  // the player may pick which unfinished book to continue; the newest one is the default
  const [pickedId, setPickedId] = useState<string | null>(null);
  const book = books.find((b) => b.id === pickedId) ?? currentBook(state);
  const [newBook, setNewBook] = useState(!book || startNew);
  const [result, setResult] = useState<{ res: LogPagesResult; title: string; page: number; finished: boolean } | null>(null);

  const quest = state.days[today]?.quests.find((q) => q.templateId === READ_QUEST);
  const pagesToday = pagesReadOn(state, today);

  return (
    <Sheet title="Lesen" onClose={onClose}>
      {quest && (
        <div className={`read-today ${quest.done ? 'done' : ''}`}>
          <Badge3D icon={quest.done ? 'check' : 'book'} tone="intelligenz" size={34} shape={quest.done ? 'coin' : 'tile'} />
          <span>
            <strong>
              Heute: {pagesToday} von {quest.amount} Seiten
            </strong>
            <small>{quest.done ? 'Quest erledigt' : 'Oder lies ein Buch zu Ende.'}</small>
          </span>
          <span className="read-meter" aria-hidden>
            <span style={{ width: `${Math.min(pagesToday / quest.amount, 1) * 100}%` }} />
          </span>
        </div>
      )}

      {result ? (
        <div className="read-success">
          <Badge3D icon={result.finished ? 'trophy' : 'check'} tone={result.finished ? 'gold' : 'intelligenz'} shape="coin" size={64} />
          <strong className="display">{result.finished ? 'Buch beendet' : 'Eingetragen'}</strong>
          <p>
            {result.finished ? `„${result.title}“ ist fertig.` : `„${result.title}“: weiter bis Seite ${result.page}.`}{' '}
            {result.res.justCompleted
              ? `Die Lese-Quest ist geschafft, +${quest?.xp ?? 0} XP.`
              : result.res.needed !== null && !result.res.completed
                ? `Noch ${Math.max(result.res.needed - result.res.pagesToday, 0)} Seiten bis zur Quest.`
                : ''}
          </p>
          <button className="primary" onClick={onClose}>
            Fertig
          </button>
          {result.finished && (
            <button
              className="link-button"
              onClick={() => {
                setResult(null);
                setNewBook(true);
              }}
            >
              Neues Buch anfangen
            </button>
          )}
        </div>
      ) : newBook || !book ? (
        <NewBookForm
          game={game}
          canCancel={!!book}
          onCancel={() => setNewBook(false)}
          onStarted={() => {
            setPickedId(null); // the book just started is the newest one
            setNewBook(false);
          }}
        />
      ) : (
        <LogForm
          key={book.id}
          game={game}
          book={book}
          books={books}
          onPick={setPickedId}
          today={today}
          onLogged={(res, page, finished) => {
            setResult({ res, title: book.title, page, finished });
            if (res.justCompleted) onCompleted?.();
          }}
          onNewBook={() => setNewBook(true)}
        />
      )}
    </Sheet>
  );
}

function NewBookForm({ game, canCancel, onCancel, onStarted }: { game: Game; canCancel: boolean; onCancel: () => void; onStarted: () => void }) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Gib den Titel des Buchs ein.');
    const page = start.trim() === '' ? 0 : Number(start);
    if (!Number.isInteger(page) || page < 0) return setError('Gib als Startseite eine ganze Zahl ein, oder lass das Feld leer.');
    game.startBook(title, page);
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
      <label className="field">
        <span>Startseite (optional)</span>
        <input type="text" inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value)} placeholder="0" />
      </label>
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

function LogForm({
  game,
  book,
  books,
  onPick,
  today,
  onLogged,
  onNewBook,
}: {
  game: Game;
  book: Book;
  books: Book[];
  onPick: (id: string) => void;
  today: string;
  onLogged: (res: LogPagesResult, page: number, finished: boolean) => void;
  onNewBook: () => void;
}) {
  const [page, setPage] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const last = book.log[book.log.length - 1];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = page.trim() === '' && finished ? book.lastPage : Number(page);
    if (page.trim() === '' && !finished) return setError('Trag ein, bis zu welcher Seite du gelesen hast.');
    const res = game.logPages({ bookId: book.id, page: n, photo: photo ?? '', finished });
    if (res.error) return setError(res.error);
    setError(null);
    onLogged(res, n, finished);
  };

  const pickFile = async (file: File) => {
    try {
      setPhoto(await fileToDataUrl(file));
      setError(null);
    } catch {
      setError('Das Foto konnte nicht gelesen werden. Versuch es noch einmal.');
    }
  };

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
      <div className="book-card">
        {book.photo ? (
          <img className="page-thumb" src={book.photo} alt={`Letztes Foto aus „${book.title}“`} />
        ) : (
          <span className="page-thumb empty" aria-hidden>
            <Icon name="book" size={26} />
          </span>
        )}
        <span className="book-info">
          <strong>{book.title}</strong>
          <span>
            {book.log.length > 0 || book.lastPage > 0 ? `Zuletzt bei Seite ${book.lastPage}` : 'Noch nichts eingetragen'}
            {book.photoDate && `, ${formatDate(book.photoDate)}`}
          </span>
        </span>
      </div>

      <label className="field">
        <span>Bis Seite</span>
        <input
          type="text"
          inputMode="numeric"
          value={page}
          onChange={(e) => setPage(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder={String(book.lastPage + 10)}
        />
      </label>

      <div className="field">
        <span>Foto der Seite</span>
        {camera ? (
          <PageCamera
            onPhoto={(url) => {
              setPhoto(url);
              setCamera(false);
              setError(null);
            }}
            onFallback={() => {
              setCamera(false);
              fileRef.current?.click();
            }}
            onCancel={() => setCamera(false)}
          />
        ) : photo ? (
          <div className="photo-preview">
            <img src={photo} alt="Foto der Seite" />
            <button type="button" className="secondary" onClick={() => setCamera(true)}>
              <Icon name="camera" size={18} />
              Neu aufnehmen
            </button>
          </div>
        ) : (
          <button type="button" className="photo-button" onClick={() => setCamera(true)}>
            <Badge3D icon="camera" tone="intelligenz" size={38} />
            <span>
              <strong>Foto der Seite machen</strong>
              <small>Das Foto ist dein Nachweis. Es bleibt auf dem Handy.</small>
            </span>
          </button>
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
