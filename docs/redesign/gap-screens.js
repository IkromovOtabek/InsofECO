Object.assign(I,{
  wifiOff:'<path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><path d="m2 2 20 20"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  copy:'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  face:'<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
  send:'<path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.03.94l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="m21.85 2.15-10.94 10.94"/>',
  help:'<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  trash:'<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  pen:'<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>'
});
const tg=(on)=>`<span class="tg ${on?'on':''}" role="switch" aria-checked="${on}"><i></i></span>`;
const setRow=(icn,m,t,right,sub)=>`<div class="li">${tileM(icn,m,28)}<div class="m"><b>${t}</b>${sub?`<span class="t-sm">${sub}</span>`:''}</div>${right}</div>`;
const bar=(t,right='')=>`${sb()}<div class="appbar"><span class="ib">${ic('back')}</span><div class="hdr-t" style="flex:1;font-size:13px;font-weight:var(--wHead)">${t}</div>${right}</div>`;
const GAPS=[
 {key:'offline',tag:'Oflayn / xato',title:'Internet yo\'q holati',note:'Hozir ilovada oflayn banner yo\'q. Yuklanmagan ro\'yxat esa "ma\'lumot yo\'q" deb ko\'rinadi (NotificationsList.tsx:29). Yangi tartibda tepada global banner chiqadi, sabab aniq aytiladi va "Qayta urinish" tugmasi bor.',html:()=>`
   ${sb()}<div class="offbar">${ic('wifiOff',14)}<span style="flex:1">Internet yo'q · 3 ta o'zgarish navbatda</span><b>Qayta</b></div>
   <div class="appbar"><div class="hdr-t" style="flex:1;font-size:13px;font-weight:var(--wHead)">Buyurtmalar</div></div>
   <div class="scroll" style="justify-content:center;align-items:center;text-align:center;gap:14px;padding:24px">
     <div class="err-ill">${ic('wifiOff',44)}</div>
     <div style="display:flex;flex-direction:column;gap:6px;align-items:center"><div class="t-title">Ma'lumot yuklanmadi</div><div class="t-body" style="max-width:220px">Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring. Saqlanganlar yo'qolmaydi.</div></div>
     <span class="btn pri" style="flex:0 0 auto;padding:0 22px;height:42px">${ic('refresh',14)}Qayta urinish</span>
     <span class="btn sec" style="flex:0 0 auto;padding:0 22px;height:40px">Bosh sahifa</span>
   </div>`},
 {key:'when',tag:'Buyurtma',title:'Obyekt va vaqt (2/3)',note:'Hozir sana "YYYY-MM-DDTHH:mm" ko\'rinishida qo\'lda yoziladi, manzilga esa soxta koordinata qo\'yiladi (new-order.tsx:43, 88). Yangi tartibda xaritadagi pin, kun chiplari, vaqt slotlari va interval tanlanadi.',html:()=>`
   ${bar('Yangi buyurtma','<span class="t-sm" style="font-weight:700">2/3</span>')}
   <div class="steps"><i class="on"></i><i class="on"></i><i></i></div>
   <div class="scroll" style="gap:10px">
     <div class="card" style="padding:10px;display:flex;gap:9px;align-items:center">${tileM('map','Logistics')}<div style="flex:1;min-width:0"><div class="t-sm">Obyekt</div><b style="font-size:11.5px">Chilonzor 9-kv, 12-uy</b></div>${ic('chev',14)}</div>
     <div class="mapbox"><svg viewBox="0 0 270 110" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70 Q60 50 120 72 T270 60" stroke="var(--borderStrong)" stroke-width="6" fill="none"/><path d="M90 0 L110 110 M190 0 L170 110" stroke="var(--borderDefault)" stroke-width="4"/><rect x="20" y="12" width="50" height="28" rx="4" fill="var(--bgMuted)"/><rect x="200" y="76" width="56" height="24" rx="4" fill="var(--bgMuted)"/></svg><span class="pin">${ic('map',16)}</span><span class="chip" style="position:absolute;right:8px;bottom:8px;height:26px;font-size:9.5px">${ic('nav',11)}&nbsp;Joylashuvim</span></div>
     <div class="t-over">Kun</div>
     <div class="chips"><span class="chip">Bugun</span><span class="chip on">Ertaga</span><span class="chip">Sha, 4-okt</span><span class="chip">Ya, 5-okt</span></div>
     <div class="t-over">Boshlanish vaqti</div>
     <div class="slots">${['07:00','08:00','09:00','10:00','11:00','13:00','14:00','15:00'].map((t,i)=>`<span class="tslot ${i===1?'on':''} ${i===6?'off':''}">${t}</span>`).join('')}</div>
     <div class="card" style="padding:10px;display:flex;align-items:center;gap:8px"><div style="flex:1"><b style="font-size:11.5px">Mikserlar oralig'i</b><div class="t-sm">12 m³ = 2 reys</div></div><div class="stepper"><span>−</span><b>30 daq</b><span>+</span></div></div>
   </div>
   <div class="sticky"><span class="btn sec" style="flex:1">Orqaga</span><span class="btn pri" style="flex:1.6">Davom etish ${ic('chev',13)}</span></div>`},
 {key:'ordered',tag:'Do\'kon',title:'Buyurtma qabul qilindi',note:'Hozir do\'kondan buyurtma berilgach faqat toast chiqadi va ekran yopiladi ([id].tsx:71): raqam ham, keyingi qadam ham ko\'rinmaydi. Yangi ekranda buyurtma raqami, keyingi qadamlar va kuzatish tugmasi bor.',html:()=>`
   ${sb()}<div class="scroll" style="gap:12px;padding-top:26px">
     <div style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center"><span class="okc">${ic('check',30)}</span><div class="t-title">Buyurtma qabul qilindi</div><span class="row" style="gap:6px;font-size:11px;color:var(--textMuted)">№ B-2026-00412 <span class="ib" style="width:24px;height:24px">${ic('copy',12)}</span></span></div>
     <div class="card" style="display:flex;flex-direction:column;gap:4px"><div class="row between"><b style="font-size:12px">Beton M300 · 12 m³</b>${badge('Yangi','info')}</div><span class="t-sm">Ertaga, 08:00 · Chilonzor 9-kv</span><div class="num" style="font-size:16px;font-weight:var(--wHead);margin-top:4px">≈ 10 800 000 so'm</div></div>
     <div class="card tl">
       <div class="s done"><span class="d"></span><div><b>Qabul qilindi</b><div class="t-sm">14:32</div></div></div>
       <div class="s now"><span class="d"></span><div><b>Sotuv bo'limi qo'ng'iroq qiladi</b><div class="t-sm">15 daqiqa ichida</div></div></div>
       <div class="s"><span class="d"></span><div style="color:var(--textMuted)">Yetkazish: tasdiqdan so'ng</div></div>
     </div>
   </div>
   <div class="sticky" style="flex-direction:column"><span class="btn pri" style="height:44px">Buyurtmalarim</span><span class="btn sec" style="flex:0 0 40px;height:40px">Do'konga qaytish</span></div>`},
 {key:'settings',tag:'Sozlamalar',title:'Sozlamalar',note:'Hozir "Til" bosilmaydi, mavzu faqat tizimga ergashadi, bildirishnoma va Face ID sozlamalari yo\'q, yordam raqami esa namuna (Profile.tsx:73-75). Yangi sahifa 4 ta guruhdan iborat.',html:()=>`
   ${bar('Sozlamalar')}
   <div class="scroll" style="gap:8px">
     <div class="card" style="display:flex;gap:10px;align-items:center;padding:10px"><span class="av" style="width:40px;height:40px">RA</span><div style="flex:1"><b style="font-size:12px">Rustam Aliyev</b><div class="t-sm">Direktor · +998 90 123 45 67</div></div>${ic('chev',14)}</div>
     <div class="t-over" style="margin-top:4px">Ilova</div>
     <div class="group">${setRow('globe','Logistics','Til','<span class="t-sm">O\'zbekcha '+ic('chev',12)+'</span>')}${setRow('moon','Production','Mavzu','<div class="miniseg"><span>Tizim</span><span class="on">Yorug\'</span><span>Tungi</span></div>')}</div>
     <div class="t-over" style="margin-top:4px">Xavfsizlik</div>
     <div class="group">${setRow('lock','Warehouse','PIN kod','<span class="t-sm">Yoqilgan</span>')}${setRow('face','Brand','Face ID bilan kirish',tg(true))}</div>
     <div class="t-over" style="margin-top:4px">Bildirishnomalar</div>
     <div class="group">${setRow('truck','Logistics','Reys xabarlari',tg(true))}${setRow('wallet','Brand','To\'lov xabarlari',tg(true))}${setRow('chat','Production','Chat',tg(false))}</div>
     <div class="t-over" style="margin-top:4px">Yordam</div>
     <div class="group">${setRow('help','Brand','Telegram: @insof_support',ic('chev',12))}${setRow('trash','Warehouse','<span style="color:var(--danger)">Hisobni o\'chirish</span>','')}</div>
     <div class="t-sm" style="text-align:center">Versiya 1.0.0</div>
   </div>`},
 {key:'accept',tag:'Yetkazish',title:'Betonni qabul qilish',note:'Hozir imzo o\'rniga soxta "tap.png" yuboriladi, "Qo\'ng\'iroq" tugmasi esa ishlamaydi (delivery/[id].tsx:132, 168). Yangi ekranda hajmni tasdiqlash, nakladnoy fotosi va haqiqiy imzo maydoni bor.',html:()=>`
   ${bar('Qabul qilish','<span class="ib">'+ic('phone')+'</span>')}
   <div class="scroll" style="gap:10px">
     <div class="hero" style="gap:6px"><span class="t-over">Mikser 01 A 123 BC · 14:05</span><div style="font-size:16px;font-weight:var(--wHead)">Beton M300 · 8 m³</div><span style="font-size:10.5px;color:var(--onInvMuted)">Zavoddan chiqdi 13:22 · yoshi 43 daq</span></div>
     <div class="card" style="padding:10px;display:flex;align-items:center;gap:8px"><div style="flex:1"><b style="font-size:11.5px">Qabul qilingan hajm</b><div class="t-sm">Hujjat bo'yicha 8,0 m³</div></div><div class="stepper"><span>−</span><b>8,0 m³</b><span>+</span></div></div>
     <div class="photo">${ic('camera',20)}<span>Nakladnoy fotosi</span></div>
     <div class="sign"><svg viewBox="0 0 240 70" aria-hidden="true"><path class="sig" pathLength="1" d="M14 46 C30 10 44 64 60 34 S88 20 96 44 S120 58 132 30 S160 18 170 42 S196 52 220 26" fill="none" stroke="var(--textStrong)" stroke-width="2.4" stroke-linecap="round"/></svg><div class="row between" style="font-size:9.5px;color:var(--textMuted)"><span>${ic('pen',11)} Shu yerga imzo qo'ying</span><b style="color:var(--brandInk)">Tozalash</b></div></div>
   </div>
   <div class="sticky" style="flex-direction:column"><span class="btn pri" style="height:46px">${ic('check',14)}Imzolash va qabul qilish</span><span class="btn sec" style="flex:0 0 38px;height:38px;color:var(--danger)">E'tiroz bildirish</span></div>`},
 {key:'notif',tag:'Bildirishnoma',title:'Bildirishnomalar',note:'Hozir ro\'yxatda tur ikonkasi ham, sana guruhlari ham yo\'q, ochilishi bilan hammasi "o\'qildi" bo\'lib qoladi (NotificationsList.tsx:19-43). Yangi ekranda filtr, "Bugun" va "Kecha" guruhlari va o\'qilmagan nuqtasi bor.',html:()=>{
   const n=(icn,m,t,b,time,un)=>`<div class="li" style="align-items:flex-start">${tileM(icn,m)}<div class="m"><b style="white-space:normal">${t}</b><span class="t-sm" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${b}</span></div><div class="r"><span class="t-sm">${time}</span>${un?'<i class="udot"></i>':''}</div></div>`;
   return `${bar('Bildirishnomalar','<span style="font-size:10px;font-weight:700;color:var(--brandInk)">Hammasi o\'qildi</span>')}
   <div class="scroll" style="gap:10px">
     <div class="chips"><span class="chip on">Hammasi</span><span class="chip">O'qilmagan <span class="n">3</span></span><span class="chip">Reyslar</span><span class="chip">To'lovlar</span></div>
     <div class="t-over">Bugun</div>
     <div class="group">${n('truck','Logistics','Reys biriktirildi','Z-2026-00027 · Yunusobod, 10 m³. Mikser 01 A 777 BA','09:14',1)}${n('wallet','Brand','To\'lov qabul qilindi','"Baraka Qurilish" MChJ · 4 500 000 so\'m, Click','08:40',1)}${n('alert','Warehouse','Sement zaxirasi kam','3 kunga yetadi. Snabjeniyega zayavka yuboring','07:55',1)}</div>
     <div class="t-over">Kecha</div>
     <div class="group">${n('check','Production','Zayavka tasdiqlandi','№ 4812 · Beton M300 direktor tomonidan tasdiqlandi','18:20',0)}${n('chat','Brand','Yangi xabar','Dilshod R.: Ertangi reys vaqti o\'zgardimi?','16:02',0)}</div>
   </div>`}},
 {key:'chat',tag:'Chat',title:'Chat',note:'Hozir chatda kun ajratgichlari, yuborildi/o\'qildi belgilari va ilova (foto, joylashuv) yo\'q, vaqt "2 soat" ko\'rinishida chiqadi (chat/[id].tsx:35). Yangi chatda buyurtma kartasi ham xabar sifatida yuboriladi.',html:()=>`
   ${sb()}<div class="appbar"><span class="ib">${ic('back')}</span><span class="av">DR</span><div style="flex:1;min-width:0"><b style="font-size:12px">Dilshod Rahimov</b><div class="t-sm" style="color:var(--success)">● onlayn · Sotuv</div></div><span class="ib">${ic('phone')}</span></div>
   <div class="scroll" style="gap:8px;background:var(--bgSubtle)">
     <span class="daychip">Bugun</span>
     <div class="bub in">Assalomu alaykum! Ertangi beton vaqti o'zgarmaydimi?<small>09:02</small></div>
     <div class="bub out">Va alaykum assalom. Yo'q, 08:00 da birinchi mikser chiqadi.<small>09:04 <span class="tick">✓✓</span></small></div>
     <div class="bub out ref"><div class="row" style="gap:8px">${tileM('box','Production')}<div><b style="font-size:11px">Buyurtma № 4812</b><div style="font-size:9.5px;opacity:.8">Beton M300 · 12 m³ · Ertaga 08:00</div></div></div><small>09:05 <span class="tick">✓✓</span></small></div>
     <div class="bub in">Rahmat, kutamiz!<small>09:06</small></div>
     <div class="typing"><i></i><i></i><i></i></div>
   </div>
   <div class="composer"><span class="ib sec" style="border:0">${ic('plus')}</span><span class="cin">Xabar yozing…</span><span class="send">${ic('send',15)}</span></div>`},
 {key:'pin',tag:'Xavfsizlik',title:'PIN qulf',note:'Hozir ilova orqa fondan qaytganda qayta qulflanmaydi, xato PIN terilganda tebranish yo\'q, Face ID esa "Tez kunda" deb turibdi (pin-lock.tsx:26-51). Yangi ekranda ism va avatar, silkinadigan nuqtalar va Face ID tugmasi bor.',html:()=>`
   ${sb()}<div class="scroll" style="align-items:center;gap:14px;padding-top:28px">
     <span class="av" style="width:58px;height:58px;font-size:18px">RA</span>
     <div style="text-align:center"><div class="t-title">Salom, Rustam</div><div class="t-sm">PIN kodni kiriting</div></div>
     <div class="pdots"><i class="f"></i><i class="f"></i><i></i><i></i></div>
     <div class="keypad">${['1','2','3','4','5','6','7','8','9','face','0','del'].map(k=>`<span class="key ${k==='face'||k==='del'?'ghost':''}">${k==='face'?ic('face',22):k==='del'?ic('back',20):k}</span>`).join('')}</div>
     <div class="row" style="gap:18px;font-size:10.5px;font-weight:700;color:var(--brandInk)"><span>PIN esdan chiqdimi?</span><span style="color:var(--textMuted)">Boshqa hisob</span></div>
   </div>`}
];
function renderGaps(){const box=document.getElementById('gapRail');if(!box)return;const p=L[dir][mode];
  box.innerHTML=GAPS.map(g=>`<div class="slot role-slot"><h3><span class="tag new">${g.tag}</span>${g.title}</h3><div class="phone"><div class="screen" data-dir="${dir}" style="${vars(p,R[dir])}">${g.html()}</div></div><p>${g.note}</p></div>`).join('')}
