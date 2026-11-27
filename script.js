/* =========================================================
   SIMULADÃO CAVEIRA — PM, PC e PPPE (13/12/2026)

   1. CONFIG      checkout, datas e WhatsApp
   2. FASES       "venda" até o fim do dia da prova; depois "encerrado"
   3. CHECKOUT    repasse de UTMs e eventos no dataLayer
   4. MAPA        cidades, zoom e ficha do local (dados em locais.js)
   5. DOCK e MIRA
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 1 · CONFIG ---------- */
  var CONFIG = {
    checkout: "https://checkout.cppem.com.br/pay/ingresso-simuladao-caveira-pm-pc-e-pppe",
    /* Contagem regressiva até o começo do dia da prova (horário de Brasília). */
    diaProva: "2026-12-13T00:00:00-03:00",
    /* Quando a venda sai do ar. Ajuste se a venda for encerrar antes. */
    fimVenda: "2026-12-13T23:59:59-03:00",
    produto: "ingresso-simuladao-caveira",
    valor: 39.9,
    whatsapp: "5581973105354",
    whatsTexto: "Olá! Quero saber sobre o Simuladão Caveira.",
    pagina: "Simuladao Caveira PE"
  };

  var reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function push(d) { window.dataLayer = window.dataLayer || []; window.dataLayer.push(d); }

  $("#ano").textContent = new Date().getFullYear();

  /* ---------- 2 · FASES + CRONÔMETRO ----------
     Teste em localhost: ?agora=2026-12-14T10:00:00-03:00 */
  var desloc = 0;
  var params = new URLSearchParams(window.location.search);
  if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    var teste = new Date(params.get("agora") || "").getTime();
    if (!isNaN(teste)) desloc = teste - Date.now();
  }

  var fase = "";
  function aplicarFase(nova) {
    if (nova === fase) return;
    fase = nova;
    document.body.setAttribute("data-fase", nova);
    $$("[data-fase-so]").forEach(function (el) { el.hidden = el.getAttribute("data-fase-so") !== nova; });
  }

  function dois(n) { return (n < 10 ? "0" : "") + n; }
  function tique() {
    var agora = Date.now() + desloc;
    aplicarFase(agora <= new Date(CONFIG.fimVenda).getTime() ? "venda" : "encerrado");
    var falta = Math.max(0, new Date(CONFIG.diaProva).getTime() - agora);
    var s = Math.floor(falta / 1000);
    var v = { d: dois(Math.floor(s / 86400)), h: dois(Math.floor(s % 86400 / 3600)), m: dois(Math.floor(s % 3600 / 60)), s: dois(s % 60) };
    $$("[data-c]").forEach(function (b) { b.textContent = v[b.getAttribute("data-c")]; });
    var lbl = $("[data-lbl-relogio]");
    if (lbl) lbl.textContent = falta > 0 ? "Até o dia da prova" : "É hoje!";
  }
  tique();
  setInterval(tique, 1000);

  /* ---------- 3 · CHECKOUT ---------- */
  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck", "fbclid", "gclid"];
  function guardar(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ler(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  UTM.forEach(function (k) { if (params.get(k)) guardar("utm_" + k, params.get(k)); });

  var urlCheckout = new URL(CONFIG.checkout);
  UTM.forEach(function (k) {
    var v = params.get(k) || ler("utm_" + k);
    if (v) urlCheckout.searchParams.set(k, v);
  });

  var cidadeAtual = null;
  $$("[data-checkout]").forEach(function (a) {
    a.href = urlCheckout.toString();
    a.target = "_blank";
    a.rel = "noopener";
    a.addEventListener("click", function () {
      push({ event: "clique_checkout", pagina: CONFIG.pagina, produto: CONFIG.produto, valor: CONFIG.valor,
             local: a.getAttribute("data-local"), cidade: cidadeAtual ? cidadeAtual.cidade : "" });
    });
  });

  var linkWhats = "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(CONFIG.whatsTexto);
  $$("[data-wa]").forEach(function (a) {
    a.href = linkWhats;
    a.target = "_blank";
    a.rel = "noopener";
    a.addEventListener("click", function () { push({ event: "whatsapp_click", pagina: CONFIG.pagina, local: a.getAttribute("data-local"), fase: fase }); });
  });

  $$("[data-vaga]").forEach(function (a) {
    a.addEventListener("click", function () { push({ event: "cta_vaga", pagina: CONFIG.pagina, local: a.getAttribute("data-local"), fase: fase }); });
  });

  /* ---------- 4 · MAPA ----------
     Mesma projeção usada para desenhar o contorno no index.html. */
  var LOCAIS = window.LOCAIS || [];
  function projetar(lat, lon) { return { x: (lon + 41.358) * 153.14, y: (-7.274 - lat) * 154.8 }; }

  var VISOES = {
    estado: { x: -25, y: -20, w: 1060, h: 382 },
    leste:  { x: 603, y: 70,  w: 418,  h: 235 }
  };

  var stage = $("#stage"), svg = $("#mapaSvg"), pins = $("#pins"), chips = $("#chips"), fora = $("#foraPetrolina");
  var visao = "estado", atual = null, animacao = 0;

  /* Ajusta a caixa pedida à proporção do palco, sem cortar nada. */
  function caixa(nome) {
    var v = VISOES[nome];
    var prop = stage.clientWidth / stage.clientHeight || 1.6;
    var w = v.w, h = v.h;
    if (w / h > prop) h = w / prop; else w = h * prop;
    return { x: v.x + v.w / 2 - w / 2, y: v.y + v.h / 2 - h / 2, w: w, h: h };
  }

  function desenhar(c) {
    atual = c;
    svg.setAttribute("viewBox", c.x + " " + c.y + " " + c.w + " " + c.h);
    svg.style.setProperty("--k", c.w / (stage.clientWidth || 1));
    $$(".pin", pins).forEach(function (p) {
      var x = (p.dataset.x - c.x) / c.w * 100, y = (p.dataset.y - c.y) / c.h * 100;
      p.style.left = x + "%";
      p.style.top = y + "%";
      p.hidden = x < 3 || x > 98 || y < 3 || y > 97;
    });
  }

  function irPara(nome, animar) {
    visao = nome;
    stage.classList.toggle("is-estado", nome === "estado");
    $$("[data-view]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === nome)); });
    fora.hidden = nome !== "leste";
    var alvo = caixa(nome), de = atual;
    cancelAnimationFrame(animacao);
    if (!animar || reduzido || !de) { desenhar(alvo); return; }
    var inicio = null;
    function passo(t) {
      if (!inicio) inicio = t;
      var p = Math.min(1, (t - inicio) / 450), e = 1 - Math.pow(1 - p, 3);
      desenhar({ x: de.x + (alvo.x - de.x) * e, y: de.y + (alvo.y - de.y) * e, w: de.w + (alvo.w - de.w) * e, h: de.h + (alvo.h - de.h) * e });
      if (p < 1) animacao = requestAnimationFrame(passo);
    }
    animacao = requestAnimationFrame(passo);
  }

  function mapsDe(l) {
    if (l.maps) return l.maps;
    if (!l.endereco) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([l.local, l.endereco].filter(Boolean).join(", "));
  }

  function selecionar(l, origem) {
    cidadeAtual = l;
    $("#fCidade").textContent = l.cidade;
    $("#fBtnCidade").textContent = l.cidade;
    $("#fNota").textContent = l.cidade;
    [["#fLocal", l.local], ["#fEndereco", l.endereco], ["#fReferencia", l.referencia], ["#fHorario", l.horario]].forEach(function (par) {
      var el = $(par[0]);
      el.textContent = par[1] || "A definir";
      el.classList.toggle("a-definir", !par[1]);
    });
    var maps = mapsDe(l), botao = $("#fMaps");
    botao.hidden = !maps;
    if (maps) botao.href = maps; else botao.removeAttribute("href");
    $("#fPendente").hidden = !!maps;
    $$("[data-cidade]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-cidade") === l.id)); });

    if (!origem) return;
    var ver = $("#verFicha");
    ver.hidden = origem !== "mapa";
    ver.textContent = "Ver local em " + l.cidade + " ↓";
    /* Na visão aproximada, Petrolina fica fora do quadro: volta ao estado todo. */
    if (l.id === "petrolina" && visao === "leste") irPara("estado", true);
    else if (l.id !== "petrolina" && visao === "estado" && stage.clientWidth < 620) irPara("leste", true);
    push({ event: "cidade_selecionada", pagina: CONFIG.pagina, cidade: l.cidade, origem: origem });
  }

  LOCAIS.forEach(function (l) {
    var p = projetar(l.lat, l.lon);

    var pin = document.createElement("button");
    pin.type = "button";
    pin.className = "pin pin--" + l.lado;
    pin.dataset.cidade = l.id;
    pin.dataset.x = p.x;
    pin.dataset.y = p.y;
    pin.setAttribute("aria-label", "Ver local de prova em " + l.cidade);
    pin.innerHTML = '<span class="pin__dot"><span class="skull" aria-hidden="true"></span></span><span class="pin__nome" aria-hidden="true">' + l.cidade + "</span>";
    pin.addEventListener("click", function () { selecionar(l, "mapa"); });
    pins.appendChild(pin);

    var li = document.createElement("li");
    var chip = document.createElement("button");
    chip.type = "button";
    chip.dataset.cidade = l.id;
    chip.innerHTML = '<span class="skull" aria-hidden="true"></span>' + l.cidade;
    chip.addEventListener("click", function () { selecionar(l, "lista"); });
    li.appendChild(chip);
    chips.appendChild(li);
  });

  $$("[data-view]").forEach(function (b) { b.addEventListener("click", function () { irPara(b.getAttribute("data-view"), true); }); });
  fora.addEventListener("click", function () {
    var pet = LOCAIS.filter(function (l) { return l.id === "petrolina"; })[0];
    if (pet) selecionar(pet, "mapa");
  });

  $("#verFicha").addEventListener("click", function () { $("#ficha").scrollIntoView({ block: "start" }); });

  /* Link direto para uma cidade: ?cidade=petrolina */
  var pedida = LOCAIS.filter(function (l) { return l.id === params.get("cidade"); })[0];
  if (LOCAIS.length) selecionar(pedida || LOCAIS[0]);
  irPara(stage.clientWidth < 620 && !(pedida && pedida.id === "petrolina") ? "leste" : "estado", false);

  var larguraAnterior = stage.clientWidth;
  window.addEventListener("resize", function () {
    if (stage.clientWidth === larguraAnterior) return;
    larguraAnterior = stage.clientWidth;
    irPara(visao, false);
  });

  /* ---------- 5 · DOCK (celular) e MIRA ---------- */
  var dock = $("#dock");
  function aoRolar() { dock.classList.toggle("is-on", window.scrollY > window.innerHeight * 0.6); }
  window.addEventListener("scroll", aoRolar, { passive: true });
  aoRolar();

  var mira = $("#mira");
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var tx = 0, ty = 0, x = 0, y = 0, ligada = false;
    var seguir = function () {
      var k = reduzido ? 1 : 0.3;
      x += (tx - x) * k; y += (ty - y) * k;
      mira.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      requestAnimationFrame(seguir);
    };
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      tx = e.clientX; ty = e.clientY;
      if (!ligada) { ligada = true; x = tx; y = ty; document.documentElement.classList.add("com-mira"); requestAnimationFrame(seguir); }
      mira.classList.add("is-on");
      var alvo = e.target instanceof Element ? e.target : null;
      mira.classList.toggle("is-lock", !!(alvo && alvo.closest("a,button,summary")));
    }, { passive: true });
    window.addEventListener("pointerdown", function () { mira.classList.add("is-fire"); }, { passive: true });
    window.addEventListener("pointerup", function () { mira.classList.remove("is-fire"); }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { mira.classList.remove("is-on"); });
  }
})();
