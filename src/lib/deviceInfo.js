// src/lib/deviceInfo.js
// Lightweight UA-based device label so parents can see "갤럭시 S25" instead of
// "기기 1" on the child management card. Capacitor's @capacitor/device plugin
// would give richer info (manufacturer/osVersion) but adds a native dep + sync;
// the WebView UA already exposes the Samsung model code which is enough for
// the most common Korean parent device lineup.
//
// Strategy: extract Android model code from UA, then map known Samsung Galaxy
// codes (Korean SKUs include trailing N/U/etc — match by longest prefix).
// Anything unknown falls back to the raw code; non-Android UAs return null.

// Prefix → friendly Korean name. We pick the longest matching prefix so
// SM-S928 wins over SM-S92 if both were ever defined.
const SAMSUNG_GALAXY_MAP = {
  // Galaxy S series (S25 launched 2025-02; S24 2024; S23 2023; S22 2022)
  "SM-S938": "갤럭시 S25 Ultra",
  "SM-S936": "갤럭시 S25+",
  "SM-S931": "갤럭시 S25",
  "SM-S928": "갤럭시 S24 Ultra",
  "SM-S926": "갤럭시 S24+",
  "SM-S921": "갤럭시 S24",
  "SM-S918": "갤럭시 S23 Ultra",
  "SM-S916": "갤럭시 S23+",
  "SM-S911": "갤럭시 S23",
  "SM-S908": "갤럭시 S22 Ultra",
  "SM-S906": "갤럭시 S22+",
  "SM-S901": "갤럭시 S22",
  // Galaxy Z foldables
  "SM-F956": "갤럭시 Z 폴드6",
  "SM-F741": "갤럭시 Z 플립6",
  "SM-F946": "갤럭시 Z 폴드5",
  "SM-F731": "갤럭시 Z 플립5",
  "SM-F936": "갤럭시 Z 폴드4",
  "SM-F721": "갤럭시 Z 플립4",
  // Galaxy A series (mid-range, 한국 출시 기준)
  "SM-A556": "갤럭시 A55",
  "SM-A546": "갤럭시 A54",
  "SM-A536": "갤럭시 A53",
  "SM-A346": "갤럭시 A34",
  "SM-A336": "갤럭시 A33",
  "SM-A256": "갤럭시 A25",
  "SM-A156": "갤럭시 A15",
  // Galaxy Note legacy (still in use)
  "SM-N986": "갤럭시 노트20 울트라",
  "SM-N981": "갤럭시 노트20",
};

function pickFriendlyForSamsungModel(model) {
  if (!model) return null;
  let bestPrefix = null;
  for (const prefix of Object.keys(SAMSUNG_GALAXY_MAP)) {
    if (model.startsWith(prefix)) {
      if (bestPrefix === null || prefix.length > bestPrefix.length) bestPrefix = prefix;
    }
  }
  return bestPrefix ? SAMSUNG_GALAXY_MAP[bestPrefix] : null;
}

// Returns { manufacturer, model, label } where label is the friendliest
// available string (Korean Galaxy name when known, else raw model code).
// Non-Android or missing model returns nulls.
export function getDeviceInfoFromUA(uaInput) {
  const ua = typeof uaInput === "string"
    ? uaInput
    : (typeof navigator !== "undefined" ? navigator.userAgent || "" : "");
  if (!ua) return { manufacturer: null, model: null, label: null };

  // Android UA: "...; Android 14; SM-S921N) AppleWebKit/..." or
  //             "...; Android 14; SM-S921N Build/UP1A...) ..."
  const androidMatch = ua.match(/Android\s+[\d.]+;\s*([^;)]+?)(?:\s+Build|;|\))/i);
  if (androidMatch) {
    const model = androidMatch[1].trim();
    const isSamsung = /^(SM|SHV|SHW|SCV|SCG|GT)-/i.test(model);
    const manufacturer = isSamsung ? "Samsung" : null;
    const friendly = isSamsung ? pickFriendlyForSamsungModel(model) : null;
    return { manufacturer, model, label: friendly || model };
  }

  if (/iPhone/i.test(ua)) return { manufacturer: "Apple", model: "iPhone", label: "iPhone" };
  if (/iPad/i.test(ua)) return { manufacturer: "Apple", model: "iPad", label: "iPad" };

  return { manufacturer: null, model: null, label: null };
}

export function getDeviceLabelFromUA(uaInput) {
  return getDeviceInfoFromUA(uaInput).label;
}
