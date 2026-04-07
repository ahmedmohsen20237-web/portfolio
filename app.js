/* ============================================
   نظام الاختبارات — app.js (موحّد)
   ============================================ */

'use strict';

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
let examData = {
  studentName:  '',
  durationMins: 30,
  randomCount:  2,
  questions:    [],
};

let examState = {
  mode:          'classic', // 'classic' | 'new'
  questions:     [],
  currentIndex:  0,
  answers:       {},
  visited:       new Set(),
  timerInterval: null,
  secondsLeft:   0,
  fontSize:      16,
};

/* ─────────────────────────────────────────────
   SCREEN HELPERS
───────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) {
    s.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
}

/* ─────────────────────────────────────────────
   SETUP SCREEN — Question Builder
───────────────────────────────────────────── */
var builderQuestions = [];
var builderCounter   = 0;

function createBuilderItem() {
  var id = ++builderCounter;
  var item = {
    id:           id,
    text:         '',
    passage:      '',
    passageTitle: 'القطعة',
    hasPassage:   false,
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
  var container = document.getElementById('questions-builder');
  var idx = builderQuestions.indexOf(item) + 1;

  var div = document.createElement('div');
  div.className = 'q-builder-item';
  div.dataset.id = item.id;

  div.innerHTML =
    '<div class="q-index-label">السؤال ' + idx + '</div>' +
    '<button class="remove-q-btn" onclick="removeBuilderQuestion(' + item.id + ')">✕ حذف</button>' +
    '<div class="form-group">' +
      '<label>نص السؤال</label>' +
      '<textarea placeholder="أدخل نص السؤال..." rows="3" oninput="updateBuilderField(' + item.id + ',\'text\',this.value)">' + item.text + '</textarea>' +
    '</div>' +
    '<label class="has-passage-toggle">' +
      '<input type="checkbox" ' + (item.hasPassage ? 'checked' : '') +
      ' onchange="togglePassage(' + item.id + ', this.checked)" />' +
      ' هذا السؤال مرتبط بقطعة نصية' +
    '</label>' +
    '<div class="passage-fields ' + (item.hasPassage ? 'visible' : '') + '" id="passage-fields-' + item.id + '">' +
      '<div class="form-group">' +
        '<label>عنوان القطعة</label>' +
        '<input type="text" value="' + item.passageTitle + '" oninput="updateBuilderField(' + item.id + ',\'passageTitle\',this.value)" placeholder="مثال: أديسون" />' +
      '</div>' +
      '<div class="form-group">' +
        '<label>نص القطعة</label>' +
        '<textarea rows="5" placeholder="أدخل نص القطعة هنا..." oninput="updateBuilderField(' + item.id + ',\'passage\',this.value)">' + item.passage + '</textarea>' +
      '</div>' +
    '</div>' +
    '<div class="form-group">' +
      '<label>الخيارات <span style="font-weight:400;color:#888;font-size:0.8em">(الدائرة = الإجابة الصحيحة)</span></label>' +
      '<div class="options-builder" id="opts-' + item.id + '">' +
        item.options.map(function(opt, i) { return buildOptionRow(item.id, i, opt); }).join('') +
      '</div>' +
      '<button class="add-option-btn" onclick="addOption(' + item.id + ')">+ إضافة خيار</button>' +
    '</div>';

  container.appendChild(div);
}

function buildOptionRow(qId, optIdx, opt) {
  return '<div class="option-row" id="opt-row-' + qId + '-' + optIdx + '">' +
    '<input type="radio" class="correct-radio" name="correct-' + qId + '"' +
    (opt.correct ? ' checked' : '') +
    ' onchange="setCorrect(' + qId + ', ' + optIdx + ')" title="حدد كإجابة صحيحة" />' +
    '<input type="text" placeholder="نص الخيار ' + (optIdx + 1) + '" value="' + opt.text + '"' +
    ' oninput="updateOption(' + qId + ', ' + optIdx + ', this.value)" />' +
    '<button class="remove-opt-btn" onclick="removeOption(' + qId + ', ' + optIdx + ')">✕</button>' +
    '</div>';
}

function updateBuilderField(id, field, value) {
  var item = builderQuestions.find(function(q) { return q.id === id; });
  if (item) item[field] = value;
}

function togglePassage(id, checked) {
  var item = builderQuestions.find(function(q) { return q.id === id; });
  if (!item) return;
  item.hasPassage = checked;
  var pf = document.getElementById('passage-fields-' + id);
  if (pf) pf.classList.toggle('visible', checked);
}

function setCorrect(qId, optIdx) {
  var item = builderQuestions.find(function(q) { return q.id === qId; });
  if (!item) return;
  item.options.forEach(function(o, i) { o.correct = (i === optIdx); });
}

function updateOption(qId, optIdx, value) {
  var item = builderQuestions.find(function(q) { return q.id === qId; });
  if (!item) return;
  item.options[optIdx].text = value;
}

function addOption(qId) {
  var item = builderQuestions.find(function(q) { return q.id === qId; });
  if (!item) return;
  item.options.push({ text: '', correct: false });
  var optIdx = item.options.length - 1;
  var container = document.getElementById('opts-' + qId);
  var row = document.createElement('div');
  row.innerHTML = buildOptionRow(qId, optIdx, item.options[optIdx]);
  container.appendChild(row.firstElementChild);
}

function removeOption(qId, optIdx) {
  var item = builderQuestions.find(function(q) { return q.id === qId; });
  if (!item || item.options.length <= 2) return;
  item.options.splice(optIdx, 1);
  var container = document.getElementById('opts-' + qId);
  container.innerHTML = item.options.map(function(opt, i) { return buildOptionRow(qId, i, opt); }).join('');
}

function removeBuilderQuestion(id) {
  var idx = builderQuestions.findIndex(function(q) { return q.id === id; });
  if (idx === -1) return;
  builderQuestions.splice(idx, 1);
  var el = document.querySelector('.q-builder-item[data-id="' + id + '"]');
  if (el) el.remove();
  document.querySelectorAll('.q-builder-item').forEach(function(el, i) {
    el.querySelector('.q-index-label').textContent = 'السؤال ' + (i + 1);
  });
}

function rebuildQuestionsFromDOM() {
  builderQuestions.forEach(function(item) {
    var el = document.querySelector('.q-builder-item[data-id="' + item.id + '"]');
    if (!el) return;
    var qTextArea = el.querySelector('textarea');
    if (qTextArea) item.text = qTextArea.value;
  });
}

/* ─────────────────────────────────────────────
   SETUP — START BUTTON
───────────────────────────────────────────── */
document.getElementById('add-question-btn').addEventListener('click', function() {
  createBuilderItem();
});

document.getElementById('start-exam-btn').addEventListener('click', function() {
  rebuildQuestionsFromDOM();

  var name         = document.getElementById('student-name').value.trim();
  var duration     = parseInt(document.getElementById('exam-duration').value) || 30;
  var randomCount  = parseInt(document.getElementById('random-count').value) || 0;

  if (!name) { alert('من فضلك أدخل اسم الطالب'); return; }
  if (builderQuestions.length === 0) { alert('من فضلك أضف سؤالاً واحداً على الأقل'); return; }

  for (var i = 0; i < builderQuestions.length; i++) {
    var q = builderQuestions[i];
    if (!q.text.trim()) { alert('السؤال ' + (i+1) + ': نص السؤال فارغ'); return; }
    var filled = q.options.filter(function(o) { return o.text.trim(); });
    if (filled.length < 2) { alert('السؤال ' + (i+1) + ': أضف خيارين على الأقل'); return; }
    var hasCorrect = q.options.some(function(o) { return o.correct && o.text.trim(); });
    if (!hasCorrect) { alert('السؤال ' + (i+1) + ': حدد الإجابة الصحيحة'); return; }
  }

  examData.studentName  = name;
  examData.durationMins = duration;
  examData.randomCount  = randomCount;
  examData.questions    = builderQuestions.map(function(q) {
    return {
      text:         q.text.trim(),
      passage:      q.hasPassage ? q.passage.trim() : '',
      passageTitle: q.hasPassage ? (q.passageTitle.trim() || 'القطعة') : '',
      options:      q.options.filter(function(o) { return o.text.trim(); }).map(function(o) {
        return { text: o.text.trim(), correct: o.correct };
      }),
    };
  });

  // Go to mode selection
  showScreen('mode-screen');
});

/* ─────────────────────────────────────────────
   MODE SELECTION
───────────────────────────────────────────── */
function backToSetup() {
  showScreen('setup-screen');
}

function selectMode(mode) {
  examState.mode = mode;
  if (mode === 'classic') {
    startClassicExam();
  } else {
    startNewExam();
  }
}

/* ─────────────────────────────────────────────
   SHARED: PREPARE QUESTIONS
───────────────────────────────────────────── */
function prepareQuestions() {
  var qs = examData.questions.slice();
  examState.questions    = qs;
  examState.currentIndex = 0;
  examState.answers      = {};
  examState.visited      = new Set();
  examState.secondsLeft  = examData.durationMins * 60;
  examState.fontSize     = 16;
}

/* ─────────────────────────────────────────────
   CLASSIC EXAM
───────────────────────────────────────────── */
function startClassicExam() {
  prepareQuestions();
  var qs = examState.questions;

  document.getElementById('sidebar-name').textContent  = examData.studentName;
  document.getElementById('stat-random').textContent   = examData.randomCount;
  document.getElementById('stat-total').textContent    = qs.length;
  document.getElementById('meta-count').textContent    = qs.length;
  document.getElementById('exam-title-bar').textContent = 'اختبار — ' + examData.studentName;

  buildNavGrid();
  renderQuestion(0);
  startTimer('timer-display', function() { endExam(); });

  showScreen('exam-screen');
}

function buildNavGrid() {
  var grid = document.getElementById('nav-grid');
  var cur  = document.getElementById('nav-current-pages');
  grid.innerHTML = '';
  cur.innerHTML  = '';

  var pageBtn = document.createElement('button');
  pageBtn.className   = 'nav-page-btn';
  pageBtn.textContent = '1';
  cur.appendChild(pageBtn);

  examState.questions.forEach(function(_, i) {
    var btn = document.createElement('button');
    btn.className = 'nav-btn not-visited';
    btn.textContent = i + 1;
    btn.dataset.index = i;
    btn.addEventListener('click', function() { goToQuestion(i); });
    grid.appendChild(btn);
  });
}

function updateNavGrid() {
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    var i = parseInt(btn.dataset.index);
    btn.classList.remove('not-visited', 'partial', 'current', 'answered');
    if (i === examState.currentIndex) btn.classList.add('current');
    if (examState.answers[i] !== undefined) {
      btn.classList.add('answered');
    } else {
      btn.classList.add('not-visited');
    }
  });

  var total      = examState.questions.length;
  var answered   = Object.keys(examState.answers).length;
  var notVisited = total - examState.visited.size;

  document.getElementById('count-answered').textContent    = answered;
  document.getElementById('count-not-visited').textContent = Math.max(0, notVisited);
  document.getElementById('count-partial').textContent     = 0;
}

function goToQuestion(index) {
  examState.currentIndex = index;
  renderQuestion(index);
}

function renderQuestion(index) {
  examState.visited.add(index);
  var q          = examState.questions[index];
  var panel      = document.getElementById('content-panel');

  document.getElementById('q-number-display').textContent = index + 1;
  document.getElementById('content-panel').style.fontSize = examState.fontSize + 'px';

  if (q.passage) {
    panel.classList.remove('no-passage');
    document.getElementById('passage-title').textContent = q.passageTitle || 'القطعة';
    document.getElementById('passage-body').innerHTML    = q.passage.replace(/\n/g, '<br/>');
  } else {
    panel.classList.add('no-passage');
  }

  document.getElementById('question-text').textContent = q.text;

  var optList = document.getElementById('options-list');
  optList.innerHTML = '';
  q.options.forEach(function(opt, i) {
    var item = document.createElement('div');
    item.className = 'option-item' + (examState.answers[index] === i ? ' selected' : '');
    item.innerHTML = '<div class="option-radio"></div><span class="option-text">' + opt.text + '</span>';
    item.addEventListener('click', function() { selectAnswer(index, i); });
    optList.appendChild(item);
  });

  updateNavGrid();
}

function selectAnswer(qIndex, optIndex) {
  examState.answers[qIndex] = optIndex;
  document.querySelectorAll('.option-item').forEach(function(el, i) {
    el.classList.toggle('selected', i === optIndex);
  });
  updateNavGrid();
}

/* Navigation buttons (classic) */
document.getElementById('btn-save').addEventListener('click', function() {
  var next = examState.currentIndex + 1;
  if (next < examState.questions.length) {
    goToQuestion(next);
  } else {
    showModal('لقد وصلت إلى آخر سؤال. هل تريد إنهاء الاختبار؟', endExam);
  }
});

document.getElementById('btn-prev').addEventListener('click', function() {
  if (examState.currentIndex > 0) {
    goToQuestion(examState.currentIndex - 1);
  }
});

/* Font size (classic) */
document.getElementById('font-increase').addEventListener('click', function() {
  examState.fontSize = Math.min(26, examState.fontSize + 2);
  document.getElementById('content-panel').style.fontSize = examState.fontSize + 'px';
});
document.getElementById('font-reset').addEventListener('click', function() {
  examState.fontSize = 16;
  document.getElementById('content-panel').style.fontSize = '16px';
});
document.getElementById('font-decrease').addEventListener('click', function() {
  examState.fontSize = Math.max(12, examState.fontSize - 2);
  document.getElementById('content-panel').style.fontSize = examState.fontSize + 'px';
});

/* End exam button (classic) */
document.getElementById('end-exam-btn').addEventListener('click', function() {
  showModal('هل تريد إنهاء الاختبار؟ لن تتمكن من العودة إليه.', endExam);
});

/* ─────────────────────────────────────────────
   NEW EXAM (Digital Paper Mode)
───────────────────────────────────────────── */
function startNewExam() {
  prepareQuestions();
  var qs = examState.questions;

  document.getElementById('new-sidebar-name').textContent = examData.studentName;
  document.getElementById('new-exam-title').textContent   = 'اختبار — ' + examData.studentName;
  document.getElementById('new-stat-total').textContent   = qs.length;
  document.getElementById('new-count-answered').textContent = '0';

  renderNewExamQuestions();
  updateNewProgress();
  startTimer('new-timer-display', function() { endExam(); });

  showScreen('new-exam-screen');
  window.scrollTo(0, 0);
}

var LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

function renderNewExamQuestions() {
  var body = document.getElementById('new-exam-body');
  body.innerHTML = '';

  examState.questions.forEach(function(q, qIndex) {
    var card = document.createElement('div');
    card.className = 'new-question-card';
    card.id = 'new-q-card-' + qIndex;

    var headerHtml =
      '<div class="new-q-header">' +
        '<span class="new-q-num">السؤال ' + (qIndex + 1) + '</span>' +
        '<span class="new-q-badge">' + (q.passage ? 'مع قطعة نصية' : '') + '</span>' +
      '</div>';

    var passageHtml = '';
    if (q.passage) {
      passageHtml =
        '<div class="new-q-passage">' +
          '<div class="new-q-passage-title">' + (q.passageTitle || 'القطعة') + '</div>' +
          '<div class="new-q-passage-body">' + q.passage.replace(/\n/g, '<br/>') + '</div>' +
        '</div>';
    }

    var optionsHtml = q.options.map(function(opt, i) {
      var letter = LETTERS[i] || String(i + 1);
      return '<div class="new-option-item" id="new-opt-' + qIndex + '-' + i + '" onclick="selectNewAnswer(' + qIndex + ',' + i + ')">' +
        '<div class="new-option-letter">' + letter + '</div>' +
        '<span class="new-option-text">' + opt.text + '</span>' +
      '</div>';
    }).join('');

    var bodyHtml =
      '<div class="new-q-body">' +
        '<div class="new-q-text">' + q.text + '</div>' +
        '<div class="new-options-list" id="new-opts-' + qIndex + '">' + optionsHtml + '</div>' +
      '</div>';

    card.innerHTML = headerHtml + passageHtml + bodyHtml;
    body.appendChild(card);
  });
}

function selectNewAnswer(qIndex, optIndex) {
  examState.answers[qIndex] = optIndex;

  // Update option visuals
  var optsContainer = document.getElementById('new-opts-' + qIndex);
  if (optsContainer) {
    optsContainer.querySelectorAll('.new-option-item').forEach(function(el, i) {
      el.classList.toggle('selected', i === optIndex);
    });
  }

  // Mark card as answered
  var card = document.getElementById('new-q-card-' + qIndex);
  if (card) card.classList.add('answered');

  updateNewProgress();
}

function updateNewProgress() {
  var total    = examState.questions.length;
  var answered = Object.keys(examState.answers).length;
  var pct      = total > 0 ? Math.round((answered / total) * 100) : 0;

  document.getElementById('new-count-answered').textContent = answered;
  var bar = document.getElementById('new-progress-bar');
  if (bar) bar.style.width = pct + '%';
}

/* New mode end buttons */
document.getElementById('new-end-exam-btn').addEventListener('click', function() {
  showModal('هل تريد إنهاء الاختبار؟ لن تتمكن من العودة إليه.', endExam);
});

document.getElementById('new-submit-btn').addEventListener('click', function() {
  var total    = examState.questions.length;
  var answered = Object.keys(examState.answers).length;
  var left     = total - answered;

  if (left > 0) {
    showModal('لم تجب على ' + left + ' سؤال بعد. هل تريد التسليم الآن؟', endExam);
  } else {
    showModal('هل تريد تسليم الاختبار؟', endExam);
  }
});

/* ─────────────────────────────────────────────
   SHARED TIMER
───────────────────────────────────────────── */
function startTimer(displayId, onEnd) {
  clearInterval(examState.timerInterval);
  renderTimerDisplay(displayId);
  examState.timerInterval = setInterval(function() {
    examState.secondsLeft--;
    renderTimerDisplay(displayId);
    if (examState.secondsLeft <= 0) {
      clearInterval(examState.timerInterval);
      onEnd();
    }
  }, 1000);
}

function renderTimerDisplay(displayId) {
  var s       = examState.secondsLeft;
  var m       = Math.floor(s / 60);
  var sec     = s % 60;
  var display = document.getElementById(displayId);
  if (!display) return;
  display.textContent = pad(m) + ':' + pad(sec);
  display.classList.remove('warning', 'danger');
  if (s <= 60)        display.classList.add('danger');
  else if (s <= 300)  display.classList.add('warning');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/* ─────────────────────────────────────────────
   END EXAM (shared)
───────────────────────────────────────────── */
function endExam() {
  clearInterval(examState.timerInterval);

  var total      = examState.questions.length;
  var answered   = Object.keys(examState.answers).length;
  var unAnswered = total - answered;

  document.getElementById('r-total').textContent      = total;
  document.getElementById('r-answered').textContent   = answered;
  document.getElementById('r-unanswered').textContent = unAnswered;

  showScreen('result-screen');
}

document.getElementById('restart-btn').addEventListener('click', function() {
  builderQuestions = [];
  builderCounter   = 0;
  document.getElementById('questions-builder').innerHTML = '';
  showScreen('setup-screen');
});

/* ─────────────────────────────────────────────
   MODAL
───────────────────────────────────────────── */
var _modalCallback = null;

function showModal(msg, onConfirm) {
  document.getElementById('modal-msg').textContent = msg;
  _modalCallback = onConfirm;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

document.getElementById('modal-confirm').addEventListener('click', function() {
  document.getElementById('modal-overlay').classList.add('hidden');
  if (typeof _modalCallback === 'function') _modalCallback();
  _modalCallback = null;
});

document.getElementById('modal-cancel').addEventListener('click', function() {
  document.getElementById('modal-overlay').classList.add('hidden');
  _modalCallback = null;
});

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
createBuilderItem();
