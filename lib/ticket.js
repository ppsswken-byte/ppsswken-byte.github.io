// ════════════════════════════════════════════════════
//  THE SIAM HERITAGE — 整理券の描画と印刷（共通）
//  kiosk.html と staff-dashboard.html から読み込む
//  依存: lib/qrcode.js, lib/star/StarWebPrintBuilder.js, lib/star/StarWebPrintTrader.js
//  ページ側の CONFIG.LIFF_ID / CONFIG.PAPER_DOTS があればそれを使う
// ════════════════════════════════════════════════════
const TICKET_DEFAULTS={LIFF_ID:'2009236977-HNXaG3GD',PAPER_DOTS:384};
function ticketCfg(k){
  try{ if(typeof CONFIG!=='undefined'&&CONFIG[k]!=null) return CONFIG[k]; }catch(e){}
  return TICKET_DEFAULTS[k];
}
function ticketHHMM(d){ return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function lineUrl(id){ return 'https://liff.line.me/'+ticketCfg('LIFF_ID')+'?t='+encodeURIComponent(id); }

// ════════════════════════════════════════════════════
//  TICKET RENDERER — 58mm (384 dots) 白黒ラスター
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
  const W=ticketCfg('PAPER_DOTS'), M=14;
  const c=document.createElement('canvas');
  c.width=W; c.height=2400;
  const g=c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,W,c.height);
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
  const qr=qrMatrix(lineUrl(tk.id));
  const n=qr.getModuleCount(), cell=Math.max(3,Math.floor(210/n)), qs=cell*n;
  const qx=Math.round((W-qs)/2);
  for(let r=0;r<n;r++) for(let cc=0;cc<n;cc++) if(qr.isDark(r,cc)) g.fillRect(qx+cc*cell,y+r*cell,cell,cell);
  y+=qs+8;
  center('スマートフォンのカメラで読み取ってください',14,400,2);
  rule(true);

  // footer
  center('店頭モニターでも番号をお呼びします',16,400,2);
  center('Your number will also appear on the screen',13,400,8);
  center('お呼び出し後 10分以内にお越しください',17,700,2);
  center('Please return within 10 min of being called',13,400,8);
  y+=14;

  // crop + pure black/white (thermal printers print 1-bit)
  const H=Math.ceil(y);
  const out=document.createElement('canvas'); out.width=W; out.height=H;
  const og=out.getContext('2d');
  og.drawImage(c,0,0);
  const img=og.getImageData(0,0,W,H), px=img.data;
  for(let i=0;i<px.length;i+=4){
    const lum=px[i]*0.299+px[i+1]*0.587+px[i+2]*0.114;
    const v=lum<150?0:255;
    px[i]=px[i+1]=px[i+2]=v; px[i+3]=255;
  }
  og.putImageData(img,0,0);
  return out;
}

// ════════════════════════════════════════════════════
//  PRINTER — Star webPRNT (Star webPRNT Browser app → mC-Print2 via Bluetooth)
// ════════════════════════════════════════════════════
const Printer={
  // アプリ内では UA に webPRNTSupportMessageHandler が含まれ、localhost:8001 宛の送信をアプリが受け取りプリンターへ送る
  inApp:/webPRNTSupportMessageHandler/.test(navigator.userAgent),
  url:'http://localhost:8001/StarWebPRNT/SendMessage',
  last:null,   // {ok, msg, at}
  busy:false,
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
  print(canvas,opts){
    opts=opts||{};
    return new Promise(resolve=>{
      if(!this.inApp) return resolve({ok:false,msg:'webPRNT Browser アプリ外のため印刷できません'});
      if(typeof StarWebPrintBuilder==='undefined'||typeof StarWebPrintTrader==='undefined')
        return resolve({ok:false,msg:'Star webPRNT ライブラリを読み込めません'});
      let done=false;
      const finish=r=>{ if(done) return; done=true; this.busy=false; this.last={...r,at:new Date()}; resolve(r); };
      try{
        this.busy=true;
        const b=new StarWebPrintBuilder();
        let req=b.createInitializationElement();
        req+=b.createBitImageElement({context:canvas.getContext('2d'),x:0,y:0,width:canvas.width,height:canvas.height});
        req+=opts.cut!==false?b.createCutPaperElement({feed:true,type:'partial'}):b.createFeedElement({line:4});
        const tr=new StarWebPrintTrader({url:this.url,papertype:'normal',timeout:30000});
        tr.onReceive=res=>{
          const ok=String(res.traderSuccess)==='true';
          const why=this.describe(tr,res);
          finish({ok, msg: ok?(why?'印刷しました（注意: '+why+'）':'印刷しました'):('印刷エラー: '+(why||('code '+res.traderCode)))});
        };
        tr.onError=res=>finish({ok:false,msg:'プリンターと通信できません（'+(res&&res.status)+'）Bluetooth接続とプリンターの電源を確認してください'});
        tr.onTimeout=()=>finish({ok:false,msg:'プリンターの応答がありません（タイムアウト）'});
        tr.sendMessage({request:req});
      }catch(e){ finish({ok:false,msg:'印刷データの作成に失敗: '+e.message}); }
    });
  },
};
