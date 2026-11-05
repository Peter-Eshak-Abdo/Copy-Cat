/**
 * CV data shared by the CV page, the AI route (/api/ai/cv) and the Word builder (lib/docx/cv-docx.ts).
 * One CvData per language; the layout is the shop's usual one (dark sidebar with personal data, skills and
 * languages; name, objective, education, experience on the main side), mirrored for Arabic.
 */

export type CvLang = "ar" | "en";

export interface CvPair {
  label: string;
  value: string;
}

export interface CvEducation {
  /** "Faculty of Arts, Suez Canal University" */
  title: string;
  /** "Department: GIS", "Expected Graduation Year: 2028"... */
  details: string[];
}

export interface CvSection {
  heading: string;
  items: string[];
}

export interface CvData {
  name: string;
  /** Optional line under the name ("Accountant", "طالب بكلية التجارة") */
  jobTitle: string;
  personal: CvPair[];
  objective: string;
  education: CvEducation[];
  experience: string[];
  courses: string[];
  skills: string[];
  languages: CvPair[];
  /** Anything else the customer gave (computer skills, hobbies, references...) */
  extra: CvSection[];
  headings: CvHeadings;
}

export interface CvHeadings {
  personal: string;
  objective: string;
  education: string;
  experience: string;
  courses: string;
  skills: string;
  languages: string;
}

/** Section names as written on the shop's two sample CVs */
export const DEFAULT_HEADINGS: Record<CvLang, CvHeadings> = {
  en: {
    personal: "Personal Information",
    objective: "OBJECTIVE",
    education: "Education",
    experience: "EXPERIENCES",
    courses: "COURSES",
    skills: "Soft Skills",
    languages: "LANGUAGES",
  },
  ar: {
    personal: "البيانات الشخصية",
    objective: "الهدف المهني",
    education: "المؤهلات",
    experience: "الخبرات السابقة",
    courses: "الدورات التدريبية",
    skills: "مهارات",
    languages: "اللغات",
  },
};

export function emptyCv(lang: CvLang): CvData {
  return {
    name: "",
    jobTitle: "",
    personal: [],
    objective: "",
    education: [],
    experience: [],
    courses: [],
    skills: [],
    languages: [],
    extra: [],
    headings: { ...DEFAULT_HEADINGS[lang] },
  };
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const pairList = (v: unknown): CvPair[] =>
  Array.isArray(v)
    ? v
        .map((p) => ({ label: str((p as CvPair)?.label), value: str((p as CvPair)?.value) }))
        .filter((p) => p.label || p.value)
    : [];

/** Whatever the model (or a saved draft) returned, as a complete CvData */
export function normalizeCv(raw: unknown, lang: CvLang): CvData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const h = (r.headings && typeof r.headings === "object" ? r.headings : {}) as Record<string, unknown>;
  const headings = { ...DEFAULT_HEADINGS[lang] };
  for (const k of Object.keys(headings) as (keyof CvHeadings)[]) if (str(h[k])) headings[k] = str(h[k]);
  return {
    name: str(r.name),
    jobTitle: str(r.jobTitle),
    personal: pairList(r.personal),
    objective: str(r.objective),
    education: Array.isArray(r.education)
      ? r.education
          .map((e) => ({ title: str((e as CvEducation)?.title), details: strList((e as CvEducation)?.details) }))
          .filter((e) => e.title || e.details.length)
      : [],
    experience: strList(r.experience),
    courses: strList(r.courses),
    skills: strList(r.skills),
    languages: pairList(r.languages),
    extra: Array.isArray(r.extra)
      ? r.extra
          .map((s) => ({ heading: str((s as CvSection)?.heading), items: strList((s as CvSection)?.items) }))
          .filter((s) => s.heading && s.items.length)
      : [],
    headings,
  };
}

/** True when nothing was filled in */
export function isEmptyCv(cv: CvData): boolean {
  return (
    !cv.name &&
    !cv.objective &&
    cv.personal.length + cv.education.length + cv.experience.length + cv.courses.length + cv.skills.length + cv.languages.length + cv.extra.length === 0
  );
}

/** Colours of the sample CVs */
export const CV_COLORS = {
  sidebar: "0F2236",
  pill: "1E7B7F",
  heading: "0F2236",
  nameAr: "4472C4",
  nameEn: "1F3A5F",
};

/* ------------------------------------------------------------------ */
/* Templates, digits, and fitting on one page                          */
/* ------------------------------------------------------------------ */

/** classic = the shop's coloured layout (dark sidebar); ats = plain black, one column, for company systems */
export type CvTemplate = "classic" | "ats";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Leaves e-mail addresses and links alone (they must stay typeable) */
function mapOutsideAddresses(s: string, fn: (part: string) => string): string {
  return s
    .split(/(\S*@\S+|https?:\/\/\S+|www\.\S+)/g)
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join("");
}

/** The Arabic CV is written all in Arabic: 0-9 become ٠-٩ (phone numbers too) */
export const toArabicDigits = (s: string) => mapOutsideAddresses(s, (p) => p.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]));
/** The English CV uses 0-9 only */
export const toWesternDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** The CV with every text in the right digits for its language */
export function localizeDigits(cv: CvData, lang: CvLang): CvData {
  const f = lang === "ar" ? toArabicDigits : toWesternDigits;
  const pair = (p: CvPair) => ({ label: f(p.label), value: f(p.value) });
  return {
    ...cv,
    name: f(cv.name),
    jobTitle: f(cv.jobTitle),
    personal: cv.personal.map(pair),
    objective: f(cv.objective),
    education: cv.education.map((e) => ({ title: f(e.title), details: e.details.map(f) })),
    experience: cv.experience.map(f),
    courses: cv.courses.map(f),
    skills: cv.skills.map(f),
    languages: cv.languages.map(pair),
    extra: cv.extra.map((s) => ({ heading: f(s.heading), items: s.items.map(f) })),
  };
}

/**
 * Sizes of the two layouts in points at scale 1. The Word builder and the on-screen / PDF sheet both read
 * these, multiplied by the scale that fits the CV on one A4 page (the shop always delivers one page:
 * a long CV gets a smaller font and tighter spacing instead of a second page).
 */
export function cvMetrics(template: CvTemplate, lang: CvLang, s: number) {
  if (template === "ats") {
    return {
      margin: 46 * s + 10, // page margin (pt)
      name: 22 * s,
      nameAfter: 2 * s,
      job: 12 * s,
      contact: 10.5 * s,
      contactAfter: 10 * s,
      heading: 12 * s,
      headingBefore: 10 * s,
      headingAfter: 5 * s,
      body: 11 * s,
      bodyLine: 1.15,
      itemAfter: 3 * s,
      eduTitle: 11.5 * s,
    };
  }
  return {
    sideTop: 35 * s,
    mainTop: 22.5 * s,
    photo: 112 * s,
    pill: 13 * s,
    pillPad: 3.5 * s,
    pillAfter: 6 * s,
    sideItem: 11.5 * s,
    sideLine: 1.375,
    sideAfter: 7 * s,
    sideBlockAfter: 18 * s,
    name: (lang === "ar" ? 30 : 24) * s,
    nameAfter: 15 * s,
    job: 13 * s,
    bar: 12 * s,
    barPad: 3.5 * s,
    barAfter: 7 * s,
    objective: 12 * s,
    objectiveLine: 1.58,
    eduTitle: 14 * s,
    eduDetail: 13 * s,
    listLine: 1.33,
    itemAfter: 7.5 * s,
    experience: 13.5 * s,
    other: 12.5 * s,
    sectionAfter: 16 * s,
  };
}

export type ClassicMetrics = Exclude<ReturnType<typeof cvMetrics>, { margin: number }>;
export type AtsMetrics = Extract<ReturnType<typeof cvMetrics>, { margin: number }>;

/** A4 in points and the classic layout's column widths */
export const PAGE_PT = { w: 595.3, h: 841.9 };
export const SIDEBAR_PT = 200;

/** Lines a text takes at this size in a column this wide (a little generous, so the guess never overflows) */
function linesOf(text: string, sizePt: number, widthPt: number): number {
  // Average letter width in em: Arabic letters join and are narrower than bold Latin ones
  const em = /[؀-ۿ]/.test(text) ? 0.44 : 0.52;
  const perLine = Math.max(8, widthPt / (sizePt * em));
  return Math.max(1, Math.ceil(text.length / perLine));
}
const LINE = 1.22; // Word's single line spacing for these fonts, in em

/** Estimated content height (pt) of the tallest column at scale s */
export function estimateHeight(cv: CvData, lang: CvLang, template: CvTemplate, s: number, hasPhoto: boolean): number {
  const sep = lang === "ar" ? " : " : ": ";
  const pair = (p: CvPair) => (p.label ? `${p.label}${sep}${p.value}` : p.value);
  if (template === "ats") {
    const m = cvMetrics("ats", lang, s) as AtsMetrics;
    const w = PAGE_PT.w - 2 * m.margin;
    const contactLen = cv.personal.reduce((a, p) => a + p.value.length + 5, 0);
    const para = (t: string, size = m.body, indent = 0) => linesOf(t, size, w - indent) * size * LINE * m.bodyLine + m.itemAfter;
    const heading = m.headingBefore + m.heading * LINE + m.headingAfter;
    let h = m.margin * 2 + m.name * LINE + m.nameAfter + (cv.jobTitle ? m.job * LINE : 0) + (contactLen > 0 ? linesOf("x".repeat(contactLen), m.contact, w) * m.contact * LINE : 0) + m.contactAfter;
    const list = (items: string[]) => (items.length ? heading + items.reduce((a, t) => a + para(t, m.body, 14), 0) : 0);
    if (cv.objective) h += heading + para(cv.objective);
    if (cv.education.length) h += heading + cv.education.reduce((a, e) => a + para(e.title, m.eduTitle) + e.details.reduce((b, d) => b + para(d, m.body, 14), 0), 0);
    h += list(cv.experience) + list(cv.courses) + list(cv.skills) + list(cv.languages.map(pair)) + list(cv.personal.map(pair));
    for (const x of cv.extra) h += list(x.items);
    return h;
  }
  const m = cvMetrics("classic", lang, s) as ClassicMetrics;
  const sideW = SIDEBAR_PT - 26;
  const mainW = PAGE_PT.w - SIDEBAR_PT - 38;
  const sideBlock = (items: string[]) =>
    items.length
      ? m.pill * LINE + m.pillPad * 2 + m.pillAfter + items.reduce((a, t) => a + linesOf(t, m.sideItem, sideW - 15) * m.sideItem * LINE * m.sideLine + m.sideAfter, 0) + m.sideBlockAfter
      : 0;
  const side =
    m.sideTop + (hasPhoto ? m.photo + 12 * s : 0) + sideBlock(cv.personal.map(pair)) + sideBlock(cv.skills) + sideBlock(cv.languages.map(pair));
  const bar = m.bar * LINE + m.barPad * 2 + m.barAfter;
  const list = (items: string[], size: number) =>
    items.length ? bar + items.reduce((a, t) => a + linesOf(t, size, mainW - 18) * size * LINE * m.listLine + m.itemAfter, 0) + m.sectionAfter : 0;
  let main = m.mainTop + linesOf(cv.name || "x", m.name, mainW) * m.name * LINE + m.nameAfter + (cv.jobTitle ? m.job * LINE : 0);
  if (cv.objective) main += bar + linesOf(cv.objective, m.objective, mainW) * m.objective * LINE * m.objectiveLine + m.sectionAfter;
  if (cv.education.length)
    main +=
      bar +
      cv.education.reduce(
        (a, e) =>
          a +
          (e.title ? linesOf(e.title, m.eduTitle, mainW) * m.eduTitle * LINE + m.itemAfter : 0) +
          e.details.reduce((b, d) => b + linesOf(d, m.eduDetail, mainW - 35) * m.eduDetail * LINE * m.listLine + m.itemAfter, 0),
        0
      ) +
      m.sectionAfter;
  main += list(cv.experience, m.experience) + list(cv.courses, m.other);
  for (const x of cv.extra) main += list(x.items, m.other);
  return Math.max(side, main);
}

/** Largest scale (1 = the normal sizes, down to 0.62) at which the CV fits on one A4 page */
export function fitScale(cv: CvData, lang: CvLang, template: CvTemplate, hasPhoto: boolean): number {
  // The classic page table must stay ~55 pt short of the page bottom (see lib/docx/cv-docx.ts)
  const budget = PAGE_PT.h - (template === "classic" ? 60 : 8);
  for (let s = 1; s > 0.62; s -= 0.02) {
    if (estimateHeight(cv, lang, template, s, hasPhoto) <= budget) return Math.round(s * 100) / 100;
  }
  return 0.62;
}
