document.addEventListener('gesturestart', e => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { 
  const now = (new Date()).getTime(); 
  if (now - lastTouchEnd <= 300) e.preventDefault(); 
  lastTouchEnd = now; 
});
document.body.addEventListener('touchmove', e => { e.preventDefault(); }, { passive:false });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => 
    navigator.serviceWorker.register('/painel/service-worker.js').catch(err => console.warn(err))
  );
}

(function(){
  const content=document.querySelectorAll('.protected');
  content.forEach(c=>c.style.display='none');
  const container=document.getElementById('key-container');
  const userInfo=document.getElementById('user-info');
  const input=document.getElementById('user-key');
  let remainingMsGlobal=0;
  let userGlobal='';

  function base36Decode(str){
    const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result='';
    for(let i=0;i<str.length;i+=2){
      result+=String.fromCharCode(chars.indexOf(str[i])*36+chars.indexOf(str[i+1]));
    }
    return result;
  }

  async function sha1(msg){
    const buffer=new TextEncoder("utf-8").encode(msg);
    const hash=await crypto.subtle.digest("SHA-1", buffer);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function verifyKey(key){
    const parts=key.split('-');
    if(parts.length!==2) return false;
    let payload;
    try{ payload=base36Decode(parts[0]); } catch(e){ return false; }
    const hash=await sha1(payload);
    if(hash.slice(0,8).toUpperCase()!==parts[1]) return false;
    const idx=payload.lastIndexOf(':');
    if(idx===-1) return false;
    const user=payload.slice(0,idx);
    const exp=parseFloat(payload.slice(idx+1));
    const now=Date.now();
    const remainingMs=exp<1e10? exp*60*1000 : exp-now;
    if(remainingMs<=0) return false;
    return {user, remainingMs};
  }

  function formatRemaining(ms){
    const s=Math.floor(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60), d=Math.floor(h/24);
    const remH=h%24, remM=m%60, remS=s%60;
    if(d>=1) return d+' dias '+remH+'h '+remM+'m '+remS+'s restantes';
    if(h>=1) return h+'h '+remM+'m '+remS+'s restantes';
    if(m>=1) return m+'m '+remS+'s restantes';
    return s+'s restantes';
  }

  async function checkKey(key){
    const payload=await verifyKey(key);
    if(payload){
      content.forEach(c=>c.style.display='block');
      container.style.display='none';
      localStorage.setItem('user_key',key);
      remainingMsGlobal=payload.remainingMs;
      userGlobal=payload.user;
      userInfo.style.display='flex';
      userInfo.querySelector('.name').textContent=payload.user;
      userInfo.querySelector('.validity').textContent=formatRemaining(payload.remainingMs);
      startCountdown();
    } else{
      localStorage.removeItem('user_key');
      document.getElementById('key-message').innerText="KEY inválida ou expirada.";
    }
  }

  function startCountdown(){
    if(window.countdownInterval) clearInterval(window.countdownInterval);
    window.countdownInterval=setInterval(()=>{
      remainingMsGlobal-=1000;
      if(remainingMsGlobal<=0){
        clearInterval(window.countdownInterval);
        alert("Sua KEY expirou!");
        userInfo.style.display='none';
        content.forEach(c=>c.style.display='none');
        container.style.display='block';
        localStorage.removeItem('user_key');
      } else userInfo.querySelector('.validity').textContent=formatRemaining(remainingMsGlobal);
    },1000);
  }

  const storedKey=localStorage.getItem('user_key');
  if(storedKey) checkKey(storedKey);

  document.getElementById('submit-key').addEventListener('click', ()=>checkKey(input.value.trim()));
  input.addEventListener('keypress', e=>{ if(e.key==='Enter') checkKey(input.value.trim()); });

  const whatsappBtn=document.getElementById('whatsapp-btn');
  whatsappBtn.addEventListener('click', ()=> window.open('https://wa.me/5511998248013','_blank'));

  const fileInput = document.getElementById('file');
  const fileBtn = document.querySelector('.file-upload-btn');
  const fileName = document.querySelector('.file-name');
  const previewImg = document.getElementById('preview-img');
  const genBtn = document.getElementById('gen');
  const printBtn = document.getElementById('print');
  const downloadBtn = document.getElementById('download');

  fileBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      fileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = e => {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        previewImg.classList.add('show');
      };
      reader.readAsDataURL(file);
      genBtn.disabled = false;
    } else {
      fileName.textContent = 'Nenhum arquivo selecionado';
      previewImg.style.display = 'none';
      previewImg.classList.remove('show');
      genBtn.disabled = true;
    }
  });

  function resetPDFButtons() {
    genBtn.style.display = 'inline-block';
    genBtn.disabled = fileInput.files.length === 0;
    printBtn.style.display = 'none';
    downloadBtn.style.display = 'none';
  }

  document.getElementById('rows').addEventListener('input', resetPDFButtons);
  document.getElementById('cols').addEventListener('input', resetPDFButtons);
  document.getElementById('preset').addEventListener('change', resetPDFButtons);
  document.getElementById('orient').addEventListener('change', resetPDFButtons);
})();

const { jsPDF } = window.jspdf;
const MM_TO_PX = mm => mm * (96/25.4);

function loadImage(file){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

let sourceImage = null;
let generatedPages = [];

const fileInput2 = document.getElementById('file');
const genBtn2 = document.getElementById('gen');
const printBtn2 = document.getElementById('print');
const downloadBtn2 = document.getElementById('download');

fileInput2.addEventListener('change', async e=>{
  const file = e.target.files[0];
  if(file){
    sourceImage = await loadImage(file);
    document.getElementById('orient').value = sourceImage.naturalWidth > sourceImage.naturalHeight ? "landscape" : "portrait";
    genBtn2.disabled = false;
    generatedPages = [];
    printBtn2.style.display = 'none';
    downloadBtn2.style.display = 'none';
    genBtn2.style.display = 'inline-block';
  }
});

document.getElementById('preset').addEventListener('change', e=>{
  document.getElementById('customGrid').style.display = (e.target.value === 'custom') ? 'flex' : 'none';
});

genBtn2.addEventListener('click', ()=>{
  if(!sourceImage) return;

  const orient = document.getElementById('orient').value;
  let pageWmm = orient === "portrait" ? 210 : 297;
  let pageHmm = orient === "portrait" ? 297 : 210;
  const pageW = Math.round(MM_TO_PX(pageWmm));
  const pageH = Math.round(MM_TO_PX(pageHmm));

  let rows, cols;
  const preset = document.getElementById('preset').value;
  if(preset !== "custom"){
    [rows, cols] = preset.split("x").map(Number);
  } else {
    rows = parseInt(document.getElementById('rows').value);
    cols = parseInt(document.getElementById('cols').value);
  }

  const tabPx = MM_TO_PX(10);
  const markPx = MM_TO_PX(6);

  const sliceWsrc = sourceImage.naturalWidth / cols;
  const sliceHsrc = sourceImage.naturalHeight / rows;

  let maxSliceW = 0;
  let maxSliceH = 0;
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      const sliceW = (c === cols-1) ? sourceImage.naturalWidth - c*sliceWsrc : sliceWsrc;
      const sliceH = (r === rows-1) ? sourceImage.naturalHeight - r*sliceHsrc : sliceHsrc;
      maxSliceW = Math.max(maxSliceW, sliceW);
      maxSliceH = Math.max(maxSliceH, sliceH);
    }
  }

  const globalScaleX = (pageW - tabPx) / maxSliceW;
  const globalScaleY = (pageH - tabPx) / maxSliceH;
  const globalScale = Math.min(globalScaleX, globalScaleY);

  generatedPages = [];

  for(let r=0; r<rows; r++){
    const sliceH = (r === rows - 1) ? sourceImage.naturalHeight - r * sliceHsrc : sliceHsrc;

    for(let c=0; c<cols; c++){
      const sliceW = (c === cols - 1) ? sourceImage.naturalWidth - c * sliceWsrc : sliceWsrc;

      const canvas = document.createElement('canvas');
      canvas.width = pageW;
      canvas.height = pageH;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle="#fff"; 
      ctx.fillRect(0,0,pageW,pageH);

      const drawW = sliceW * globalScale;
      const drawH = sliceH * globalScale;

      const dx = (pageW - drawW - (c < cols-1 ? tabPx : 0)) / 2;
      const dy = (pageH - drawH - (r < rows-1 ? tabPx : 0)) / 2;

      ctx.drawImage(sourceImage, c*sliceWsrc, r*sliceHsrc, sliceW, sliceH, dx, dy, drawW, drawH);

      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(dx, dy, drawW, drawH);
      ctx.setLineDash([]);

      if(c < cols - 1 && tabPx > 0){
        ctx.fillStyle="#fff"; 
        ctx.fillRect(dx+drawW, dy, tabPx, drawH);

        ctx.strokeStyle = "#888"; 
        ctx.lineWidth = 1; 
        ctx.setLineDash([4,4]);
        ctx.beginPath();
        ctx.moveTo(dx+drawW, dy);
        ctx.lineTo(dx+drawW, dy+drawH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "#000"; 
        ctx.lineWidth = 1.5;
        ctx.strokeRect(dx+drawW, dy, tabPx, drawH);

        ctx.setLineDash([5,3]);
        ctx.beginPath(); ctx.moveTo(dx+drawW,dy); ctx.lineTo(dx+drawW,dy+drawH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.save();
        ctx.translate(dx+drawW+tabPx/2, dy+drawH/2);
        ctx.rotate(-Math.PI/2);
        ctx.fillStyle="#000"; ctx.font="bold 18px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("COLE AQUI",0,0);
        ctx.restore();
      }

      if(r < rows - 1 && tabPx > 0){
        ctx.fillStyle="#fff"; 
        ctx.fillRect(dx, dy+drawH, drawW, tabPx);

        ctx.strokeStyle = "#888"; 
        ctx.lineWidth = 1; 
        ctx.setLineDash([4,4]);
        ctx.beginPath();
        ctx.moveTo(dx, dy+drawH);
        ctx.lineTo(dx+drawW, dy+drawH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "#000"; 
        ctx.lineWidth = 1.5;
        ctx.strokeRect(dx, dy+drawH, drawW, tabPx);

        ctx.setLineDash([5,3]);
        ctx.beginPath(); ctx.moveTo(dx,dy+drawH); ctx.lineTo(dx+drawW,dy+drawH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle="#000"; ctx.font="bold 18px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("COLE AQUI", dx+drawW/2, dy+drawH+tabPx/2);
      }

      ctx.strokeStyle="#000"; ctx.lineWidth=1.2; ctx.beginPath();
      ctx.moveTo(dx-markPx,dy); ctx.lineTo(dx,dy);
      ctx.moveTo(dx,dy-markPx); ctx.lineTo(dx,dy);
      ctx.moveTo(dx+drawW+markPx,dy); ctx.lineTo(dx+drawW,dy);
      ctx.moveTo(dx+drawW,dy-markPx); ctx.lineTo(dx+drawW,dy);
      ctx.moveTo(dx-markPx,dy+drawH); ctx.lineTo(dx,dy+drawH);
      ctx.moveTo(dx,dy+drawH+markPx); ctx.lineTo(dx,dy+drawH);
      ctx.moveTo(dx+drawW+markPx,dy+drawH); ctx.lineTo(dx+drawW,dy+drawH);
      ctx.moveTo(dx+drawW,dy+drawH+markPx); ctx.lineTo(dx+drawW,dy+drawH);
      ctx.stroke();

      generatedPages.push({canvas,pageWmm,pageHmm, row: r, col: c});
    }
  }

  generatedPages.sort((a,b)=> a.row - b.row || a.col - b.col);

  genBtn2.style.display = 'none';
  printBtn2.style.display = 'inline-block';
  downloadBtn2.style.display = 'inline-block';
});

function generatePDF(){
  if(generatedPages.length === 0) return null;
  const w = generatedPages[0].pageWmm;
  const h = generatedPages[0].pageHmm;
  const pdf = new jsPDF({orientation: w>h?"landscape":"portrait", unit:"mm", format:[w,h]});
  generatedPages.forEach((pg,i)=>{
    const img = pg.canvas.toDataURL("image/jpeg",1.0);
    if(i>0) pdf.addPage([pg.pageWmm,pg.pageHmm], w>h?"landscape":"portrait");
    pdf.addImage(img,"JPEG",0,0,pg.pageWmm,pg.pageHmm);
  });
  return pdf;
}

printBtn2.addEventListener('click', ()=>{
  const pdf = generatePDF();
  if(pdf){
    pdf.autoPrint();
    window.open(pdf.output("bloburl"),"_blank");
  }
});

downloadBtn2.addEventListener('click', async ()=>{
  const pdf = generatePDF();
  if(!pdf) return;

  const blob = pdf.output("blob");
  const file = new File([blob], "painel.pdf", {type:"application/pdf"});

  if(navigator.canShare && navigator.canShare({files:[file]})){
    try { await navigator.share({files:[file], title:"Painel PDF"}); }
    catch(e){ console.log(e); }
  } else {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(link.href);
  }
});