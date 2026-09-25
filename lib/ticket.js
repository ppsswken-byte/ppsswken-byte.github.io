// ════════════════════════════════════════════════════
//  THE SIAM HERITAGE — 整理券の描画と印刷（共通）
//  kiosk.html と staff-dashboard.html から読み込む
//  依存: lib/qrcode.js, lib/star/StarWebPrintBuilder.js, lib/star/StarWebPrintTrader.js
//  ページ側の CONFIG.LIFF_ID があればそれを使う。用紙幅と接続方法は printerSettings（端末ごと）
// ════════════════════════════════════════════════════
const TICKET_VERSION=4;   // HTML 側の ?v= と合わせる
const TICKET_DEFAULTS={LIFF_ID:'2009236977-HNXaG3GD'};
function ticketCfg(k){
  try{ if(typeof CONFIG!=='undefined'&&CONFIG[k]!=null) return CONFIG[k]; }catch(e){}
  return TICKET_DEFAULTS[k];
}

// ── プリンター設定（端末ごと・localStorage）───────────
//  mode: 'app' = Star webPRNT Browser アプリ経由（Bluetooth など、iPad の設定で選んだポート）
//        'lan' = プリンター内蔵の webPRNT サーバーへ直接（https://<IP>/StarWebPRNT/SendMessage）
//  paper: 80 = 80mm 用紙（印字幅 72mm = 576 ドット: mC-Print3）/ 58 = 58mm 用紙（384 ドット: mC-Print2）
const PRINTER_KEY='printerSettings';
const PAPER_DOTS={58:384,80:576};
const printerSettings={mode:'app',ip:'',paper:80};
try{ Object.assign(printerSettings,JSON.parse(localStorage.getItem(PRINTER_KEY)||'{}')); }catch(e){}
function savePrinterSettings(){ try{ localStorage.setItem(PRINTER_KEY,JSON.stringify(printerSettings)); }catch(e){} }
function paperDots(){ return PAPER_DOTS[printerSettings.paper]||576; }
// "192.168.1.50" / "https://192.168.1.50/" などを IP（ホスト名）だけにする
function cleanPrinterHost(v){ return String(v||'').trim().replace(/^https?:\/\//i,'').replace(/\/.*$/,'').replace(/[^0-9A-Za-z.\-:]/g,''); }
function ticketHHMM(d){ return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function lineUrl(id){ return 'https://liff.line.me/'+ticketCfg('LIFF_ID')+'?t='+encodeURIComponent(id); }

// ════════════════════════════════════════════════════
//  TICKET RENDERER — 白黒ラスター
//  レイアウトは 58mm（幅 384）基準で書き、80mm（576）では全体を拡大して描く
// ════════════════════════════════════════════════════
let printLogo=null;
const printLogoReady=new Promise(res=>{
  const img=new Image();
  img.onload=()=>{ printLogo=img; res(); };
  img.onerror=()=>res();
  img.src='lib/logo-print.png';
});
async function fontsReady(){
  try{
    await Promise.all([
      document.fonts.load('700 40px "Noto Sans JP"','整理番号あ'),
      document.fonts.load('400 20px "Noto Sans JP"','整理番号あ'),
    ]);
  }catch(e){}
  await printLogoReady;
}
function qrMatrix(text){
  const qr=qrcode(0,'M');
  qr.addData(text);
  qr.make();
  return qr;
}
function qrDataUrl(text,cell){
  const qr=qrMatrix(text);
  return qr.createDataURL(cell||5,cell||5);
}
const FONT='"Noto Sans JP","Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif';
function renderTicketCanvas(tk){
  const DW=paperDots(), S=DW/384, W=384, M=14;   // W, M などは 384 基準の座標
  const c=document.createElement('canvas');
  c.width=DW; c.height=Math.ceil(2400*S);
  const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height);
  g.setTransform(S,0,0,S,0,0);
  g.fillStyle='#000'; g.strokeStyle='#000'; g.textBaseline='alphabetic';
  let y=10;
  const font=(sz,wt)=>{ g.font=(wt||400)+' '+sz+'px '+FONT; };
  const center=(txt,sz,wt,gap)=>{ font(sz,wt); y+=sz; g.textAlign='center'; g.fillText(txt,W/2,y); y+=(gap==null?8:gap); };
  const rule=(dash)=>{ y+=6; g.lineWidth=2; g.setLineDash(dash?[6,5]:[]); g.beginPath(); g.moveTo(M,y); g.lineTo(W-M,y); g.stroke(); g.setLineDash([]); y+=12; };
  const row=(ja,en,val)=>{
    font(20,700); g.textAlign='left'; g.fillText(ja,M,y+22);
    font(13,400); g.fillText(en,M,y+40);
    let sz=26; font(sz,700); while(g.measureText(val).width>W-M*2-150&&sz>14){ sz-=2; font(sz,700); }
    g.textAlign='right'; g.fillText(val,W-M,y+30);
    y+=50;
  };

  // logo
  if(printLogo){
    const lw=128, lh=Math.round(printLogo.height*lw/printLogo.width);
    g.drawImage(printLogo,(W-lw)/2,y,lw,lh); y+=lh+6;
  } else {
    center('THE SIAM HERITAGE',26,700);
  }
  center('TOKYO · 新丸の内ビルディング 6F',15,400,4);
  const d=tk.issuedAt||new Date();
  center(`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}  ${ticketHHMM(d)}`,15,400,2);
  rule(false);

  // number
  center('整 理 番 号',20,700,2);
  center('YOUR TICKET NUMBER',13,400,0);
  let sz=80; font(sz,700);
  while(g.measureText(tk.id).width>W-M*2&&sz>30){ sz-=2; font(sz,700); }
  y+=sz+2; g.textAlign='center'; g.fillText(tk.id,W/2,y); y+=12;
  rule(false);

  // details
  const styleJa=tk.style==='alacarte'?'アラカルト':'ブッフェ', styleEn=tk.style==='alacarte'?'À la carte':'Buffet';
  row('ご人数','Guests',`${tk.ppl} 名 / ${tk.ppl} pax`);
  row('ご利用','Style',`${styleJa} ${styleEn}`);
  row('ご案内予定','Seating time',`${tk.round} の回`);
  row('前のお客様','Groups ahead',`${tk.ahead} 組`);
  row('目安待ち時間','Estimated wait',tk.waitMin<=5?'まもなく / Soon':`約 ${tk.waitMin} 分 / min`);
  if(tk.wc>0) row('車椅子・ベビーカー','Wheelchair / stroller',tk.wc>=3?'3台以上':`${tk.wc} 台`);
  rule(true);

  // LINE QR
  y+=4;
  center('LINEで呼び出し通知を受け取る',19,700,2);
  center('Scan to get notified on LINE',14,400,8);
  // QR はドット単位（整数）で描く — 拡大してもセルの大きさが揃い、読み取りやすい
  const qr=qrMatrix(lineUrl(tk.id));
  const n=qr.getModuleCount(), cell=Math.max(3,Math.floor(210*S/n)), qs=cell*n;
  const qx=Math.round((DW-qs)/2), qy=Math.round(y*S);
  g.setTransform(1,0,0,1,0,0);
  for(let r=0;r<n;r++) for(let cc=0;cc<n;cc++) if(qr.isDark(r,cc)) g.fillRect(qx+cc*cell,qy+r*cell,cell,cell);
  g.setTransform(S,0,0,S,0,0);
  y+=qs/S+8;
  center('スマートフォンのカメラで読み取ってください',14,400,2);
  rule(true);

  // footer
  center('店頭モニターでも番号をお呼びします',16,400,2);
  center('Your number will also appear on the screen',13,400,8);
  center('お呼び出し後 10分以内にお越しください',17,700,2);
  center('Please return within 10 min of being called',13,400,8);
  y+=14;

  // crop + pure black/white (thermal printers print 1-bit)
  const H=Math.ceil(y*S);
  const out=document.createElement('canvas'); out.width=DW; out.height=H;
  const og=out.getContext('2d');
  og.drawImage(c,0,0);
  const img=og.getImageData(0,0,DW,H), px=img.data;
  for(let i=0;i<px.length;i+=4){
    const lum=px[i]*0.299+px[i+1]*0.587+px[i+2]*0.114;
    const v=lum<150?0:255;
    px[i]=px[i+1]=px[i+2]=v; px[i+3]=255;
  }
  og.putImageData(img,0,0);
  return out;
}

// ════════════════════════════════════════════════════
//  PRINTER — Star webPRNT
//   app: Star webPRNT Browser アプリ → iPad の設定で選んだプリンター（Bluetooth / TCP）
//   lan: プリンター内蔵 webPRNT サーバーへ HTTPS で直接送る（Safari でも可）
// ════════════════════════════════════════════════════
const Printer={
  // アプリ内では UA に webPRNTSupportMessageHandler が含まれ、localhost:8001 宛の送信をアプリが受け取りプリンターへ送る
  inApp:/webPRNTSupportMessageHandler/.test(navigator.userAgent),
  appUrl:'http://localhost:8001/StarWebPRNT/SendMessage',
  last:null,   // {ok, msg, kind, detail, at}
  busy:false,
  get mode(){ return printerSettings.mode==='lan'?'lan':'app'; },
  get host(){ return cleanPrinterHost(printerSettings.ip); },
  // ページが https のため、LAN も https で送る（http だとブラウザが混在コンテンツとして止める）
  get lanUrl(){ return this.host?'https://'+this.host+'/StarWebPRNT/SendMessage':''; },
  get url(){ return this.mode==='lan'?this.lanUrl:this.appUrl; },
  // いまの設定で印刷を試せる状態か
  get ready(){ return this.mode==='lan'?!!this.host:this.inApp; },
  // 画面表示用の説明
  get label(){ return this.mode==='lan'?'LAN '+(this.host||'（IP 未設定）'):'webPRNT アプリ'; },
  describe(trader,res){
    const st={traderStatus:res.traderStatus};
    const p=[];
    try{
      if(trader.isCoverOpen(st)) p.push('カバーが開いています');
      if(trader.isPaperEnd(st)) p.push('用紙切れです');
      if(trader.isOffLine(st)) p.push('オフライン');
      if(trader.isAutoCutterError(st)) p.push('カッターエラー');
      if(trader.isHighTemperatureStop(st)) p.push('高温のため停止中');
      if(trader.isNonRecoverableError(st)) p.push('復帰不可能エラー');
    }catch(e){}
    return p.join('・');
  },
  // 整理券（画像）を印刷
  print(canvas,opts){
    opts=opts||{};
    return this._send(b=>{
      let req=b.createInitializationElement();
      req+=b.createBitImageElement({context:canvas.getContext('2d'),x:0,y:0,width:canvas.width,height:canvas.height});
      return req+this._tail(b,opts);
    },'ticket');
  },
  // 文字だけのテスト印刷（画像を使わない）— 接続の問題か、画像データの問題かを切り分ける
  printText(lines,opts){
    opts=opts||{};
    return this._send(b=>{
      let req=b.createInitializationElement();
      req+=b.createTextElement({data:lines.join('\n')+'\n'});
      return req+this._tail(b,opts);
    },'text');
  },
  _tail(b,opts){
    return opts.cut!==false?b.createCutPaperElement({feed:true,type:'partial'}):b.createFeedElement({line:4});
  },
  _notReadyMsg(){
    return this.mode==='lan'
      ?'プリンターの IP アドレスが設定されていません（スタッフメニュー → 接続方法）'
      :'webPRNT Browser アプリ外のため印刷できません';
  },
  // 送信して結果を返す。原因調査のため、プリンターからの応答をそのまま last.detail に残す
  _send(build,kind){
    return new Promise(resolve=>{
      if(!this.ready) return resolve({ok:false,msg:this._notReadyMsg()});
      if(typeof StarWebPrintBuilder==='undefined'||typeof StarWebPrintTrader==='undefined')
        return resolve({ok:false,msg:'Star webPRNT ライブラリを読み込めません'});
      const lan=this.mode==='lan', url=this.url;
      let done=false;
      const finish=(r,detail)=>{ if(done) return; done=true; this.busy=false; this.last={...r,kind,detail:detail?{...detail,via:lan?'lan':'app',url}:null,at:new Date()}; resolve(r); };
      const raw=t=>String(t==null?'':t).replace(/&lt;/g,'<').replace(/&gt;/g,'>').slice(0,300);
      const lanHelp='① プリンターの電源と LAN ケーブル ② iPad が同じ Wi-Fi か ③ IP アドレス（'+this.host+'）④ スタッフメニューの「証明書を許可」を確認してください';
      try{
        this.busy=true;
        const req=build(new StarWebPrintBuilder());
        const tr=new StarWebPrintTrader({url,papertype:'normal',timeout:lan?15000:30000});
        tr.onReceive=res=>{
          const ok=String(res.traderSuccess)==='true';
          const why=this.describe(tr,res);
          const detail={code:res.traderCode,statusBytes:res.traderStatus,http:res.status,raw:raw(res.responseText)};
          let msg;
          if(ok) msg=why?'印刷しました（注意: '+why+'）':'印刷しました';
          else if(why) msg='印刷エラー: '+why;
          else if(!/[0-9a-f]{4}/i.test(String(res.traderStatus||''))||String(res.traderCode)==='1100')
            // ステータスが取れない = プリンターにつながっていない
            msg=lan
              ?'プリンターに接続できません（code '+res.traderCode+'）。'+lanHelp
              :'プリンターに接続できません（code '+res.traderCode+'）。iPad の設定 → webPRNT の PRINTER / PORT NAME と、プリンターの電源・接続を確認してください';
          else msg='印刷エラー: code '+res.traderCode;
          finish({ok,msg},detail);
        };
        tr.onError=res=>{
          const st=res&&res.status;
          let msg;
          if(lan&&(st===0||st==null)) msg='プリンターにつながりません。'+lanHelp;
          else if(lan&&(st===404||st===403||st===405)) msg='プリンターの webPRNT が無効です（HTTP '+st+'）。プリンターの設定ページで WebPRNT を有効にしてください';
          else msg='プリンターと通信できません（'+st+'）プリンターの電源と接続を確認してください';
          finish({ok:false,msg},{http:st,raw:raw(res&&res.responseText)});
        };
        tr.onTimeout=()=>finish({ok:false,msg:'プリンターの応答がありません（タイムアウト）'+(lan?'。'+lanHelp:'')},{raw:'timeout'});
        tr.sendMessage({request:req});
      }catch(e){ finish({ok:false,msg:'印刷データの作成に失敗: '+e.message},{raw:String(e&&e.stack||e).slice(0,300)}); }
    });
  },
};
