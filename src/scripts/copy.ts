// 复制按钮：点击 [data-copy] 复制其值；剪贴板不可用时选中目标文本让用户手动复制。
function selectText(el: Element | null) {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function bindCopy(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>('button[data-copy]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    const label = btn.querySelector('[data-copy-label]');
    const idle = label?.textContent ?? '';
    let timer: number | undefined;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy ?? '';
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        selectText(document.getElementById(btn.dataset.copyTarget ?? ''));
      }
      if (label) label.textContent = ok ? '已复制' : '请按 ⌘C';
      btn.dataset.state = ok ? 'done' : 'manual';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (label) label.textContent = idle;
        delete btn.dataset.state;
      }, 2000);
    });
  });
}
