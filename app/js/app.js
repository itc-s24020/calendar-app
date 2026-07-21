(function(){
  const today = new Date();
  today.setHours(0,0,0,0);

  // 現在日を基準に、前後1年分だけ表示できるようにする
  // 表示可能範囲: config.js の rangeInMonths(既定12ヶ月=前後1年分)に従う
  const rangeMonths = (typeof CalendarConfig !== 'undefined') ? CalendarConfig.rangeInMonths : 12;
  const minMonth = new Date(today.getFullYear(), today.getMonth() - rangeMonths, 1);
  const maxMonth = new Date(today.getFullYear(), today.getMonth() + rangeMonths, 1);

  // 現在表示中の年月
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-11

  // 予定データ: { "YYYY-M-D": [ { time, title, memo } ] }
  // 古い {time,title} / 文字列配列も読み込み時に正規化する
  const STORAGE_KEY = 'calendar-app:schedules';
  const DRAFT_STORAGE_KEY = 'calendar-app:schedule-drafts';
  const maxSchedulePreview = (typeof CalendarConfig !== 'undefined' && CalendarConfig.maxSchedulePreview)
    ? CalendarConfig.maxSchedulePreview
    : 2;

  // localStorage から予定を読み込み、古い形式の文字列データも正規化する
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

  // 入力値を { time, title } に揃え、空データは除外する
  function normalizeScheduleEntry(entry){
    if(typeof entry === 'string'){
      const title = entry.trim();
      return title ? { time: '', title, memo: '' } : null;
    }
    if(!entry || typeof entry !== 'object') return null;
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    if(!title) return null;
    const time = typeof entry.time === 'string' ? entry.time.trim() : '';
    const memo = typeof entry.memo === 'string' ? entry.memo : '';
    return { time, title, memo };
  }

  function loadDrafts(){
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if(!raw) return {};
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed;
    } catch (err) {
      return {};
    }
  }

  function saveDrafts(){
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    } catch (err) {
      // 保存できない環境では何もしない
    }
  }

  function hasMemo(entry){
    return !!(entry.memo && entry.memo.trim());
  }

  function emptyAddDraft(){
    return { time: '', title: '', memo: '' };
  }

  function ensureDraftBucket(dateKey){
    if(!drafts[dateKey] || typeof drafts[dateKey] !== 'object'){
      drafts[dateKey] = { add: emptyAddDraft(), edit: null };
      return drafts[dateKey];
    }
    if(!drafts[dateKey].add || typeof drafts[dateKey].add !== 'object'){
      drafts[dateKey].add = emptyAddDraft();
    }
    if(!Object.prototype.hasOwnProperty.call(drafts[dateKey], 'edit')){
      drafts[dateKey].edit = null;
    }
    return drafts[dateKey];
  }

  // 保存失敗時はアプリを止めず、静かに無視する
  function saveSchedules(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
    } catch (err) {
      // 保存できない環境では何もしない
    }
  }

  // 予定一覧の実データ
  const schedules = loadSchedules();

  // 画面の主要な要素を先に取得しておく
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
  const scheduleMemoInput = document.getElementById('scheduleMemoInput');
  const editPanel = document.getElementById('editPanel');
  const editForm = document.getElementById('editForm');
  const editTimeInput = document.getElementById('editTimeInput');
  const editInput = document.getElementById('editInput');
  const editMemoInput = document.getElementById('editMemoInput');
  const cancelEdit = document.getElementById('cancelEdit');
  const closeModal = document.getElementById('closeModal');

  // モーダルで編集中の予定を追跡する
  let activeKey = null;
  let editingIndex = null;

  const drafts = loadDrafts();

  // 日付キーを保存用の文字列に変換する
  function keyOf(y,m,d){ return y+"-"+m+"-"+d; }

  // 1件の予定を表示用ラベルにまとめる
  function formatScheduleLabel(entry){
    const time = entry.time ? entry.time + ' ' : '';
    return time + entry.title;
  }

  function saveAddDraftForActiveDate(){
    if(!activeKey) return;
    const bucket = ensureDraftBucket(activeKey);
    bucket.add = {
      time: scheduleTimeInput.value,
      title: scheduleInput.value,
      memo: scheduleMemoInput.value
    };
    saveDrafts();
  }

  function restoreAddDraftForActiveDate(){
    const bucket = ensureDraftBucket(activeKey);
    const addDraft = bucket.add || emptyAddDraft();
    scheduleTimeInput.value = typeof addDraft.time === 'string' ? addDraft.time : '';
    scheduleInput.value = typeof addDraft.title === 'string' ? addDraft.title : '';
    scheduleMemoInput.value = typeof addDraft.memo === 'string' ? addDraft.memo : '';
  }

  function clearAddDraftForActiveDate(){
    if(!activeKey || !drafts[activeKey]) return;
    drafts[activeKey].add = emptyAddDraft();
    saveDrafts();
  }

  function saveEditDraftForActiveDate(){
    if(!activeKey || editingIndex === null) return;
    const bucket = ensureDraftBucket(activeKey);
    bucket.edit = {
      index: editingIndex,
      time: editTimeInput.value,
      title: editInput.value,
      memo: editMemoInput.value
    };
    saveDrafts();
  }

  function clearEditDraftForActiveDate(){
    if(!activeKey || !drafts[activeKey]) return;
    drafts[activeKey].edit = null;
    saveDrafts();
  }

  // 最小月判定に使うヘルパー
  function isSameMonth(y,m){
    return y === minMonth.getFullYear() && m === minMonth.getMonth();
  }

  // カレンダー全体を再描画する
  function render(){
    // ヘッダー表示を更新する
    yearLabel.textContent = viewYear + "年";
    monthLabel.innerHTML = '<span class="num">' + (viewMonth+1) + '</span> 月';

    // ナビゲーションは表示範囲を超えないように制御する
    const atMin = (viewYear === minMonth.getFullYear() && viewMonth === minMonth.getMonth());
    const atMax = (viewYear === maxMonth.getFullYear() && viewMonth === maxMonth.getMonth());
    prevBtn.disabled = atMin;
    nextBtn.disabled = atMax;

    rangeNote.textContent = minMonth.getFullYear()+"年"+(minMonth.getMonth()+1)+"月 〜 "+maxMonth.getFullYear()+"年"+(maxMonth.getMonth()+1)+"月の範囲で表示できます";

    // 月ごとの日付を作り直す
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
        const shown = list.slice(0, maxSchedulePreview);
        shown.forEach(entry => {
          const item = document.createElement('div');
          item.className = 'item';
          const title = document.createElement('span');
          title.textContent = formatScheduleLabel(entry);
          item.appendChild(title);
          if(hasMemo(entry)){
            const badge = document.createElement('span');
            badge.className = 'memo-badge';
            badge.textContent = 'MEMO';
            item.appendChild(badge);
          }
          listEl.appendChild(item);
        });
        if(list.length > maxSchedulePreview){
          const more = document.createElement('div');
          more.className = 'more-count';
          more.textContent = '他 ' + (list.length-maxSchedulePreview) + ' 件';
          listEl.appendChild(more);
        }
        cell.appendChild(listEl);
      }

      cell.addEventListener('click', () => openModal(viewYear, viewMonth, dayNum));
      grid.appendChild(cell);
    }
  }

  // 選択した日付の予定入力モーダルを開く
  function openModal(y,m,d){
    activeKey = keyOf(y,m,d);
    editingIndex = null;
    modalDate.textContent = y + '年 ' + (m+1) + '月 ' + d + '日 の予定';
    renderScheduleList();
    updateEditPanel();
    overlay.classList.add('open');
    restoreAddDraftForActiveDate();
    editTimeInput.value = '';
    editInput.value = '';
    editMemoInput.value = '';
    setTimeout(()=> scheduleInput.focus(), 50);
  }

  // 編集フォームと追加フォームの表示を切り替える
  function updateEditPanel(){
    const editing = editingIndex !== null;
    editPanel.hidden = false;
    editPanel.style.display = editing ? 'block' : 'none';
    addForm.style.display = editing ? 'none' : 'flex';
  }

  // 選択中の予定を編集状態に入れる
  function startEdit(index){
    const list = schedules[activeKey] || [];
    if(index < 0 || index >= list.length) return;
    editingIndex = index;
    const bucket = ensureDraftBucket(activeKey);
    const editDraft = bucket.edit;
    if(editDraft && editDraft.index === index){
      editTimeInput.value = typeof editDraft.time === 'string' ? editDraft.time : '';
      editInput.value = typeof editDraft.title === 'string' ? editDraft.title : list[index].title;
      editMemoInput.value = typeof editDraft.memo === 'string' ? editDraft.memo : (list[index].memo || '');
    } else {
      editTimeInput.value = list[index].time || '';
      editInput.value = list[index].title;
      editMemoInput.value = list[index].memo || '';
    }
    updateEditPanel();
    setTimeout(()=> editTimeInput.focus(), 50);
  }

  // 編集状態を解除して追加フォームに戻す
  function stopEdit(){
    editingIndex = null;
    editTimeInput.value = '';
    editInput.value = '';
    editMemoInput.value = '';
    updateEditPanel();
    setTimeout(()=> scheduleInput.focus(), 50);
  }

  // モーダル内の予定一覧を描画する
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
      span.className = 'item-main';
      const timeTag = document.createElement('span');
      timeTag.className = 'item-time';
      timeTag.textContent = entry.time ? entry.time : '';
      const titleTag = document.createElement('span');
      titleTag.className = 'item-title';
      titleTag.textContent = entry.title;
      span.appendChild(timeTag);
      span.appendChild(titleTag);
      if(hasMemo(entry)){
        const badge = document.createElement('span');
        badge.className = 'memo-badge';
        badge.textContent = 'MEMO';
        span.appendChild(badge);
      }
      const content = document.createElement('div');
      content.className = 'item-content';
      content.appendChild(span);
      if(hasMemo(entry)){
        const memoTag = document.createElement('div');
        memoTag.className = 'item-memo';
        memoTag.textContent = entry.memo;
        content.appendChild(memoTag);
      }
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
          clearEditDraftForActiveDate();
        } else if(editingIndex !== null && editingIndex > idx){
          editingIndex--;
        }
        const bucket = ensureDraftBucket(activeKey);
        if(bucket.edit && bucket.edit.index === idx){
          bucket.edit = null;
          saveDrafts();
        } else if(bucket.edit && bucket.edit.index > idx){
          bucket.edit.index--;
          saveDrafts();
        }
        saveSchedules();
        renderScheduleList();
        render();
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      li.appendChild(content);
      li.appendChild(actions);
      scheduleList.appendChild(li);
    });
  }

  // 予定追加フォームの送信処理
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = scheduleInput.value.trim();
    const time = scheduleTimeInput.value.trim();
    const memo = scheduleMemoInput.value;
    if(!title) return;
    if(!schedules[activeKey]) schedules[activeKey] = [];
    schedules[activeKey].push({ time, title, memo });
    saveSchedules();
    scheduleInput.value = '';
    scheduleTimeInput.value = '';
    scheduleMemoInput.value = '';
    clearAddDraftForActiveDate();
    renderScheduleList();
    render();
    scheduleInput.focus();
  });

  // 編集フォームの送信処理
  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if(editingIndex === null) return;
    const title = editInput.value.trim();
    const time = editTimeInput.value.trim();
    const memo = editMemoInput.value;
    if(!title) return;
    schedules[activeKey][editingIndex] = { time, title, memo };
    saveSchedules();
    clearEditDraftForActiveDate();
    renderScheduleList();
    render();
    stopEdit();
  });

  scheduleTimeInput.addEventListener('input', saveAddDraftForActiveDate);
  scheduleInput.addEventListener('input', saveAddDraftForActiveDate);
  scheduleMemoInput.addEventListener('input', saveAddDraftForActiveDate);
  editTimeInput.addEventListener('input', saveEditDraftForActiveDate);
  editInput.addEventListener('input', saveEditDraftForActiveDate);
  editMemoInput.addEventListener('input', saveEditDraftForActiveDate);

  // 編集をやめて入力内容をリセットする
  cancelEdit.addEventListener('click', stopEdit);

  // モーダルを閉じるときは編集状態も戻す
  closeModal.addEventListener('click', () => {
    stopEdit();
    overlay.classList.remove('open');
  });
  // 背景クリックでモーダルを閉じる
  overlay.addEventListener('click', (e) => {
    if(e.target === overlay){
      stopEdit();
      overlay.classList.remove('open');
    }
  });

  // 月移動ボタンの操作
  prevBtn.addEventListener('click', () => {
    if(prevBtn.disabled) return;
    viewMonth--;
    if(viewMonth < 0){ viewMonth = 11; viewYear--; }
    render();
  });
  // 次月へ進む
  nextBtn.addEventListener('click', () => {
    if(nextBtn.disabled) return;
    viewMonth++;
    if(viewMonth > 11){ viewMonth = 0; viewYear++; }
    render();
  });
  // 今日の月へ戻す
  todayBtn.addEventListener('click', () => {
    viewYear = today.getFullYear();
    viewMonth = today.getMonth();
    render();
  });

  // 初期描画
  render();
})();