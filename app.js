/* ============================================
   نظام الاختبارات — app.js
   ============================================ */

'use strict';

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let examData = {
  studentName:  '',
  durationMins: 30,
  randomCount:  2,
  questions:    [],  // { text, passage:'', passageTitle:'', options:[], correctIndex }
};

let examState = {
  questions:       [],  // shuffled / ordered questions for this session
  currentIndex:    0,
  answers:         {},  // { qIndex: optionIndex }
  visited:         new Set(),
  timerInterval:   null,
  secondsLeft:     0,
  fontSize:        16,  // px
};

/* ─────────────────────────────────────────────
   SCREEN HELPERS
───────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ─────────────────────────────────────────────
   SETUP SCREEN — Question Builder
───────────────────────────────────────────── */
let builderQuestions = []; // array of { id, text, passage, passageTitle, options:[{text,correct}] }
let builderCounter = 0;

function createBuilderItem() {
  const id = ++builderCounter;
  const item = {
    id,
    text: '',
    passage: '',
    passageTitle: 'القطعة',
    hasPassage: false,
    options: [
      { text: '', correct: true  },
      { text: '', correct: false },
      { text: '', correct: false },
      { text: '', correct: false },
    ],
  };
  builderQuestions.push(item);
  renderBuilderItem(item);
}

function renderBuilderItem(item) {
  const container = document.getElementById('questions-builder');
  const idx = builderQuestions.indexOf(item) + 1;

  const div = document.createElement('div');
  div.className = 'q-builder-item';
  div.dataset.id = item.id;

  div.innerHTML = `
    <div class="q-index-label">السؤال ${idx}</div>
    <button class="remove-q-btn" onclick="removeBuilderQuestion(${item.id})">✕ حذف</button>

    <div class="form-group">
      <label>نص السؤال</label>
      <textarea placeholder="أدخل نص السؤال..." rows="3" oninput="updateBuilderField(${item.id},'text',this.value)">${item.text}</textarea>
    </div>

    <label class="has-passage-toggle">
      <input type="checkbox" ${item.hasPassage ? 'checked' : ''}
             onchange="togglePassage(${item.id}, this.checked)" />
      هذا السؤال مرتبط بقطعة نصية
    </label>

    <div class="passage-fields ${item.hasPassage ? 'visible' : ''}" id="passage-fields-${item.id}">
      <div class="form-group">
        <label>عنوان القطعة</label>
        <input type="text" value="${item.passageTitle}"
               oninput="updateBuilderField(${item.id},'passageTitle',this.value)"
               placeholder="مثال: أديسون" />
      </div>
      <div class="form-group">
        <label>نص القطعة</label>
        <textarea rows="5" placeholder="أدخل نص القطعة هنا..."
                  oninput="updateBuilderField(${item.id},'passage',this.value)">${item.passage}</textarea>
      </div>
    </div>

    <div class="form-group">
      <label>الخيارات <span style="font-weight:400;color:#888;font-size:0.8em">(الدائرة الخضراء = الإجابة الصحيحة)</span></label>
      <div class="options-builder" id="opts-${item.id}">
        ${item.options.map((opt, i) => buildOptionRow(item.id, i, opt)).join('')}
      </div>
      <button class="add-option-btn" onclick="addOption(${item.id})">+ إضافة خيار</button>
    </div>
  `;

  container.appendChild(div);
}

function buildOptionRow(qId, optIdx, opt) {
  return `
    <div class="option-row" id="opt-row-${qId}-${optIdx}">
      <input type="radio" class="correct-radio" name="correct-${qId}"
             ${opt.correct ? 'checked' : ''}
             onchange="setCorrect(${qId}, ${optIdx})" title="حدد كإجابة صحيحة" />
      <input type="text" placeholder="نص الخيار ${optIdx + 1}"
             value="${opt.text}"
             oninput="updateOption(${qId}, ${optIdx}, this.value)" />
      <button class="remove-opt-btn" onclick="removeOption(${qId}, ${optIdx})">✕</button>
    </div>
  `;
}

function updateBuilderField(id, field, value) {
  const item = builderQuestions.find(q => q.id === id);
  if (item) item[field] = value;
}

function togglePassage(id, checked) {
  const item = builderQuestions.find(q => q.id === id);
  if (!item) return;
  item.hasPassage = checked;
  const pf = document.getElementById(`passage-fields-${id}`);
  if (pf) pf.classList.toggle('visible', checked);
}

function setCorrect(qId, optIdx) {
  const item = builderQuestions.find(q => q.id === qId);
  if (!item) return;
  item.options.forEach((o, i) => o.correct = (i === optIdx));
}

function updateOption(qId, optIdx, value) {
  const item = builderQuestions.find(q => q.id === qId);
  if (!item) return;
  item.options[optIdx].text = value;
}

function addOption(qId) {
  const item = builderQuestions.find(q => q.id === qId);
  if (!item) return;
  item.options.push({ text: '', correct: false });
  const optIdx = item.options.length - 1;
  const container = document.getElementById(`opts-${qId}`);
  const row = document.createElement('div');
  row.innerHTML = buildOptionRow(qId, optIdx, item.options[optIdx]);
  container.appendChild(row.firstElementChild);
}

function removeOption(qId, optIdx) {
  const item = builderQuestions.find(q => q.id === qId);
  if (!item || item.options.length <= 2) return;
  item.options.splice(optIdx, 1);
  // Re-render options for this question
  const container = document.getElementById(`opts-${qId}`);
  container.innerHTML = item.options.map((opt, i) => buildOptionRow(qId, i, opt)).join('');
}

function removeBuilderQuestion(id) {
  const idx = builderQuestions.findIndex(q => q.id === id);
  if (idx === -1) return;
  builderQuestions.splice(idx, 1);
  const el = document.querySelector(`.q-builder-item[data-id="${id}"]`);
  if (el) el.remove();
  // Re-number remaining questions
  document.querySelectorAll('.q-builder-item').forEach((el, i) => {
    el.querySelector('.q-index-label').textContent = `السؤال ${i + 1}`;
  });
}

function rebuildQuestionsFromDOM() {
  // Sync textarea/input values into builderQuestions (in case of direct typing)
  builderQuestions.forEach(item => {
    const el = document.querySelector(`.q-builder-item[data-id="${item.id}"]`);
    if (!el) return;
    const qTextArea = el.querySelector('textarea');
    if (qTextArea) item.text = qTextArea.value;
  });
}

/* ─────────────────────────────────────────────
   START EXAM
───────────────────────────────────────────── */
document.getElementById('add-question-btn').addEventListener('click', () => {
  createBuilderItem();
});

document.getElementById('start-exam-btn').addEventListener('click', () => {
  rebuildQuestionsFromDOM();

  const name = document.getElementById('student-name').value.trim();
  const duration = parseInt(document.getElementById('exam-duration').value) || 30;
  const randomCount = parseInt(document.getElementById('random-count').value) || 0;

  if (!name) { alert('من فضلك أدخل اسم الطالب'); return; }
  if (builderQuestions.length === 0) { alert('من فضلك أضف سؤالاً واحداً على الأقل'); return; }

  // Validate questions
  for (let i = 0; i < builderQuestions.length; i++) {
    const q = builderQuestions[i];
    if (!q.text.trim()) { alert(`السؤال ${i+1}: نص السؤال فارغ`); return; }
    const filled = q.options.filter(o => o.text.trim());
    if (filled.length < 2) { alert(`السؤال ${i+1}: أضف خيارين على الأقل`); return; }
    const hasCorrect = q.options.some(o => o.correct && o.text.trim());
    if (!hasCorrect) { alert(`السؤال ${i+1}: حدد الإجابة الصحيحة`); return; }
  }

  examData.studentName  = name;
  examData.durationMins = duration;
  examData.randomCount  = randomCount;
  examData.questions    = builderQuestions.map(q => ({
    text:         q.text.trim(),
    passage:      q.hasPassage ? q.passage.trim() : '',
    passageTitle: q.hasPassage ? (q.passageTitle.trim() || 'القطعة') : '',
    options:      q.options.filter(o => o.text.trim()).map(o => ({
      text:    o.text.trim(),
      correct: o.correct,
    })),
  }));

  startExam();
});

/* ─────────────────────────────────────────────
   EXAM LOGIC
───────────────────────────────────────────── */
function startExam() {
  const qs = [...examData.questions];
  examState.questions    = qs;
  examState.currentIndex = 0;
  examState.answers      = {};
  examState.visited      = new Set();
  examState.secondsLeft  = examData.durationMins * 60;
  examState.fontSize     = 16;

  // Init sidebar counts
  document.getElementById('sidebar-name').textContent = examData.studentName;
  document.getElementById('stat-random').textContent  = examData.randomCount;
  document.getElementById('stat-total').textContent   = qs.length;
  document.getElementById('meta-count').textContent   = qs.length;
  document.getElementById('exam-title-bar').textContent = `اختبار — ${examData.studentName}`;

  buildNavGrid();
  renderQuestion(0);
  startTimer();

  showScreen('exam-screen');
}

function buildNavGrid() {
  const grid = document.getElementById('nav-grid');
  const cur  = document.getElementById('nav-current-pages');
  grid.innerHTML = '';
  cur.innerHTML  = '';

  // Current page indicator — show page 1/1 (single page for now)
  const pageBtn = document.createElement('button');
  pageBtn.className = 'nav-page-btn';
  pageBtn.textContent = '1';
  cur.appendChild(pageBtn);

  examState.questions.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'nav-btn not-visited';
    btn.textContent = i + 1;
    btn.dataset.index = i;
    btn.addEventListener('click', () => {
      goToQuestion(i);
    });
    grid.appendChild(btn);
  });
}

function updateNavGrid() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const i = parseInt(btn.dataset.index);
    btn.classList.remove('not-visited', 'partial', 'current', 'answered');
    if (i === examState.currentIndex) btn.classList.add('current');
    if (examState.answers[i] !== undefined) {
      btn.classList.add('answered');
    } else {
      btn.classList.add('not-visited');
    }
  });

  // Update counters
  const total     = examState.questions.length;
  const answered  = Object.keys(examState.answers).length;
  const notVisited = total - examState.visited.size;

  document.getElementById('count-answered').textContent   = answered;
  document.getElementById('count-not-visited').textContent = Math.max(0, notVisited);
  document.getElementById('count-partial').textContent    = 0;
}

function goToQuestion(index) {
  examState.currentIndex = index;
  renderQuestion(index);
}

function renderQuestion(index) {
  examState.visited.add(index);
  const q = examState.questions[index];
  const panel = document.getElementById('content-panel');
  const passageSide = document.getElementById('passage-side');
  const questionSide = document.getElementById('question-side');

  // Q number
  document.getElementById('q-number-display').textContent = index + 1;

  // Font size
  document.getElementById('content-panel').style.fontSize = examState.fontSize + 'px';

  // Passage
  if (q.passage) {
    panel.classList.remove('no-passage');
    document.getElementById('passage-title').textContent = q.passageTitle || 'القطعة';
    document.getElementById('passage-body').innerHTML = q.passage.replace(/\n/g, '<br/>');
  } else {
    panel.classList.add('no-passage');
  }

  // Question text
  document.getElementById('question-text').textContent = q.text;

  // Options
  const optList = document.getElementById('options-list');
  optList.innerHTML = '';
  q.options.forEach((opt, i) => {
    const item = document.createElement('div');
    item.className = 'option-item' + (examState.answers[index] === i ? ' selected' : '');
    item.innerHTML = `<div class="option-radio"></div><span class="option-text">${opt.text}</span>`;
    item.addEventListener('click', () => selectAnswer(index, i));
    optList.appendChild(item);
  });

  updateNavGrid();
}

function selectAnswer(qIndex, optIndex) {
  examState.answers[qIndex] = optIndex;
  // Re-render options highlighting
  document.querySelectorAll('.option-item').forEach((el, i) => {
    el.classList.toggle('selected', i === optIndex);
  });
  updateNavGrid();
}

/* ─────────────────────────────────────────────
   NAVIGATION BUTTONS
───────────────────────────────────────────── */
document.getElementById('btn-save').addEventListener('click', () => {
  const next = examState.currentIndex + 1;
  if (next < examState.questions.length) {
    goToQuestion(next);
  } else {
    // Last question — offer to end
    showModal('لقد وصلت إلى آخر سؤال. هل تريد إنهاء الاختبار؟', endExam);
  }
});

document.getElementById('btn-prev').addEventListener('click', () => {
  if (examState.currentIndex > 0) {
    goToQuestion(examState.currentIndex - 1);
  }
});

/* ─────────────────────────────────────────────
   FONT SIZE
───────────────────────────────────────────── */
document.getElementById('font-increase').addEventListener('click', () => {
  examState.fontSize = Math.min(26, examState.fontSize + 2);
  document.getElementById('content-panel').style.fontSize = examState.fontSize + 'px';
});
document.getElementById('font-reset').addEventListener('click', () => {
  examState.fontSize = 16;
  document.getElementById('content-panel').style.fontSize = '16px';
});
document.getElementById('font-decrease').addEventListener('click', () => {
  examState.fontSize = Math.max(12, examState.fontSize - 2);
  document.getElementById('content-panel').style.fontSize = examState.fontSize + 'px';
});

/* ─────────────────────────────────────────────
   TIMER
───────────────────────────────────────────── */
function startTimer() {
  clearInterval(examState.timerInterval);
  renderTimer();
  examState.timerInterval = setInterval(() => {
    examState.secondsLeft--;
    renderTimer();
    if (examState.secondsLeft <= 0) {
      clearInterval(examState.timerInterval);
      endExam();
    }
  }, 1000);
}

function renderTimer() {
  const s = examState.secondsLeft;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const display = document.getElementById('timer-display');
  display.textContent = `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  display.classList.remove('warning','danger');
  if (s <= 60)  display.classList.add('danger');
  else if (s <= 300) display.classList.add('warning');
}

/* ─────────────────────────────────────────────
   END EXAM
───────────────────────────────────────────── */
document.getElementById('end-exam-btn').addEventListener('click', () => {
  showModal('هل تريد إنهاء الاختبار؟ لن تتمكن من العودة إليه.', endExam);
});

function endExam() {
  clearInterval(examState.timerInterval);

  const total     = examState.questions.length;
  const answered  = Object.keys(examState.answers).length;
  const unAnswered = total - answered;

  document.getElementById('r-total').textContent     = total;
  document.getElementById('r-answered').textContent  = answered;
  document.getElementById('r-unanswered').textContent = unAnswered;

  showScreen('result-screen');
}

document.getElementById('restart-btn').addEventListener('click', () => {
  // Reset state
  builderQuestions = [];
  builderCounter   = 0;
  document.getElementById('questions-builder').innerHTML = '';
  showScreen('setup-screen');
});

/* ─────────────────────────────────────────────
   MODAL
───────────────────────────────────────────── */
let _modalCallback = null;

function showModal(msg, onConfirm) {
  document.getElementById('modal-msg').textContent = msg;
  _modalCallback = onConfirm;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

document.getElementById('modal-confirm').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
  if (typeof _modalCallback === 'function') _modalCallback();
  _modalCallback = null;
});

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
  _modalCallback = null;
});

/* ─────────────────────────────────────────────
   INIT — add one question by default
───────────────────────────────────────────── */
createBuilderItem();
