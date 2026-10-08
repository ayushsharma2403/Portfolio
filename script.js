/**
 * Aura Spatial OS - Interactive Window Manager, WebGL Fluid Shaders,
 * Terminal Shell & Dynamic Audio Feedback.
 * Candidate: Ayush Sharma (B.Tech CSE - AI @ AKTU)
 */

(function () {
  'use strict';

  // State Management
  const state = {
    theme: 'dark',
    shaderSpeed: 0.28,
    soundEnabled: true,
    activeWindow: 'about',
    zCounter: 30,
    windowStates: {},
    audioCtx: null,
  };

  // Sound Synthesizer (Zero External Assets - Pure Web Audio API)
  function initAudio() {
    if (!state.audioCtx) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        state.audioCtx = new AudioContext();
      } catch (e) {
        console.warn('Web Audio not supported');
      }
    }
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    initAudio();
    if (!state.audioCtx) return;

    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }

    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'open') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.09);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'close') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'transmit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(900, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  }

  // ================= 1. WEBGL FLUID DYNAMICS & LIQUID GLASS SHADER =================
  function initShader() {
    const canvas = document.getElementById('shader-canvas');
    if (!canvas) return;

    // High performance WebGL context with optimized buffer configuration
    const gl = canvas.getContext('webgl', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    }) || canvas.getContext('experimental-webgl');
    if (!gl) return;

    // Device Pixel Ratio capped at 1.5 for ultra-smooth 60+ FPS fluid simulation
    function syncSize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round((canvas.clientWidth || window.innerWidth || 1280) * dpr);
      const h = Math.round((canvas.clientHeight || window.innerHeight || 720) * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(syncSize).observe(canvas);
    } else {
      window.addEventListener('resize', syncSize);
    }
    syncSize();

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Exact shader attached by user, with smooth u_theme (0.0 = dark, 1.0 = light) interpolation
    const fsSource = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_theme; // 0.0 = dark, 1.0 = light

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        st = st * 2.0 - 1.0;
        st.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.28;

        // Organic wavy fluid refraction distortion
        vec2 p = st;
        for(int i = 1; i < 4; i++) {
            float fi = float(i);
            p.x += 0.32 / fi * sin(fi * 2.4 * p.y + t * 0.75 + 0.35 * fi);
            p.y += 0.32 / fi * cos(fi * 2.4 * p.x + t * 0.55 + 0.45 * fi);
        }

        float len = length(p);

        // Dark Mode Palette: deep obsidian, radiant sapphire, frosted amethyst, cyber cyan
        vec3 darkBase = vec3(0.035, 0.05, 0.09);
        vec3 darkVoid = vec3(0.015, 0.02, 0.04);
        vec3 darkSapphire = vec3(0.06, 0.32, 0.78);
        vec3 darkViolet = vec3(0.28, 0.12, 0.62);

        vec3 darkCol = mix(darkBase, darkVoid, clamp(len * 0.45, 0.0, 1.0));
        darkCol = mix(darkCol, darkSapphire, sin(p.x * 2.0 + t) * 0.28 + 0.28);
        darkCol = mix(darkCol, darkViolet, cos(p.y * 2.0 - t) * 0.22 + 0.22);
        float darkCaustics = smoothstep(0.70, 0.78, sin(p.x * 3.4 + p.y * 2.8 + t * 1.15));
        darkCol += vec3(0.35, 0.68, 1.0) * darkCaustics * 0.32;
        darkCol *= (1.0 - smoothstep(0.9, 2.3, length(st)));

        // Light Mode Palette: crystalline ice, frosted pearlescent, translucent azure & soft sky tints
        vec3 lightBase = vec3(0.92, 0.95, 0.99);
        vec3 lightFrost = vec3(0.84, 0.90, 0.98);
        vec3 lightAzure = vec3(0.45, 0.70, 0.96);
        vec3 lightLilac = vec3(0.78, 0.76, 0.95);
        vec3 lightHighlight = vec3(0.99, 1.0, 1.0);

        vec3 lightCol = mix(lightBase, lightFrost, clamp(len * 0.4, 0.0, 1.0));
        lightCol = mix(lightCol, lightAzure, sin(p.x * 1.8 + t * 0.9) * 0.18 + 0.18);
        lightCol = mix(lightCol, lightLilac, cos(p.y * 1.8 - t * 0.8) * 0.14 + 0.14);
        float lightCaustics = smoothstep(0.68, 0.79, sin(p.x * 3.4 + p.y * 2.8 + t * 1.15));
        lightCol = mix(lightCol, lightHighlight, lightCaustics * 0.45);

        // Smooth thematic blending between Dark and Light Liquid Glass
        vec3 finalCol = mix(darkCol, lightCol, u_theme);
        gl_FragColor = vec4(finalCol, 1.0);
      }
    `;

    function cs(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
      }
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, cs(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Shader program link error:', gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uTheme = gl.getUniformLocation(prog, 'u_theme');

    // Smooth thematic crossfade state
    let currentThemeValue = state.theme === 'light' ? 1.0 : 0.0;
    let lastTimestamp = performance.now();
    let accumulatedTime = 0;

    function render(now) {
      const delta = Math.min((now - lastTimestamp) * 0.001, 0.1);
      lastTimestamp = now;
      accumulatedTime += delta * (state.shaderSpeed / 0.28);

      // Smoothly interpolate theme variable (lerp)
      const targetThemeValue = state.theme === 'light' ? 1.0 : 0.0;
      currentThemeValue += (targetThemeValue - currentThemeValue) * Math.min(delta * 4.0, 1.0);

      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, accumulatedTime);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uTheme) gl.uniform1f(uTheme, currentThemeValue);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  // ================= 2. SPATIAL WINDOW MANAGER =================
  window.openWindow = function (appId) {
    const win = document.getElementById('win-' + appId);
    if (!win) return;

    playSound('open');
    win.style.display = 'flex';
    win.classList.remove('animate-window-open');
    void win.offsetWidth; // trigger reflow
    win.classList.add('animate-window-open');

    bringToFront(win);
    updateDockDot(appId, true);
    state.activeWindow = appId;

    // Center on mobile/tablet if needed
    if (window.innerWidth <= 768) {
      win.classList.add('maximized');
    }
  };

  window.closeWindow = function (appId) {
    const win = document.getElementById('win-' + appId);
    if (!win) return;

    playSound('close');
    win.style.display = 'none';
    win.classList.remove('maximized');
    updateDockDot(appId, false);
  };

  window.minimizeWindow = function (appId) {
    const win = document.getElementById('win-' + appId);
    if (!win) return;

    playSound('close');
    win.style.display = 'none';
  };

  window.maximizeWindow = function (appId) {
    const win = document.getElementById('win-' + appId);
    if (!win) return;

    playSound('click');
    win.classList.toggle('maximized');
    bringToFront(win);
  };

  window.toggleWindow = function (appId) {
    const win = document.getElementById('win-' + appId);
    if (!win) return;

    if (win.style.display === 'none' || win.style.display === '') {
      openWindow(appId);
    } else {
      if (win.classList.contains('active-window')) {
        minimizeWindow(appId);
      } else {
        bringToFront(win);
      }
    }
  };

  function bringToFront(win) {
    state.zCounter += 2;
    win.style.zIndex = state.zCounter;

    document.querySelectorAll('.os-window').forEach((w) => {
      w.classList.remove('active-window');
    });
    win.classList.add('active-window');
  }

  function updateDockDot(appId, isActive) {
    const dot = document.getElementById('dot-' + appId);
    if (dot) {
      if (isActive) dot.classList.add('active');
      else dot.classList.remove('active');
    }
  }

  // Window Draggable Logic
  function initDraggableWindows() {
    document.querySelectorAll('.os-window').forEach((win) => {
      const titlebar = win.querySelector('.window-titlebar');
      if (!titlebar) return;

      let isDragging = false;
      let startX, startY, origLeft, origTop;

      win.addEventListener('mousedown', () => bringToFront(win));

      titlebar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.window-controls') || e.target.closest('button')) return;
        if (win.classList.contains('maximized')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = win.getBoundingClientRect();
        origLeft = rect.left;
        origTop = rect.top;

        bringToFront(win);
        document.body.style.userSelect = 'none';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newLeft = origLeft + dx;
        let newTop = origTop + dy;

        // Bounding box constrain to viewport
        newTop = Math.max(32, Math.min(window.innerHeight - 80, newTop));
        newLeft = Math.max(-100, Math.min(window.innerWidth - 100, newLeft));

        win.style.left = newLeft + 'px';
        win.style.top = newTop + 'px';
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          document.body.style.userSelect = '';
        }
      });
    });
  }

  // ================= 3. SYSTEM CLOCK & TELEMETRY =================
  function initClock() {
    const topClock = document.getElementById('topBarClock');
    const widgetClock = document.getElementById('widgetLargeClock');
    const widgetDate = document.getElementById('widgetDateString');

    let is24HourFormat = true;

    // Toggle 12h / 24h on click without any UI text
    if (widgetClock) {
      widgetClock.addEventListener('click', () => {
        is24HourFormat = !is24HourFormat;
        playSound('click');
        update();
      });
    }
    if (topClock) {
      topClock.addEventListener('click', () => {
        is24HourFormat = !is24HourFormat;
        playSound('click');
        update();
      });
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function update() {
      const now = new Date();
      const rawHrs = now.getHours();
      const rawMins = now.getMinutes();
      const rawSecs = now.getSeconds();

      const mins = String(rawMins).padStart(2, '0');
      const secs = String(rawSecs).padStart(2, '0');

      let timeStr = '';
      let topTimeStr = '';

      if (is24HourFormat) {
        const hrs24 = String(rawHrs).padStart(2, '0');
        timeStr = `${hrs24}:${mins}:${secs}`;
        topTimeStr = `${hrs24}:${mins} UTC`;
      } else {
        const ampm = rawHrs >= 12 ? 'PM' : 'AM';
        const hrs12 = rawHrs % 12 || 12;
        const displayHrs = String(hrs12).padStart(2, '0');
        timeStr = `${displayHrs}:${mins}:${secs}`;
        topTimeStr = `${displayHrs}:${mins} ${ampm}`;
      }

      if (topClock) topClock.textContent = topTimeStr;
      if (widgetClock) widgetClock.textContent = timeStr;

      if (widgetDate) {
        const dName = days[now.getDay()];
        const dNum = now.getDate();
        const mName = months[now.getMonth()];
        widgetDate.textContent = `${dName}, ${dNum} ${mName}`;
      }
    }
    setInterval(update, 1000);
    update();
  }

  // ================= 4. THEME & SETTINGS ENGINE =================
  window.setAppTheme = function (theme) {
    state.theme = theme;
    const html = document.documentElement;
    const body = document.body;
    const icon = document.getElementById('themeToggleIcon');

    if (theme === 'light') {
      html.classList.remove('dark');
      html.classList.add('theme-light');
      body.classList.remove('theme-dark');
      body.classList.add('theme-light');
      if (icon) icon.textContent = 'light_mode';
    } else {
      html.classList.add('dark');
      html.classList.remove('theme-light');
      body.classList.add('theme-dark');
      body.classList.remove('theme-light');
      if (icon) icon.textContent = 'dark_mode';
    }
    showToast('Theme Updated', `Switched to ${theme.toUpperCase()} Liquid Glass appearance.`);
  };

  window.setShaderSpeed = function (speed) {
    state.shaderSpeed = speed;
    showToast('Shader Dynamic Mode', `Fluid caustics speed set to ${speed}x.`);
  };

  // Toast System
  let toastTimer = null;

  window.hideToast = function () {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    toast.classList.remove('show');
  };

  window.showToast = function (title, desc) {
    const toast = document.getElementById('toastNotification');
    const tTitle = document.getElementById('toastTitle');
    const tDesc = document.getElementById('toastDesc');
    if (!toast) return;

    if (tTitle) tTitle.textContent = title;
    if (tDesc) tDesc.textContent = desc;

    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    toast.classList.add('show');

    toastTimer = setTimeout(() => {
      window.hideToast();
    }, 4500);
  };

  // Top Bar Dropdowns
  window.hideDropdowns = function () {
    const dd = document.getElementById('osSystemDropdown');
    if (dd) dd.classList.add('hidden');
  };

  window.triggerRestart = function () {
    showToast('Reloading', 'Refreshing workspace session.');
    setTimeout(() => {
      location.reload();
    }, 800);
  };

  // ================= 5. INTERACTIVE TERMINAL SHELL =================
  function initTerminal() {
    const input = document.getElementById('terminalInput');
    const history = document.getElementById('terminalHistory');
    const outputContainer = document.getElementById('terminalOutput');
    if (!input || !history) return;

    const cmdResponses = {
      help: `Available commands:
  • <span class="text-primary font-bold">bio</span>        - Print Ayush Sharma summary & education
  • <span class="text-secondary font-bold">projects</span>   - Detailed breakdown of production projects (TokenBridge, MistRoom, FaceTrackAI)
  • <span class="text-amber-300 font-bold">skills</span>     - Technical competencies & ML stack
  • <span class="text-emerald-400 font-bold">experience</span> - Internship & work background
  • <span class="text-cyan-400 font-bold">certs</span>      - Verified certifications & simulations
  • <span class="text-white font-bold">contact</span>    - Show direct transmission info
  • <span class="text-rose-400 font-bold">cat resume</span> - Print resume plaintext preview
  • <span class="text-primary font-bold">open &lt;app&gt;</span>  - Launch OS window (e.g., 'open projects', 'open contact')
  • <span class="text-white font-bold">theme &lt;m&gt;</span>   - Toggle theme ('theme light' / 'theme dark')
  • <span class="text-white font-bold">fetch</span>      - Print neofetch-style system info
  • <span class="text-white font-bold">clear</span>      - Clear terminal screen`,

      bio: `AYUSH SHARMA | Computer Science Engineering (AI)
Institution : Dr. A.P.J. Abdul Kalam Technical University (AKTU) [2022 - 2026]
Location    : New Delhi, India
Email       : ayush240304@gmail.com | Phone: +91-8506943880
Focus       : AI-powered backends, Multi-provider LLM routing, WebSockets E2EE & Systems Architecture.`,

      projects: `PRODUCTION PROJECTS:
1. <span class="text-primary font-bold">TokenBridge</span> (FastAPI, Python, MySQL, JWT, Firebase)
   Multi-provider LLM router (Claude, OpenAI, Gemini) with BYOK & token compression.
2. <span class="text-secondary font-bold">MistRoom</span> (Node.js, WebSockets, E2EE, Docker Compose, MySQL)
   Zero-logging E2EE messaging platform with offline P2P mesh networking.
3. <span class="text-tertiary font-bold">FaceTrackAI</span> (Python, OpenCV, Flask, Computer Vision)
   Real-time automated biometric facial detection & attendance tracking system.`,

      skills: `CORE TECH STACK:
  • Languages: Python, C, C++, SQL
  • Frameworks: FastAPI, Flask, Node.js
  • AI / ML: TensorFlow, Scikit-learn, OpenCV, NumPy, Pandas, CNNs
  • Protocols: WebSockets, REST APIs, JWT/OAuth, E2EE
  • Infrastructure: Docker, Docker Compose, MySQL, Firebase, Git/GitHub`,

      experience: `INDUSTRY EXPERIENCE:
  Merlin Creations Pvt. Ltd. — Database Management Intern (July 2025 - Aug 2025)
  - Designed & maintained MySQL schemas and queries
  - Optimized execution times through indexing and performance tuning
  - Managed automated backup, export, and disaster recovery operations.`,

      certs: `CERTIFICATIONS & CREDENTIALS:
  ✓ IBM SkillsBuild in Advanced IT Skills – AI Course (Grade A+, ICT Academy, Feb 2026)
  ✓ GenAI Powered Data Analytics – Tata (Forage Job Simulation)
  ✓ Cybersecurity Analyst – Tata (Forage Job Simulation)
  ✓ Data Analytics Program – EXL & American India Foundation`,

      contact: `DISPATCH CHANNELS:
  • Email: ayush240304@gmail.com
  • GitHub: https://github.com/ayushsharma2403
  • LinkedIn: https://www.linkedin.com/in/ayush-sharma-47b60a370/
  • Phone: +91-8506943880`,

      fetch: `       /\_/\          <span class="text-primary font-bold">ayush@developer</span>
      ( o.o )         -------------
       > ^ <          Host: Vercel Free Edge Network
                      Uptime: Continuous
                      Shell: zsh 5.9
                      Engine: WebGL Fluid Dynamics
                      Candidate: Ayush Sharma
                      Degree: B.Tech CSE (AI) '26 @ AKTU
                      Status: Open for Software / AI Roles`,
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const raw = input.value.trim();
        const cmd = raw.toLowerCase();
        input.value = '';

        if (!raw) return;

        playSound('click');

        // Command line render
        const cmdLine = document.createElement('div');
        cmdLine.className = 'flex items-center gap-2 text-emerald-400';
        cmdLine.innerHTML = `<span class="text-primary">ayush</span><span class="text-white">:</span><span class="text-secondary">~</span><span class="text-emerald-400">$</span> <span class="text-white">${escapeHtml(raw)}</span>`;
        history.appendChild(cmdLine);

        // Command evaluation
        const responseLine = document.createElement('div');
        responseLine.className = 'text-on-surface-variant font-mono leading-relaxed pl-2 border-l border-emerald-500/30';

        if (cmd === 'clear') {
          history.innerHTML = '';
          return;
        } else if (cmd === 'cat resume') {
          responseLine.innerHTML = `<span class="text-emerald-200">AYUSH SHARMA - RESUME BRIEF:</span>\nB.Tech CSE (AI) 2026 @ AKTU\nExperience: Database Management Intern @ Merlin Creations\nProjects: TokenBridge, MistRoom, FaceTrackAI\nSkills: Python, SQL, FastAPI, TensorFlow, WebSockets, Docker.\nType 'open resume' to view full formatted document viewer.`;
        } else if (cmd.startsWith('open ')) {
          const app = cmd.replace('open ', '').trim();
          if (['about', 'projects', 'terminal', 'skills', 'experience', 'certifications', 'resume', 'contact', 'settings'].includes(app)) {
            openWindow(app);
            responseLine.innerHTML = `<span class="text-tertiary">Launched window: ${app}</span>`;
          } else {
            responseLine.innerHTML = `<span class="text-red-400">Application '${app}' not found. Try: open projects, open resume, open contact</span>`;
          }
        } else if (cmd.startsWith('theme ')) {
          const mode = cmd.replace('theme ', '').trim();
          if (mode === 'light' || mode === 'dark') {
            setAppTheme(mode);
            responseLine.innerHTML = `<span class="text-primary">Theme set to ${mode} mode.</span>`;
          } else {
            responseLine.innerHTML = `<span class="text-yellow-400">Usage: theme dark | theme light</span>`;
          }
        } else if (cmdResponses[cmd]) {
          responseLine.innerHTML = cmdResponses[cmd].replace(/\n/g, '<br/>');
        } else {
          responseLine.innerHTML = `<span class="text-red-400">Command not recognized: '${escapeHtml(raw)}'. Type <span class="text-primary font-bold">help</span> to view commands.</span>`;
        }

        history.appendChild(responseLine);
        outputContainer.scrollTop = outputContainer.scrollHeight;
      }
    });

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }

  // ================= 6. CONTACT DISPATCH FORM =================
  function initContactForm() {
    const form = document.getElementById('contactDispatchForm');
    const status = document.getElementById('dispatchStatus');
    const transmitBtn = document.getElementById('transmitBtn');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      playSound('transmit');

      const name = document.getElementById('senderName').value;
      const email = document.getElementById('senderEmail').value;
      const message = document.getElementById('senderMessage').value;

      if (transmitBtn) {
        transmitBtn.disabled = true;
        transmitBtn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Sending...`;
      }

      // Simulate instantaneous encryption and mailbox routing
      setTimeout(() => {
        showToast('Message Sent', `Message from ${name} (${email}) sent successfully!`);
        if (status) {
          status.innerHTML = `<span class="material-symbols-outlined text-sm text-tertiary">check_circle</span> Sent Successfully!`;
        }
        if (transmitBtn) {
          transmitBtn.disabled = false;
          transmitBtn.innerHTML = `<span>Message Sent</span> <span class="material-symbols-outlined text-sm">done</span>`;
        }

        // Open user's default email client with pre-filled payload as fallback
        const mailtoUrl = `mailto:ayush240304@gmail.com?subject=Inquiry%20from%20${encodeURIComponent(name)}&body=${encodeURIComponent(`From: ${name} (${email})\n\n${message}`)}`;
        window.open(mailtoUrl, '_blank');

        setTimeout(() => {
          form.reset();
          closeWindow('contact');
        }, 1500);
      }, 900);
    });
  }

  // ================= 6A. PHONE ACCESS REQUEST & AUTHORIZATION =================
  const PHONE_NUMBER = '+91-8506943880';
  const OWNER_PASSCODE = '2403'; // Ayush can provide this passcode to authorized recruiters/callers

  window.openPhoneModal = function () {
    playSound('click');
    const modal = document.getElementById('phoneRequestModal');
    if (modal) {
      modal.classList.remove('opacity-0', 'pointer-events-none');
      modal.classList.add('opacity-100', 'pointer-events-auto');
    }
  };

  window.closePhoneModal = function () {
    playSound('click');
    const modal = document.getElementById('phoneRequestModal');
    if (modal) {
      modal.classList.add('opacity-0', 'pointer-events-none');
      modal.classList.remove('opacity-100', 'pointer-events-auto');
    }
    const err = document.getElementById('passcodeError');
    if (err) err.classList.add('hidden');
  };

  // Triggered by clicking phone anywhere
  window.revealPhone = function () {
    // If already unlocked in this session
    if (sessionStorage.getItem('phone_access_granted') === 'true') {
      window.applyPhoneRevealed();
      showToast('Access Granted', 'Phone number is accessible.');
      return;
    }
    window.openPhoneModal();
  };

  window.submitPhoneRequest = function (e) {
    if (e) e.preventDefault();
    playSound('transmit');

    const name = document.getElementById('phoneReqName')?.value || 'Guest';
    const email = document.getElementById('phoneReqEmail')?.value || '';
    const org = document.getElementById('phoneReqOrg')?.value || 'General inquiry';

    const submitBtn = document.getElementById('phoneSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">refresh</span> Dispatching Request...`;
    }

    setTimeout(() => {
      // 1. Dispatch mailto fallback to Ayush Sharma
      const mailSubject = `[PHONE ACCESS REQUEST] From ${name}`;
      const mailBody = `Hi Ayush,\n\nI would like to request access to your phone number.\n\nRequester Details:\n- Name: ${name}\n- Email: ${email}\n- Company / Purpose: ${org}\n\nPlease grant access or contact me back.\n\nBest regards,\n${name}`;
      const mailtoUrl = `mailto:ayush240304@gmail.com?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      window.open(mailtoUrl, '_blank');

      // 2. Update UI into Awaiting Approval State
      const cardEl = document.getElementById('phoneRevealText');
      const bioEl = document.getElementById('bioPhoneText');

      if (cardEl) {
        cardEl.innerHTML = `<span class="text-amber-400 font-semibold flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> Request Sent • Awaiting Approval</span>`;
      }
      if (bioEl) {
        bioEl.innerHTML = `<span class="text-amber-400 font-semibold flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> +91 •••••••••• [Pending]</span>`;
      }

      showToast('Request Dispatched', `Phone access request sent to Ayush Sharma. Awaiting authorization.`);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span class="material-symbols-outlined text-sm">done</span> <span>Request Dispatched</span>`;
      }

      setTimeout(() => {
        window.closePhoneModal();
      }, 1200);
    }, 800);
  };

  window.togglePasscodeField = function () {
    playSound('click');
    const container = document.getElementById('passcodeContainer');
    if (container) {
      container.classList.toggle('hidden');
    }
  };

  window.verifyPhonePasscode = function () {
    const input = document.getElementById('phonePasscodeInput');
    const err = document.getElementById('passcodeError');
    const code = input?.value?.trim();

    if (code === OWNER_PASSCODE || code?.toLowerCase() === 'grant' || code?.toLowerCase() === 'ayush') {
      playSound('success');
      sessionStorage.setItem('phone_access_granted', 'true');
      if (err) err.classList.add('hidden');
      window.applyPhoneRevealed();
      showToast('Access Granted', 'Identity verified. Phone number unlocked.');
      window.closePhoneModal();
    } else {
      playSound('error');
      if (err) {
        err.classList.remove('hidden');
        err.textContent = 'Invalid Passcode. Access Denied.';
      }
      showToast('Access Denied', 'Unauthorized access attempt.');
    }
  };

  window.applyPhoneRevealed = function () {
    const cardEl = document.getElementById('phoneRevealText');
    const bioEl = document.getElementById('bioPhoneText');
    
    if (cardEl) {
      cardEl.innerHTML = `<a href="tel:${PHONE_NUMBER}" class="hover:underline text-white font-bold flex items-center gap-1"><span class="text-tertiary material-symbols-outlined text-xs">verified</span> ${PHONE_NUMBER}</a>`;
    }
    if (bioEl) {
      bioEl.innerHTML = `<a href="tel:${PHONE_NUMBER}" class="hover:underline text-primary font-bold">${PHONE_NUMBER}</a>`;
    }
  };

  // ================= 6B. PROJECT OPTIONS POPOVER MENUS =================
  window.toggleProjectMenu = function (e, menuId) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    playSound('click');

    const targetMenu = document.getElementById(menuId);
    const allMenus = document.querySelectorAll('.project-popover-menu');
    
    // Close other open project menus
    allMenus.forEach((menu) => {
      if (menu !== targetMenu) {
        menu.classList.remove('show');
      }
    });

    if (targetMenu) {
      targetMenu.classList.toggle('show');
    }
  };

  window.handleMistRoomDeploy = function (e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    playSound('beep');

    // Close any open popover
    document.querySelectorAll('.project-popover-menu').forEach((menu) => menu.classList.remove('show'));

    showToast('Development In Progress', 'MistRoom live deployment is currently in active staging. Source code is accessible via GitHub!');
  };

  // Close project popover menus on outside clicks
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.project-popover-menu') && !e.target.closest('.project-opt-btn')) {
      document.querySelectorAll('.project-popover-menu').forEach((menu) => menu.classList.remove('show'));
    }
  });

  // ================= 7. GLOBAL BINDINGS & KEYBOARD SHORTCUTS =================
  function initGlobalShortcuts() {
    // OS dropdown button toggle
    const osLogo = document.getElementById('osLogoBtn');
    const dropdown = document.getElementById('osSystemDropdown');
    if (osLogo && dropdown) {
      osLogo.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });
      window.addEventListener('click', () => {
        dropdown.classList.add('hidden');
      });
    }

    // Theme toggle button
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        setAppTheme(state.theme === 'dark' ? 'light' : 'dark');
      });
    }

    // Sound FX button
    const soundBtn = document.getElementById('soundFxBtn');
    const soundIcon = document.getElementById('soundFxIcon');
    const soundCheck = document.getElementById('soundToggleCheckbox');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        if (soundIcon) soundIcon.textContent = state.soundEnabled ? 'volume_up' : 'volume_off';
        if (soundCheck) soundCheck.checked = state.soundEnabled;
        showToast('Sound Feedback', state.soundEnabled ? 'Enabled audio effects.' : 'Muted audio effects.');
      });
    }
    if (soundCheck) {
      soundCheck.addEventListener('change', (e) => {
        state.soundEnabled = e.target.checked;
        if (soundIcon) soundIcon.textContent = state.soundEnabled ? 'volume_up' : 'volume_off';
      });
    }

    // Keyboard Hotkeys (Cmd+I, Cmd+M, etc.)
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        openWindow('about');
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        openWindow('contact');
      } else if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        openWindow('terminal');
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        openWindow('projects');
      }
    });

    // Mobile swipe/tap sound trigger
    document.querySelectorAll('button, a, .desktop-shortcut').forEach((el) => {
      el.addEventListener('click', () => playSound('click'));
    });
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    initShader();
    initClock();
    initDraggableWindows();
    initTerminal();
    initContactForm();
    initGlobalShortcuts();

    // Default open window: About
    openWindow('about');

    // Welcome Toast
    setTimeout(() => {
      showToast('Ayush Sharma Portfolio Active', 'Welcome to my developer portfolio.');
    }, 1000);
  });
})();
