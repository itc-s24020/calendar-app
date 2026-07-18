(function(){
  const today = new Date();
  today.setHours(0,0,0,0);

  // 表示可能範囲: config.js の rangeInMonths(既定12ヶ月=前後1年分)に従う
  const rangeMonths = (typeof CalendarConfig !== 'undefined') ? CalendarConfig.rangeInMonths : 12;
  const minMonth = new Date(today.getFullYear(), today.getMonth() - rangeMonths, 1);
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + rangeMonths, 1);

  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-11

  // 予定データ: { "YYYY-M-D": ["予定1", "予定2"] }
  const schedules = {};

  const grid = document.getElementById('grid');
  const yearLabel = document.getElementById('yearLabel');
  const monthLabel = document.getElementById('monthLabel');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const todayBtn = document.getElementById('todayBtn');
  const rangeNote = document.getElementById('rangeNote');

  const overlay = document.getElementById('overlay');
  const modalDate = document.getElementById('modalDate');
  const scheduleList = document.getElementById('scheduleList');
  const addForm = document.getElementById('addForm');
  const scheduleInput = document.getElementById('scheduleInput');
  const closeModal = document.getElementById('closeModal');

  let activeKey = null;

  function keyOf(y,m,d){ return y+"-"+m+"-"+d; }

  function isSameMonth(y,m){
    return y === minMonth.getFullYear() && m === minMonth.getMonth();
  }

  function render(){
    // ヘッダー
    yearLabel.textContent = viewYear + "年";
    monthLabel.innerHTML = '<span class="num">' + (viewMonth+1) + '</span> 月';

    // ナビゲーション制御 (前後1年に制限)
    const atMin = (viewYear === minMonth.getFullYear() && viewMonth === minMonth.getMonth());
    const atMax = (viewYear === maxMonth.getFullYear() && viewMonth === maxMonth.getMonth());
    prevBtn.disabled = atMin;
    nextBtn.disabled = atMax;

    rangeNote.textContent = minMonth.getFullYear()+"年"+(minMonth.getMonth()+1)+"月 〜 "+maxMonth.getFullYear()+"年"+(maxMonth.getMonth()+1)+"月の範囲で表示できます";

    // グリッド生成
    grid.innerHTML = '';
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay(); // 0=日
    const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    for(let i=0; i<totalCells; i++){
      const dayNum = i - startWeekday + 1;
      const cell = document.createElement('div');

      if(dayNum < 1 || dayNum > daysInMonth){
        cell.className = 'cell empty';
        grid.appendChild(cell);
        continue;
      }

      const weekday = (startWeekday + dayNum - 1) % 7;
      let cls = 'cell';
      if(weekday === 0) cls += ' sun';
      if(weekday === 6) cls += ' sat';

      const isToday = (viewYear === today.getFullYear() && viewMonth === today.getMonth() && dayNum === today.getDate());
      if(isToday) cls += ' today';
      cell.className = cls;

      const dateNum = document.createElement('div');
      dateNum.className = 'datenum';
      dateNum.textContent = dayNum;
      cell.appendChild(dateNum);

      const key = keyOf(viewYear, viewMonth, dayNum);
      const list = schedules[key] || [];
      if(list.length){
        const listEl = document.createElement('div');
        listEl.className = 'schedule-list';
        const shown = list.slice(0,2);
        shown.forEach(txt => {
          const item = document.createElement('div');
          item.className = 'item';
          item.textContent = txt;
          listEl.appendChild(item);
        });
        if(list.length > 2){
          const more = document.createElement('div');
          more.className = 'more-count';
          more.textContent = '他 ' + (list.length-2) + ' 件';
          listEl.appendChild(more);
        }
        cell.appendChild(listEl);
      }

      cell.addEventListener('click', () => openModal(viewYear, viewMonth, dayNum));
      grid.appendChild(cell);
    }
  }

  function openModal(y,m,d){
    activeKey = keyOf(y,m,d);
    modalDate.textContent = y + '年 ' + (m+1) + '月 ' + d + '日 の予定';
    renderScheduleList();
    overlay.classList.add('open');
    scheduleInput.value = '';
    setTimeout(()=> scheduleInput.focus(), 50);
  }

  function renderScheduleList(){
    const list = schedules[activeKey] || [];
    scheduleList.innerHTML = '';
    if(list.length === 0){
      const li = document.createElement('div');
      li.className = 'empty-msg';
      li.textContent = 'まだ予定がありません。';
      scheduleList.appendChild(li);
      return;
    }
    list.forEach((txt, idx) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = txt;
      const delBtn = document.createElement('button');
      delBtn.className = 'del';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', () => {
        schedules[activeKey].splice(idx,1);
        if(schedules[activeKey].length === 0) delete schedules[activeKey];
        renderScheduleList();
        render();
      });
      li.appendChild(span);
      li.appendChild(delBtn);
      scheduleList.appendChild(li);
    });
  }

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = scheduleInput.value.trim();
    if(!val) return;
    if(!schedules[activeKey]) schedules[activeKey] = [];
    schedules[activeKey].push(val);
    scheduleInput.value = '';
    renderScheduleList();
    render();
    scheduleInput.focus();
  });

  closeModal.addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', (e) => { if(e.target === overlay) overlay.classList.remove('open'); });

  prevBtn.addEventListener('click', () => {
    if(prevBtn.disabled) return;
    viewMonth--;
    if(viewMonth < 0){ viewMonth = 11; viewYear--; }
    render();
  });
  nextBtn.addEventListener('click', () => {
    if(nextBtn.disabled) return;
    viewMonth++;
    if(viewMonth > 11){ viewMonth = 0; viewYear++; }
    render();
  });
  todayBtn.addEventListener('click', () => {
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    render();
  });

  render();
})();