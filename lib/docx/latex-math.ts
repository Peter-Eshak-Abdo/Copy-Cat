import {
  MathComponent,
  MathFraction,
  MathRadical,
  MathRun,
  MathSubScript,
  MathSubSuperScript,
  MathSuperScript,
} from "docx";

/**
 * Converts the LaTeX subset the OCR prompt asks for ($\frac{٣}{٤}$, $س^{٢}$, $\sqrt{٤٩}$, symbols) into
 * pieces for a Word paragraph. Only real structures (fraction, power, index, root) become Word equation
 * objects; everything between them stays ordinary paragraph text. A Word equation is always laid out
 * left-to-right, so "$س^{٢} = ٢٥$" written as one equation printed reversed ("٢٥ = س²") in an Arabic
 * paragraph; as text the "=" and "٢٥" follow the paragraph's own right-to-left order.
 */

type Node =
  | { t: "text"; s: string }
  | { t: "frac"; num: Node[]; den: Node[] }
  | { t: "script"; base: Node[]; sup?: Node[]; sub?: Node[] }
  | { t: "sqrt"; body: Node[]; deg?: Node[] };

export type MathPiece = { kind: "text"; text: string } | { kind: "math"; components: MathComponent[] };

const SYMBOLS: Record<string, string> = {
  times: "×", div: "÷", pm: "±", mp: "∓", cdot: "·", ast: "∗", le: "≤", leq: "≤", ge: "≥", geq: "≥",
  ne: "≠", neq: "≠", approx: "≈", equiv: "≡", sim: "∼", simeq: "≃", cong: "≅", propto: "∝",
  perp: "⊥", parallel: "∥", angle: "∠", measuredangle: "∡", triangle: "△", square: "□", circ: "∘", degree: "°",
  pi: "π", theta: "θ", alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", lambda: "λ", mu: "μ",
  sigma: "σ", Sigma: "Σ", omega: "ω", Omega: "Ω", phi: "φ", infty: "∞", in: "∈", notin: "∉", ni: "∋",
  subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇", cup: "∪", cap: "∩", emptyset: "∅", varnothing: "∅",
  forall: "∀", exists: "∃", therefore: "∴", because: "∵", to: "→", rightarrow: "→", leftarrow: "←",
  Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", iff: "⇔", leftrightarrow: "↔", ldots: "…", cdots: "⋯",
  dots: "…", prime: "′", "%": "%", "{": "{", "}": "}", "$": "$", "&": "&", "#": "#", "_": "_",
  ",": " ", ";": " ", ":": " ", "!": "", quad: "  ", qquad: "    ", " ": " ", backslash: "\\",
  sum: "∑", prod: "∏", int: "∫", partial: "∂", nabla: "∇", neg: "¬", land: "∧", lor: "∨",
};
const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" };
const TEXT_COMMANDS = new Set(["text", "mathrm", "textbf", "mathbf", "operatorname", "textrm", "mathit", "textit", "mbox"]);
const STYLE_COMMANDS = new Set(["displaystyle", "textstyle", "scriptstyle", "limits", "nolimits", "left", "right", "big", "Big", "bigl", "bigr", "Bigl", "Bigr"]);

class Parser {
  private i = 0;
  constructor(private readonly src: string) {}

  parseSeq(stop?: string): Node[] {
    const out: Node[] = [];
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (stop && ch === stop) {
        this.i++;
        return out;
      }
      if (ch === "}") {
        // Unbalanced closing brace: skip it rather than fail the whole expression
        this.i++;
        continue;
      }
      let atom = this.parseAtom();
      // Attach any ^ / _ scripts to the atom just read
      while (this.src[this.i] === "^" || this.src[this.i] === "_") {
        const op = this.src[this.i++];
        const arg = this.parseArg();
        const base = atom.t === "script" && !(op === "^" ? atom.sup : atom.sub) ? atom : null;
        if (base) {
          if (op === "^") base.sup = arg;
          else base.sub = arg;
        } else {
          atom = { t: "script", base: [atom], ...(op === "^" ? { sup: arg } : { sub: arg }) };
        }
      }
      out.push(atom);
    }
    return out;
  }

  /** One argument: a {group}, a \command or a single character */
  private parseArg(): Node[] {
    while (this.src[this.i] === " ") this.i++;
    if (this.src[this.i] === "{") {
      this.i++;
      return this.parseSeq("}");
    }
    return this.i < this.src.length ? [this.parseAtom()] : [];
  }

  private parseAtom(): Node {
    const ch = this.src[this.i];
    if (ch === "{") {
      this.i++;
      const inner = this.parseSeq("}");
      return inner.length === 1 ? inner[0] : { t: "script", base: inner };
    }
    if (ch !== "\\") {
      this.i++;
      return { t: "text", s: ch };
    }

    this.i++;
    const nameMatch = this.src.slice(this.i).match(/^([A-Za-z]+|.)/);
    const name = nameMatch ? nameMatch[1] : "";
    this.i += name.length;

    if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
      return { t: "frac", num: this.parseArg(), den: this.parseArg() };
    }
    if (name === "sqrt") {
      let deg: Node[] | undefined;
      if (this.src[this.i] === "[") {
        this.i++;
        deg = this.parseSeq("]");
      }
      return { t: "sqrt", body: this.parseArg(), deg };
    }
    if (TEXT_COMMANDS.has(name)) {
      return { t: "text", s: flatten(this.parseArg()) };
    }
    if (name === "mathbb") {
      const letter = flatten(this.parseArg());
      return { t: "text", s: BLACKBOARD[letter] ?? letter };
    }
    if (name === "overline" || name === "overrightarrow" || name === "overleftrightarrow" || name === "vec" || name === "bar") {
      // Segment / ray / vector notation: the letters with a combining mark above each
      const mark = name === "overline" || name === "bar" ? "̅" : "⃗";
      return { t: "text", s: [...flatten(this.parseArg())].map((c) => (c === " " ? c : c + mark)).join("") };
    }
    if (STYLE_COMMANDS.has(name)) {
      // \left( ... \right) keep their delimiter; "\left." prints nothing
      if ((name === "left" || name === "right") && this.src[this.i] === ".") this.i++;
      return { t: "text", s: "" };
    }
    if (name in SYMBOLS) return { t: "text", s: SYMBOLS[name] };
    // Unknown command: print its name rather than lose the content
    return { t: "text", s: name };
  }
}

function flatten(nodes: Node[]): string {
  return nodes
    .map((n) => {
      if (n.t === "text") return n.s;
      if (n.t === "frac") return `${flatten(n.num)}/${flatten(n.den)}`;
      if (n.t === "sqrt") return `√${flatten(n.body)}`;
      return flatten(n.base) + (n.sup ? flatten(n.sup) : "") + (n.sub ? flatten(n.sub) : "");
    })
    .join("");
}

/** ^{\circ} and ^\circ are a degree sign, not a superscript structure */
function simplify(node: Node): Node {
  if (node.t === "script" && node.sup && !node.sub && flatten(node.sup).trim() === "∘") {
    return { t: "text", s: `${flatten(node.base)}°` };
  }
  if (node.t === "script" && !node.sup && !node.sub) {
    return node.base.length === 1 ? simplify(node.base[0]) : { t: "text", s: flatten(node.base) };
  }
  return node;
}

function toComponents(nodes: Node[]): MathComponent[] {
  const out: MathComponent[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push(new MathRun(text));
    text = "";
  };
  for (const raw of nodes) {
    const n = simplify(raw);
    if (n.t === "text") {
      text += n.s;
      continue;
    }
    flush();
    if (n.t === "frac") {
      out.push(new MathFraction({ numerator: toComponents(n.num), denominator: toComponents(n.den) }));
    } else if (n.t === "sqrt") {
      out.push(new MathRadical({ children: toComponents(n.body), degree: n.deg ? toComponents(n.deg) : undefined }));
    } else if (n.sup && n.sub) {
      out.push(new MathSubSuperScript({ children: toComponents(n.base), superScript: toComponents(n.sup), subScript: toComponents(n.sub) }));
    } else if (n.sup) {
      out.push(new MathSuperScript({ children: toComponents(n.base), superScript: toComponents(n.sup) }));
    } else if (n.sub) {
      out.push(new MathSubScript({ children: toComponents(n.base), subScript: toComponents(n.sub) }));
    }
  }
  flush();
  return out;
}

export function latexToPieces(latex: string): MathPiece[] {
  const nodes = new Parser(latex).parseSeq().map(simplify);
  const pieces: MathPiece[] = [];
  for (const n of nodes) {
    if (n.t === "text") {
      const last = pieces[pieces.length - 1];
      if (last && last.kind === "text") last.text += n.s;
      else pieces.push({ kind: "text", text: n.s });
    } else {
      pieces.push({ kind: "math", components: toComponents([n]) });
    }
  }
  return pieces.filter((p) => p.kind === "math" || p.text.length > 0);
}

/** Plain-text reading of a LaTeX expression (used for width measurement and the text preview) */
export function latexToPlain(latex: string): string {
  return flatten(new Parser(latex).parseSeq().map(simplify));
}

/** Splits text into plain parts and $...$ math parts */
export function splitMath(text: string): Array<{ math: boolean; s: string }> {
  const out: Array<{ math: boolean; s: string }> = [];
  const re = /\$\$([^$]+)\$\$|\$([^$]+)\$|\\\((.+?)\\\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ math: false, s: text.slice(last, m.index) });
    out.push({ math: true, s: m[1] ?? m[2] ?? m[3] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ math: false, s: text.slice(last) });
  return out;
}

/**
 * Word draws equation text in Cambria Math, which has no Arabic-Indic digits or Arabic letters: they came
 * out tiny and garbled. Marking every equation run as "normal text" (m:nor) in the document font fixes
 * that; this runs on document.xml after the docx is packed (the docx library cannot set run properties
 * on equation runs).
 */
export function patchEquationRunFonts(documentXml: string, font: string, sizeHalfPts: number): string {
  const f = font.replace(/[<>&"]/g, "");
  const rPr =
    `<m:rPr><m:nor/></m:rPr><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>` +
    `<w:sz w:val="${sizeHalfPts}"/><w:szCs w:val="${sizeHalfPts}"/></w:rPr>`;
  return documentXml.replace(/<m:r>(?!<m:rPr>)/g, `<m:r>${rPr}`);
}
