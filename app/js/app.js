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
  const STORAGE_KEY = 'calendar-app:schedules';

  function loadSchedules(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return {};
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      Object.keys(parsed).forEach((key) => {
        if(!Array.isArray(parsed[key])) return;
        parsed[key] = parsed[key].map((entry) => normalizeScheduleEntry(entry)).filter(Boolean);
      });
      return parsed;
    } catch (err) {
      return {};
    }
  }

  function normalizeScheduleEntry(entry){
    if(typeof entry === 'string'){
      const title = entry.trim();
      return title ? { time: '', title } : null;
    }
    if(!entry || typeof entry !== 'object') return null;
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    if(!title) return null;
    const time = typeof entry.time === 'string' ? entry.time.trim() : '';
    return { time, title };
  }

  function saveSchedules(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
    } catch (err) {
      // 保存できない環境では何もしない
    }
  }

  const schedules = loadSchedules();

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
  const scheduleTimeInput = document.getElementById('scheduleTimeInput');
  const scheduleInput = document.getElementById('scheduleInput');
  const editPanel = document.getElementById('editPanel');
  const editForm = document.getElementById('editForm');
  const editTimeInput = document.getElementById('editTimeInput');
  const editInput = document.getElementById('editInput');
  const cancelEdit = document.getElementById('cancelEdit');
  const closeModal = document.getElementById('closeModal');

  let activeKey = null;
  let editingIndex = null;

  function keyOf(y,m,d){ return y+"-"+m+"-"+d; }

  function formatScheduleLabel(entry){
    const time = entry.time ? entry.time + ' ' : '';
    return time + entry.title;
  }

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
        shown.forEach(entry => {
          const item = document.createElement('div');
          item.className = 'item';
          item.textContent = formatScheduleLabel(entry);
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
    editingIndex = null;
    modalDate.textContent = y + '年 ' + (m+1) + '月 ' + d + '日 の予定';
    renderScheduleList();
    updateEditPanel();
    overlay.classList.add('open');
    scheduleTimeInput.value = '';
    scheduleInput.value = '';
    editTimeInput.value = '';
    editInput.value = '';
    setTimeout(()=> scheduleInput.focus(), 50);
  }

  function updateEditPanel(){
    const editing = editingIndex !== null;
    editPanel.hidden = false;
    editPanel.style.display = editing ? 'block' : 'none';
    addForm.style.display = editing ? 'none' : 'flex';
  }

  function startEdit(index){
    const list = schedules[activeKey] || [];
    if(index < 0 || index >= list.length) return;
    editingIndex = index;
    editTimeInput.value = list[index].time || '';
    editInput.value = list[index].title;
    updateEditPanel();
    setTimeout(()=> editTimeInput.focus(), 50);
  }

  function stopEdit(){
    editingIndex = null;
    editTimeInput.value = '';
    editInput.value = '';
    updateEditPanel();
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
    list.forEach((entry, idx) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      const timeTag = document.createElement('span');
      timeTag.className = 'item-time';
      timeTag.textContent = entry.time ? entry.time : '';
      const titleTag = document.createElement('span');
      titleTag.className = 'item-title';
      titleTag.textContent = entry.title;
      span.appendChild(timeTag);
      span.appendChild(titleTag);
      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'edit';
      editBtn.textContent = '編集';
      editBtn.addEventListener('click', () => startEdit(idx));

      const delBtn = document.createElement('button');
      delBtn.className = 'del';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', () => {
        schedules[activeKey].splice(idx,1);
        if(schedules[activeKey].length === 0) delete schedules[activeKey];
        if(editingIndex === idx){
          stopEdit();
        } else if(editingIndex !== null && editingIndex > idx){
          editingIndex--;
        }
        saveSchedules();
        renderScheduleList();
        render();
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      li.appendChild(span);
      li.appendChild(actions);
      scheduleList.appendChild(li);
    });
  }

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = scheduleInput.value.trim();
    const time = scheduleTimeInput.value.trim();
    if(!title) return;
    if(!schedules[activeKey]) schedules[activeKey] = [];
    schedules[activeKey].push({ time, title });
    saveSchedules();
    scheduleInput.value = '';
    scheduleTimeInput.value = '';
    renderScheduleList();
    render();
    scheduleInput.focus();
  });

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if(editingIndex === null) return;
    const title = editInput.value.trim();
    const time = editTimeInput.value.trim();
    if(!title) return;
    schedules[activeKey][editingIndex] = { time, title };
    saveSchedules();
    renderScheduleList();
    render();
    stopEdit();
  });

  cancelEdit.addEventListener('click', stopEdit);

  closeModal.addEventListener('click', () => {
    stopEdit();
    overlay.classList.remove('open');
  });
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay){
      stopEdit();
      overlay.classList.remove('open');
    }
  });

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