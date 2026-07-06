// ═══════════════════════════════════════════════════════════
//  The Siam Heritage Tokyo — Queue Management Backend
//  Google Apps Script  (コピーして GAS エディタに貼り付け)
// ═══════════════════════════════════════════════════════════
//
//  【セットアップ手順】
//
//  1. Google スプレッドシートを新規作成する
//     https://sheets.new
//
//  2. このスクリプトを Google Apps Script にコピーする
//     スプレッドシートのメニュー → 拡張機能 → Apps Script
//
//  3. 下の SPREADSHEET_ID に スプレッドシートの ID を入力する
//     URL: https://docs.google.com/spreadsheets/d/【ここ】/edit
//
//  4. setupSheets() を一度実行してシートを初期化する
//     (実行 → 関数を実行 → setupSheets)
//
//  5. LINE Channel Access Token を設定する:
//     setLineToken() 内のトークンを書き換えて一度実行する
//
//  6. デプロイする
//     デプロイ → 新しいデプロイ → ウェブアプリ
//     - 実行するユーザー: 自分
//     - アクセスできるユーザー: 全員
//     → デプロイ URL をコピーして各 HTML の CONFIG.GAS_URL に貼り付ける
//
// ═══════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1hHlXnqnjaqia0SANh8IkCs5A7nP31FUi0TbpH1j-8og';

// ── メインエントリーポイント ─────────────────────────────
function doGet(e) {
  const output = ContentService
    .createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);

  try {
    const action = (e.parameter && e.parameter.action) || '';
    let result;

    switch (action) {
      case 'getDashboard': result = getDashboard();                   break;
      case 'register':     result = registerQueue(e.parameter);      break;
      case 'getTicket':    result = getTicket(e.parameter.id);       break;
      case 'call':         result = callCustomer(e.parameter.id);    break;
      case 'checkin':      result = checkinCustomer(e.parameter.id); break;
      case 'cancel':       result = cancelCustomer(e.parameter.id);  break;
      case 'restore':      result = restoreCustomer(e.parameter.id); break;
      case 'addQueue':     result = addQueueByStaff(e.parameter);    break;
      case 'updateSeats':  result = updateSeats(e.parameter);        break;
      case 'resetCounter': result = resetCounterAPI();               break;
      case 'getTv':        result = getTvConfig();                   break;
      case 'setTv':        result = setTvConfig(e.parameter);        break;
      case 'health':       result = healthCheck();                   break;
      default:             result = { error: 'Unknown action: ' + action };
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ error: err.message }));
  }

  return output;
}

// ── HELPER: シート取得 ───────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

// ── HELPER: Queue 全データ取得 ───────────────────────────
function getAllQueue() {
  const sheet = getSheet('Queue');
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(function(row) {
    return {
      id:         String(row[0]),
      ppl:        Number(row[1]),
      time:       toTimeStr(row[2]),
      round:      toTimeStr(row[3]),
      status:     String(row[4]),
      calledAt:   row[5] ? Number(row[5]) : null,
      lineUserId: String(row[6] || ''),
      note:       String(row[7] || ''),
    };
  });
}

// ── HELPER: Queue 行更新 ─────────────────────────────────
function updateQueueRow(id, updates) {
  const sheet = getSheet('Queue');
  const data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      if ('status'   in updates) sheet.getRange(i + 1, 5).setValue(updates.status);
      if ('calledAt' in updates) sheet.getRange(i + 1, 6).setValue(updates.calledAt !== null ? updates.calledAt : '');
      return true;
    }
  }
  return false;
}

// ── HELPER: 今日の日付タグ (MMdd) ────────────────────────
function todayTag() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MMdd');
}

// ── HELPER: 今日発行された整理券か判定 ───────────────────
// ID 形式: W-MMdd-NNN  (過去日の行はシートに履歴として残るが表示しない)
function isTodayId(id) {
  return String(id).indexOf('W-' + todayTag() + '-') === 0;
}

// ── HELPER: 次のカウンター番号 ──────────────────────────
function nextCounter() {
  var prop = PropertiesService.getScriptProperties();
  var cur  = parseInt(prop.getProperty('QUEUE_COUNTER') || '0', 10);
  var next = cur + 1;
  prop.setProperty('QUEUE_COUNTER', String(next));
  return next;
}

// ── getDashboard ─────────────────────────────────────────
function getDashboard() {
  return {
    q:     getAllQueue().filter(function(q) { return isTodayId(q.id); }),
    seats: getSeats(),
    tv:    getTvConfig(),
  };
}

// ── TV ディスプレイ映像設定 ──────────────────────────────
// mode: 'auto'   = 時間帯で自動切替（下記スケジュール）
//       'lunch'  = ランチ映像を強制表示
//       'dinner' = ディナー映像を強制表示
//       'off'    = 映像なし（ロゴ表示）
// holiday: true = 本日は土日祝スケジュールを使う（平日でも祝日の場合にスタッフがON）
var TV_DEFAULTS = {
  mode: 'auto',
  wdFrom: '10:45', wdTo: '15:01',   // 平日ランチ
  weFrom: '10:45', weTo: '16:01',   // 土日祝ランチ
  dnFrom: '16:45', dnTo: '23:01',   // ディナー（毎日）
  holiday: false,
};

function getTvConfig() {
  var raw = PropertiesService.getScriptProperties().getProperty('TV_CONFIG');
  var cfg = {};
  try { cfg = raw ? JSON.parse(raw) : {}; } catch (e) { cfg = {}; }
  var out = {};
  for (var k in TV_DEFAULTS) out[k] = (k in cfg) ? cfg[k] : TV_DEFAULTS[k];
  return out;
}

function setTvConfig(p) {
  var cfg = getTvConfig();
  if (p.mode !== undefined) {
    var m = String(p.mode);
    if (['auto', 'lunch', 'dinner', 'off'].indexOf(m) === -1) return { error: 'Invalid mode: ' + m };
    cfg.mode = m;
  }
  ['wdFrom', 'wdTo', 'weFrom', 'weTo', 'dnFrom', 'dnTo'].forEach(function(k) {
    if (p[k] !== undefined && /^\d{1,2}:\d{2}$/.test(String(p[k]))) cfg[k] = String(p[k]);
  });
  if (p.holiday !== undefined) cfg.holiday = (String(p.holiday) === 'true');
  PropertiesService.getScriptProperties().setProperty('TV_CONFIG', JSON.stringify(cfg));
  return { ok: true, tv: cfg };
}

// ── HELPER: Date / 文字列 → HH:mm 文字列 ─────────────────
function toTimeStr(val) {
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Tokyo', 'HH:mm');
  var s = String(val).trim();
  if (/^\d{1,2}:\d{2}/.test(s)) return s; // "HH:mm" or "HH:mm-mm" はそのまま
  try { var d = new Date(s); if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'Asia/Tokyo', 'HH:mm'); } catch(e) {}
  return s;
}

// ── HELPER: ブッフェ回の開始分数 ──────────────────────────
function parseRoundMinutes(round) {
  var m = String(round).match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
}

// ── getSeats ─────────────────────────────────────────────
function getSeats() {
  var sheet = getSheet('Seats');
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [
      { t: '11:00',    fill: 100, s: 'full' },
      { t: '11:30',    fill: 100, s: 'full' },
      { t: '12:30-40', fill: 72,  s: 'lim'  },
      { t: '13:10',    fill: 22,  s: 'free' },
    ];
  }
  return data.slice(1).map(function(row) {
    return { t: toTimeStr(row[0]), fill: Number(row[1]), s: String(row[2]) };
  });
}

// ── register ─────────────────────────────────────────────
function registerQueue(params) {
  var ppl        = parseInt(params.ppl, 10) || 1;
  var round      = params.round      || '12:30-40';
  var lineUserId = params.lineUserId || '';
  var wheelchair = parseInt(params.wheelchair, 10) || 0;
  var courseType = params.courseType || 'buffet'; // 'buffet' or 'alacarte'

  var num  = nextCounter();
  var now  = new Date();
  var mmdd = Utilities.formatDate(now, 'Asia/Tokyo', 'MMdd');
  var id   = 'W-' + mmdd + '-' + String(num).padStart(3, '0');
  var time = Utilities.formatDate(now, 'Asia/Tokyo', 'HH:mm');

  var all   = getAllQueue();
  var ahead = all.filter(function(q) {
    return isTodayId(q.id) && q.round === round && (q.status === 'waiting' || q.status === 'pre');
  }).length;

  // スマート待ち時間: 回の開始まで + 前の組 * 5分
  var nowMin    = now.getHours() * 60 + now.getMinutes();
  var roundMin  = parseRoundMinutes(round);
  var untilRound = Math.max(0, roundMin - nowMin);
  var waitMin   = untilRound + ahead * 5;

  var note = '';
  if (wheelchair > 0) note += '車椅子/ベビーカー×' + wheelchair + ' ';
  if (courseType === 'alacarte') note += 'アラカルト';

  getSheet('Queue').appendRow([id, ppl, time, round, 'waiting', '', lineUserId, note.trim()]);

  if (lineUserId) {
    sendLineMessage(
      lineUserId,
      '🪷 整理券を受け取りました\n\n' +
      '整理番号：' + id + '\n' +
      'ご人数：' + ppl + '名様\n' +
      'ご案内予定：' + round + ' の回\n' +
      (courseType === 'alacarte' ? 'ご利用：アラカルト\n' : '') +
      '前のお客様：' + (ahead === 0 ? 'なし（先頭）' : ahead + '組') + '\n' +
      '目安待ち時間：' + (waitMin <= 5 ? 'まもなくご案内' : '約 ' + waitMin + ' 分') + '\n\n' +
      'ご案内の際にLINEでお知らせします。\n店内・近隣にてお待ちください。'
    );
  }

  return { id: id, ahead: ahead, waitMin: waitMin };
}

// ── getTicket ────────────────────────────────────────────
function getTicket(id) {
  var all = getAllQueue();
  var q   = all.find(function(x) { return x.id === id; });
  if (!q) return { error: 'Ticket not found' };

  var ahead = all.filter(function(x) {
    return isTodayId(x.id) &&
           x.round === q.round &&
           (x.status === 'waiting' || x.status === 'pre') &&
           x.id < q.id;
  }).length;

  var nowMin    = new Date().getHours() * 60 + new Date().getMinutes();
  var roundMin  = parseRoundMinutes(q.round);
  var untilRound = Math.max(0, roundMin - nowMin);
  var waitMin   = untilRound + ahead * 5;

  return {
    id:       q.id,
    status:   q.status,
    ppl:      q.ppl,
    round:    q.round,
    ahead:    ahead,
    waitMin:  waitMin,
    calledAt: q.calledAt,
  };
}

// ── callCustomer ─────────────────────────────────────────
function callCustomer(id) {
  var all = getAllQueue();
  var q   = all.find(function(x) { return x.id === id; });
  if (!q) return { error: 'Not found' };

  var calledAt = Date.now();
  updateQueueRow(id, { status: 'called', calledAt: calledAt });

  if (q.lineUserId) {
    sendLineMessage(
      q.lineUserId,
      '🔔 ご入店のご案内\n\n' +
      '整理番号 ' + id + ' のお客様\n' +
      'ただいまご案内できます。\n\n' +
      '📍 10分以内にカウンターへお越しください\n' +
      '新丸の内ビルディング 6F\nThe Siam Heritage Tokyo'
    );
  }

  return { ok: true, calledAt: calledAt };
}

// ── checkinCustomer ──────────────────────────────────────
function checkinCustomer(id) {
  updateQueueRow(id, { status: 'checkin' });
  return { ok: true };
}

// ── cancelCustomer ───────────────────────────────────────
function cancelCustomer(id) {
  updateQueueRow(id, { status: 'noshow', calledAt: null });
  return { ok: true };
}

// ── restoreCustomer ──────────────────────────────────────
function restoreCustomer(id) {
  updateQueueRow(id, { status: 'waiting', calledAt: null });
  return { ok: true };
}

// ── addQueueByStaff ──────────────────────────────────────
function addQueueByStaff(params) {
  var ppl        = parseInt(params.ppl, 10) || 2;
  var round      = params.round      || '12:30-40';
  var note       = params.note       || '';
  var wheelchair = parseInt(params.wheelchair, 10) || 0;
  var courseType = params.courseType || 'buffet';
  if (wheelchair > 0) note = ('車椅子/ベビーカー×' + wheelchair + ' ' + note).trim();
  if (courseType === 'alacarte') note = ('アラカルト ' + note).trim();

  var num  = nextCounter();
  var now  = new Date();
  var mmdd = Utilities.formatDate(now, 'Asia/Tokyo', 'MMdd');
  var id   = 'W-' + mmdd + '-' + String(num).padStart(3, '0');
  var time = Utilities.formatDate(now, 'Asia/Tokyo', 'HH:mm');

  var all   = getAllQueue();
  var ahead = all.filter(function(q) {
    return isTodayId(q.id) && q.round === round && (q.status === 'waiting' || q.status === 'pre');
  }).length;

  getSheet('Queue').appendRow([id, ppl, time, round, 'waiting', '', '', note]);

  return { id: id, ahead: ahead, waitMin: ahead * 5 };
}

// ── updateSeats ──────────────────────────────────────────
function updateSeats(params) {
  var sheet    = getSheet('Seats');
  var data     = sheet.getDataRange().getValues();
  var target   = String(params.time).trim();
  for (var i = 1; i < data.length; i++) {
    var cellTime = toTimeStr(data[i][0]); // Date → HH:mm or passthrough
    if (cellTime === target) {
      sheet.getRange(i + 1, 2).setValue(parseInt(params.fill, 10));
      sheet.getRange(i + 1, 3).setValue(params.status);
      return { ok: true };
    }
  }
  return { error: 'Seat time not found: ' + target + ' (checked ' + (data.length - 1) + ' rows)' };
}

// ── resetCounterAPI ──────────────────────────────────────
function resetCounterAPI() {
  PropertiesService.getScriptProperties().setProperty('QUEUE_COUNTER', '0');
  return { ok: true, message: 'Counter reset to 0' };
}

// ── healthCheck (check.html 用の自己診断) ─────────────────
function healthCheck() {
  var res = { ok: true, now: new Date().toISOString(), today: todayTag() };
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    res.spreadsheet = ss.getName();
    res.queueSheet  = !!ss.getSheetByName('Queue');
    res.seatsSheet  = !!ss.getSheetByName('Seats');
  } catch (e) {
    res.ok = false;
    res.spreadsheetError = e.message;
  }
  var prop = PropertiesService.getScriptProperties();
  res.lineTokenSet = !!prop.getProperty('LINE_TOKEN');
  res.counter      = prop.getProperty('QUEUE_COUNTER');
  return res;
}

// ── LINE Messaging API ───────────────────────────────────
function sendLineMessage(userId, text) {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN');
  if (!token || !userId) return;

  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method:  'post',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token,
      },
      payload:           JSON.stringify({ to: userId, messages: [{ type: 'text', text: text }] }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log('LINE send error: ' + e.message);
  }
}

// ════════════════════════════════════════════════════════
//  セットアップ用関数 — 一度だけ実行してください
// ════════════════════════════════════════════════════════

// 【初回】シートのヘッダーとデフォルトデータを作成する
function setupSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Queue シート
  var qSheet = ss.getSheetByName('Queue');
  if (!qSheet) qSheet = ss.insertSheet('Queue');
  if (qSheet.getLastRow() === 0) {
    qSheet.appendRow(['id', 'ppl', 'time', 'round', 'status', 'calledAt', 'lineUserId', 'note']);
    qSheet.getRange('1:1').setFontWeight('bold');
    qSheet.setColumnWidth(1, 80);
    qSheet.setColumnWidth(7, 160);
  }

  // Seats シート
  var sSheet = ss.getSheetByName('Seats');
  if (!sSheet) sSheet = ss.insertSheet('Seats');
  if (sSheet.getLastRow() === 0) {
    sSheet.appendRow(['time', 'fill', 'status']);
    sSheet.getRange('1:1').setFontWeight('bold');
    sSheet.appendRow(['11:00',    100, 'full']);
    sSheet.appendRow(['11:30',    100, 'full']);
    sSheet.appendRow(['12:30-40',  72, 'lim' ]);
    sSheet.appendRow(['13:10',     22, 'free']);
  }

  // カウンター初期化
  var prop = PropertiesService.getScriptProperties();
  if (!prop.getProperty('QUEUE_COUNTER')) {
    prop.setProperty('QUEUE_COUNTER', '0');
  }

  Logger.log('✅ Setup complete!');
}

// 【初回】LINE Channel Access Token を設定する
// ※ token を書き換えてから実行してください
function setLineToken() {
  PropertiesService.getScriptProperties()
    .setProperty('LINE_TOKEN', 'YOUR_LINE_CHANNEL_ACCESS_TOKEN_HERE');
}
// カウンターをリセットする（営業日のリセット用）
function resetCounter() {
  PropertiesService.getScriptProperties().setProperty('QUEUE_COUNTER', '0');
  Logger.log('✅ Counter reset to 0');
}

// 【毎日自動リセット】トリガーを設定する（一度だけ実行してください）
// 毎日 16:00 (JST) に resetCounter() を自動実行
function setupDailyResetTrigger() {
  // 既存のトリガーを削除（重複防止）
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'resetCounter') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('resetCounter')
    .timeBased()
    .atHour(16)   // 閉店後 16:00 JST にリセット
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();
  Logger.log('✅ Daily reset trigger set at 16:00 JST');
}
