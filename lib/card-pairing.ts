export type DetectedSide = "front" | "back" | "unknown";

export interface ScannedSide {
  side: DetectedSide;
  /** 14-digit national number read from this side, if readable */
  nationalId?: string | null;
}

export interface SidePairing {
  /** Indices into the uploaded list; a missing side is left empty */
  front: number | null;
  back: number | null;
  nationalId: string | null;
}

/** OCR can misread a digit or two, so ids within 2 differing digits count as the same card */
const MAX_ID_DISTANCE = 2;

function idDistance(a?: string | null, b?: string | null): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

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

  // An undetected side whose number matches a known front is that card's back; otherwise it is a front
  const kind = sides.map((s, i): "front" | "back" => {
    if (s.side !== "unknown") return s.side;
    const matchesFront = sides.some(
      (o, j) => j !== i && o.side === "front" && idDistance(o.nationalId, s.nationalId) <= MAX_ID_DISTANCE
    );
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
      const d = idDistance(sides[f].nationalId, sides[b].nationalId);
      if (d <= MAX_ID_DISTANCE) candidates.push([d, f, b]);
    }
  }
  candidates.sort((a, b) => a[0] - b[0] || Math.abs(a[1] - a[2]) - Math.abs(b[1] - b[2]));
  for (const [, f, b] of candidates) {
    if (backOf.has(f) || usedBacks.has(b)) continue;
    backOf.set(f, b);
    usedBacks.add(b);
  }

  // 2. Sides missing a readable number join the nearest unpaired side they do not contradict
  // (two different readable numbers are two different cards)
  for (const b of backs) {
    if (usedBacks.has(b)) continue;
    // Only a directly neighbouring upload: guessing across other cards paired strangers' sides in testing
    const nearest = [b - 1, b + 1].find(
      (f) => kind[f] === "front" && !backOf.has(f) && (!sides[f].nationalId || !sides[b].nationalId)
    );
    if (nearest === undefined) continue;
    backOf.set(nearest, b);
    usedBacks.add(b);
  }

  // 3. Every front is a card (back possibly empty); leftover backs become cards without a front
  const pairs: SidePairing[] = fronts.map((f) => {
    const b = backOf.get(f) ?? null;
    return { front: f, back: b, nationalId: sides[f].nationalId || (b !== null ? sides[b].nationalId : null) || null };
  });
  for (const b of backs) {
    if (!usedBacks.has(b)) pairs.push({ front: null, back: b, nationalId: sides[b].nationalId || null });
  }

  const firstIndex = (p: SidePairing) => Math.min(p.front ?? Infinity, p.back ?? Infinity);
  return pairs.sort((a, b) => firstIndex(a) - firstIndex(b));
}
