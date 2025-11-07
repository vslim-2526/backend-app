import { DateTime } from "luxon";

function convertVietnameseNumbers(text) {
  const SPECIALS = {
    "ba mươi mốt": 31,
    "ba mốt": 31,
    "ba mươi": 30,
    "hai mươi mốt": 21,
    "hai mốt": 21,
    "hai mươi lăm": 25,
    "hai lăm": 25,
    "hai mươi nhăm": 25,
    "hai nhăm": 25,
    "mười một": 11,
    "mười hai": 12,
    "mười ba": 13,
    "mười bốn": 14,
    "mười lăm": 15,
    "mười nhăm": 15,
    "mười sáu": 16,
    "mười bảy": 17,
    "mười tám": 18,
    "mười chín": 19,
  };

  const BASICS = {
    một: 1,
    hai: 2,
    ba: 3,
    bốn: 4,
    tư: 4,
    lăm: 5,
    sáu: 6,
    bảy: 7,
    tám: 8,
    chín: 9,
    mười: 10,
    "hai mươi": 20,
    "ba mươi": 30,
  };

  let result = text.toLowerCase();

  // Ưu tiên thay specials (cụm dài trước)
  Object.entries(SPECIALS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([phrase, num]) => {
      const regex = new RegExp(`\\b${phrase}\\b`, "g");
      result = result.replace(regex, num.toString());
    });

  // Thay tiếp các số cơ bản
  Object.entries(BASICS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([phrase, num]) => {
      const regex = new RegExp(`\\b${phrase}\\b`, "g");
      result = result.replace(regex, num.toString());
    });

  // Gộp số rời nhau: "2 5" -> "25"
  result = result.replace(/(\d)\s+(?=\d)/g, "$1");

  return result;
}

// -------------------------------
// Test
// -------------------------------
const testCases = [
  "ba tháng sáu",
  "hai lăm tháng sau",
  "3 tháng chín",
  "hai sáu",
];

// -------------------------------
// Chuẩn hoá từ
// -------------------------------
const variants = {
  hnay: "hôm nay",
  hqua: "hôm qua",
  hkia: "hôm kia",
  nmai: "ngày mai",
  thg: "tháng",
  tới: "sau",
  ngoái: "trước",
  trc: "trước",
  "vừa rồi": "vừa qua",
  rồi: "trước",
  mùng: "",
  mồng: "",
};

const wordMap = {
  nay: 0,
  "hôm nay": 0,
  mai: 1,
  "ngày mai": 1,
  mốt: 2,
  "ngày kia": 2,
  "ngày mốt": 2,
  "ngày hôm qua": -1,
  "ngày hôm kia": -1,
  "hôm qua": -1,
  "hôm kia": -2,
};

function normalizeText(text) {
  text = text.toLowerCase().trim();
  for (const [wrong, correct] of Object.entries(variants)) {
    const regex = new RegExp(`\\b${wrong}\\b`, "g");
    text = text.replace(regex, correct);
  }
  return text.trim();
}

function safeDate(y, m, d) {
  const dt = DateTime.local(y, m, d);
  return dt.isValid ? dt : null;
}

// -------------------------------
// Matchers
// -------------------------------
function matchWordMap(text, today) {
  if (wordMap[text] !== undefined) {
    return today.plus({ days: wordMap[text] });
  }
  return null;
}

function matchWeekday(text, today) {
  const weekdays = {
    "thứ 2": 1,
    "thứ hai": 1,
    t2: 1,
    "thứ 3": 2,
    "thứ ba": 2,
    t3: 2,
    "thứ 4": 3,
    "thứ tư": 3,
    t4: 3,
    "thứ 5": 4,
    "thứ năm": 4,
    t5: 4,
    "thứ 6": 5,
    "thứ sáu": 5,
    t6: 5,
    "thứ 7": 6,
    "thứ bảy": 6,
    t7: 6,
    "chủ nhật": 7,
    cn: 7,
    cnhat: 7,
  };

  for (const [k, v] of Object.entries(weekdays)) {
    if (text.startsWith(k)) {
      let delta = v - today.weekday;
      let base = 0;

      if (text.includes("tuần sau")) base = 7;
      else if (
        text.includes("tuần trước") ||
        text.includes("tuần rồi") ||
        text.includes("tuần qua")
      ) {
        base = -7;
      } else if (text.includes("vừa qua")) {
        if (delta >= 0) delta -= 7; // force nearest past
      }

      return today.plus({ days: delta + base });
    }
  }
  return null;
}

function matchSpecificMonthYear(text, today) {
  let m;

  // dd/mm năm sau
  m =
    text.match(/(\d{1,2})[./-](\d{1,2}) năm sau/) ||
    text.match(/(\d{1,2}) tháng (\d{1,2}) năm sau/);
  if (m) {
    const [_, d, mth] = m;
    return safeDate(today.year + 1, parseInt(mth), parseInt(d));
  }

  // dd/mm năm trước
  m =
    text.match(/(\d{1,2})[./-](\d{1,2}) năm trước/) ||
    text.match(/(\d{1,2}) tháng (\d{1,2}) năm trước/);
  if (m) {
    const [_, d, mth] = m;
    return safeDate(today.year - 1, parseInt(mth), parseInt(d));
  }

  // ngày X tháng sau
  m = text.match(/(ngày\s*)?(\d{1,2})([./-](\d{1,2}))?\s*tháng sau/);
  if (m) {
    const d = parseInt(m[2]);
    const next = today.plus({ months: 1 });
    return safeDate(next.year, next.month, d);
  }

  // ngày X tháng trước
  m = text.match(/(ngày\s*)?(\d{1,2})([./-](\d{1,2}))? tháng trước/);
  if (m) {
    const d = parseInt(m[2]);
    const prev = today.minus({ months: 1 });
    return safeDate(prev.year, prev.month, d);
  }

  // ngày X năm sau
  m = text.match(/(ngày\s*)?(\d{1,2}) năm sau/);
  if (m) {
    const d = parseInt(m[2]);
    const next = today.plus({ years: 1 });
    return safeDate(next.year, next.month, d);
  }

  // ngày X năm trước
  m = text.match(/(ngày\s*)?(\d{1,2}) năm trước/);
  if (m) {
    const d = parseInt(m[2]);
    const prev = today.minus({ years: 1 });
    return safeDate(prev.year, prev.month, d);
  }

  // m =
  //   text.match(/(\d{1,2})[./-](\d{1,2})(\s*năm\s*)?(\d{2,4})/) ||
  //   text.match(/(\d{1,2}) tháng (\d{1,2})(\s*năm\s*)?(\d{2,4})/);
  // if (m) {
  //   let [, d, mth, , y] = m;
  //   console.log(d, mth, y);
  //   return m;
  //   // d = parseInt(d);
  //   // mth = parseInt(mth);
  //   // y = parseInt(y);
  //   // if (y < 100) y = y < 50 ? 2000 + y : 1900 + y;
  //   // return safeDate(y, mth, d);
  // }

  return null;
}

function matchRelativeExpression(text, today) {
  const m = text.match(/(\d+)\s+(ngày)\s+(sau|trước)/);
  if (m) {
    let [, n, , direction] = m;
    n = parseInt(n);
    return direction === "sau"
      ? today.plus({ days: n })
      : today.minus({ days: n });
  }
  return null;
}

function matchNumberDate(text, today) {
  let m;

  // dd/mm/yyyy
  m =
    text.match(/(ngày\s*)?(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/) ||
    text.match(/(ngày\s*)?(\d{1,2}) tháng (\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let [, , d, mth, y] = m;
    d = parseInt(d);
    mth = parseInt(mth);
    y = parseInt(y);
    if (y < 100) y = y < 50 ? 2000 + y : 1900 + y;
    return safeDate(y, mth, d);
  }

  m =
    text.match(/(ngày\s*)?(\d{1,2})[./-](\d{1,2})(\s*năm\s*)?(\d{2,4})/) ||
    text.match(/(ngày\s*)?(\d{1,2}) tháng (\d{1,2})(\s*năm\s*)?(\d{2,4})/);
  if (m) {
    let [, , d, mth, , y] = m;
    d = parseInt(d);
    mth = parseInt(mth);
    y = parseInt(y);
    if (y < 100) y = y < 50 ? 2000 + y : 1900 + y;
    return safeDate(y, mth, d);
  }

  // dd/mm
  m = text.match(/(ngày\s*)?(\d{1,2})[./-](\d{1,2})$/);
  if (m) {
    let [, , d, mth] = m;
    return safeDate(today.year, parseInt(mth), parseInt(d));
  }

  // dd tháng mm
  m = text.match(/(ngày\s*)?(\d{1,2}) tháng (\d{1,2})$/);
  if (m) {
    let [, , d, mth] = m;
    return safeDate(today.year, parseInt(mth), parseInt(d));
  }

  // chỉ ngày trong tháng hiện tại
  if (/^(ngày\s*)?\d{1,2}$/.test(text)) {
    const d = parseInt(text.replace("ngày", "").trim());
    return safeDate(today.year, today.month, d);
  }

  return null;
}

// -------------------------------
// Pipeline
// -------------------------------
function parseDate(text) {
  let today = DateTime.now().startOf("day");
  text = normalizeText(convertVietnameseNumbers(text));

  const matchers = [
    matchWordMap,
    matchWeekday,
    matchSpecificMonthYear,
    matchRelativeExpression,
    matchNumberDate,
  ];

  for (const fn of matchers) {
    const result = fn(text, today);
    if (result) return new DateTime(result);
  }
  return null;
}

const rangeVariants = {
  "h ": "nay",
  giờ: "nay",
  khoảng: "",
  trong: "",
  hãy: "",
  cả: "",
};

function normalizeDateRange(text) {
  text = text.toLowerCase().trim();
  for (const [wrong, correct] of Object.entries(rangeVariants)) {
    text = text.replace(new RegExp(`\\b${wrong}\\b`, "g"), correct);
  }
  return text.trim();
}

function matchFromTo(text, today) {
  const m = text.match(/^(từ)?\s*(.*?)\s*(tới|đến)\s*(.*)$/);
  if (!m) return null;
  let [, , d1, , d2] = m;
  d1 = d1.trim();
  d2 = d2.trim();

  const parseSpecial = (s) => (s ? parseDate(s) : today);

  let end = parseSpecial(d2);
  let start = parseSpecial(d1);

  if (/^\d+$/.test(d1) && end) {
    start = DateTime.fromObject({ year: end.year, month: end.month, day: +d1 });
  }
  if (/^\d+$/.test(d1) && /^\d+$/.test(d2)) {
    start = today.set({ day: +d1 });
    end = today.set({ day: +d2 });
  }

  let isBlankFilled = false;
  if (start && !end) {
    end = today;
    isBlankFilled = true;
  } else if (end && !start) {
    start = today;
    isBlankFilled = true;
  }

  if (start && end && start > end) {
    if (isBlankFilled) return [null, null];
    if (
      start.month > end.month ||
      (start.month === end.month && start.day > end.day)
    ) {
      start = start.minus({ years: 1 });
    } else if (start.day > end.day && start.month === end.month) {
      start = start.minus({ months: 1 });
    }
  }

  return start && end ? [start, end] : null;
}

function matchNumericRange(text, today) {
  const m = text.match(
    /^(\d*)\s*(ngày|tuần|tháng|năm)\s+(tới|nay|qua|vừa qua|gần đây|vừa rồi|gần nhất)$/
  );
  if (!m) return null;
  let [, n, unit, direction] = m;
  n = n ? +n : 1;

  let delta;
  if (unit === "ngày") delta = { days: n };
  else if (unit === "tuần") delta = { weeks: n };
  else if (unit === "tháng") delta = { months: n };
  else if (unit === "năm") delta = { years: n };

  if (["tới", "sau", "sắp tới"].includes(direction)) {
    return [today, today.plus(delta)];
  } else {
    if (["nay", "gần đây", "gần nhất"].includes(direction) && unit == "ngày") {
      delta = { days: n - 1 };
      return [today.minus(delta), today];
    }
    return [today.minus(delta), today.minus({ days: 1 })];
  }
}

function matchParseDate(text, _) {
  const d = parseDate(text);
  return d ? [d, d] : null;
}

export function parseDateRange(text) {
  console.log("Parsing date:", text);
  const today = DateTime.now().startOf("day");
  text = normalizeDateRange(text);

  const matchers = [matchNumericRange, matchFromTo, matchParseDate];
  for (const fn of matchers) {
    const result = fn(text, today);
    if (result) {
      return { start: result[0].toISODate(), end: result[1].toISODate() };
    }
  }
  return null;
}

// function testParseDateRange() {
//   const today = DateTime.now().toISODate();
//   console.log("Hôm nay là:", today);

//   const cases = [
//     "01-01-00",
//     "29/2/24",
//     "15-7 năm ngoái",
//     "tuần sau",
//     "mùng 1 tháng 1",
//     "ngày 03 tháng 3",
//     "1/5 năm sau",
//     "14/2 tháng sau",
//     "Từ 15 tới 27/10",
//     "Từ 15-8 tới 27/10",
//     "từ 2/9 tới h",
//     "từ hqua tới 15/9",
//     "15-9",
//     "hqua",
//     "từ 30/12 tới 2/1",
//     "28/2/2024 tới 1/3",
//     "từ hqua đến nmai",
//     "từ t2 tuần trước tới cn tuần này",
//     "từ t2 tuần trước tới cn tuần trước",
//     "từ 1-5 tới 5-5-26",
//     "từ 5 tháng 8 tới 10",
//     "từ 3 ngày trước tới nay",
//     "từ hôm kia tới t2 tuần sau",
//     "2 ngày qua",
//     "2 ngày nay",
//     "2 năm nay",
//     "2 tuần tới",
//     "ngày hôm qua",
//     "tháng qua",
//     "2 tháng vừa qua",
//     "3 tháng tới",
//     "t2 tuần trước",
//     // Ngày trong tuần / relative tuần
//     "thứ 6 tuần trước",
//     "cn",
//     "chủ nhật này",
//     "cn tuần sau",
//     "t2 tuần sau",
//     "t2 tuần tới",
//     "thứ ba tuần kế",
//     // Ngày + tháng + năm viết kiểu lạ
//     "01-01-00",
//     "31/12/99",
//     "29/2/24",
//     "29/2/25",
//     "7.11.45",
//     "2/8/1945",
//     // Ngày/tháng không trọn vẹn
//     "32/1/2025",
//     "0/5/2025",
//     "5/0/2025",
//     "13",
//     "ngày 100",
//     // Biểu thức relative dài
//     "15-7 năm ngoái",
//     "15 thg 7 năm ngoái",
//     "100 ngày sau",
//     "10 năm trước",
//     "24 tháng sau",
//     "6 tuần trước",
//     "365 ngày trước",
//     // Dùng chữ thay số
//     "mùng 1 tháng 1",
//     "mồng 2 tháng 9",
//     "ngày ba tháng ba",
//     "ngày 03 tháng 3",
//     // Kết hợp chữ + relative
//     "mùng 1 tết năm sau",
//     "30/4 năm trước",
//     "1/5 năm sau",
//     "14/2 tháng sau",
//     // Nhập nhằng dễ nhầm
//     "1-2",
//     "11/12",
//     "20/10",
//     // Ngày đặc biệt
//     "hôm qua",
//     "hôm kia",
//     "ngày kia",
//     "mốt",
//     "tuần sau",
//     "năm sau",
//     // Live test
//     "ngày mốt",
//     "thứ 6 tuần này",
//     "thứ ba tuần trước",
//     "26 tháng trước",
//   ];

//   for (const text of cases) {
//     const result = parseDateRange(text);
//     console.log(`${text.padEnd(20)} → ${result}`);
//   }
// }

// testParseDateRange();
