(() => {
  const wheelCanvas = document.getElementById('wheel');
  const spinBtn = document.getElementById('spinBtn');
  const muteBtn = document.getElementById('muteBtn');
  const tncBtn = document.getElementById('tncBtn');
  const tncModal = document.getElementById('tncModal');
  const closeTnc = document.getElementById('closeTnc');
  const resultCard = document.getElementById('resultCard');
  const resultBadge = document.getElementById('resultBadge');
  const resultTitle = document.getElementById('resultTitle');
  const resultSub = document.getElementById('resultSub');
  const shareNote = document.getElementById('shareNote');
  const confettiCanvas = document.getElementById('confettiCanvas');
  const pointerEl = document.querySelector('.pointer');
  const resultImg = document.getElementById('resultImg');

  const gifts = [
    { id: 'gift_a', name: 'Rechargeable Karaoke Mic with Speaker', image: '/static/img/gifta.png', short: 'Karaoke Mic' },
    { id: 'gift_b', name: 'Polycarbonate Spinner Comet Cabin Trolley Bag', image: '/static/img/giftb.png', short: 'Cabin Trolley' },
    { id: 'gift_c', name: 'Luminary Smart Watch', image: '/static/img/giftc.png', short: 'Smart Watch' },
    { id: 'gift_d', name: 'Polyester Unisex 15 Inch Laptop Backpack', image: '/static/img/giftd.png', short: 'Backpack' },
  ];

  // Visual wheel: 5 slices (4 gifts + 1 try again) - larger slices for mobile
  const labelOf = (id) => (gifts.find(g => g.id === id)?.short || id);
  const slices = [
    { kind:'gift', id:'gift_a', label: labelOf('gift_a') },
    { kind:'gift', id:'gift_b', label: labelOf('gift_b') },
    { kind:'try', id:'try', label:'Try Again' },
    { kind:'gift', id:'gift_c', label: labelOf('gift_c') },
    { kind:'gift', id:'gift_d', label: labelOf('gift_d') },
  ];

  // Outcome weighting (configurable). Equal to one gift by default.
  const weights = { gift_a:1, gift_b:1, gift_c:1, gift_d:1, try_again:1 };

  const DURATIONS = Array.from({length: 11}, (_,i) => 1.5 + i*0.25); // 1.5..4.0
  let spinning = false;
  let currentAngle = 0; // radians
  let sessionId = cryptoRandomId();
  let muted = false;

  const ctx = wheelCanvas.getContext('2d');
  const confCtx = confettiCanvas.getContext('2d');
  const wheelWrap = document.querySelector('.wheel-wrap');
  const headerEl = document.querySelector('.top');

  // Resize and draw
  function layout() {
    const vw = Math.min(window.innerWidth, 820);
    const vh = Math.min(window.innerHeight, 1024);
    // Reduce wheel size on smaller mobile screens for better layout
    const isMobile = window.innerWidth <= 768;
    const widthFactor = isMobile ? 0.75 : 0.8;
    const heightFactor = isMobile ? 0.48 : 0.6;
    const size = Math.min(Math.floor(vw * widthFactor), Math.floor(vh * heightFactor));
    wheelCanvas.width = size * devicePixelRatio;
    wheelCanvas.height = size * devicePixelRatio;
    wheelCanvas.style.width = `${size}px`;
    wheelCanvas.style.height = `${size}px`;

    drawWheel();
    // confetti canvas
    confettiCanvas.width = window.innerWidth * devicePixelRatio;
    confettiCanvas.height = window.innerHeight * devicePixelRatio;
    confettiCanvas.style.width = `${window.innerWidth}px`;
    confettiCanvas.style.height = `${window.innerHeight}px`;
  }

  window.addEventListener('resize', layout, { passive: true });
  layout();

  function drawWheel() {
    const { width, height } = wheelCanvas;
    const cx = width/2, cy = height/2;
    const radius = Math.min(width, height)/2 - (12*devicePixelRatio);
    const rim = Math.max(8*devicePixelRatio, radius*0.06);
    const hub = radius * 0.22;

    ctx.clearRect(0,0,width,height);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(currentAngle);

    const n = slices.length;
    const arc = (Math.PI * 2) / n;
    // Offset slices so first slice is centered at top (where pointer points)
    const offsetAngle = -(arc/2) - Math.PI/2;
    for (let i=0;i<n;i++){
      const start = i*arc + offsetAngle;
      const end = start + arc;

      // Slice fill with subtle radial gradient for depth
      const [base, light] = sliceColors(i);
      const g = ctx.createRadialGradient(0,0, radius*0.15, 0,0, radius);
      g.addColorStop(0, light);
      g.addColorStop(1, base);
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0, radius - rim*0.5, start, end);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();

      // Separator
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(start)*(radius - rim*0.5), Math.sin(start)*(radius - rim*0.5));
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5*devicePixelRatio;
      ctx.stroke();

      // Label centered inside the slice (between hub and rim)
      ctx.save();
      // Make font size responsive to wheel radius (scales properly on mobile)
      // Larger slices (5 instead of 12) allow for bigger text
      // Increase by 3pt (~4px at 96dpi) on mobile for readability
      const baseFontSize = Math.max(12, radius * 0.042) + 8 + (window.innerWidth <= 768 ? 4 : 0);
      ctx.font = `900 ${baseFontSize}px ui-sans-serif, system-ui, -apple-system`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelRadius = hub + (radius - rim - hub) * 0.55; // interior position
      const sliceAngle = start + arc/2;

      // Position at the slice angle
      const x = Math.cos(sliceAngle) * labelRadius;
      const y = Math.sin(sliceAngle) * labelRadius;
      ctx.translate(x, y);

      // Keep text always horizontal (no rotation)
      // This ensures all text is upright and readable

      // Split text into lines if needed
      const label = slices[i].label;
      const words = label.split(' ');
      let lines = [];
      if (words.length > 1) {
        // Split into two lines
        lines = [words[0], words.slice(1).join(' ')];
      } else {
        lines = [label];
      }

      // Measure text to create background
      // Make line height responsive to font size
      const lineHeight = baseFontSize * 1.2;
      let maxWidth = 0;
      lines.forEach(line => {
        const metrics = ctx.measureText(line);
        if (metrics.width > maxWidth) maxWidth = metrics.width;
      });

      const textHeight = lineHeight * lines.length;
      // Make padding responsive to font size
      const bgPadding = baseFontSize * 0.35;

      // Draw semi-transparent background rectangle behind text
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      const bgY = -(textHeight/2) - bgPadding/2;
      ctx.fillRect(-maxWidth/2 - bgPadding, bgY, maxWidth + bgPadding*2, textHeight + bgPadding);

      // Draw each line of text
      lines.forEach((line, idx) => {
        const yPos = (idx - (lines.length - 1)/2) * lineHeight;

        // Draw text with strong outline for readability
        ctx.strokeStyle = '#1a1a2e';
        // Make stroke width responsive to font size
        ctx.lineWidth = baseFontSize * 0.23;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(line, 0, yPos);

        // Fill text with bright color
        ctx.fillStyle = '#fff';
        ctx.fillText(line, 0, yPos);
      });

      ctx.restore();
    }

    // Outer rim (stroke) with vibrant metallic gradient
    const rimGrad = ctx.createRadialGradient(0,0, radius - rim, 0,0, radius);
    rimGrad.addColorStop(0, '#a855f7');
    rimGrad.addColorStop(0.5, '#8338ec');
    rimGrad.addColorStop(1, '#6366f1');
    ctx.beginPath();
    ctx.arc(0,0, radius - rim*0.25, 0, Math.PI*2);
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = rim;
    ctx.stroke();

    // Add bright highlight ring
    ctx.beginPath();
    ctx.arc(0,0, radius - rim*0.35, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = rim * 0.15;
    ctx.stroke();

    // Gloss highlight overlay
    const gloss = ctx.createRadialGradient(-radius*0.25, -radius*0.25, radius*0.05, 0,0, radius);
    gloss.addColorStop(0, 'rgba(255,255,255,0.25)');
    gloss.addColorStop(0.6, 'rgba(255,255,255,0.06)');
    gloss.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.beginPath();
    ctx.arc(0,0, radius - rim*0.6, 0, Math.PI*2);
    ctx.fillStyle = gloss;
    ctx.fill();

    // Center hub cap - vibrant gradient
    const hubGrad = ctx.createRadialGradient(0,0, hub*0.2, 0,0, hub);
    hubGrad.addColorStop(0, '#fff');
    hubGrad.addColorStop(0.5, '#ffbe0b');
    hubGrad.addColorStop(1, '#ff006e');
    ctx.beginPath();
    ctx.arc(0,0, hub, 0, Math.PI*2);
    ctx.fillStyle = hubGrad;
    ctx.fill();

    // Add metallic ring around hub
    ctx.beginPath();
    ctx.arc(0,0, hub, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3*devicePixelRatio;
    ctx.stroke();

    // Decorative inner dot ring - bright colors
    const dots = 12;
    const dotR = hub * 0.72;
    const dotSz = Math.max(3*devicePixelRatio, hub*0.09);
    const dotColors = ['#ff006e', '#8338ec', '#00f5ff', '#06ffa5', '#ffbe0b'];
    for (let i=0;i<dots;i++){
      const a = i * 2*Math.PI/dots;
      ctx.fillStyle = dotColors[i % dotColors.length];
      ctx.beginPath();
      ctx.arc(Math.cos(a)*dotR, Math.sin(a)*dotR, dotSz, 0, Math.PI*2);
      ctx.fill();
    }

    // Small star emblem at the center - bright gold
    ctx.save();
    ctx.rotate(Math.PI/10);
    ctx.fillStyle = '#fff';
    drawStarShape(ctx, hub*0.45);
    ctx.restore();

    ctx.restore();
  }

  function sliceColors(i){
    const palette = [
      '#ff006e','#8338ec','#3a86ff','#06ffa5','#ffbe0b','#ff006e',
      '#fb5607','#a855f7','#00d2ff','#00f5ff','#ff4d6d','#4cc9f0'
    ];
    const base = palette[i % palette.length];
    return [shade(base, -15), shade(base, 25)];
  }

  function drawStarShape(ctx, r){
    ctx.beginPath();
    for (let i=0;i<5;i++){
      const a = i * 2*Math.PI/5 - Math.PI/2;
      const x = Math.cos(a) * r; const y = Math.sin(a) * r;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      const a2 = a + Math.PI/5;
      ctx.lineTo(Math.cos(a2)*r*0.45, Math.sin(a2)*r*0.45);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Simple shade util (mix with white/black)
  function shade(hex, amt){
    const c = hex.replace('#','');
    const num = parseInt(c,16);
    let r = (num >> 16) + amt;
    let g = (num >> 8 & 0x00FF) + amt;
    let b = (num & 0x0000FF) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function cryptoRandomId() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    const arr = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return [...arr].map(b=>b.toString(16).padStart(2,"0")).join('');
  }

  // Sound Manager: uses local audio files only (no synth fallback)
  const SoundManager = (() => {
    const base = '/static/audio/';
    const mk = (name) => { const a = new Audio(); a.src = base + name; a.preload = 'auto'; return a; };
    const files = { tick: mk('tick.mp3'), spin: mk('spin_loop.mp3'), win: mk('win.mp3'), stop: mk('stop.mp3'), lose: mk('lose.mp3') };
    let spinning=false;
    function playTick(){ if(muted) return; if(files.tick && files.tick.duration>0){ const c=files.tick.cloneNode(); c.playbackRate = 0.9; c.play().catch(()=>{}); } }
    function playSpinLoop(){ if(muted) return; if(files.spin && files.spin.duration>=0){ files.spin.loop=true; files.spin.playbackRate = 0.75; files.spin.currentTime=0; files.spin.play().catch(()=>{}); spinning=true; } }
    function stopSpinLoop(){ if(spinning){ files.spin.pause(); files.spin.currentTime=0; spinning=false; } }
    function playWin(){ if(muted) return; if(files.win && files.win.duration>0){ const c=files.win.cloneNode(); c.playbackRate = 0.95; c.play().catch(()=>{}); } }
    function playStop(){ if(muted) return; if(files.stop && files.stop.duration>0){ const c=files.stop.cloneNode(); c.playbackRate = 0.95; c.play().catch(()=>{}); } }
    function playLose(){ if(muted) return; if(files.lose && files.lose.duration>0){ const c=files.lose.cloneNode(); c.playbackRate = 0.95; c.play().catch(()=>{}); } }
    return { playTick, playSpinLoop, stopSpinLoop, playWin, playStop, playLose };
  })();

  // Confetti (larger, varied shapes + emojis) - SUPER VIBRANT!
  function launchConfetti(ms=2200){
    const DPI = devicePixelRatio || 1;
    const W = confettiCanvas.width, H = confettiCanvas.height;
    const colors = ['#ff006e','#8338ec','#3a86ff','#06ffa5','#ffbe0b','#fb5607','#a855f7','#00f5ff','#ff4d6d','#4cc9f0','#ff006e','#00d2ff'];
    const emojis = ['🎉','✨','⭐','🎊','💥','🌟','💫','🔥'];
    const particles = [];
    const count = 280;
    for (let i=0;i<count;i++){
      const typeRand = Math.random();
      let type = 'rect';
      if (typeRand < 0.15) type = 'circle'; else if (typeRand < 0.3) type = 'tri'; else if (typeRand < 0.4) type = 'star'; else if (typeRand < 0.5) type='emoji';
      const size = 6 + Math.random()*12;
      particles.push({ t:type, x:Math.random()*W, y:-20, s:size, c:colors[i%colors.length], e:emojis[i%emojis.length],
        vx:(-1+Math.random()*2)*(0.8+Math.random()*0.6)*DPI, vy:(1.2+Math.random()*1.8)*DPI, rot:Math.random()*Math.PI*2, vr:(-1+Math.random()*2)*0.2 });
    }
    const start = performance.now();
    function drawStar(ctx, r){ ctx.beginPath(); for (let i=0;i<5;i++){ const a=i*2*Math.PI/5 - Math.PI/2; const x=Math.cos(a)*r; const y=Math.sin(a)*r; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); const a2=a+Math.PI/5; ctx.lineTo(Math.cos(a2)*r*0.5, Math.sin(a2)*r*0.5);} ctx.closePath(); ctx.fill(); }
    function tick(now){
      const t = now - start; confCtx.clearRect(0,0,W,H);
      for (const p of particles){ p.vy += 0.02*DPI; p.x += p.vx; p.y += p.vy; p.rot += p.vr; confCtx.save(); confCtx.translate(p.x, p.y); confCtx.rotate(p.rot);
        if (p.t==='rect'){ confCtx.fillStyle=p.c; confCtx.fillRect(-p.s/2,-p.s/2,p.s*1.2,p.s*0.7); }
        else if (p.t==='circle'){ confCtx.fillStyle=p.c; confCtx.beginPath(); confCtx.arc(0,0,p.s/2,0,Math.PI*2); confCtx.fill(); }
        else if (p.t==='tri'){ confCtx.fillStyle=p.c; confCtx.beginPath(); confCtx.moveTo(-p.s/2,p.s/2); confCtx.lineTo(p.s/2,p.s/2); confCtx.lineTo(0,-p.s/2); confCtx.closePath(); confCtx.fill(); }
        else if (p.t==='star'){ confCtx.fillStyle=p.c; drawStar(confCtx, p.s/2); }
        else if (p.t==='emoji'){ confCtx.font = `${p.s*1.1}px system-ui, Apple Color Emoji, Segoe UI Emoji`; confCtx.fillText(p.e, -p.s/2, p.s/2); }
        confCtx.restore(); }
      if (t < ms){ requestAnimationFrame(tick); } else { confCtx.clearRect(0,0,W,H); }
    }
    requestAnimationFrame(tick);
  }

  // Spin mechanics
  function pickOutcome(){
    // Weighted: 4 gifts equal; try_again equals one gift by default
    const entries = [
      ...gifts.map(g => ({ key:g.id, w:weights[g.id] ?? 1 })),
      { key:'try_again', w: weights['try_again'] ?? 1 }
    ];
    const total = entries.reduce((s,e)=>s+(e.w>0?e.w:0),0);
    let r = Math.random()*total;
    for (const e of entries){
      if (r < e.w) return e.key;
      r -= e.w;
    }
    return 'try_again';
  }

  function findTargetSliceIndex(outcome){
    if (outcome === 'try_again'){
      const ids = slices.map((s,i)=> s.kind==='try' ? i : -1).filter(i=>i>=0);
      return ids[Math.floor(Math.random()*ids.length)];
    }
    const ids = slices.map((s,i)=> (s.kind==='gift' && s.id===outcome) ? i : -1).filter(i=>i>=0);
    return ids[Math.floor(Math.random()*ids.length)];
  }

  function easeInOutCubic(x){ return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3)/2; }

  function spinOnce(){
    if (spinning) return;
    spinning = true; spinBtn.disabled = true;

    const duration = DURATIONS[Math.floor(Math.random()*DURATIONS.length)];
    const outcomeKey = pickOutcome();
    const resultType = (outcomeKey === 'try_again') ? 'try_again' : 'gift';

    const n = slices.length;
    const arc = (Math.PI*2)/n;
    const offsetAngle = -(arc/2) - Math.PI/2; // Same offset used in drawing
    const targetIndex = findTargetSliceIndex(outcomeKey);

    // Since slices are offset so slice 0 is at top when currentAngle=0,
    // to get slice i at top, we rotate by -i*arc (rotating counter-clockwise)
    const targetAngle = -targetIndex * arc;

    // Normalize target angle to 0-2π range
    const targetModulo = ((targetAngle % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI);

    // Add minimum 3 full spins, then calculate final position
    const minFullSpins = 3;
    const minTotalRotation = currentAngle + minFullSpins * (2*Math.PI);

    // Find how many full rotations to add to reach the target
    const k = Math.ceil((minTotalRotation - targetModulo) / (2*Math.PI));
    const endAngle = targetModulo + k * (2*Math.PI);

    // animate
    const startAngle = currentAngle;
    const start = performance.now();
    const totalMs = duration * 1000;
    let lastPointer = normAngle(-currentAngle - offsetAngle);

    const tick = (now) => {
      const t = Math.min(1, (now - start)/totalMs);
      const eased = easeInOutCubic(t);
      const a = startAngle + (endAngle - startAngle)*eased;
      currentAngle = a;
      drawWheel();

      // tick sound at boundary crossings
      // Account for the offset angle used in drawing
      const pointer = normAngle(-a - offsetAngle);
      if (!muted){
        if (crossed(lastPointer, pointer, arc)){
          SoundManager.playTick();
          if (pointerEl){
            pointerEl.classList.remove('tick');
            pointerEl.offsetHeight; // reflow
            pointerEl.classList.add('tick');
          }
        }
      }
      lastPointer = pointer;

      if (t < 1){
        requestAnimationFrame(tick);
      } else {
        onSpinEnd(resultType, outcomeKey, duration);
      }
    };
    // start spin sound
    SoundManager.playSpinLoop();
    // add spinning shadow class
    wheelCanvas.classList.add('spin-shadow');
    if (headerEl) headerEl.classList.add('spin-flash');
    requestAnimationFrame(tick);
  }

  function normAngle(a){
    const TAU = Math.PI*2;
    return (a % TAU + TAU) % TAU;
  }

  function crossed(prev, curr, step){
    // did pointer angle cross a multiple of 'step' moving forward?
    if (curr < prev) curr += Math.PI*2;
    const prevIndex = Math.floor(prev / step);
    const currIndex = Math.floor(curr / step);
    return currIndex > prevIndex;
  }

  function onSpinEnd(resultType, outcomeKey, duration){
    // settle
    currentAngle = normAngle(currentAngle);
    drawWheel();

    // stop loop and play stop
    SoundManager.stopSpinLoop();
    SoundManager.playStop();
    wheelCanvas.classList.remove('spin-shadow');
    if (headerEl) headerEl.classList.remove('spin-flash');

    if (resultType === 'gift'){
      const gift = gifts.find(g => g.id === outcomeKey);
      resultBadge.classList.remove('hidden');
      resultBadge.style.borderColor = '#0ac97a';
      resultTitle.textContent = `You won: ${gift?.name || 'a Gift'}!`;
      resultSub.textContent = `Take a screenshot of this screen to claim your prize!`;
      shareNote.classList.remove('hidden');
      if (resultImg && gift?.image){ resultImg.src = gift.image; resultImg.alt = gift.name; }
      SoundManager.playWin();
      launchConfetti(2400);
    } else {
      resultBadge.classList.add('hidden');
      resultTitle.textContent = 'Try Again! Spin once more for your chance to WIN!';
      resultSub.textContent = '';
      shareNote.classList.add('hidden');
      if (resultImg){ resultImg.removeAttribute('src'); resultImg.alt = ''; }
      SoundManager.playLose();
    }
    resultCard.classList.remove('hidden');

    // Log to server (anonymous)
    const payload = {
      result_type: (resultType === 'gift') ? 'gift' : 'try_again',
      result_label: (resultType === 'gift') ? (gifts.find(g => g.id===outcomeKey)?.name || outcomeKey) : 'Try Again',
      spin_duration_sec: duration,
      session_id: sessionId,
    };
    fetch('/api/log-spin', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    }).catch(()=>{});

    setTimeout(()=>{
      spinning = false;
      spinBtn.disabled = false;
    }, 200);
  }

  // Events
  spinBtn.addEventListener('click', spinOnce);
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });
  tncBtn.addEventListener('click', ()=> tncModal.showModal());
  closeTnc.addEventListener('click', ()=> tncModal.close());
  tncModal.addEventListener('click', (e) => { if (e.target === tncModal) tncModal.close(); });

  // Initial result card
  (function initCard(){
    resultTitle.textContent = 'Ready to play? Tap SPIN to begin.';
    resultSub.textContent = '';
    shareNote.classList.add('hidden');
    resultBadge.classList.add('hidden');
  })();
})();
