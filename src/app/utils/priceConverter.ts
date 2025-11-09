// vn_amount_parser_implicit_thousand.js
// -*- coding: utf-8 -*-

// ========== CONSTANTS ==========
const VI_NUM = {
  không: 0,
  linh: 0,
  lẻ: 0,
  một: 1,
  mốt: 1,
  hai: 2,
  ba: 3,
  bốn: 4,
  tư: 4,
  năm: 5,
  lăm: 5,
  nhăm: 5,
  sáu: 6,
  bảy: 7,
  bãy: 7,
  tám: 8,
  chín: 9,
  mười: 10,
};
const SMALL_UNITS = { trăm: 100, chục: 10, mươi: 10 };
const LARGE_UNITS = {
  tỷ: 1_000_000_000,
  tỉ: 1_000_000_000,
  triệu: 1_000_000,
  nghìn: 1_000,
  ngàn: 1_000,
};
const SUFFIX_TO_MULT = {
  k: 1000,
  ka: 1000,
  cá: 1000,
  ca: 1000,
  nghìn: 1000,
  ngàn: 1000,
  ng: 1000,
  tr: 1_000_000,
  triệu: 1_000_000,
  trieu: 1_000_000,
  m: 1_000_000,
  củ: 1_000_000,
  tỷ: 1_000_000_000,
  tỉ: 1_000_000_000,
  ty: 1_000_000_000,
  tỏi: 1_000_000_000,
  b: 1_000_000_000,
};
const CURRENCY_WORDS = new Set(["đ", "đồng", "vnd", "vnđ", "₫"]);

const ASCII_TO_VI = {
  ruoi: "rưỡi",
  le: "lẻ",
  mot: "một",
  moi: "mười",
  muoi: "mười",
  lam: "lăm",
  nam: "năm",
  bon: "bốn",
  tu: "tư",
  ty: "tỷ",
  ti: "tỉ",
  trieu: "triệu",
  nghin: "nghìn",
  ngan: "ngàn",
  toi: "tỏi",
  cu: "củ",
  hai: "hai",
  ba: "ba",
  sau: "sáu",
  bay: "bảy",
  tam: "tám",
  chin: "chín",
  chuc: "chục",
  tram: "trăm",
  ca: "cá",
};

// ========== HELPERS ==========
function _normalize_text(s) {
  s = s.toLowerCase().replace(/₫/g, " đ ").replace(/\s+/g, " ").trim();
  if (!s) return s;
  return s
    .split(" ")
    .map((t) => ASCII_TO_VI[t] || t)
    .join(" ");
}
function _strip_currency_words(s) {
  return s
    .split(" ")
    .filter((t) => !CURRENCY_WORDS.has(t))
    .join(" ");
}
function _to_float(s) {
  return parseFloat(s.replace(",", "."));
}
function _apply_suffix(numStr, suf) {
  suf =
    {
      ngan: "nghìn",
      ngàn: "nghìn",
      trieu: "triệu",
      ty: "tỷ",
      ka: "k",
      cá: "k",
      ca: "k",
    }[suf] || suf;
  const mult = SUFFIX_TO_MULT[suf] || 1;
  return Math.round(_to_float(numStr) * mult);
}
const DIGIT_TOKEN_RE = /^\d+$/;

// Regex equivalents
const NUM_SUFFIX_RE =
  /(?<num>\d+(?:[.,]\d+)?)\s*(?<suf>k|ka|cá|ca|nghìn|ngan|ngàn|ng|tr|triệu|trieu|tỷ|tỉ|ty|tỏi|b|m)\b/g;
const NUM_UNIT_RUOI_RE =
  /(?<num>\d+(?:[.,]\d+)?)\s*(?<unit>tỷ|tỉ|triệu|tr|nghìn|ngàn|k|ka|cá|ca|tỏi)\s*rưỡi\b/g;
const NUM_SUFFIX_TAIL_RE =
  /(?<num>\d+(?:[.,]\d+)?)\s*(?<unit>tỷ|tỉ|triệu|tr|nghìn|ngàn|k|ka|cá|ca|tỏi|m|b)\s*(?<tail>\d+)\b|(?<num2>\d+(?:[.,]\d+)?)(?<unit2>tỷ|tỉ|triệu|tr|nghìn|ngàn|k|ka|cá|ca|tỏi|m|b)(?<tail2>\d+)/g;
const PURE_NUMBER_RE = /^\s*([+-]?\d+(?:[.,]\d{1,2})?)\s*$/;

// ========== PARSERS ==========
function _parse_numeric_suffix_segments(text) {
  let total = 0,
    parts = [],
    last = 0;
  for (const m of text.matchAll(NUM_SUFFIX_RE)) {
    parts.push(text.slice(last, m.index));
    total += _apply_suffix(m.groups.num, m.groups.suf);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return [total, parts.join("").trim()];
}

function _parse_numeric_suffix_with_tail(text) {
  let total = 0,
    parts = [],
    last = 0;
  for (const m of text.matchAll(NUM_SUFFIX_TAIL_RE)) {
    parts.push(text.slice(last, m.index));

    let unit, mult, base, tail;
    if (m.groups.unit) {
      // spaced
      unit =
        {
          tr: "triệu",
          ngàn: "nghìn",
          ka: "k",
          cá: "k",
          ca: "k",
          m: "triệu",
          b: "tỷ",
        }[m.groups.unit] || m.groups.unit;
      mult = SUFFIX_TO_MULT[unit] || LARGE_UNITS[unit] || 1;
      base = _to_float(m.groups.num);
      tail = parseInt(m.groups.tail);
    } else {
      // compact
      unit =
        {
          tr: "triệu",
          ngàn: "nghìn",
          ka: "k",
          cá: "k",
          ca: "k",
          m: "triệu",
          b: "tỷ",
        }[m.groups.unit2] || m.groups.unit2;
      mult = SUFFIX_TO_MULT[unit] || LARGE_UNITS[unit] || 1;
      base = _to_float(m.groups.num2);
      tail = parseInt(m.groups.tail2);
    }
    // For multi-digit tails, interpret as units of (mult / 1000)
    // For single-digit tails, interpret as units of (mult / 10) for backward compatibility
    const tailDigits = String(tail).length;
    const tailMultiplier = tailDigits > 1 ? mult / 1000 : mult / 10.0;
    total += Math.round(base * mult + tailMultiplier * tail);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return [total, parts.join("").trim()];
}

function _parse_num_unit_ruoi(text) {
  const tokens = text.split(/\s+/);
  if (!tokens.length) return [0, text];
  const UNIT_TOKENS = new Set([
    "tỷ",
    "tỉ",
    "triệu",
    "tr",
    "nghìn",
    "ngàn",
    "k",
    "ka",
    "cá",
    "ca",
    "tỏi",
    "củ",
  ]);
  for (let i = 0; i < tokens.length - 1; i++) {
    if (UNIT_TOKENS.has(tokens[i]) && tokens[i + 1] === "rưỡi") {
      const unitNorm =
        { tr: "triệu", ngàn: "nghìn", ka: "k", cá: "k", ca: "k" }[tokens[i]] ||
        tokens[i];
      const mult = SUFFIX_TO_MULT[unitNorm] || LARGE_UNITS[unitNorm] || 1;
      let j = i - 1;
      let numberTokens = [];
      while (j >= 0) {
        const tok = tokens[j];
        if (DIGIT_TOKEN_RE.test(tok) || tok in VI_NUM || tok in SMALL_UNITS) {
          numberTokens.push(tok);
          j--;
          continue;
        }
        break;
      }
      numberTokens.reverse();
      let base;
      if (!numberTokens.length) base = 1;
      else if (
        numberTokens.length === 1 &&
        DIGIT_TOKEN_RE.test(numberTokens[0])
      )
        base = parseInt(numberTokens[0]);
      else base = _parse_small_segment(numberTokens);
      const val = Math.round(base * mult + 0.5 * mult);
      const residualTokens = tokens.slice(0, j + 1).concat(tokens.slice(i + 2));
      return [val, residualTokens.join(" ").trim()];
    }
  }
  return [0, text];
}

function _contains_large_unit(words) {
  return words.some((w) =>
    [
      "tỷ",
      "tỉ",
      "triệu",
      "tr",
      "nghìn",
      "ngàn",
      "k",
      "ka",
      "cá",
      "ca",
      "tỏi",
      "m",
      "b",
      "củ",
    ].includes(w)
  );
}

function _parse_small_segment(words) {
  let value = 0,
    current = 0,
    last_unit = 1;
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    // heuristic: "hai tư" => 24
    if (i + 1 < words.length && w in VI_NUM && words[i + 1] in VI_NUM) {
      const first = VI_NUM[w],
        second = VI_NUM[words[i + 1]];
      if (1 <= first && first <= 9 && 0 <= second && second <= 9) {
        current += first * 10 + second;
        i += 2;
        continue;
      }
    }
    if (w in VI_NUM) {
      current += VI_NUM[w];
      i++;
      continue;
    }
    if (DIGIT_TOKEN_RE.test(w)) {
      current += parseInt(w);
      i++;
      continue;
    }
    if (w in SMALL_UNITS) {
      const unit = SMALL_UNITS[w];
      if (current === 0) current = 1;
      current *= unit;
      value += current;
      last_unit = unit;
      current = 0;
      i++;
      continue;
    }
    if (w === "rưỡi" || w === "nửa") {
      value += Math.round(0.5 * last_unit);
      i++;
      continue;
    }
    i++;
  }
  value += current;
  return value;
}

function _split_by_large_units(words) {
  let segs = [],
    rest = [...words];
  const units = [
    ["tỷ", 1e9],
    ["tỉ", 1e9],
    ["b", 1e9],
    ["tỏi", 1e9],
    ["triệu", 1e6],
    ["tr", 1e6],
    ["m", 1e6],
    ["củ", 1e6],
    ["nghìn", 1e3],
    ["ngàn", 1e3],
    ["k", 1e3],
    ["ka", 1e3],
    ["cá", 1e3],
    ["ca", 1e3],
  ];
  for (const [unit, mult] of units) {
    if (rest.includes(unit)) {
      const idx = rest.lastIndexOf(unit);
      segs.push([rest.slice(0, idx), mult]);
      rest = rest.slice(idx + 1);
    }
  }
  if (rest.length) segs.push([rest, 1]);
  return segs;
}

function _parse_words_amount(text) {
  const words = text.split(/\s+/).filter((w) => !CURRENCY_WORDS.has(w));
  if (!words.length) return [0, false];
  const has_large = _contains_large_unit(words);
  let total = 0;
  const segs = _split_by_large_units(words);
  let consumed_tail = false;
  if (segs.length >= 2) {
    const [last_words, last_mult] = segs[segs.length - 1];
    const [prev_words, prev_mult] = segs[segs.length - 2];
    if (last_mult === 1 && last_words.length === 1) {
      const tok = last_words[0];
      let digit = null;
      if (tok in VI_NUM) digit = VI_NUM[tok];
      else if (DIGIT_TOKEN_RE.test(tok)) digit = parseInt(tok);
      if (digit != null && digit >= 0 && digit <= 9 && prev_mult >= 1000) {
        total += Math.round((prev_mult / 10) * digit);
        consumed_tail = true;
      }
    }
  }
  segs.forEach(([seg, mult], idx) => {
    if (consumed_tail && idx === segs.length - 1) return;
    total += _parse_small_segment(seg) * mult;
  });
  return [total, has_large];
}

// ========== MAIN ==========
export function parseVietnameseMoney(
  text,
  smart_thousand_for_bare_small_int = true,
  bare_small_int_threshold = 999
) {
  console.log("Parsing price:", text);
  if (!text || !text.trim()) return null;
  let s = _strip_currency_words(_normalize_text(text));

  let [ruoi_val, residual] = _parse_num_unit_ruoi(s);
  let sum_val = ruoi_val;

  let [add_tail_val, residual2] = _parse_numeric_suffix_with_tail(residual);
  sum_val += add_tail_val;
  residual = residual2;

  let [add_val, residual3] = _parse_numeric_suffix_segments(residual);
  sum_val += add_val;
  residual = residual3;

  const m = residual.match(PURE_NUMBER_RE);
  if (m) {
    let v = _to_float(m[1]);
    if (
      smart_thousand_for_bare_small_int &&
      Math.abs(v) <= bare_small_int_threshold &&
      Number.isInteger(v)
    ) {
      v *= 1000;
    }
    return { priceValue: Math.round(sum_val + v) };
  }

  let [words_value, has_large] = _parse_words_amount(residual);
  if (words_value > 0) {
    if (
      smart_thousand_for_bare_small_int &&
      !has_large &&
      words_value <= bare_small_int_threshold
    ) {
      words_value *= 1000;
    }
    return { priceValue: sum_val + words_value };
  }
  return sum_val > 0 ? { priceValue: sum_val } : null;
}

// // ========== DEMO ==========
// const samples = [
//   "20",
//   "2 chục",
//   "hai chục",
//   "200",
//   "hai trăm",
//   "9 trăm",
//   "chín trăm",
//   "300k",
//   "300ka",
//   "300 cá",
//   "một triệu rưỡi",
//   "1 triệu rưỡi",
//   "2 triệu 300k",
//   "ba trăm nghìn",
//   "1.5tr",
//   "1,5tr",
//   "5 chục",
//   "2375k",
//   "muoi lam ngan",
//   "sáu mươi lăm ngàn",
//   "sau tram",
// ];
// for (const s of samples) {
//   console.log(`${s.padEnd(20)} -> ${parseVietnameseMoney(s)}`);
// }
