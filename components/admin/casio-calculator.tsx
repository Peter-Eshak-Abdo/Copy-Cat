"use client";

import { useEffect, useReducer } from "react";
import { Delete } from "lucide-react";

/**
 * Plain calculator that behaves like a Casio fx-991: you type the whole expression (with brackets),
 * nothing is worked out until "=", and then × and ÷ come before + and −.
 *   - After "=", a digit starts a new sum and an operator continues from the answer.
 *   - "(" right after a number or ")" means multiply: 2(3+1) = 8.
 *   - Unclosed brackets are closed automatically on "=".
 * Keyboard: digits . + - * / ( ) Enter = Backspace Esc.
 */
export interface CalcState {
  expr: string;
  /** Expression that produced `answer` (shown small above it) */
  last: string;
  answer: string | null;
  error: boolean;
}

export type CalcAction =
  | { type: "digit"; value: string }
  | { type: "op"; value: "+" | "−" | "×" | "÷" }
  | { type: "open" }
  | { type: "close" }
  | { type: "equals" }
  | { type: "del" }
  | { type: "clear" };

export const CALC_START: CalcState = { expr: "", last: "", answer: null, error: false };

const OPS = "+−×÷";
const isOp = (c: string | undefined) => !!c && OPS.includes(c);
const openCount = (s: string) => [...s].filter((c) => c === "(").length - [...s].filter((c) => c === ")").length;

export function formatAnswer(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

/** Evaluates a typed expression; null when it is not valid maths */
export function evaluateExpression(expr: string): number | null {
  let s = expr + ")".repeat(Math.max(0, openCount(expr)));
  s = s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  if (!s.trim() || !/^[\d.+\-*/() ]+$/.test(s)) return null;
  // Reject things like "2..3" or "5()" before evaluating
  if (/\d*\.\d*\./.test(s) || /\(\)/.test(s)) return null;
  try {
    const value = new Function(`"use strict"; return (${s});`)();
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function calcReducer(state: CalcState, action: CalcAction): CalcState {
  const fresh = state.answer !== null; // showing a result
  const expr = state.expr;
  const lastChar = expr.slice(-1);

  switch (action.type) {
    case "clear":
      return CALC_START;

    case "del":
      if (fresh) return { ...CALC_START, expr: state.last };
      return { ...state, expr: expr.slice(0, -1), error: false };

    case "digit": {
      const d = action.value;
      if (fresh || state.error) return { ...CALC_START, expr: d === "." ? "0." : d };
      // One dot per number
      if (d === ".") {
        const currentNumber = expr.match(/[\d.]*$/)?.[0] || "";
        if (currentNumber.includes(".")) return state;
        if (!currentNumber) return { ...state, expr: expr + (lastChar === ")" ? "×0." : "0.") };
      }
      // A digit right after ")" multiplies
      return { ...state, expr: expr + (lastChar === ")" ? "×" : "") + d };
    }

    case "op": {
      const op = action.value;
      if (state.error) return state;
      if (fresh) return { ...CALC_START, expr: (state.answer || "0") + op };
      if (!expr || lastChar === "(") {
        // Only a leading minus makes sense here (negative number)
        return op === "−" ? { ...state, expr: expr + "−" } : state;
      }
      if (isOp(lastChar)) return { ...state, expr: expr.slice(0, -1) + op };
      if (lastChar === ".") return { ...state, expr: expr + "0" + op };
      return { ...state, expr: expr + op };
    }

    case "open": {
      if (fresh || state.error) return { ...CALC_START, expr: "(" };
      const implicit = /[\d.)]$/.test(expr) ? "×" : "";
      return { ...state, expr: expr + implicit + "(" };
    }

    case "close":
      if (fresh || openCount(expr) <= 0 || isOp(lastChar) || lastChar === "(") return state;
      return { ...state, expr: expr + ")" };

    case "equals": {
      if (fresh || !expr) return state;
      const closed = expr + ")".repeat(Math.max(0, openCount(expr)));
      const value = evaluateExpression(closed);
      if (value === null) return { ...state, error: true };
      return { expr: "", last: closed, answer: formatAnswer(value), error: false };
    }
  }
}

const KEY_STYLE = {
  num: "bg-white hover:bg-slate-50 text-slate-900 border-slate-200 font-bold",
  op: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100 font-black",
  fn: "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 font-bold",
  clear: "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-100 font-black",
  eq: "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 font-black",
};

export function CasioCalculator() {
  const [state, dispatch] = useReducer(calcReducer, CALC_START);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      let action: CalcAction | null = null;
      if (/^[0-9.]$/.test(k)) action = { type: "digit", value: k };
      else if (k === "+") action = { type: "op", value: "+" };
      else if (k === "-") action = { type: "op", value: "−" };
      else if (k === "*" || k === "x") action = { type: "op", value: "×" };
      else if (k === "/") action = { type: "op", value: "÷" };
      else if (k === "(") action = { type: "open" };
      else if (k === ")") action = { type: "close" };
      else if (k === "Enter" || k === "=") action = { type: "equals" };
      else if (k === "Backspace") action = { type: "del" };
      else if (k === "Escape" || k === "Delete") action = { type: "clear" };
      if (action) {
        e.preventDefault();
        dispatch(action);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showing = state.answer !== null;
  const mainLine = state.error ? "Math ERROR" : showing ? state.answer : state.expr || "0";
  const topLine = showing ? `${state.last} =` : state.expr && openCount(state.expr) > 0 ? `أقواس مفتوحة: ${openCount(state.expr)}` : "";

  const key = (label: React.ReactNode, action: CalcAction, style: keyof typeof KEY_STYLE, extra = "") => (
    <button
      type="button"
      onClick={() => dispatch(action)}
      className={`h-14 rounded-xl border text-xl transition-colors cursor-pointer ${KEY_STYLE[style]} ${extra}`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-md mx-auto w-full bg-white rounded-2xl p-5 shadow-xs flex flex-col gap-4 border border-slate-200" dir="rtl">
      <div className="flex items-center justify-between">
        <span className="text-base font-black text-slate-900">آلة حاسبة</span>
        <span className="text-xs text-slate-500 font-medium">اكتب العملية كلها وبعدين =، وتقدر تستخدم الكيبورد</span>
      </div>
      <div className="bg-slate-900 rounded-xl px-4 py-3 text-left min-h-[92px] flex flex-col justify-end gap-1" dir="ltr">
        <div className="text-sm text-slate-400 font-mono truncate min-h-[20px]" dir={topLine.startsWith("أقواس") ? "rtl" : "ltr"}>
          {topLine}
        </div>
        <div
          className={`font-mono font-bold tracking-wide break-all ${state.error ? "text-rose-400 text-2xl" : "text-white text-3xl"}`}
        >
          {mainLine}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 font-mono" dir="ltr">
        {key("AC", { type: "clear" }, "clear")}
        {key("(", { type: "open" }, "fn")}
        {key(")", { type: "close" }, "fn")}
        {key(<Delete className="w-5 h-5 mx-auto" />, { type: "del" }, "fn")}

        {key("7", { type: "digit", value: "7" }, "num")}
        {key("8", { type: "digit", value: "8" }, "num")}
        {key("9", { type: "digit", value: "9" }, "num")}
        {key("÷", { type: "op", value: "÷" }, "op")}

        {key("4", { type: "digit", value: "4" }, "num")}
        {key("5", { type: "digit", value: "5" }, "num")}
        {key("6", { type: "digit", value: "6" }, "num")}
        {key("×", { type: "op", value: "×" }, "op")}

        {key("1", { type: "digit", value: "1" }, "num")}
        {key("2", { type: "digit", value: "2" }, "num")}
        {key("3", { type: "digit", value: "3" }, "num")}
        {key("−", { type: "op", value: "−" }, "op")}

        {key("0", { type: "digit", value: "0" }, "num")}
        {key(".", { type: "digit", value: "." }, "num")}
        {key("=", { type: "equals" }, "eq")}
        {key("+", { type: "op", value: "+" }, "op")}
      </div>
    </div>
  );
}
