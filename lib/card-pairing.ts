export type DetectedSide = "front" | "back" | "unknown";

export interface ScannedSide {
  side: DetectedSide;
  /** 14-digit national number read from this side, if readable */
  nationalId?: string | null;
  /** Last 6 digits of the national number, when only the end of it was readable */
  idTail?: string | null;
}

export interface SidePairing {
  /** Indices into the uploaded list; a missing side is left empty */
  front: number | null;
  back: number | null;
  nationalId: string | null;
  /** Last 6 digits when no side gave the full number */
  idTail?: string | null;
  /** Paired by upload order, not by national number: worth a look before printing */
  guessed?: boolean;
}

/** OCR can misread a digit or two, so ids within 2 differing digits count as the same card */
const MAX_ID_DISTANCE = 2;

function hamming(a: string, b: string): number {
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

const tailOf = (s: ScannedSide) => s.idTail || (s.nationalId ? s.nationalId.slice(-6) : null);
const hasNumber = (s: ScannedSide) => !!(s.nationalId || s.idTail);

/**
 * How far apart two sides' national numbers are. Two full numbers allow two misread digits. When one side
 * only gave its last 6 digits (worn card, glare, blurry photo) those must match exactly, and count as a
 * weaker match than a full number.
 */
function idDistance(a: ScannedSide, b: ScannedSide): number {
  if (a.nationalId && b.nationalId) return hamming(a.nationalId, b.nationalId);
  const ta = tailOf(a);
  const tb = tailOf(b);
  if (!ta || !tb) return Infinity;
  return ta === tb ? MAX_ID_DISTANCE + 0.5 : Infinity;
}
const MAX_MATCH = MAX_ID_DISTANCE + 0.5;

/**
 * Pairs scanned card sides into cards, in upload order:
 * 1. Fronts and backs carrying the same national number are paired, whatever order they were uploaded in.
 * 2. When one of the two numbers is unreadable, a back joins an unpaired front uploaded right before it
 *    (or right after it); two different readable numbers are never paired.
 * 3. Anything left over becomes a card with its other side empty.
 * With no side detected at all (AI unavailable) uploads are paired consecutively, front then back.
 */
export function pairCardSides(sides: ScannedSide[]): SidePairing[] {
  if (sides.length === 0) return [];

  if (sides.every((s) => s.side === "unknown")) {
    const pairs: SidePairing[] = [];
    for (let i = 0; i < sides.length; i += 2) {
      pairs.push({
        front: i,
        back: i + 1 < sides.length ? i + 1 : null,
        nationalId: sides[i].nationalId || sides[i + 1]?.nationalId || null,
      });
    }
    return pairs;
  }

  // An undetected side whose number matches a known front is that card's back; otherwise it is a front.
  // (The page decides undetected sides itself by looking for the portrait, see processOneSide.)
  const kind = sides.map((s, i): "front" | "back" => {
    if (s.side !== "unknown") return s.side;
    const matchesFront = sides.some((o, j) => j !== i && o.side === "front" && idDistance(o, s) <= MAX_MATCH);
    return matchesFront ? "back" : "front";
  });

  const fronts = sides.map((_, i) => i).filter((i) => kind[i] === "front");
  const backs = sides.map((_, i) => i).filter((i) => kind[i] === "back");
  const backOf = new Map<number, number>();
  const usedBacks = new Set<number>();

  // 1. Matching national numbers, closest match first
  const candidates: Array<[number, number, number]> = [];
  for (const f of fronts) {
    for (const b of backs) {
      const d = idDistance(sides[f], sides[b]);
      if (d <= MAX_MATCH) candidates.push([d, f, b]);
    }
  }
  candidates.sort((a, b) => a[0] - b[0] || Math.abs(a[1] - a[2]) - Math.abs(b[1] - b[2]));
  for (const [, f, b] of candidates) {
    if (backOf.has(f) || usedBacks.has(b)) continue;
    backOf.set(f, b);
    usedBacks.add(b);
  }

  // 2a. No number readable at all (AI quota used up, glare): when the leftover fronts and backs without a
  // number are equally many, they are matched in upload order, which fits both "front, back, front, back"
  // and "all fronts, then all backs". Unequal counts mean a side is missing somewhere, so only direct
  // neighbours are paired (2b). Either way the card is flagged for a check by eye.
  const guessed = new Set<number>();
  const loneFronts = fronts.filter((f) => !backOf.has(f) && !hasNumber(sides[f]));
  const loneBacks = backs.filter((b) => !usedBacks.has(b) && !hasNumber(sides[b]));
  if (loneFronts.length > 0 && loneFronts.length === loneBacks.length) {
    loneFronts.forEach((f, k) => {
      backOf.set(f, loneBacks[k]);
      usedBacks.add(loneBacks[k]);
      guessed.add(f);
    });
  }

  // 2b. Sides missing a readable number join the nearest unpaired side they do not contradict
  // (two different readable numbers are two different cards)
  for (const b of backs) {
    if (usedBacks.has(b)) continue;
    // Only a directly neighbouring upload: guessing across other cards paired strangers' sides in testing
    const nearest = [b - 1, b + 1].find(
      (f) => kind[f] === "front" && !backOf.has(f) && (!hasNumber(sides[f]) || !hasNumber(sides[b]))
    );
    if (nearest === undefined) continue;
    backOf.set(nearest, b);
    usedBacks.add(b);
    guessed.add(nearest);
  }

  // 3. Every front is a card (back possibly empty); leftover backs become cards without a front
  const pairs: SidePairing[] = fronts.map((f) => {
    const b = backOf.get(f) ?? null;
    return {
      front: f,
      back: b,
      nationalId: sides[f].nationalId || (b !== null ? sides[b].nationalId : null) || null,
      idTail: tailOf(sides[f]) || (b !== null ? tailOf(sides[b]) : null),
      guessed: guessed.has(f),
    };
  });
  for (const b of backs) {
    if (!usedBacks.has(b)) pairs.push({ front: null, back: b, nationalId: sides[b].nationalId || null, idTail: tailOf(sides[b]) });
  }

  const firstIndex = (p: SidePairing) => Math.min(p.front ?? Infinity, p.back ?? Infinity);
  return pairs.sort((a, b) => firstIndex(a) - firstIndex(b));
}

/** The two scanned sides carry the same national number (full, or the last 6 digits) */
export function sameCardNumber(a: ScannedSide, b: ScannedSide): boolean {
  return idDistance(a, b) <= MAX_MATCH;
}

type Corner = { x: number; y: number };
type Quad = { tl: Corner; tr: Corner; br: Corner; bl: Corner };

/**
 * Renames a card's corners for a clockwise quarter turn (90 / 180 / 270): the perspective warp always outputs
 * a landscape card from tl→tr, so renaming the corners turns the straightened card upright.
 */
export function turnQuad<Q extends Quad>(quad: Q, rotation: number): Quad {
  const ring = [quad.tl, quad.tr, quad.br, quad.bl];
  const shift = (((Math.round(rotation / 90)) % 4) + 4) % 4;
  const at = (k: number) => ring[(k - shift + 4) % 4];
  return { tl: at(0), tr: at(1), br: at(2), bl: at(3) };
}

/**
 * Without an AI answer about the card's direction: a card photographed upright or sideways is still a
 * landscape rectangle, so when the quad's top edge is the short one it is turned a quarter.
 */
export function landscapeQuad<Q extends Quad>(quad: Q, imageW: number, imageH: number): Quad {
  const len = (a: Corner, b: Corner) => Math.hypot((a.x - b.x) * imageW, (a.y - b.y) * imageH);
  const top = (len(quad.tl, quad.tr) + len(quad.bl, quad.br)) / 2;
  const side = (len(quad.tl, quad.bl) + len(quad.tr, quad.br)) / 2;
  return top < side * 0.85 ? turnQuad(quad, 90) : quad;
}
