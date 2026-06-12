/* 風雲！決算城 — main.js */

document.addEventListener('DOMContentLoaded', () => {

  /* ── スムーズスクロール（アンカーリンク用） ── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ── 城カード：近日参陣クリック抑制 ── */
  document.querySelectorAll('.castle-card--soon').forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
    });
  });

  /* ── スクロールで城シルエットを微動 ── */
  const castle = document.querySelector('.hero__castle');
  if (castle) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      castle.style.transform = `translateY(${y * 0.04}px)`;
    }, { passive: true });
  }

});
