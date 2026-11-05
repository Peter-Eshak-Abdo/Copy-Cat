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
