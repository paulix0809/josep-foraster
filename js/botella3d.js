/* Botellas 3D de Josep Foraster (three.js r128, script clásico: funciona abriendo el HTML con doble clic).
   Las formas salen de medir las fotos de la bodega fila a fila (js/botellas-datos.js). Las etiquetas son las reales,
   ampliadas y desenrolladas (js/etiquetas.js); las redibujadas en vectores (DIBUJOS) quedan de reserva.
   Uso: const b = Botella3D.montar(elemento, { botella: 'trepat', alta: true, zona }); b.mostrar('pep', 1); */
(function () {
  'use strict';
  const S = 1 / 100;                         // unidades de escena
  const TOPE = 40 * Math.PI / 180;           // giro máximo a cada lado (no hay contraetiqueta)
  const BASE = 812, ALTO = 808 * S;
  const col = h => new THREE.Color(h).convertSRGBToLinear(); // los colores se escriben en sRGB, como en el diseño
  const TINTA = '#1e1a1b';

  // ── Cada botella: vidrio, cierre y etiqueta ──
  const CFG = {
    trepat:        { vidrio: 0x1b0e12, cierre: { tipo: 'capsula', color: 0x241d22, banda: [19, 46, 0xb4628d] }, dibujo: 'trepat' },
    blancseleccio: { vidrio: 0x2a2117, cierre: { tipo: 'lacre', color: 0xe0ae4a }, dibujo: 'blancseleccio' },
    julieta:       { vidrio: 0x161213, cierre: { tipo: 'lacre', color: 0xa1263a }, dibujo: 'julieta' },
    pep:           { vidrio: 0x140e0b, cierre: { tipo: 'lacre', color: 0x2b67a0 }, dibujo: 'pep' },
    robina:        { vidrio: 0x161213, cierre: { tipo: 'lacre', color: 0x76284a }, dibujo: 'robina' },
    brisat:        { vidrio: 0x3b2b1e, cierre: { tipo: 'lacre', color: 0xd9782b }, dibujo: 'brisat' },
    gallinetes:    { vidrio: 0x2a1418, cierre: { tipo: 'capsula', color: 0x1c1a1d }, img: 'gallinetes' },
    crianca:       { vidrio: 0x0c0e0b, cierre: { tipo: 'metal', color: 0xc6c9cd }, dibujo: 'crianca' },
    seleccio:      { vidrio: 0x131418, cierre: { tipo: 'capsula', color: 0x161618 }, dibujo: 'seleccio' },
    nanosblanc:    { transparente: true, vino: 0xe09a26, cierre: { tipo: 'capsula', color: 0xe3912e, nanos: true }, img: 'nanosblanc' },
    nanosrosat:    { transparente: true, vino: 0xef9472, cierre: { tipo: 'capsula', color: 0xcb6b95, nanos: true }, img: 'nanosrosat' },
    nanoscollita:  { vidrio: 0x23110f, cierre: { tipo: 'capsula', color: 0xb5323f, nanos: true }, img: 'nanoscollita' },
    lilla:         { transparente: true, vino: 0xec7050, cierre: { tipo: 'chapa', color: 0xc9ad74 }, dibujo: 'lilla' },
    cava:          { transparente: true, vino: 0xe8a77c, cierre: { tipo: 'oro', color: 0xb8925a }, dibujo: 'cava' }
  };

  const FUENTES = ['700 100px Oswald', '600 100px "Barlow Condensed"', '700 100px "Libre Caslon Text"', '400 100px "Libre Caslon Text"',
    'italic 400 100px "Libre Caslon Text"', '400 100px "Pinyon Script"', '400 100px Damion', '400 100px "Allerta Stencil"'];
  let fuentesListas = null;
  const cargarFuentes = () => fuentesListas || (fuentesListas = (!document.fonts || !document.fonts.load) ? Promise.resolve()
    : Promise.all(FUENTES.map(f => document.fonts.load(f).catch(() => null))).then(() => document.fonts.ready));

  // ── Lienzo de etiqueta: medidas en píxeles de la foto, centrado en el frente ──
  function lienzo(datos, angulo, ancho, papel) {
    const radio = datos.radio + .7, arco = radio * angulo, alto = datos.et[1] - datos.et[0];
    const W = ancho, H = Math.round(W * alto / arco), k = W / arco, cx = W / 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    let semilla = 7; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
    // papel con fibras y sombra en los bordes que dan la vuelta
    g.fillStyle = papel.color; g.fillRect(0, 0, W, H);
    const fib = papel.oscuro ? ['255,255,255', '0,0,0'] : ['120,100,100', '255,255,255'];
    for (let i = 0; i < W * 2.2; i++) {
      const x = azar() * W, y = azar() * H, l = (6 + azar() * 26) * W / 4096, a = azar() * Math.PI;
      g.strokeStyle = `rgba(${azar() < .5 ? fib[0] : fib[1]},${(papel.oscuro ? .02 : .035) + azar() * .045})`; g.lineWidth = (1 + azar() * 1.4) * W / 4096;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    const borde = g.createLinearGradient(0, 0, W, 0);
    borde.addColorStop(0, 'rgba(60,45,45,.18)'); borde.addColorStop(.06, 'rgba(60,45,45,0)'); borde.addColorStop(.94, 'rgba(60,45,45,0)'); borde.addColorStop(1, 'rgba(60,45,45,.18)');
    g.fillStyle = borde; g.fillRect(0, 0, W, H);
    const X = v => cx + v * k, Y = v => v * k;
    // texto a una altura de mayúscula medida; con ancho, se reparte el espacio entre letras (o se estrecha si no cabe)
    const texto = (t, fuente, capa, base, o = {}) => {
      g.font = fuente.replace('#', 100); const ref = g.measureText(o.ref || 'H').actualBoundingBoxAscent || 70;
      const sz = 100 * capa * k / ref; g.font = fuente.replace('#', sz.toFixed(1)); g.fillStyle = o.color || TINTA; g.textBaseline = 'alphabetic';
      const letras = [...t], anchos = letras.map(l => g.measureText(l).width), natural = anchos.reduce((a, b) => a + b, 0);
      const objetivo = o.ancho ? o.ancho * k : natural, x0 = o.x != null ? X(o.x) : cx;
      const ini = o.alinea === 'izq' ? x0 : o.alinea === 'der' ? x0 - objetivo : x0 - objetivo / 2;
      if (o.escala || natural > objetivo) { g.save(); g.translate(ini, Y(base)); g.scale(objetivo / natural, 1); g.textAlign = 'left'; g.fillText(t, 0, 0); g.restore(); }
      else { const extra = letras.length > 1 ? (objetivo - natural) / (letras.length - 1) : 0; let x = ini; g.textAlign = 'left';
        letras.forEach((l, i) => { g.fillText(l, x, Y(base)); x += anchos[i] + extra; }); }
      return { fin: (ini + objetivo - cx) / k };
    };
    const escudo = (x, y, h, color = TINTA, grosor = 1.6) => {
      g.save(); g.translate(X(x), Y(y)); const e = h * k / 48; g.scale(e, e); g.translate(-20, -24);
      g.strokeStyle = color; g.lineWidth = grosor; g.lineJoin = 'round';
      ['M3 3h34v19c0 12-8 19-17 23C11 41 3 34 3 22V3Z', 'M20 3v42M3 21h34', 'M8 9h7v8H8zM11.5 9v8', 'M25 8l4 4 4-4M25 12l4 4 4-4', 'M8 27c3 0 4 3 4 6m0 0c0-3 1-6 4-6M12 33v5']
        .forEach(d => g.stroke(new Path2D(d)));
      g.beginPath(); g.arc(29, 31, 4, 0, Math.PI * 2); g.stroke(); g.restore();
    };
    const raya = (x, y, w, grosor = .45, color = TINTA) => { g.fillStyle = color; g.fillRect(X(x), Y(y), w * k, grosor * k); };
    // tinta gastada de imprenta (solo en las palabras grandes)
    const gastar = (x0, y0, w, h, n) => {
      g.save(); g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${.12 + azar() * .3})`; g.beginPath(); g.arc(X(x0 + azar() * w), Y(y0 + azar() * h), (.5 + azar() * 1.8) * W / 4096, 0, Math.PI * 2); g.fill(); }
      g.restore(); g.save(); g.globalCompositeOperation = 'destination-over'; g.fillStyle = papel.color; g.fillRect(0, 0, W, H); g.restore();
    };
    return { c, g, texto, escudo, raya, gastar, k, W, H };
  }

  const CASLON_B = '700 #px "Libre Caslon Text"', CASLON = '400 #px "Libre Caslon Text"', CASLON_I = 'italic 400 #px "Libre Caslon Text"';
  const COND = '600 #px "Barlow Condensed"', SCRIPT = '400 #px "Pinyon Script"';
  // pie común de las etiquetas de finca (Julieta, Pep, La Robina): TREPAT · JOSEP FORASTER · escudo · Montblanc
  const pieFinca = (L, y) => {
    L.texto('TREPAT', COND, 6, y, { x: -80, ancho: 30, alinea: 'izq' });
    L.texto('JOSEP FORASTER', CASLON_B, 8.4, y, { x: -42, ancho: 118, alinea: 'izq' });
    L.escudo(-54, y + 27, 15);
    L.texto('MONTBLANC', CASLON_B, 6, y + 20, { x: -24, ancho: 46, alinea: 'izq' });
    L.texto('CONCA DE BARBERÀ', CASLON, 4.4, y + 31, { x: -24, ancho: 46, alinea: 'izq' });
    L.raya(-24, y + 32.6, 46);
    L.texto('DENOMINACIÓ D’ORIGEN', CASLON, 3.6, y + 40, { x: -24, ancho: 46, alinea: 'izq' });
  };
  const pieClasico = (L, y, o = {}) => { // JOSEP FORASTER · MONTBLANC · CONCA · DO, centrado
    const c = o.color, am = o.am || 61;
    L.texto('JOSEP FORASTER', CASLON_B, o.cap || 9, y, { ancho: o.ancho || 116, color: c });
    L.texto('MONTBLANC', CASLON, 7, y + 17, { ancho: am, color: c });
    L.texto('CONCA DE BARBERÀ', CASLON, 5, y + 26, { ancho: am, color: c });
    L.raya(-am / 2, y + 28.3, am, .45, c || TINTA);
    L.texto('DENOMINACIÓ D’ORIGEN', CASLON, 3.9, y + 35, { ancho: am, color: c });
  };

  const DIBUJOS = {
    trepat: L => { L.escudo(0, 61, 19); L.texto('TREPAT', '700 #px Oswald', 41, 127, { ancho: 121, escala: true }); L.gastar(-62, 86, 125, 41, 1100);
      L.texto('SERRA DE MIRAMAR', COND, 7, 146, { ancho: 82 }); pieClasico(L, 179); },
    blancseleccio: L => { L.escudo(0, 61, 19); L.texto('BLANC SELECCIÓ', '700 #px Oswald', 33, 122, { ancho: 178, escala: true }); L.gastar(-90, 89, 180, 33, 1500);
      L.texto('MUNTANYES DE PRADES', COND, 6.5, 145, { ancho: 96 }); pieClasico(L, 179); },
    crianca: L => { L.escudo(0, 58, 17); L.texto('CRIANÇA', CASLON, 24, 120, { ancho: 130 }); pieClasico(L, 162, { cap: 9.5, ancho: 104, am: 50 }); },
    seleccio: L => { const c = '#e7e3dc'; L.escudo(0, 62, 17, '#cfcac2', 1.4); L.texto('SELECCIÓ', CASLON_B, 21, 124, { ancho: 150, color: c });
      pieClasico(L, 172, { color: c, cap: 9.5, ancho: 106, am: 56 }); },
    julieta: L => { L.texto('Julieta', SCRIPT, 30, 106, { x: -76, alinea: 'izq', ref: 'J' }); L.texto('2025', CASLON_I, 7.5, 106, { x: 46, alinea: 'izq' }); pieFinca(L, 160); },
    pep: L => { const r = L.texto('Pep', SCRIPT, 30, 104, { x: -42, alinea: 'izq', ref: 'P' }); L.texto('’20', CASLON_I, 7.5, 104, { x: r.fin + 3, alinea: 'izq' }); pieFinca(L, 158); },
    robina: L => { const r = L.texto('la Robina', '400 #px Damion', 21, 108, { x: -70, alinea: 'izq', ref: 'R' }); L.texto('2024', CASLON, 9, 108, { x: r.fin + 4, alinea: 'izq' }); pieFinca(L, 160); },
    brisat: L => { const r = L.texto('Brisat del Coster', SCRIPT, 24, 104, { x: -98, alinea: 'izq', ref: 'B', ancho: 168, escala: true }); L.texto('’20', CASLON_I, 7, 104, { x: r.fin + 2, alinea: 'izq' });
      L.texto('Macabeu', CASLON_B, 9, 160, { x: -76, alinea: 'izq', ancho: 44 }); L.escudo(-14, 156, 14);
      L.texto('Josep', CASLON_B, 9, 152, { x: -4, alinea: 'izq' }); L.texto('Foraster', CASLON_B, 9, 164, { x: -4, alinea: 'izq' });
      L.texto('Montblanc', SCRIPT, 8, 177, { x: -3, alinea: 'izq', ref: 'M' }); L.texto('CONCA DE BARBERÀ', CASLON, 3.6, 186, { x: -4, alinea: 'izq', ancho: 42 }); },
    lilla: L => { L.escudo(-70, 62, 16);
      L.g.save(); L.g.translate(1.6 * L.k, 1.6 * L.k); L.texto('LILLA', '400 #px "Allerta Stencil"', 34, 92, { x: 6, ancho: 150, color: 'rgba(30,26,27,.28)' }); L.g.restore();
      L.texto('LILLA', '400 #px "Allerta Stencil"', 34, 92, { x: 6, ancho: 150 });
      L.texto('MÈTODE ANCESTRAL', COND, 4.6, 121, { ancho: 62 }); L.texto('JOSEP FORASTER', CASLON_B, 9.5, 151, { ancho: 105 }); L.texto('MONTBLANC', CASLON, 6.5, 164, { ancho: 48 }); },
    cava: L => { L.texto('75cl.', COND, 4.5, 20, { x: -98, alinea: 'izq' }); L.texto('11,5%vol.', COND, 4.5, 20, { x: 98, alinea: 'der' });
      L.escudo(0, 56, 16); L.texto('JOSEP FORASTER', CASLON_B, 9, 88, { ancho: 102 });
      L.texto('Trepat · Rosat', SCRIPT, 15, 118, { ancho: 96, escala: true, ref: 'T' }); L.texto('CAVA', CASLON, 10, 142, { ancho: 48 });
      L.texto('BRUT · MÈTODE TRADICIONAL · 100% TREPAT', COND, 4, 157, { ancho: 132 }); L.raya(-66, 160.5, 132, .35);
      L.texto('D.O. CAVA · ELABORAT PER MAS FORASTER · CONTÉ SULFITS', COND, 2.8, 170, { ancho: 150 }); }
  };
  const PAPEL = { seleccio: { color: '#1e1d1f', oscuro: true }, crianca: { color: '#f3f3f1' }, cava: { color: '#eef0e8' }, lilla: { color: '#f3f1ee' } };

  // texturas de los cierres impresos: la cápsula de Els Nanos y el papel de oro del cava
  function texCierre(cfg, datos) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const g = c.getContext('2d');
    g.fillStyle = '#' + cfg.cierre.color.toString(16).padStart(6, '0'); g.fillRect(0, 0, 1024, 1024);
    const alto = datos.cierre - 4, fila = y => (y - 4) / alto * 1024; // y en px de la foto → fila del lienzo (arriba = tapa)
    if (cfg.cierre.nanos) { // NA / NOS en blanco y ELS pequeño de lado, en la cara de delante (u = .5)
      g.fillStyle = '#f6efe6'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.font = '700 150px Oswald'; g.fillText('NA', 532, fila(62)); g.fillText('NOS', 532, fila(104));
      g.save(); g.translate(436, fila(84)); g.rotate(-Math.PI / 2); g.font = '700 60px Oswald'; g.fillText('ELS', 0, 0); g.restore();
    }
    if (cfg.cierre.tipo === 'oro') { // papel de oro arrugado con JOSEP FORASTER en el frente
      let s = 3; const az = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 2600; i++) { g.strokeStyle = `rgba(${az() < .5 ? '255,240,200' : '80,55,25'},${.05 + az() * .08})`; g.lineWidth = 1 + az() * 3;
        const x = az() * 1024, y = az() * 1024; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (az() - .5) * 60, y + (az() - .5) * 18); g.stroke(); }
      g.fillStyle = '#f5e8cc'; g.textAlign = 'center'; g.font = '700 46px "Libre Caslon Text"'; g.fillText('JOSEP', 512, fila(236)); g.fillText('FORASTER', 512, fila(252));
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  // ── Estudio: tiras de luz que se reflejan en el vidrio ──
  function entorno(renderer) {
    const sc = new THREE.Scene();
    sc.add(new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60), new THREE.MeshBasicMaterial({ color: col(0x0d0b0c), side: THREE.BackSide })));
    const caja = (w, h, x, y, z, fuerza, tono = 0xffffff) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col(tono).multiplyScalar(fuerza), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
    };
    caja(2.2, 22, -9, 1, 6, 6); caja(5.5, 22, 10, 1, 3, 3.2, 0xfff4ea); caja(1.2, 18, -6, 0, -9, 2.4); caja(1.2, 18, 7, 0, -9, 1.6);
    caja(16, 6, 0, 16, 2, 1.4); caja(6, 5, -1, 9, 16, .22, 0xffeee6);
    const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(sc, .02).texture; pm.dispose(); return tex;
  }

  const torno = (puntos, offset = 0, escala = 1) => new THREE.LatheGeometry(
    puntos.map(([r, y]) => new THREE.Vector2(r === 0 ? 0 : Math.max(0, r * escala + offset) * S, (BASE - y) * S)), 160, -Math.PI, Math.PI * 2);
  const radioEn = (perfil, y) => { // semiancho del perfil a una altura dada
    for (let i = 1; i < perfil.length; i++) { const [r0, y0] = perfil[i - 1], [r1, y1] = perfil[i];
      if (r0 && r1 && (y0 - y) * (y1 - y) <= 0 && y0 !== y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0); }
    return 40;
  };

  // ── Construye una botella completa ──
  function construir(id, renderer, alta) {
    const datos = window.BOTELLAS_DATOS[id], cfg = CFG[id], grupo = new THREE.Group(), listos = [];
    const P = datos.perfil, yc = datos.cierre, cuerpo = P.filter(p => p[0] !== 0);
    // el perfil va de abajo (centro del culo) hacia arriba; el vidrio acaba bajo el cierre
    const rc = radioEn(P, yc);
    const vidrioP = [P[0]].concat(cuerpo.filter(p => p[1] >= yc)).concat([[rc, yc - .5], [0, yc - .5]]);
    if (cfg.transparente) {
      // vino por dentro, vidrio casi incoloro por fuera y una capa que solo suma los reflejos
      const vinoP = [P[0]].concat(cuerpo.filter(p => p[1] >= datos.vino)).concat([[radioEn(P, datos.vino), datos.vino], [0, datos.vino]]);
      const vino = new THREE.Mesh(torno(vinoP, -2.2, .97), new THREE.MeshStandardMaterial({ color: col(cfg.vino), emissive: col(cfg.vino), emissiveIntensity: .1,
        roughness: .3, transparent: true, premultipliedAlpha: true, opacity: .86, envMapIntensity: .2 }));
      vino.renderOrder = 1; grupo.add(vino);
      const tinte = new THREE.Mesh(torno(vidrioP), new THREE.MeshBasicMaterial({ color: col(0xeef2ec), transparent: true, premultipliedAlpha: true, opacity: .12, depthWrite: false }));
      tinte.renderOrder = 3; grupo.add(tinte);
      const brillo = new THREE.Mesh(torno(vidrioP, .2), new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: .04, clearcoat: 1, clearcoatRoughness: .03,
        envMapIntensity: 1.7, transparent: true, depthWrite: false,
        // suma luz al color pero no toca la opacidad: en el borde el reflejo es casi negro y no debe tapar el fondo
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }));
      brillo.renderOrder = 4; grupo.add(brillo);
    } else {
      grupo.add(new THREE.Mesh(torno(vidrioP), new THREE.MeshPhysicalMaterial({ color: col(cfg.vidrio), sheen: col(0x4a0d18), roughness: .07,
        clearcoat: 1, clearcoatRoughness: .03, reflectivity: .6, envMapIntensity: 1.35 })));
    }
    // cierre: la silueta medida por encima de su línea, un pelo más ancha que el vidrio
    const cierreP = [[0, yc + 1], [radioEn(P, yc + 1), yc + 1]].concat(cuerpo.filter(p => p[1] < yc + 1)).concat([[0, P[P.length - 1][1]]]);
    const ci = cfg.cierre, metal = ci.tipo === 'metal' || ci.tipo === 'oro' || ci.tipo === 'chapa';
    const matC = new THREE.MeshPhysicalMaterial({ color: col(ci.color), metalness: metal ? 1 : 0, roughness: metal ? (ci.tipo === 'oro' ? .34 : .26) : ci.tipo === 'lacre' ? .32 : .45,
      clearcoat: ci.tipo === 'lacre' ? .7 : .3, clearcoatRoughness: .25, envMapIntensity: metal ? 1.1 : .9 });
    if (ci.nanos || ci.tipo === 'oro') { matC.color = new THREE.Color(0xffffff); matC.map = texCierre(cfg, datos);
      listos.push(cargarFuentes().then(() => { matC.map.dispose(); matC.map = texCierre(cfg, datos); matC.needsUpdate = true; })); }
    grupo.add(new THREE.Mesh(torno(cierreP, .6), matC));
    if (ci.banda) {
      const [y0, y1, c] = ci.banda, r = radioEn(P, (y0 + y1) / 2) + 1.1;
      grupo.add(new THREE.Mesh(torno([[r - .3, y1 + .5], [r, y1 - 1], [r, y0 + 1.5], [r - .3, y0]]), new THREE.MeshPhysicalMaterial({ color: col(c), roughness: .5, clearcoat: .25, clearcoatRoughness: .4, envMapIntensity: .8 })));
    }
    // etiqueta
    const oscuro = PAPEL[id] && PAPEL[id].oscuro;
    const real = window.ETIQUETAS_IMG && window.ETIQUETAS_IMG[id]; // etiqueta real (si no, la redibujada)
    const angulo = (real ? 164 : 205) * Math.PI / 180, radio = (datos.radio + .7) * S, altoEt = (datos.et[1] - datos.et[0]) * S;
    const matE = new THREE.MeshStandardMaterial({ color: col(oscuro ? 0xffffff : 0xfff3f1), roughness: oscuro ? .55 : .82, envMapIntensity: .75 });
    const etiqueta = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, altoEt, 200, 1, true, -angulo / 2, angulo), matE);
    etiqueta.position.y = (BASE - (datos.et[0] + datos.et[1]) / 2) * S; etiqueta.visible = false; grupo.add(etiqueta);
    const ponMapa = (t) => { t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true;
      matE.map = t; matE.emissive = new THREE.Color(0xffffff); matE.emissiveMap = t; matE.emissiveIntensity = oscuro ? .18 : .42; matE.needsUpdate = true; etiqueta.visible = true; };
    if (real) listos.push(new Promise(res => { const im = new Image(); im.onload = () => { ponMapa(new THREE.Texture(im)); res(); }; im.onerror = res; im.src = real; }));
    else if (cfg.dibujo) listos.push(cargarFuentes().then(() => { const L = lienzo(datos, angulo, alta ? 4096 : 2048, PAPEL[id] || { color: '#f2ebec' }); DIBUJOS[cfg.dibujo](L); ponMapa(new THREE.CanvasTexture(L.c)); }));
    // sombra de contacto: mancha suave y un núcleo más oscuro bajo el aro de apoyo
    const cs = document.createElement('canvas'); cs.width = cs.height = 512; const gs = cs.getContext('2d');
    const halo = gs.createRadialGradient(256, 256, 0, 256, 256, 256);
    halo.addColorStop(0, 'rgba(28,20,18,.5)'); halo.addColorStop(.36, 'rgba(28,20,18,.42)'); halo.addColorStop(.5, 'rgba(28,20,18,.16)'); halo.addColorStop(1, 'rgba(28,20,18,0)');
    gs.fillStyle = halo; gs.fillRect(0, 0, 512, 512);
    const nucleo = gs.createRadialGradient(256, 256, 60, 256, 256, 120);
    nucleo.addColorStop(0, 'rgba(18,12,10,0)'); nucleo.addColorStop(.75, 'rgba(18,12,10,.45)'); nucleo.addColorStop(1, 'rgba(18,12,10,0)');
    gs.fillStyle = nucleo; gs.fillRect(0, 0, 512, 512);
    const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cs), transparent: true, depthWrite: false, toneMapped: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = .002; const ts = datos.radio * S * 3.4; sombra.scale.set(ts, ts, 1); sombra.renderOrder = 0;
    const raiz = new THREE.Group(); raiz.add(sombra); raiz.add(grupo); raiz.position.y = -ALTO / 2 - 4 * S / 2;
    raiz.userData = { botella: grupo, listo: Promise.all(listos) };
    return raiz;
  }
  const liberar = (o) => o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) { ['map', 'emissiveMap'].forEach(k => n.material[k] && n.material[k].dispose()); n.material.dispose(); } });

  function montar(el, op = {}) {
    if (!window.THREE || !window.BOTELLAS_DATOS) return null;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    if (op.fondo != null) renderer.setClearColor(new THREE.Color(op.fondo), 1); // solo para pruebas
    const lienzoGL = renderer.domElement; lienzoGL.className = 'botella3d'; el.appendChild(lienzoGL);
    const escena = new THREE.Scene(); escena.environment = entorno(renderer);
    escena.add(new THREE.HemisphereLight(0xfff8f2, 0x2a2224, .5));
    const camara = new THREE.PerspectiveCamera(14, 1, 1, 200);
    // cámara de estudio un poco por encima: el culo y la etiqueta dibujan una curva suave, como en la foto
    const elev = 6.5 * Math.PI / 180, dist = (ALTO * 1.12 / 2) / Math.tan(7 * Math.PI / 180);
    const ponCamara = d => { camara.position.set(0, d * Math.sin(elev) - .16, d * Math.cos(elev)); camara.lookAt(0, -.16, 0); }; // aire debajo para la sombra
    ponCamara(dist);

    const inicial = op.botella || 'trepat';
    let actual = construir(inicial, renderer, op.alta), idActual = inicial, cambio = null;
    escena.add(actual);
    actual.userData.listo.then(() => { el.classList.add('botella3d-lista'); op.alListo && op.alListo(); });
    // cambiar de botella: la vieja sale de lado girando y la nueva entra desde el otro
    const mostrar = (id, dir = 1) => {
      if (!CFG[id] || id === idActual) return;
      if (cambio) { escena.remove(cambio.vieja); liberar(cambio.vieja); cambio.nueva.visible = true; actual = cambio.nueva; cambio = null; }
      const nueva = construir(id, renderer, op.alta); nueva.visible = false; escena.add(nueva); idActual = id;
      const c = cambio = { vieja: actual, nueva, dir, t: 0, entra: false, preparada: false };
      nueva.userData.listo.then(() => { c.preparada = true; });
      actual = nueva;
    };

    // giro: el ratón empuja mientras se mueve; arrastrar con tope elástico; siempre vuelve al centro
    let objetivoRaton = 0, giroRaton = 0, giroLibre = 0, vel = 0, arrastrando = false, ultX = 0, ultRaton = null;
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const zona = op.zona || el;
    if (op.giroRaton !== false && !quieto) {
      zona.addEventListener('pointermove', e => { if (arrastrando) return;
        if (ultRaton !== null) objetivoRaton = Math.max(-.5, Math.min(.5, objetivoRaton + (e.clientX - ultRaton) * .004)); ultRaton = e.clientX; });
      zona.addEventListener('pointerleave', () => { ultRaton = null; objetivoRaton = 0; });
    }
    if (op.arrastre !== false) {
      lienzoGL.style.cursor = 'grab'; lienzoGL.style.touchAction = 'pan-y';
      lienzoGL.addEventListener('pointerdown', e => { arrastrando = true; objetivoRaton = 0; ultX = e.clientX; vel = 0; lienzoGL.setPointerCapture(e.pointerId); lienzoGL.style.cursor = 'grabbing'; });
      lienzoGL.addEventListener('pointermove', e => { if (!arrastrando) return; const d = (e.clientX - ultX) * .012; giroLibre += d; vel = d; ultX = e.clientX; });
      const suelta = () => { arrastrando = false; lienzoGL.style.cursor = 'grab'; };
      lienzoGL.addEventListener('pointerup', suelta); lienzoGL.addEventListener('pointercancel', suelta);
    }
    const medir = () => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return; renderer.setSize(r.width, r.height, false);
      lienzoGL.style.width = '100%'; lienzoGL.style.height = '100%'; camara.aspect = r.width / r.height; camara.updateProjectionMatrix();
      const anchoVis = 2 * dist * Math.tan(7 * Math.PI / 180) * camara.aspect, necesario = 240 * S * 1.05;
      ponCamara(anchoVis < necesario ? dist * necesario / anchoVis : dist); };
    medir(); const ro = new ResizeObserver(medir); ro.observe(el);
    let visible = true; const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); io.observe(el);
    const suave = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    let t0 = performance.now(), vivo = true;
    const bucle = (t) => {
      if (!vivo) return; requestAnimationFrame(bucle);
      const dt = Math.min(.05, (t - t0) / 1000); t0 = t; if (!visible) return;
      objetivoRaton *= Math.exp(-dt * 2.2); // el empujón del ratón se apaga solo
      giroRaton += (objetivoRaton - giroRaton) * Math.min(1, dt * 4);
      if (!arrastrando) { giroLibre += vel; vel *= Math.pow(.02, dt); giroLibre += (0 - giroLibre) * Math.min(1, dt * 2.4); }
      giroLibre = Math.max(-2.5, Math.min(2.5, giroLibre));
      const vaiven = quieto ? 0 : Math.sin(t / 2600) * .05; // respiración mínima alrededor del centro
      const giro = TOPE * Math.tanh((giroLibre + giroRaton + vaiven) / TOPE); // tope elástico
      const aplica = (r, x, extra) => { r.position.x = x; r.userData.botella.rotation.y = giro + extra; };
      if (cambio) {
        // se desliza poco y se funde, así nunca se ve cortada por el borde del lienzo
        const c = cambio, D = 1.1;
        if (!c.entra) { c.t = Math.min(1, c.t + dt / (quieto ? .01 : .38)); const e = suave(c.t); aplica(c.vieja, -c.dir * D * e, -c.dir * .8 * e); lienzoGL.style.opacity = 1 - e;
          if (c.t >= 1 && c.preparada) { escena.remove(c.vieja); liberar(c.vieja); c.entra = true; c.t = 0; c.nueva.visible = true; aplica(c.nueva, c.dir * D, c.dir * .8); } }
        else { c.t = Math.min(1, c.t + dt / (quieto ? .01 : .62)); const e = 1 - suave(c.t); aplica(c.nueva, c.dir * D * e, c.dir * .8 * e); lienzoGL.style.opacity = 1 - e;
          if (c.t >= 1) { cambio = null; lienzoGL.style.opacity = 1; } }
      } else aplica(actual, 0, 0);
      renderer.render(escena, camara);
    };
    requestAnimationFrame(bucle);
    return { lienzo: lienzoGL, mostrar, destruir: () => { vivo = false; ro.disconnect(); io.disconnect(); renderer.dispose(); lienzoGL.remove(); } };
  }

  // fotos de estudio de cada botella (para las miniaturas del selector): un solo renderer fuera de pantalla
  function fotos(ids, ancho = 180, alto = 300) {
    if (!window.THREE || !window.BOTELLAS_DATOS) return Promise.resolve({});
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return Promise.resolve({}); }
    renderer.setPixelRatio(2); renderer.setSize(ancho, alto, false);
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.setClearColor(0x000000, 0);
    const escena = new THREE.Scene(); escena.environment = entorno(renderer); escena.add(new THREE.HemisphereLight(0xfff8f2, 0x2a2224, .5));
    const camara = new THREE.PerspectiveCamera(14, ancho / alto, 1, 200), elev = 6.5 * Math.PI / 180, d = (ALTO * 1.12 / 2) / Math.tan(7 * Math.PI / 180);
    camara.position.set(0, d * Math.sin(elev) - .16, d * Math.cos(elev)); camara.lookAt(0, -.16, 0);
    const out = {};
    return ids.reduce((p, id) => p.then(() => {
      const r = construir(id, renderer, false); escena.add(r);
      return r.userData.listo.then(() => { r.userData.botella.rotation.y = -.18; renderer.render(escena, camara);
        out[id] = renderer.domElement.toDataURL('image/png'); escena.remove(r); liberar(r); });
    }), Promise.resolve()).then(() => { renderer.dispose(); return out; });
  }

  window.Botella3D = { montar, fotos, BOTELLAS: Object.keys(CFG) };
})();
