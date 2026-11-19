/* dengeX rapor — interactions: active TOC, chart tooltips, unit-economics calculator */
(function () {
  'use strict';

  const fmt = (n, d = 0) =>
    Number(n).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const tl = (n, d = 0) => fmt(n, d) + ' ₺';

  /* ---------- active section in the top bar ---------- */
  const links = [...document.querySelectorAll('.toc a')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window && links.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          links.forEach((a) => a.classList.remove('active'));
          const a = map.get(e.target.id);
          if (a) a.classList.add('active');
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    document.querySelectorAll('section[id]').forEach((s) => io.observe(s));
  }

  /* ---------- tooltips for any [data-tip] mark ---------- */
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'status');
  document.body.appendChild(tip);
  const place = (x, y) => {
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.classList.remove('on'); return; }
    tip.innerHTML = t.getAttribute('data-tip');
    tip.classList.add('on');
    place(e.clientX, e.clientY);
  });
  document.addEventListener('pointerleave', () => tip.classList.remove('on'));

  /* ---------- unit economics calculator ---------- */
  const calc = document.getElementById('calc');
  if (calc) {
    const $ = (id) => calc.querySelector('#' + id);
    const state = { channel: 'platform' };
    const channels = {
      // commission % of basket, fixed per-order fee, payment fee %
      platform: { label: 'Platform · kendi kurye', key: 'comRest' },
      platformCourier: { label: 'Platform kuryesi', key: 'comCourier' },
      own: { label: 'QR / web · online ödeme', key: 'own' },
      cash: { label: 'Kapıda / dükkân', key: 'cash' },
    };
    const inputs = ['basket', 'food', 'pack', 'comRest', 'comCourier', 'courier', 'payFee', 'orders'];

    const read = () => Object.fromEntries(inputs.map((k) => [k, parseFloat($(k).value)]));

    const compute = (v, ch) => {
      const netBasket = v.basket / 1.10; // KDV %10 düşülmüş net satış
      let commission = 0, courier = 0, pay = 0;
      if (ch === 'platform') { commission = v.basket * v.comRest / 100; courier = v.courier; }
      if (ch === 'platformCourier') { commission = v.basket * v.comCourier / 100; courier = 0; }
      if (ch === 'own') { pay = v.basket * v.payFee / 100; courier = v.courier; }
      if (ch === 'cash') { courier = v.courier; }
      const commissionVat = commission * 0.20; // komisyon faturasındaki KDV (indirilebilir, nakit akışını etkiler)
      const cost = v.food + v.pack;
      const profit = netBasket - cost - commission - courier - pay;
      return { netBasket, commission, commissionVat, courier, pay, cost, profit, margin: profit / netBasket };
    };

    const render = () => {
      const v = read();
      inputs.forEach((k) => {
        const o = calc.querySelector(`output[for=${k}]`);
        if (!o) return;
        o.textContent = ['comRest', 'comCourier', 'payFee'].includes(k) ? '%' + fmt(v[k], 1)
          : k === 'orders' ? fmt(v[k]) + ' / gün' : tl(v[k]);
      });
      const r = compute(v, state.channel);
      const set = (id, val, cls) => { const el = $(id); el.textContent = val; el.className = cls || ''; };
      set('o-net', tl(r.netBasket, 2));
      set('o-cost', '− ' + tl(r.cost, 2));
      set('o-com', r.commission ? '− ' + tl(r.commission, 2) : '0 ₺');
      set('o-courier', r.courier ? '− ' + tl(r.courier, 2) : '0 ₺');
      set('o-pay', r.pay ? '− ' + tl(r.pay, 2) : '0 ₺');
      set('o-profit', tl(r.profit, 2), r.profit >= 0 ? 'pos' : 'neg');
      set('o-margin', '%' + fmt(r.margin * 100, 1), r.profit >= 0 ? 'pos' : 'neg');
      set('o-month', tl(r.profit * v.orders * 30), r.profit >= 0 ? 'pos' : 'neg');

      // comparison bars across the four channels
      const rows = Object.keys(channels).map((ch) => ({ ch, ...compute(v, ch) }));
      const max = Math.max(...rows.map((x) => Math.abs(x.profit)), 1);
      $('cmp').innerHTML = rows.map((x) => {
        const w = Math.max(2, Math.abs(x.profit) / max * 100);
        const color = x.profit >= 0 ? 'var(--s1)' : 'var(--bad)';
        const on = x.ch === state.channel ? ' style="color:#fff;font-weight:600"' : '';
        return `<div class="hbar" data-tip="<b>${channels[x.ch].label}</b><br>Sipariş başı net: ${tl(x.profit, 2)}<br>Marj: %${fmt(x.margin * 100, 1)}">
          <div class="lbl"${on}>${channels[x.ch].label}</div>
          <div class="track"><div class="fill" style="width:${w}%;background:${color}"></div></div>
          <div class="val">${tl(x.profit, 1)}</div></div>`;
      }).join('');
    };

    calc.addEventListener('input', render);
    calc.querySelectorAll('.seg button').forEach((b) =>
      b.addEventListener('click', () => {
        calc.querySelectorAll('.seg button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        state.channel = b.dataset.ch;
        render();
      })
    );
    render();
  }

  /* ---------- scenario switch (growth model) ---------- */
  const scen = document.getElementById('scenario');
  if (scen) {
    scen.querySelectorAll('.seg button').forEach((b) =>
      b.addEventListener('click', () => {
        scen.querySelectorAll('.seg button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        scen.querySelectorAll('[data-scen]').forEach((el) => { el.hidden = el.dataset.scen !== b.dataset.s; });
      })
    );
  }
})();
