/* ============================================================
   app.js — منصة الوسام التعليمية v3.0
============================================================ */

const FIREBASE_CONFIG = {
  apiKey:"AIzaSyAek8K6nHzxAUiGM6ZvLfeFmzDsFjt1ABE",authDomain:"my-quiz-platform-c1a08.firebaseapp.com",
  databaseURL:"https://my-quiz-platform-c1a08-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:"my-quiz-platform-c1a08",storageBucket:"my-quiz-platform-c1a08.firebasestorage.app",
  messagingSenderId:"361533364886",appId:"1:361533364886:web:60875464941f706277c0b7"
};
firebase.initializeApp(FIREBASE_CONFIG);
const db=firebase.database(),auth=firebase.auth(),storage=firebase.storage();

let currentUser=null,isAdminMode=false,authListeners=[];
function onAuthStateChange(cb){authListeners.push(cb);}
auth.onAuthStateChanged(user=>{
  currentUser=user;isAdminMode=!!user;
  if(user){sessionStorage.setItem('adminMode','1');document.body.classList.add('admin-mode');}
  else{sessionStorage.removeItem('adminMode');document.body.classList.remove('admin-mode');}
  authListeners.forEach(cb=>cb(user,isAdminMode));
});
async function adminSignIn(e,p){try{return await auth.signInWithEmailAndPassword(e,p);}catch(e){throw translateAuthError(e);}}
async function adminSignOut(){await auth.signOut();}
function translateAuthError(e){const m={'auth/invalid-email':'البريد غير صالح','auth/user-not-found':'المستخدم غير موجود','auth/wrong-password':'كلمة المرور غير صحيحة','auth/invalid-credential':'بيانات الاعتماد غير صحيحة','auth/too-many-requests':'تجاوزت عدد المحاولات','auth/network-request-failed':'خطأ في الشبكة','auth/user-disabled':'الحساب معطّل'};const err=new Error(m[e.code]||'خطأ في المصادقة');err.code=e.code;return err;}

async function dbSaveQuiz(d){if(!currentUser)throw new Error('يجب تسجيل الدخول كأدمن');const r=await db.ref('quizzes').push(d);return r.key;}
async function dbUpdateQuiz(id,d){if(!currentUser)throw new Error('يجب تسجيل الدخول كأدمن');await db.ref('quizzes/'+id).set(d);}
async function dbDeleteQuiz(id){if(!currentUser)throw new Error('يجب تسجيل الدخول كأدمن');await db.ref('quizzes/'+id).remove();}
function dbListenQuizzes(cb,errCb){db.ref('quizzes').on('value',snap=>{const d=snap.val();cb(d?Object.entries(d).map(([fid,qd])=>({...qd,firebaseId:fid,id:fid})):[]);},e=>{console.error(e);errCb&&errCb(e);});}
async function dbSaveAnalytics(qid,data){try{const uid=currentUser?currentUser.uid:'anon_'+Date.now();await db.ref(`analytics/${qid}/${uid}`).set({...data,timestamp:Date.now()});}catch(e){console.warn(e);}}
async function dbSaveFolder(d){if(!currentUser)throw new Error('يجب تسجيل الدخول');const r=await db.ref('folders').push(d);return r.key;}
async function dbDeleteFolder(id){if(!currentUser)throw new Error('يجب تسجيل الدخول');await db.ref('folders/'+id).remove();}
function dbListenFolders(cb){db.ref('folders').on('value',snap=>{AppFolders=snap.val()||{};cb(AppFolders);});}
async function dbSaveBank(d){if(!currentUser)throw new Error('يجب تسجيل الدخول');const r=await db.ref('banks').push(d);return r.key;}
async function dbUpdateBank(id,d){if(!currentUser)throw new Error('يجب تسجيل الدخول');await db.ref('banks/'+id).set(d);}
async function dbDeleteBank(id){if(!currentUser)throw new Error('يجب تسجيل الدخول');await db.ref('banks/'+id).remove();}
function dbListenBanks(cb){db.ref('banks').on('value',snap=>{AppBanks=snap.val()||{};cb(AppBanks);});}

const AppState={
  tests:[],errors:JSON.parse(localStorage.getItem('quizErrors')||'[]'),
  goal:JSON.parse(localStorage.getItem('quizGoal')||'null'),
  scores:JSON.parse(localStorage.getItem('quizScores')||'{}'),
  adminSettings:JSON.parse(localStorage.getItem('adminSettings')||'{"categorizedErrors":false,"showNotesLive":true}'),
  progress:JSON.parse(localStorage.getItem('quizProgress')||'{}'),
  currentTest:null,currentQ:0,userAnswers:[],timerInterval:null,elapsedSecs:0,
  builderQuestions:[],parsedQuestions:[],editingQuizId:null,editQuestions:[],
  pendingDeleteId:null,deleteMode:'test',
  pomodoro:{running:false,phase:'focus',focusMins:25,breakMins:5,totalSessions:4,currentSession:1,completedSessions:0,remaining:1500,interval:null},
  tools:{cd:{running:false,interval:null,remaining:0},sw:{running:false,interval:null,elapsed:0,laps:[]},qt:{running:false,interval:null,remaining:0,qIdx:0,total:0,perQ:30}}
};
let AppFolders={},AppBanks={},selectedFolderEmoji='📁',currentFolderView=null;

function escapeHtml(s){if(!s&&s!==0)return'';return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function fmtTime(s){const t=Math.max(0,s);return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
function $id(id){return document.getElementById(id);}
function setText(id,v){const e=$id(id);if(e)e.textContent=v;}
function setVal(id,v){const e=$id(id);if(e)e.value=v;}
function openModal(id){const e=$id(id);if(e)e.classList.add('open');}
function closeModal(id){const e=$id(id);if(e){e.classList.add('closing');setTimeout(()=>e.classList.remove('open','closing'),200);}}
function persistAll(){localStorage.setItem('quizScores',JSON.stringify(AppState.scores));localStorage.setItem('quizErrors',JSON.stringify(AppState.errors));}

const TICONS={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
function showToast(msg,type='success',dur=3500){
  const tc=$id('toast-container');if(!tc)return;
  const t=document.createElement('div');t.className='toast '+type;
  t.innerHTML=`<span class="toast-icon">${TICONS[type]||''}</span><span>${escapeHtml(msg)}</span>`;
  tc.appendChild(t);setTimeout(()=>{t.style.animation='toastOut .3s ease forwards';setTimeout(()=>t.remove(),300);},dur);
}
function showLoadingScreen(txt){const e=$id('loading-screen');if(e)e.classList.remove('hidden','fade-out');if(txt)setText('loading-sub-text',txt);}
function hideLoadingScreen(){const e=$id('loading-screen');if(e){e.classList.add('fade-out');setTimeout(()=>e.classList.add('hidden'),600);}}
function initTheme(){applyTheme(localStorage.getItem('sitetheme')||'dark');}
function applyTheme(t){const icon=$id('theme-icon');if(t==='light'){document.body.classList.add('light-mode');if(icon)icon.className='fa-solid fa-moon';}else{document.body.classList.remove('light-mode');if(icon)icon.className='fa-solid fa-sun';}localStorage.setItem('sitetheme',t);}
function toggleTheme(){applyTheme(document.body.classList.contains('light-mode')?'dark':'light');}
document.addEventListener('click',e=>{if(e.target.classList.contains('modal-overlay')&&e.target.classList.contains('open')&&e.target.id!=='admin-login-modal')closeModal(e.target.id);});
/* ── Navigation ── */
function showPage(name){
  if(name==='admin'&&!isAdminMode){openAdminLoginModal();return;}
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const t=$id('page-'+name);if(!t)return;t.classList.add('active');
  const inits={home:renderHome,errors:renderErrors,admin:()=>{renderManageList();loadAdminSettings();},tools:initToolsPage,banks:renderBanksPage,analytics:renderAnalyticsPage};
  if(inits[name])inits[name]();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ── Home ── */
function renderHome(){
  const{tests,scores,errors}=AppState;
  const done=Object.keys(scores).length,vals=Object.values(scores);
  const avg=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;
  setText('stat-total',tests.length);setText('stat-done',done);setText('stat-avg',avg!==null?avg+'%':'—');setText('stat-errors',errors.length);setText('stat-banks',Object.keys(AppBanks).length);
  renderGoal(done);renderFoldersSection();renderTestsGrid();
}
function renderGoal(done){
  const g=AppState.goal;if(!g)return;
  const pct=g.target?Math.min(100,Math.round(done/g.target*100)):0;
  setText('goal-title',g.name||'هدفي');setText('goal-desc',pct+'% من الهدف مكتمل');setText('goal-done-lbl',done+' مكتمل');setText('goal-target-lbl','الهدف: '+(g.target||'—'));
  const b=$id('goal-bar');if(b)b.style.width=pct+'%';
}
function renderTestsGrid(){
  const{tests,scores}=AppState;const grid=$id('tests-grid');if(!grid)return;
  const frag=document.createDocumentFragment();
  if(!tests.length){const e=document.createElement('div');e.className='quizzes-empty';e.innerHTML='<div class="empty-icon">📭</div><h3>لا توجد اختبارات بعد</h3><p>أضف اختباراً من لوحة الإدارة</p>';frag.appendChild(e);}
  tests.forEach((t,idx)=>{
    const sc=scores[t.id];let badge='<span class="test-badge badge-new">جديد</span>',bar='';
    if(sc!==undefined){badge=sc>=70?'<span class="test-badge badge-done">مكتمل ✓</span>':'<span class="test-badge badge-retry">راجع أخطاءك</span>';const cls=sc>=80?'fill-green':sc>=60?'fill-yellow':'fill-red';bar=`<div class="test-score-bar"><div class="test-score-fill ${cls}" style="width:${sc}%"></div></div>`;}
    const card=document.createElement('div');card.className='test-card';card.onclick=()=>startQuiz(t.firebaseId);
    card.innerHTML=`<button class="test-card-del admin-only-inline" onclick="event.stopPropagation();requestDeleteTest('${t.firebaseId}')">🗑️</button><div class="test-card-top"><div class="test-num">${idx+1}</div>${badge}</div><div class="test-title">${escapeHtml(t.name)}</div><div class="test-meta"><span>📝 ${t.questions?.length||0} سؤال</span><span>⏱️ ${t.timeLimit?t.timeLimit+' د':'بلا حد'}</span>${t.subject?`<span>📚 ${escapeHtml(t.subject)}</span>`:''} ${sc!==undefined?`<span style="color:${sc>=70?'var(--green)':sc>=50?'var(--accent)':'var(--red)'}">🎯 ${sc}%</span>`:''}</div>${bar}`;
    frag.appendChild(card);
  });
  if(isAdminMode){const a=document.createElement('div');a.className='add-card';a.onclick=()=>showPage('admin');a.innerHTML='<span style="font-size:1.4rem">➕</span><span>أضف اختباراً جديداً</span>';frag.appendChild(a);}
  grid.innerHTML='';grid.appendChild(frag);
  document.querySelectorAll('.admin-only-inline').forEach(e=>e.style.display=isAdminMode?'':'none');
}
function openGoalModal(){const g=AppState.goal;if(g){setVal('goal-name-input',g.name||'');setVal('goal-target-input',g.target||'');}openModal('goal-modal');}
function saveGoal(){const name=$id('goal-name-input')?.value.trim(),target=parseInt($id('goal-target-input')?.value)||0;AppState.goal={name:name||'هدفي',target};localStorage.setItem('quizGoal',JSON.stringify(AppState.goal));closeModal('goal-modal');renderHome();showToast('تم حفظ هدفك ✓');}
function requestDeleteTest(fid){if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}const t=AppState.tests.find(x=>x.firebaseId===fid);if(!t)return;AppState.pendingDeleteId=fid;AppState.deleteMode='test';setText('delete-modal-name',t.name);openModal('delete-modal');}
function clearErrors(){AppState.deleteMode='errors';setText('delete-modal-name','جميع الأخطاء المسجّلة');openModal('delete-modal');}
async function confirmDeleteTest(){
  closeModal('delete-modal');
  if(AppState.deleteMode==='test'&&AppState.pendingDeleteId){try{await dbDeleteQuiz(AppState.pendingDeleteId);delete AppState.scores[AppState.pendingDeleteId];AppState.errors=AppState.errors.filter(e=>e.testId!==AppState.pendingDeleteId);persistAll();showToast('تم الحذف نهائياً');}catch(e){showToast(e.message||'فشل الحذف','error');}}
  else if(AppState.deleteMode==='errors'){AppState.errors=[];localStorage.setItem('quizErrors','[]');renderErrors();renderHome();showToast('تم مسح الأخطاء');}
  AppState.pendingDeleteId=null;
}
function attachFirebaseListener(){
  showLoadingScreen('جارٍ تحميل الاختبارات...');
  dbListenQuizzes(tests=>{AppState.tests=tests;renderHome();const ap=$id('page-admin'),mt=$id('admin-manage');if(ap?.classList.contains('active')&&mt?.classList.contains('active'))renderManageList();hideLoadingScreen();},()=>{showToast('خطأ في قاعدة البيانات','error');hideLoadingScreen();});
}

/* ── Folders ── */
function attachFoldersListener(){dbListenFolders(()=>{populateFolderSelects();if($id('page-home')?.classList.contains('active'))renderFoldersSection();if($id('admin-folders')?.classList.contains('active'))renderAdminFoldersList();});}
function populateFolderSelects(){
  ['new-test-folder','parse-test-folder','ai-test-folder'].forEach(sid=>{const sel=$id(sid);if(!sel)return;const cur=sel.value;sel.innerHTML='<option value="">عام (بدون مجلد)</option>';Object.entries(AppFolders).forEach(([fid,f])=>{const opt=document.createElement('option');opt.value=fid;opt.textContent=(f.icon||'📁')+' '+(f.name||'مجلد');if(fid===cur)opt.selected=true;sel.appendChild(opt);});});
}
function renderFoldersSection(){
  const sec=$id('folders-section'),grid=$id('folders-grid');if(!sec||!grid)return;
  const entries=Object.entries(AppFolders);if(!entries.length){sec.style.display='none';return;}sec.style.display='block';
  if(!currentFolderView){const fqv=$id('folder-quizzes-view');if(fqv)fqv.style.display='none';}
  const frag=document.createDocumentFragment();
  entries.forEach(([fid,f])=>{const qc=AppState.tests.filter(t=>t.folderId===fid).length;const card=document.createElement('div');card.className='folder-card';card.onclick=()=>openFolderView(fid);card.innerHTML=`<button class="folder-card-del admin-only-inline" onclick="event.stopPropagation();requestDeleteFolder('${fid}')">🗑️</button><div class="folder-card-icon">${escapeHtml(f.icon||'📁')}</div><div class="folder-card-name">${escapeHtml(f.name||'مجلد')}</div><div class="folder-card-count">${qc} اختبار</div>`;frag.appendChild(card);});
  grid.innerHTML='';grid.appendChild(frag);document.querySelectorAll('.admin-only-inline').forEach(e=>e.style.display=isAdminMode?'':'none');
}
function openFolderView(fid){
  currentFolderView=fid;const folder=AppFolders[fid];if(!folder)return;
  const fqv=$id('folder-quizzes-view'),tg=$id('tests-grid'),grid=$id('folder-quizzes-grid'),title=$id('folder-view-title'),fg=$id('folders-grid');
  if(fg)fg.style.display='none';if(tg)tg.style.display='none';if(fqv)fqv.style.display='block';if(title)title.textContent=(folder.icon||'📁')+' '+folder.name;
  const folderTests=AppState.tests.filter(t=>t.folderId===fid);
  const frag=document.createDocumentFragment();
  if(!folderTests.length){const e=document.createElement('div');e.className='quizzes-empty';e.innerHTML='<div class="empty-icon">📭</div><h3>لا توجد اختبارات في هذا المجلد</h3>';frag.appendChild(e);}
  folderTests.forEach((t,idx)=>{
    const sc=AppState.scores[t.id];let badge='<span class="test-badge badge-new">جديد</span>',bar='';
    if(sc!==undefined){badge=sc>=70?'<span class="test-badge badge-done">مكتمل ✓</span>':'<span class="test-badge badge-retry">راجع أخطاءك</span>';const cls=sc>=80?'fill-green':sc>=60?'fill-yellow':'fill-red';bar=`<div class="test-score-bar"><div class="test-score-fill ${cls}" style="width:${sc}%"></div></div>`;}
    const card=document.createElement('div');card.className='test-card';card.onclick=()=>startQuiz(t.firebaseId);
    card.innerHTML=`<button class="test-card-del admin-only-inline" onclick="event.stopPropagation();requestDeleteTest('${t.firebaseId}')">🗑️</button><div class="test-card-top"><div class="test-num">${idx+1}</div>${badge}</div><div class="test-title">${escapeHtml(t.name)}</div><div class="test-meta"><span>📝 ${t.questions?.length||0} سؤال</span>${t.subject?`<span>📚 ${escapeHtml(t.subject)}</span>`:''}</div>${bar}`;
    frag.appendChild(card);
  });
  if(grid){grid.innerHTML='';grid.appendChild(frag);}document.querySelectorAll('.admin-only-inline').forEach(e=>e.style.display=isAdminMode?'':'none');
}
function closeFolderView(){currentFolderView=null;const fqv=$id('folder-quizzes-view'),tg=$id('tests-grid'),fg=$id('folders-grid');if(fqv)fqv.style.display='none';if(tg)tg.style.display='';if(fg)fg.style.display='';}
function openCreateFolderModal(){if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}setVal('folder-name-input','');selectedFolderEmoji='📁';document.querySelectorAll('.folder-emoji-opt').forEach(e=>e.classList.remove('selected'));document.querySelector('.folder-emoji-opt')?.classList.add('selected');openModal('create-folder-modal');setTimeout(()=>$id('folder-name-input')?.focus(),120);}
function selectFolderEmoji(el,emoji){document.querySelectorAll('.folder-emoji-opt').forEach(e=>e.classList.remove('selected'));el.classList.add('selected');selectedFolderEmoji=emoji;}
async function saveFolder(){if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}const name=$id('folder-name-input')?.value.trim();if(!name){showToast('أدخل اسم المجلد','error');return;}try{await dbSaveFolder({name,icon:selectedFolderEmoji,createdAt:Date.now()});closeModal('create-folder-modal');showToast('تم إنشاء المجلد ✓');renderAdminFoldersList();}catch(e){showToast(e.message||'حدث خطأ','error');}}
function requestDeleteFolder(fid){if(!isAdminMode)return;if(!confirm('هل تريد حذف هذا المجلد؟'))return;dbDeleteFolder(fid).then(()=>{showToast('تم حذف المجلد ✓');if(currentFolderView===fid)closeFolderView();}).catch(e=>showToast(e.message,'error'));}
function renderAdminFoldersList(){const container=$id('admin-folders-list');if(!container)return;const entries=Object.entries(AppFolders);if(!entries.length){container.innerHTML='<div class="empty-state"><div class="icon">📭</div><p>لا توجد مجلدات بعد</p></div>';return;}const frag=document.createDocumentFragment();entries.forEach(([fid,f])=>{const qc=AppState.tests.filter(t=>t.folderId===fid).length;const item=document.createElement('div');item.className='admin-folder-item';item.innerHTML=`<div class="admin-folder-item-info"><div class="admin-folder-item-icon">${escapeHtml(f.icon||'📁')}</div><div><div class="admin-folder-item-name">${escapeHtml(f.name||'مجلد')}</div><div class="admin-folder-item-meta">${qc} اختبار</div></div></div><div style="display:flex;gap:7px"><button onclick="requestDeleteFolder('${fid}')" class="btn btn-secondary" style="font-size:0.8rem;padding:7px 12px;color:var(--red)">🗑️ حذف</button></div>`;frag.appendChild(item);});container.innerHTML='';container.appendChild(frag);}
/* ── Admin Auth ── */
function applyAdminUI(user,isAdmin){
  const bar=$id('admin-mode-bar'),lb=$id('admin-login-btn'),li=$id('admin-lock-icon'),ab=$id('nav-admin-btn');
  document.querySelectorAll('.admin-only').forEach(e=>e.style.display=isAdmin?'':'none');
  document.querySelectorAll('.admin-only-inline').forEach(e=>e.style.display=isAdmin?'':'none');
  if(isAdmin){document.body.classList.add('admin-mode');bar?.classList.add('visible');lb?.classList.add('active-admin');if(li)li.className='fa-solid fa-unlock';if(ab)ab.style.display='flex';setText('admin-user-email',user?.email||'');setText('admin-user-email-settings',user?.email||'—');}
  else{document.body.classList.remove('admin-mode');bar?.classList.remove('visible');lb?.classList.remove('active-admin');if(li)li.className='fa-solid fa-lock';if(ab)ab.style.display='none';}
}
function openAdminLoginModal(){if(isAdminMode){if(confirm('هل تريد تسجيل الخروج؟'))logoutAdmin();return;}setVal('admin-email-input','');setVal('admin-password-input','');const e=$id('admin-login-error');if(e){e.style.display='none';e.textContent='';}openModal('admin-login-modal');setTimeout(()=>$id('admin-email-input')?.focus(),120);}
function handleAdminLogin(){openAdminLoginModal();}
async function verifyAdminLogin(){
  const email=$id('admin-email-input')?.value.trim(),pw=$id('admin-password-input')?.value,btn=$id('admin-login-submit-btn');
  if(!email||!pw){showLoginError('يرجى إدخال البريد وكلمة المرور');return;}
  if(btn){btn.disabled=true;btn.textContent='جارٍ التحقق...';}
  try{await adminSignIn(email,pw);closeModal('admin-login-modal');showToast('✅ مرحباً في وضع الأدمن');}
  catch(e){showLoginError(e.message||'فشل تسجيل الدخول');}
  finally{if(btn){btn.disabled=false;btn.textContent='دخول';}}
}
function showLoginError(msg){const e=$id('admin-login-error');if(e){e.textContent='❌ '+msg;e.style.display='block';}}
async function logoutAdmin(){try{await adminSignOut();showPage('home');showToast('🔒 تم تسجيل الخروج','info');}catch(e){showToast('فشل تسجيل الخروج','error');}}
document.addEventListener('keydown',e=>{const m=$id('admin-login-modal');if(e.key==='Enter'&&m?.classList.contains('open'))verifyAdminLogin();});
function loadAdminSettings(){const s=AppState.adminSettings;const c=$id('setting-categorized-errors'),n=$id('setting-show-notes-live');if(c)c.checked=!!s.categorizedErrors;if(n)n.checked=s.showNotesLive!==false;}
function saveAdminSettings(){AppState.adminSettings.categorizedErrors=$id('setting-categorized-errors')?.checked||false;AppState.adminSettings.showNotesLive=$id('setting-show-notes-live')?.checked!==false;localStorage.setItem('adminSettings',JSON.stringify(AppState.adminSettings));showToast('تم حفظ الإعدادات ✓');}
function switchAdminTab(tab,ev){document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.admin-tab-content').forEach(c=>c.classList.remove('active'));if(ev?.currentTarget)ev.currentTarget.classList.add('active');$id('admin-'+tab)?.classList.add('active');if(tab==='manage')renderManageList();if(tab==='settings')loadAdminSettings();if(tab==='folders')renderAdminFoldersList();}
function renderManageList(){
  const c=$id('manage-list');if(!c)return;const{tests,scores}=AppState;
  if(!tests.length){c.innerHTML='<div class="empty-state"><div class="icon">📭</div><p>لا توجد اختبارات بعد</p></div>';return;}
  const w=document.createElement('div');w.style.cssText='display:flex;flex-direction:column;gap:8px;';
  tests.forEach(t=>{const sc=scores[t.id];const item=document.createElement('div');item.className='manage-item';item.innerHTML=`<div class="manage-item-info"><div class="manage-item-name">${escapeHtml(t.name)}</div><div class="manage-item-meta">${t.questions?.length||0} سؤال • ${t.timeLimit||0} دقيقة${sc!==undefined?' • آخر درجة: '+sc+'%':''}</div></div><div class="manage-item-actions"><button onclick="startQuiz('${t.firebaseId}')" class="btn btn-primary" style="font-size:0.8rem;padding:8px 12px">▶️</button><button onclick="openEditQuiz('${t.firebaseId}')" class="btn btn-secondary" style="font-size:0.8rem;padding:8px 12px;color:var(--accent)">✏️</button><button onclick="requestDeleteTest('${t.firebaseId}')" class="btn btn-secondary" style="font-size:0.8rem;padding:8px 12px;color:var(--red)">🗑️</button></div>`;w.appendChild(item);});
  c.innerHTML='';c.appendChild(w);
}

/* ── Quiz Builder ── */
function addQuestionBuilder(data){AppState.builderQuestions.push(data||{text:'',choices:['','','',''],correct:0,correctAnswers:[0],multiCorrect:false,note:'',image:''});renderBuilder();}
function renderBuilderTo(questions,containerId){
  const container=$id(containerId);if(!container)return;
  const letters=['أ','ب','ج','د'];const frag=document.createDocumentFragment();
  questions.forEach((q,qi)=>{
    const item=document.createElement('div');item.className='q-builder-item';const isMulti=q.multiCorrect;
    let ch='';q.choices.forEach((c,ci)=>{const iType=isMulti?'checkbox':'radio';const checked=isMulti?(Array.isArray(q.correctAnswers)&&q.correctAnswers.includes(ci)):(q.correct===ci);ch+=`<div class="choice-builder-row"><input type="${iType}" name="bq-correct-${containerId}-${qi}" ${checked?'checked':''} onchange="builderSetCorrect('${containerId}',${qi},${ci},this.checked,${isMulti})" style="accent-color:var(--green);width:15px;height:15px"/><input class="form-input" placeholder="${letters[ci]||ci+1}..." value="${escapeHtml(c||'')}" oninput="getBuilderQuestions('${containerId}')[${qi}].choices[${ci}]=this.value" style="flex:1"/></div>`;});
    const imgPreview=q.image?`<div class="q-image-preview-wrap" id="${containerId}-imgwrap-${qi}"><img src="${q.image}" class="q-image-preview" alt="صورة"/><button class="q-img-remove-btn" onclick="removeBuilderImage('${containerId}',${qi})">✕</button></div>`:`<div class="q-image-preview-wrap" id="${containerId}-imgwrap-${qi}" style="display:none"><img src="" class="q-image-preview" alt=""/><button class="q-img-remove-btn" onclick="removeBuilderImage('${containerId}',${qi})">✕</button></div>`;
    item.innerHTML=`<div class="q-builder-header"><span class="q-builder-num">سؤال ${qi+1}${isMulti?' <span class="multi-badge">متعدد</span>':''}</span><div class="q-builder-actions"><button class="q-multi-btn${isMulti?' active':''}" onclick="toggleBuilderMulti('${containerId}',${qi})">${isMulti?'☑️ متعدد':'☐ واحد'}</button><button class="q-del-btn" onclick="deleteBuilderQ('${containerId}',${qi})">حذف</button></div></div><input class="form-input" placeholder="نص السؤال..." value="${escapeHtml(q.text||'')}" oninput="getBuilderQuestions('${containerId}')[${qi}].text=this.value" style="margin-bottom:9px"/>${imgPreview}<div class="q-img-upload-row"><label class="q-img-upload-btn">🖼️ ${q.image?'تغيير':'إضافة'} صورة<input type="file" accept="image/*" style="display:none" onchange="handleBuilderImageUpload(event,'${containerId}',${qi})"/></label></div><div class="choices-builder">${ch}</div><textarea class="q-note-input" placeholder="ملاحظة المعلم..." oninput="getBuilderQuestions('${containerId}')[${qi}].note=this.value">${escapeHtml(q.note||'')}</textarea>`;
    frag.appendChild(item);
  });
  container.innerHTML='';container.appendChild(frag);
}
function renderBuilder(){renderBuilderTo(AppState.builderQuestions,'questions-builder');}
function getBuilderQuestions(cid){return cid==='edit-questions-builder'?AppState.editQuestions:AppState.builderQuestions;}
function toggleBuilderMulti(cid,qi){const qs=getBuilderQuestions(cid);qs[qi].multiCorrect=!qs[qi].multiCorrect;qs[qi].correctAnswers=[qs[qi].correct||0];renderBuilderTo(qs,cid);}
function builderSetCorrect(cid,qi,ci,checked,isMulti){const qs=getBuilderQuestions(cid);const q=qs[qi];if(isMulti){if(!Array.isArray(q.correctAnswers))q.correctAnswers=[];if(checked){if(!q.correctAnswers.includes(ci))q.correctAnswers.push(ci);}else{q.correctAnswers=q.correctAnswers.filter(x=>x!==ci);if(!q.correctAnswers.length)q.correctAnswers=[ci];}q.correct=q.correctAnswers[0];}else{q.correct=ci;q.correctAnswers=[ci];}}
function deleteBuilderQ(cid,i){const qs=getBuilderQuestions(cid);qs.splice(i,1);renderBuilderTo(qs,cid);}
function handleBuilderImageUpload(event,cid,qi){const file=event.target.files[0];if(!file)return;if(file.size>2*1024*1024){showToast('حجم الصورة يجب أن يكون أقل من 2MB','error');return;}const reader=new FileReader();reader.onload=e=>{const qs=getBuilderQuestions(cid);qs[qi].image=e.target.result;const wrap=document.getElementById(cid+'-imgwrap-'+qi);if(wrap){wrap.style.display='';const img=wrap.querySelector('img');if(img)img.src=e.target.result;}showToast('تم إضافة الصورة ✓');};reader.readAsDataURL(file);}
function removeBuilderImage(cid,qi){const qs=getBuilderQuestions(cid);qs[qi].image='';const wrap=document.getElementById(cid+'-imgwrap-'+qi);if(wrap){wrap.style.display='none';const img=wrap.querySelector('img');if(img)img.src='';}}

async function saveTest(){
  if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}
  const name=$id('new-test-name')?.value.trim();if(!name){showToast('أدخل اسم الاختبار','error');return;}
  if(!AppState.builderQuestions.length){showToast('أضف سؤالاً على الأقل','error');return;}
  const folderId=$id('new-test-folder')?.value||'';
  const data={name,subject:$id('new-test-subject')?.value.trim()||'',timeLimit:parseInt($id('new-test-time')?.value)||0,folderId,questions:AppState.builderQuestions.map(q=>({text:q.text,choices:[...q.choices],correctAnswers:q.correctAnswers?.length?q.correctAnswers:[q.correct],correct:q.correctAnswers?.length?q.correctAnswers[0]:q.correct,multiCorrect:q.multiCorrect||false,note:q.note||'',image:q.image||''})),createdAt:Date.now()};
  const btn=$id('save-test-btn');if(btn){btn.disabled=true;btn.textContent='جارٍ الحفظ...';}
  try{await dbSaveQuiz(data);showToast('تم حفظ الاختبار ✓');setVal('new-test-name','');setVal('new-test-subject','');setVal('new-test-time','10');const fs=$id('new-test-folder');if(fs)fs.value='';AppState.builderQuestions=[];renderBuilder();setTimeout(()=>showPage('home'),900);}
  catch(e){showToast(e.message||'حدث خطأ','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='💾 حفظ الاختبار';}}
}
function openEditQuiz(fid){const test=AppState.tests.find(t=>t.firebaseId===fid);if(!test)return;AppState.editingQuizId=fid;AppState.editQuestions=test.questions.map(q=>({...q,choices:[...q.choices],correctAnswers:[...(q.correctAnswers||[q.correct||0])],image:q.image||''}));setVal('edit-test-name',test.name||'');setVal('edit-test-subject',test.subject||'');setVal('edit-test-time',test.timeLimit||0);renderBuilderTo(AppState.editQuestions,'edit-questions-builder');openModal('edit-quiz-modal');}
function addEditQuestion(){AppState.editQuestions.push({text:'',choices:['','','',''],correct:0,correctAnswers:[0],multiCorrect:false,note:'',image:''});renderBuilderTo(AppState.editQuestions,'edit-questions-builder');}
async function saveEditedQuiz(){
  if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}
  const name=$id('edit-test-name')?.value.trim();if(!name){showToast('أدخل اسم الاختبار','error');return;}
  const oldTest=AppState.tests.find(t=>t.firebaseId===AppState.editingQuizId);
  const data={name,subject:$id('edit-test-subject')?.value.trim()||'',timeLimit:parseInt($id('edit-test-time')?.value)||0,questions:AppState.editQuestions.map(q=>({text:q.text,choices:[...q.choices],correctAnswers:q.correctAnswers?.length?q.correctAnswers:[q.correct],correct:q.correctAnswers?.length?q.correctAnswers[0]:q.correct,multiCorrect:q.multiCorrect||false,note:q.note||'',image:q.image||''})),createdAt:oldTest?.createdAt||Date.now(),updatedAt:Date.now(),folderId:oldTest?.folderId||''};
  const btn=$id('save-edit-btn');if(btn){btn.disabled=true;btn.textContent='جارٍ الحفظ...';}
  try{await dbUpdateQuiz(AppState.editingQuizId,data);closeModal('edit-quiz-modal');showToast('تم حفظ التعديلات ✓');AppState.editingQuizId=null;AppState.editQuestions=[];}
  catch(e){showToast(e.message||'حدث خطأ','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='💾 حفظ التعديلات';}}
}

/* ── Smart Parser ── */
function smartParseText(raw){
  let txt=raw.replace(/\r\n|\r/g,'\n').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\t/g,' ').replace(/ {2,}/g,' ');
  const lines=txt.split('\n').map(l=>l.trim());
  const RX_Q=/^(?:س(?:ؤال)?\s*\d*\s*[:.)]\s*|Q\s*\d*\s*[:.)]\s*|\d+\s*[.)]\s*(?!\s*[أبجدهوABCDa-f]\s*[.)]))(.+)/i;
  const RX_C=/^(?:([أبجدهوABCDEFa-f])\s*[.):\-]\s*|[•▪▸\-*]\s*)(.+)/i;
  const qs=[];let cur=null;
  function push(){if(cur&&cur.text.trim()&&cur.choices.length>=2)qs.push(cur);cur=null;}
  lines.forEach(l=>{if(!l)return;const qm=l.match(RX_Q),cm=l.match(RX_C);const qt=qm?qm[1].trim():(l.endsWith('؟')||l.endsWith('?'))?l:null;const ct=cm?cm[cm.length-1].trim():null;if(qt&&!ct){push();cur={text:qt,choices:[],correctAnswers:[0],note:''};}else if(ct&&cur)cur.choices.push(ct);else if(ct&&!cur&&qs.length)qs[qs.length-1].choices.push(ct);else if(cur){if(!cur.choices.length)cur.text+=' '+l;else if(l.length<120&&!l.match(RX_Q))cur.choices[cur.choices.length-1]+=' '+l;}else if(l.endsWith('؟')||l.endsWith('?')){push();cur={text:l,choices:[],correctAnswers:[0],note:''};} });
  push();return qs.filter(q=>q.choices.length>=2).map(q=>({...q,text:q.text.trim(),choices:q.choices.map(c=>c.trim()).filter(c=>c)}));
}
function applyBulkAnswers(bulk){const parts=bulk.replace(/،/g,',').split(/[\s,]+/).map(p=>p.trim()).filter(Boolean);const M={'أ':1,'ا':1,'A':1,'a':1,'1':1,'ب':2,'B':2,'b':2,'2':2,'ج':3,'C':3,'c':3,'3':3,'د':4,'D':4,'d':4,'4':4,'ه':5,'E':5,'e':5,'5':5,'و':6,'F':6,'f':6,'6':6};parts.forEach((p,i)=>{if(i>=AppState.parsedQuestions.length)return;const idx=(M[p]||parseInt(p)||1)-1;if(idx>=0){AppState.parsedQuestions[i].correctAnswers=[idx];AppState.parsedQuestions[i].correct=idx;}});showToast('تم تعيين الإجابات تلقائياً ✓');}
function parseQuestions(){const raw=$id('parse-input')?.value.trim();if(!raw){showToast('الصق نصاً أولاً','error');return;}AppState.parsedQuestions=smartParseText(raw);if(!AppState.parsedQuestions.length){showToast('لم يتم التعرف على أسئلة','error');return;}const bulk=$id('bulk-answers-input')?.value.trim();if(bulk)applyBulkAnswers(bulk);renderParsedQuestions();showToast(`تم التعرف على ${AppState.parsedQuestions.length} سؤال ✓`);}
function renderParsedQuestions(){const pr=$id('parse-preview'),list=$id('parse-questions-list');if(!pr||!list)return;const letters=['أ','ب','ج','د'];pr.style.display='block';setText('parse-preview-title',`✅ تم التحليل — ${AppState.parsedQuestions.length} سؤال`);const frag=document.createDocumentFragment();AppState.parsedQuestions.forEach((q,qi)=>{const item=document.createElement('div');item.className='parsed-q-item';let ch='';q.choices.forEach((c,ci)=>{const checked=(q.correctAnswers||[q.correct||0]).includes(ci)?'checked':'';ch+=`<label class="parsed-choice-row"><input type="checkbox" ${checked} onchange="toggleParsedCorrect(${qi},${ci},this.checked)"><span>${letters[ci]||ci+1}. ${escapeHtml(c)}</span></label>`;});item.innerHTML=`<div class="parsed-q-text">${qi+1}. ${escapeHtml(q.text)}</div><div class="parsed-choices">${ch}</div><textarea class="parsed-note-input" placeholder="ملاحظة المعلم..." oninput="AppState.parsedQuestions[${qi}].note=this.value">${escapeHtml(q.note||'')}</textarea>`;frag.appendChild(item);});list.innerHTML='';list.appendChild(frag);}
function toggleParsedCorrect(qi,ci,checked){const q=AppState.parsedQuestions[qi];if(!q)return;if(!Array.isArray(q.correctAnswers))q.correctAnswers=[q.correct||0];if(checked){if(!q.correctAnswers.includes(ci))q.correctAnswers.push(ci);}else{q.correctAnswers=q.correctAnswers.filter(x=>x!==ci);if(!q.correctAnswers.length)q.correctAnswers=[ci];}q.correct=q.correctAnswers[0];}
async function saveParsedTest(){
  if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}
  const name=$id('parse-test-name')?.value.trim();if(!name){showToast('أدخل اسم الاختبار','error');return;}
  if(!AppState.parsedQuestions.length){showToast('لا توجد أسئلة','error');return;}
  const folderId=$id('parse-test-folder')?.value||'';
  const data={name,subject:$id('parse-test-subject')?.value.trim()||'',timeLimit:parseInt($id('parse-test-time')?.value)||0,folderId,questions:AppState.parsedQuestions.map(q=>({text:q.text,choices:[...q.choices],correctAnswers:q.correctAnswers||[q.correct||0],correct:(q.correctAnswers||[q.correct||0])[0],multiCorrect:(q.correctAnswers||[]).length>1,note:q.note||''})),createdAt:Date.now()};
  const btn=$id('save-parsed-btn');if(btn){btn.disabled=true;btn.textContent='جارٍ الحفظ...';}
  try{await dbSaveQuiz(data);showToast(`تم حفظ "${name}" ✓`);setVal('parse-input','');setVal('bulk-answers-input','');setVal('parse-test-name','');setVal('parse-test-subject','');const pf=$id('parse-test-folder');if(pf)pf.value='';const pr=$id('parse-preview');if(pr)pr.style.display='none';AppState.parsedQuestions=[];setTimeout(()=>showPage('home'),900);}
  catch(e){showToast(e.message||'حدث خطأ','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='💾 حفظ الاختبار';}}
}
/* ── AI PDF Importer ── */
const AIPdfState={pdfDoc:null,pages:[],analyzedQuestions:[],currentEditIdx:-1};

async function handleAIPdfUpload(event){
  const file=event.target.files[0];if(!file)return;
  if(file.type!=='application/pdf'){showToast('يرجى رفع ملف PDF فقط','error');return;}
  const zone=$id('ai-pdf-upload-zone'),txt=$id('ai-pdf-upload-text');
  if(zone)zone.classList.add('has-file');if(txt)txt.textContent='✅ '+file.name;
  const arrayBuffer=await file.arrayBuffer();
  try{
    if(typeof pdfjsLib==='undefined'){showToast('مكتبة PDF.js لم تُحمَّل','error');return;}
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    AIPdfState.pdfDoc=await pdfjsLib.getDocument({data:arrayBuffer}).promise;
    await renderPdfPageThumbnails();
    $id('ai-step-2').style.display='block';
    setText('ai-pages-count',`${AIPdfState.pdfDoc.numPages} صفحة — اختر الصفحات للتحليل أو سيتم تحليل الكل`);
    showToast(`تم تحميل الـ PDF — ${AIPdfState.pdfDoc.numPages} صفحة ✓`);
  }catch(e){console.error(e);showToast('فشل قراءة الملف: '+e.message,'error');}
}

async function renderPdfPageThumbnails(){
  const grid=$id('ai-pages-preview');if(!grid)return;
  grid.innerHTML='';AIPdfState.pages=[];
  for(let i=1;i<=AIPdfState.pdfDoc.numPages;i++){
    const page=await AIPdfState.pdfDoc.getPage(i);
    const viewport=page.getViewport({scale:0.3});
    const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    AIPdfState.pages.push({pageNum:i,canvas,selected:true});
    const thumb=document.createElement('div');thumb.className='ai-page-thumb selected';thumb.dataset.page=i;
    thumb.innerHTML=`<div class="ai-page-check">✓</div><div class="ai-page-label">صفحة ${i}</div>`;
    thumb.insertBefore(canvas,thumb.querySelector('.ai-page-label'));
    thumb.onclick=()=>{thumb.classList.toggle('selected');AIPdfState.pages[i-1].selected=thumb.classList.contains('selected');};
    grid.appendChild(thumb);
  }
}

async function runAIAnalysis(){
  const btn=$id('ai-analyze-btn');
  const selectedPages=AIPdfState.pages.filter(p=>p.selected);
  if(!selectedPages.length){showToast('اختر صفحة واحدة على الأقل','error');return;}
  const testName=$id('ai-test-name')?.value.trim();if(!testName){showToast('أدخل اسم الاختبار أولاً','error');return;}
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin" style="margin-left:6px"></i>جارٍ التحليل...';}
  $id('ai-step-3').style.display='block';
  $id('ai-analysis-progress').style.display='block';
  $id('ai-results-container').innerHTML='';
  $id('ai-save-section').style.display='none';
  AIPdfState.analyzedQuestions=[];
  const progressFill=$id('ai-progress-fill'),progressText=$id('ai-progress-text');
  try{
    for(let pi=0;pi<selectedPages.length;pi++){
      const pg=selectedPages[pi];
      if(progressFill)progressFill.style.width=Math.round((pi/selectedPages.length)*90)+'%';
      if(progressText)progressText.textContent=`تحليل صفحة ${pg.pageNum} من ${selectedPages.length}...`;
      const page=await AIPdfState.pdfDoc.getPage(pg.pageNum);
      const viewport=page.getViewport({scale:2.0});
      const hiCanvas=document.createElement('canvas');hiCanvas.width=viewport.width;hiCanvas.height=viewport.height;
      await page.render({canvasContext:hiCanvas.getContext('2d'),viewport}).promise;
      const pageDataURL=hiCanvas.toDataURL('image/jpeg',0.85);
      const questions=await analyzePageWithAI(pageDataURL,pg.pageNum,testName);
      AIPdfState.analyzedQuestions.push(...questions);
      renderAIResults();
    }
    if(progressFill)progressFill.style.width='100%';
    if(progressText)progressText.textContent=`✅ اكتمل التحليل — ${AIPdfState.analyzedQuestions.length} سؤال`;
    setTimeout(()=>{if($id('ai-analysis-progress'))$id('ai-analysis-progress').style.display='none';},1500);
    $id('ai-save-section').style.display='block';
    setText('ai-results-summary',`تم اكتشاف ${AIPdfState.analyzedQuestions.length} سؤال من ${selectedPages.length} صفحة`);
    showToast(`✅ تم تحليل ${AIPdfState.analyzedQuestions.length} سؤال`);
  }catch(e){
    console.error(e);if(progressText)progressText.textContent='❌ خطأ: '+e.message;showToast('فشل التحليل: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-wand-magic-sparkles" style="margin-left:6px"></i>تحليل بالذكاء الاصطناعي';}
  }
}

async function analyzePageWithAI(pageDataURL,pageNum,examTitle){
  const systemPrompt=`أنت محلل اختبارات متخصص. استخرج الأسئلة من صورة ورقة امتحان وأرجع JSON فقط بالشكل التالي (بدون أي نص إضافي أو backticks):
{"questions":[{"number":1,"text":"نص السؤال","type":"mcq","choices":["أ","ب","ج","د"],"correct":0,"confidence":0.9,"notes":""}],"pageNotes":""}
قواعد: correct هو index الخيار الصحيح (0=أول, 1=ثاني...). إذا لم تجد إجابة، ضع correct:-1. confidence بين 0 و1. ادعم العربية والإنجليزية.`;
  const response=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4000,system:systemPrompt,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:pageDataURL.split(',')[1]}},{type:'text',text:`صفحة ${pageNum} من اختبار: "${examTitle}". استخرج جميع الأسئلة والإجابات الصحيحة.`}]}]})
  });
  if(!response.ok)throw new Error(`API Error: ${response.status}`);
  const data=await response.json();
  const rawText=data.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  let parsed;
  try{const clean=rawText.replace(/```json|```/g,'').trim();parsed=JSON.parse(clean);}
  catch(e){const match=rawText.match(/\{[\s\S]*\}/);if(match)parsed=JSON.parse(match[0]);else return[];}
  return(parsed.questions||[]).map((q,i)=>({...q,pageNum,id:`page${pageNum}_q${i}`,choices:q.choices||['أ','ب','ج','د'],correct:typeof q.correct==='number'?q.correct:0,confidence:q.confidence||0.7,confirmed:false,image:''}));
}

function renderAIResults(){
  const container=$id('ai-results-container');if(!container)return;
  const letters=['أ','ب','ج','د','هـ','و'];
  const frag=document.createDocumentFragment();
  AIPdfState.analyzedQuestions.forEach((q,idx)=>{
    const confLevel=q.confidence>=0.8?'high':q.confidence>=0.6?'med':'low';
    const confLabel=q.confidence>=0.8?'دقة عالية':q.confidence>=0.6?'متوسطة':'تحقق مطلوب';
    const card=document.createElement('div');
    card.className=`ai-question-card ${q.correct<0?'needs-review':q.confidence<0.6?'needs-review':'confirmed'}`;
    card.id='aiq-'+idx;
    let choicesHtml='';
    (q.choices||[]).forEach((c,ci)=>{choicesHtml+=`<div class="ai-choice-row ${ci===q.correct?'correct':''}"><div class="ai-choice-letter">${letters[ci]||ci+1}</div><span>${escapeHtml(c)}</span>${ci===q.correct?'<span style="margin-right:auto;font-size:0.72rem;color:var(--green);font-weight:700;font-family:\'ThmanyahSans\',sans-serif">✓ صحيح</span>':''}</div>`;});
    card.innerHTML=`
      <div class="ai-question-header">
        <div class="ai-question-num">سؤال ${idx+1}${q.pageNum?' (صفحة '+q.pageNum+')':''}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <div class="ai-confidence-badge ai-confidence-${confLevel}">🎯 ${Math.round(q.confidence*100)}% — ${confLabel}</div>
          ${q.confirmed?'<span style="color:var(--green);font-size:0.78rem">✅ مؤكَّد</span>':''}
        </div>
      </div>
      ${q.image?`<img src="${q.image}" class="ai-question-img" alt="صورة">`:''}
      <div class="ai-question-text">${escapeHtml(q.text||'(بدون نص)')}</div>
      <div class="ai-choices-preview">${choicesHtml}</div>
      ${q.notes?`<div style="font-size:0.78rem;color:var(--text3);background:rgba(59,130,246,.06);padding:6px 10px;border-radius:7px;margin-top:6px">💡 ${escapeHtml(q.notes)}</div>`:''}
      <div class="ai-question-actions">
        <button class="btn btn-secondary" onclick="confirmAIQuestion(${idx})" style="font-size:0.78rem;padding:6px 12px;color:var(--green)">✅ تأكيد</button>
        <button class="btn btn-secondary" onclick="openAIQuestionEdit(${idx})" style="font-size:0.78rem;padding:6px 12px">✏️ تعديل</button>
        <button class="btn btn-secondary" onclick="removeAIQuestion(${idx})" style="font-size:0.78rem;padding:6px 12px;color:var(--red)">🗑️ حذف</button>
        ${q.correct<0?'<span style="color:var(--accent);font-size:0.75rem;font-family:\'ThmanyahSans\',sans-serif">⚠️ يحتاج إجابة صحيحة</span>':''}
      </div>`;
    frag.appendChild(card);
  });
  container.innerHTML='';container.appendChild(frag);
}

function confirmAIQuestion(idx){AIPdfState.analyzedQuestions[idx].confirmed=true;renderAIResults();showToast('تم تأكيد السؤال ✓');}
function removeAIQuestion(idx){AIPdfState.analyzedQuestions.splice(idx,1);renderAIResults();setText('ai-results-summary',`${AIPdfState.analyzedQuestions.length} سؤال`);}

function openAIQuestionEdit(idx){
  AIPdfState.currentEditIdx=idx;const q=AIPdfState.analyzedQuestions[idx];if(!q)return;
  const letters=['أ','ب','ج','د','هـ','و'];
  let choiceInputs='';
  (q.choices||[]).forEach((c,ci)=>{choiceInputs+=`<div class="choice-builder-row" style="margin-bottom:7px"><input type="radio" name="ai-edit-correct" value="${ci}" ${ci===q.correct?'checked':''} style="accent-color:var(--green);width:15px;height:15px"><span style="font-size:0.78rem;color:var(--text3);min-width:20px">${letters[ci]||ci+1}</span><input class="form-input" id="ai-edit-choice-${ci}" value="${escapeHtml(c)}" style="flex:1;padding:8px 10px"></div>`;});
  const form=$id('ai-edit-question-form');
  if(form)form.innerHTML=`<div class="form-group"><label class="form-label">نص السؤال</label><textarea class="form-input" id="ai-edit-text" rows="3" style="resize:vertical">${escapeHtml(q.text||'')}</textarea></div><div class="form-group"><label class="form-label">الخيارات (اختر الصحيح)</label>${choiceInputs}</div><div class="form-group"><label class="form-label">ملاحظة</label><input class="form-input" id="ai-edit-note" value="${escapeHtml(q.notes||'')}"></div>`;
  openModal('ai-question-edit-modal');
}
function saveAIQuestionEdit(){
  const idx=AIPdfState.currentEditIdx;if(idx<0)return;const q=AIPdfState.analyzedQuestions[idx];
  q.text=$id('ai-edit-text')?.value||q.text;q.notes=$id('ai-edit-note')?.value||'';
  const cr=document.querySelector('input[name="ai-edit-correct"]:checked');if(cr)q.correct=parseInt(cr.value);
  (q.choices||[]).forEach((_,ci)=>{const inp=$id('ai-edit-choice-'+ci);if(inp)q.choices[ci]=inp.value;});
  q.confirmed=true;renderAIResults();closeModal('ai-question-edit-modal');showToast('تم حفظ التعديل ✓');
}

async function saveAIQuiz(){
  if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}
  const name=$id('ai-test-name')?.value.trim();if(!name){showToast('أدخل اسم الاختبار','error');return;}
  if(!AIPdfState.analyzedQuestions.length){showToast('لا توجد أسئلة للحفظ','error');return;}
  const btn=$id('ai-save-btn');if(btn){btn.disabled=true;btn.textContent='جارٍ الحفظ...';}
  const folderId=$id('ai-test-folder')?.value||'';
  const data={name,subject:$id('ai-test-subject')?.value.trim()||'',timeLimit:0,folderId,questions:AIPdfState.analyzedQuestions.map(q=>({text:q.text||'',choices:q.choices||['أ','ب','ج','د'],correctAnswers:[Math.max(0,q.correct)],correct:Math.max(0,q.correct),multiCorrect:false,note:q.notes||'',image:q.image||''})),createdAt:Date.now(),importedFromPDF:true};
  try{
    await dbSaveQuiz(data);showToast(`✅ تم حفظ "${name}" (${data.questions.length} سؤال)`);
    AIPdfState.pdfDoc=null;AIPdfState.pages=[];AIPdfState.analyzedQuestions=[];
    $id('ai-step-2').style.display='none';$id('ai-step-3').style.display='none';
    const zone=$id('ai-pdf-upload-zone'),txt=$id('ai-pdf-upload-text');
    if(zone)zone.classList.remove('has-file');if(txt)txt.textContent='اسحب ملف PDF هنا أو اضغط للاختيار';
    setVal('ai-test-name','');setVal('ai-test-subject','');
    setTimeout(()=>showPage('home'),1000);
  }catch(e){showToast(e.message||'حدث خطأ','error');}
  finally{if(btn){btn.disabled=false;btn.textContent='💾 حفظ الاختبار';}}
}
/* ── Question Banks ── */
function attachBanksListener(){dbListenBanks(()=>{if($id('page-banks')?.classList.contains('active'))renderBanksPage();renderHome();});}

function renderBanksPage(){
  const container=$id('banks-container');if(!container)return;
  const entries=Object.entries(AppBanks);
  if(!entries.length){container.innerHTML='<div class="bank-empty"><div class="icon">🗄️</div><p>لا توجد بنوك أسئلة بعد</p></div>';return;}
  const search=($id('bank-search')?.value||'').toLowerCase();
  const frag=document.createDocumentFragment();
  entries.forEach(([bid,bank])=>{
    if(search&&!bank.name?.toLowerCase().includes(search)&&!bank.subject?.toLowerCase().includes(search))return;
    const bankQuizzes=(bank.quizIds||[]).map(qid=>AppState.tests.find(t=>t.firebaseId===qid)).filter(Boolean);
    const totalQ=bankQuizzes.reduce((a,t)=>a+(t.questions?.length||0),0);
    const card=document.createElement('div');card.className='bank-card';
    let quizRows='';bankQuizzes.forEach(t=>{quizRows+=`<div class="bank-quiz-row"><div><div class="bank-quiz-name">${escapeHtml(t.name)}</div><div class="bank-quiz-meta">${t.questions?.length||0} سؤال${t.subject?' • '+t.subject:''}</div></div><button class="btn btn-primary" onclick="startQuiz('${t.firebaseId}')" style="font-size:0.78rem;padding:6px 12px">▶️ تشغيل</button></div>`;});
    card.innerHTML=`<div class="bank-card-header"><div><div class="bank-card-title">🗄️ ${escapeHtml(bank.name||'بنك')}</div>${bank.desc?`<div style="font-size:0.78rem;color:var(--text3);margin-top:3px">${escapeHtml(bank.desc)}</div>`:''}<div class="bank-card-meta" style="margin-top:6px"><span>📝 ${totalQ} سؤال</span><span>📚 ${bankQuizzes.length} اختبار</span>${bank.subject?`<span>🔬 ${escapeHtml(bank.subject)}</span>`:''}</div></div><div class="bank-card-actions">${isAdminMode?`<button class="btn btn-secondary" onclick="openAddQuizzesToBank('${bid}')" style="font-size:0.8rem;padding:7px 12px">➕ أضف</button><button class="btn btn-secondary" onclick="openGenerateQuizFromBank('${bid}')" style="font-size:0.8rem;padding:7px 12px;color:var(--blue)">🪄 توليد</button><button class="btn btn-secondary" onclick="exportBank('${bid}')" style="font-size:0.8rem;padding:7px 12px">📤</button><button class="btn btn-secondary" onclick="deleteBank('${bid}')" style="font-size:0.8rem;padding:7px 12px;color:var(--red)">🗑️</button>`:''}</div></div>${bankQuizzes.length?`<div class="bank-quizzes-list">${quizRows}</div>`:'<div style="color:var(--text3);font-size:0.82rem;padding:8px 0">لا توجد اختبارات في هذا البنك بعد</div>'}`;
    frag.appendChild(card);
  });
  container.innerHTML='';container.appendChild(frag);
}
function filterBanks(){renderBanksPage();}

function openCreateBankModal(){
  if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}
  setVal('bank-name-input','');setVal('bank-desc-input','');setVal('bank-subject-input','');
  const sel=$id('bank-quizzes-selector');if(!sel)return;
  sel.innerHTML='';
  AppState.tests.forEach(t=>{const item=document.createElement('label');item.className='bank-quiz-selector-item';item.innerHTML=`<input type="checkbox" value="${t.firebaseId}" style="accent-color:var(--accent)"> <span>${escapeHtml(t.name)}</span> <span style="color:var(--text3);font-size:0.74rem">${t.questions?.length||0} سؤال</span>`;sel.appendChild(item);});
  // reset save button
  const saveBtn=document.querySelector('#create-bank-modal .btn-primary');
  if(saveBtn)saveBtn.onclick=saveBank;
  openModal('create-bank-modal');
}
async function saveBank(){
  if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}
  const name=$id('bank-name-input')?.value.trim();if(!name){showToast('أدخل اسم البنك','error');return;}
  const checked=[...document.querySelectorAll('#bank-quizzes-selector input:checked')].map(i=>i.value);
  const data={name,desc:$id('bank-desc-input')?.value.trim()||'',subject:$id('bank-subject-input')?.value.trim()||'',quizIds:checked,createdAt:Date.now()};
  try{await dbSaveBank(data);closeModal('create-bank-modal');showToast('تم إنشاء البنك ✓');}
  catch(e){showToast(e.message||'حدث خطأ','error');}
}
async function deleteBank(bid){if(!isAdminMode)return;if(!confirm('هل تريد حذف هذا البنك؟'))return;try{await dbDeleteBank(bid);showToast('تم حذف البنك ✓');}catch(e){showToast(e.message,'error');}}

function openAddQuizzesToBank(bid){
  const bank=AppBanks[bid];if(!bank)return;
  const sel=$id('bank-quizzes-selector');if(!sel)return;
  sel.innerHTML='';
  AppState.tests.forEach(t=>{const item=document.createElement('label');item.className='bank-quiz-selector-item';const checked=(bank.quizIds||[]).includes(t.firebaseId)?'checked':'';item.innerHTML=`<input type="checkbox" value="${t.firebaseId}" ${checked} style="accent-color:var(--accent)"> <span>${escapeHtml(t.name)}</span>`;sel.appendChild(item);});
  setVal('bank-name-input',bank.name||'');setVal('bank-desc-input',bank.desc||'');setVal('bank-subject-input',bank.subject||'');
  const saveBtn=document.querySelector('#create-bank-modal .btn-primary');
  if(saveBtn)saveBtn.onclick=async()=>{const checked=[...document.querySelectorAll('#bank-quizzes-selector input:checked')].map(i=>i.value);try{await dbUpdateBank(bid,{...bank,quizIds:checked,updatedAt:Date.now()});closeModal('create-bank-modal');showToast('تم تحديث البنك ✓');}catch(e){showToast(e.message,'error');}};
  openModal('create-bank-modal');
}
function exportBank(bid){
  const bank=AppBanks[bid];if(!bank)return;
  const bankQuizzes=(bank.quizIds||[]).map(qid=>AppState.tests.find(t=>t.firebaseId===qid)).filter(Boolean);
  const exportData={bankName:bank.name,subject:bank.subject,exportedAt:new Date().toISOString(),quizzes:bankQuizzes.map(t=>({name:t.name,questions:t.questions}))};
  const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`bank_${bank.name}_${Date.now()}.json`;a.click();
  showToast('تم تصدير البنك ✓');
}

/* ── Smart Quiz Generation ── */
function openGenerateQuizModal(){
  if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}
  const sel=$id('gen-banks-selector');if(!sel)return;
  sel.innerHTML='';
  Object.entries(AppBanks).forEach(([bid,bank])=>{const item=document.createElement('label');item.className='bank-quiz-selector-item';item.innerHTML=`<input type="checkbox" value="${bid}" style="accent-color:var(--accent)"> <span>${escapeHtml(bank.name)}</span> <span style="color:var(--text3);font-size:0.74rem">${(bank.quizIds||[]).length} اختبار</span>`;sel.appendChild(item);});
  openModal('generate-quiz-modal');
}
function openGenerateQuizFromBank(bid){openGenerateQuizModal();setTimeout(()=>{const cb=document.querySelector(`#gen-banks-selector input[value="${bid}"]`);if(cb)cb.checked=true;},100);}
async function generateSmartQuiz(){
  if(!isAdminMode){showToast('يجب تسجيل الدخول كأدمن','error');return;}
  const name=$id('gen-quiz-name')?.value.trim()||'اختبار مولّد تلقائياً';
  const count=parseInt($id('gen-question-count')?.value)||10;
  const selectedBanks=[...document.querySelectorAll('#gen-banks-selector input:checked')].map(i=>i.value);
  if(!selectedBanks.length){showToast('اختر بنكاً على الأقل','error');return;}
  const randomQ=$id('gen-randomize-q')?.checked!==false;
  const randomA=$id('gen-randomize-a')?.checked!==false;
  let allQuestions=[];
  selectedBanks.forEach(bid=>{const bank=AppBanks[bid];if(!bank)return;(bank.quizIds||[]).forEach(qid=>{const test=AppState.tests.find(t=>t.firebaseId===qid);if(test)allQuestions.push(...(test.questions||[]).map(q=>({...q})));});});
  if(!allQuestions.length){showToast('لا توجد أسئلة في البنوك المختارة','error');return;}
  if(randomQ)allQuestions=allQuestions.sort(()=>Math.random()-0.5);
  const selected=allQuestions.slice(0,count);
  if(randomA)selected.forEach(q=>{if(!q.choices?.length)return;const correct=q.choices[q.correct||0];const shuffled=[...q.choices].sort(()=>Math.random()-0.5);q.correct=shuffled.indexOf(correct);q.correctAnswers=[q.correct];q.choices=shuffled;});
  const data={name,timeLimit:0,folderId:'',questions:selected,createdAt:Date.now(),generatedFromBanks:selectedBanks};
  try{await dbSaveQuiz(data);closeModal('generate-quiz-modal');showToast(`✅ تم توليد "${name}" (${selected.length} سؤال)`);setTimeout(()=>showPage('home'),800);}
  catch(e){showToast(e.message||'حدث خطأ','error');}
}

/* ── Analytics ── */
function renderAnalyticsPage(){renderAnalyticsKPIs();renderHardestQuestions();renderSubjectPerformance();renderTimeline();}
function renderAnalyticsKPIs(){
  const{tests,scores,errors}=AppState;const scoreVals=Object.values(scores);const avg=scoreVals.length?Math.round(scoreVals.reduce((a,b)=>a+b,0)/scoreVals.length):0;
  const grid=$id('analytics-kpi-grid');if(!grid)return;
  const kpis=[{val:tests.length,lbl:'إجمالي الاختبارات',color:'var(--accent)'},{val:scoreVals.length,lbl:'اختبار مكتمل',color:'var(--green)'},{val:avg+'%',lbl:'متوسط الدرجات',color:avg>=70?'var(--green)':avg>=50?'var(--accent)':'var(--red)'},{val:errors.length,lbl:'خطأ مسجّل',color:'var(--red)'},{val:Object.keys(AppBanks).length,lbl:'بنك أسئلة',color:'var(--blue)'},{val:scoreVals.filter(s=>s>=90).length,lbl:'درجة ممتازة ≥90%',color:'var(--green)'}];
  grid.innerHTML=kpis.map(k=>`<div class="analytics-kpi"><div class="analytics-kpi-val" style="color:${k.color}">${k.val}</div><div class="analytics-kpi-lbl">${k.lbl}</div></div>`).join('');
}
function renderHardestQuestions(){
  const container=$id('analytics-hardest');if(!container)return;const{errors}=AppState;
  const sorted=[...errors].sort((a,b)=>(b.attempts||1)-(a.attempts||1)).slice(0,5);
  let html='<h4>🔥 أصعب الأسئلة</h4>';
  if(!sorted.length){html+='<p style="color:var(--text3);font-size:0.84rem">لا توجد بيانات بعد</p>';}
  else{html+=sorted.map((e,i)=>`<div class="analytics-hardest-item"><div class="analytics-hardest-rank">${i+1}</div><div style="flex:1;min-width:0"><div style="font-size:0.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'ThmanyahSerif',serif">${escapeHtml((e.q?.text||'سؤال').substring(0,55))}</div><div style="font-size:0.72rem;color:var(--text3);margin-top:2px">${e.testName||'—'} • ${e.attempts||1} محاولة</div></div></div>`).join('');}
  container.innerHTML=html;
}
function renderSubjectPerformance(){
  const container=$id('analytics-subjects');if(!container)return;const{tests,scores}=AppState;
  const bySubject={};tests.forEach(t=>{if(!t.subject)return;if(!bySubject[t.subject])bySubject[t.subject]=[];if(scores[t.id]!==undefined)bySubject[t.subject].push(scores[t.id]);});
  const entries=Object.entries(bySubject).filter(([,vs])=>vs.length).map(([s,vs])=>({subject:s,avg:Math.round(vs.reduce((a,b)=>a+b)/vs.length)})).sort((a,b)=>b.avg-a.avg);
  let html='<h4>📚 الأداء بالمواد</h4>';
  if(!entries.length){html+='<p style="color:var(--text3);font-size:0.84rem">لا توجد بيانات بعد</p>';}
  else{html+=entries.map(e=>`<div class="analytics-bar-row"><div class="analytics-bar-label">${escapeHtml(e.subject)}</div><div class="analytics-bar-bg"><div class="analytics-bar-fill" style="width:${e.avg}%;background:${e.avg>=70?'linear-gradient(90deg,var(--green),#10b98166)':e.avg>=50?'linear-gradient(90deg,var(--accent3),var(--accent))':'linear-gradient(90deg,var(--red),#ef444466)'}"></div></div><div class="analytics-bar-pct">${e.avg}%</div></div>`).join('');}
  container.innerHTML=html;
}
function renderTimeline(){
  const container=$id('analytics-timeline');if(!container)return;const{scores,tests}=AppState;
  const completed=tests.filter(t=>scores[t.id]!==undefined).map(t=>({name:t.name,score:scores[t.id]})).slice(-10);
  let html='<h4>📈 آخر 10 اختبارات مكتملة</h4>';
  if(!completed.length){html+='<p style="color:var(--text3);font-size:0.84rem">لم تكمل أي اختبار بعد</p>';}
  else{html+=`<div style="display:flex;flex-direction:column;gap:7px">`+completed.map(t=>`<div class="analytics-bar-row"><div class="analytics-bar-label" style="min-width:140px;font-size:0.76rem">${escapeHtml(t.name.substring(0,22))}</div><div class="analytics-bar-bg"><div class="analytics-bar-fill" style="width:${t.score}%"></div></div><div class="analytics-bar-pct">${t.score}%</div></div>`).join('')+'</div>';}
  container.innerHTML=html;
}
/* ── Quiz Engine ── */
function getCorrectAnswers(q){if(Array.isArray(q.correctAnswers)&&q.correctAnswers.length)return q.correctAnswers;if(typeof q.correct==='number')return[q.correct];return[0];}
function isAnswerCorrect(q,ua){const correct=getCorrectAnswers(q);if(ua===null||ua===undefined||ua===-1)return false;const a=Array.isArray(ua)?ua[0]:ua;return correct.includes(a);}
function startQuiz(fid){const test=AppState.tests.find(t=>t.firebaseId===fid);if(!test?.questions?.length){showToast('هذا الاختبار لا يحتوي على أسئلة!','error');return;}const saved=AppState.progress[fid];if(saved&&saved.answers?.some(a=>a!==null)){if(confirm('لديك تقدم محفوظ. هل تريد الاستمرار؟')){resumeQuiz(test,saved);return;}}initQuizSession(test);}
function startCustomQuiz(questions,title){if(!questions.length){showToast('لا توجد أسئلة','error');return;}initQuizSession({id:'__practice__',firebaseId:'__practice__',name:title,subject:'تدريب',timeLimit:0,questions});}
function initQuizSession(test){AppState.currentTest=test;AppState.currentQ=0;AppState.userAnswers=new Array(test.questions.length).fill(null);AppState.elapsedSecs=0;showPage('quiz');setText('quiz-title',test.name);setText('quiz-subtitle',(test.subject?escapeHtml(test.subject)+' • ':'')+test.questions.length+' سؤال');startTimer();renderQuestion();renderNavStrip();}
function resumeQuiz(test,saved){AppState.currentTest=test;AppState.currentQ=saved.currentQ||0;AppState.userAnswers=saved.answers||new Array(test.questions.length).fill(null);AppState.elapsedSecs=saved.elapsed||0;showPage('quiz');setText('quiz-title',test.name);setText('quiz-subtitle',(test.subject?escapeHtml(test.subject)+' • ':'')+test.questions.length+' سؤال');startTimer();renderQuestion();renderNavStrip();showToast('استُؤنف الاختبار ✓','info');}
function startTimer(){clearInterval(AppState.timerInterval);const limit=(AppState.currentTest.timeLimit||0)*60;const pill=$id('timer-pill');AppState.timerInterval=setInterval(()=>{AppState.elapsedSecs++;if(AppState.elapsedSecs%30===0)saveProgress();if(limit>0){const rem=limit-AppState.elapsedSecs;if(rem<=0){clearInterval(AppState.timerInterval);submitQuiz();return;}if(pill){pill.className='timer-pill'+(rem<=60?' danger':rem<=120?' warning':'');pill.innerHTML=`⏱️ <span>${fmtTime(rem)}</span>`;}}else{if(pill)pill.innerHTML=`⏱️ <span>${fmtTime(AppState.elapsedSecs)}</span>`;}},1000);}
function saveProgress(){const{currentTest,currentQ,userAnswers,elapsedSecs}=AppState;if(!currentTest||currentTest.id==='__practice__')return;AppState.progress[currentTest.id]={currentQ,answers:[...userAnswers],elapsed:elapsedSecs};localStorage.setItem('quizProgress',JSON.stringify(AppState.progress));}
function clearProgress(tid){delete AppState.progress[tid];localStorage.setItem('quizProgress',JSON.stringify(AppState.progress));}
function renderNavStrip(){const strip=$id('q-nav-strip');if(!strip)return;const{currentTest,currentQ,userAnswers}=AppState;strip.innerHTML='';currentTest.questions.forEach((_,i)=>{const d=document.createElement('div');const ua=userAnswers[i];let cls='unanswered';if(i===currentQ)cls='current';else if(ua===-1)cls='skipped';else if(ua!==null)cls='answered';d.className='q-nav-dot '+cls;d.textContent=i+1;d.title='السؤال '+(i+1);d.onclick=()=>jumpToQuestion(i);strip.appendChild(d);});}
function jumpToQuestion(i){AppState.currentQ=i;renderQuestion();renderNavStrip();}
function renderQuestion(){
  const{currentTest,currentQ,userAnswers}=AppState;const q=currentTest.questions[currentQ];
  const pct=(currentQ/currentTest.questions.length)*100;const pf=$id('q-progress-fill');if(pf)pf.style.width=pct+'%';
  setText('q-counter',(currentQ+1)+' / '+currentTest.questions.length);setText('q-num','السؤال '+(currentQ+1));setText('q-text',q.text);
  const qImg=$id('q-image-display');if(qImg){if(q.image&&q.image.trim()){qImg.src=q.image;qImg.style.display='block';}else{qImg.src='';qImg.style.display='none';}}
  const notePre=$id('teacher-note-pre');if(notePre){if(q.note&&q.note.trim()&&AppState.adminSettings.showNotesLive!==false){notePre.textContent=q.note;notePre.style.display='flex';}else{notePre.style.display='none';}}
  const nb=$id('teacher-note-box');if(nb)nb.style.display='none';
  const letters=['أ','ب','ج','د','هـ','و'];const container=$id('choices-container');if(!container)return;
  const frag=document.createDocumentFragment();const ua=userAnswers[currentQ];
  q.choices.forEach((c,i)=>{const div=document.createElement('div');div.className='choice'+(ua===i?' selected':'');div.id='choice-'+i;div.onclick=()=>selectAnswer(i);div.innerHTML=`<div class="choice-letter">${letters[i]||(i+1)}</div><div class="choice-text">${escapeHtml(c)}</div>`;frag.appendChild(div);});
  container.innerHTML='';container.appendChild(frag);
  const prevBtn=$id('prev-btn'),nextBtn=$id('next-btn'),skipBtn=$id('skip-btn');
  if(prevBtn)prevBtn.disabled=(currentQ===0);if(nextBtn)nextBtn.textContent=currentQ===currentTest.questions.length-1?'إنهاء ✓':'التالي ←';if(skipBtn)skipBtn.style.display=ua!==null?'none':'';
}
function selectAnswer(i){AppState.userAnswers[AppState.currentQ]=i;document.querySelectorAll('.choice').forEach((el,ci)=>{el.classList.toggle('selected',ci===i);});const sb=$id('skip-btn');if(sb)sb.style.display='none';saveProgress();renderNavStrip();}
function prevQuestion(){if(AppState.currentQ>0){AppState.currentQ--;renderQuestion();renderNavStrip();}}
function nextQuestion(){const{currentQ,currentTest}=AppState;if(currentQ<currentTest.questions.length-1){AppState.currentQ++;renderQuestion();renderNavStrip();}else openFinalReview();}
function skipQuestion(){AppState.userAnswers[AppState.currentQ]=-1;saveProgress();renderNavStrip();nextQuestion();}
function confirmLeaveQuiz(){openModal('leave-modal');}
function leaveQuiz(){clearInterval(AppState.timerInterval);closeModal('leave-modal');showPage('home');}

function openFinalReview(){
  const{currentTest,userAnswers}=AppState;const qs=currentTest.questions;
  const answered=userAnswers.filter(a=>a!==null&&a!==-1).length,skipped=userAnswers.filter(a=>a===-1).length,unanswered=userAnswers.filter(a=>a===null).length;
  setText('final-review-summary',`إجمالي: ${qs.length} • أجبت: ${answered} • تخطي: ${skipped} • لم تجب: ${unanswered}`);
  const letters=['أ','ب','ج','د','هـ','و'];const list=$id('final-review-list');if(!list)return;list.innerHTML='';
  qs.forEach((q,i)=>{const ua=userAnswers[i];const item=document.createElement('div');const isAnswered=ua!==null&&ua!==-1,isSkipped=ua===-1;item.className='final-review-item'+(isAnswered?' answered':isSkipped?' skipped':'');item.onclick=()=>{closeModal('final-review-modal');jumpToQuestion(i);};const ansText=isAnswered?`${letters[ua]||ua+1}. ${escapeHtml(q.choices[ua]||'')}`:isSkipped?'تم التخطي':'لم تُجب بعد';item.innerHTML=`<div class="fri-num">السؤال ${i+1}</div><div class="fri-q">${escapeHtml(q.text)}</div><div class="fri-ans ${isAnswered?'has-answer':'no-answer'}">${escapeHtml(ansText)}</div>`;list.appendChild(item);});
  openModal('final-review-modal');
}
function submitQuiz(){
  closeModal('final-review-modal');clearInterval(AppState.timerInterval);
  const{currentTest,userAnswers,elapsedSecs}=AppState;const qs=currentTest.questions;
  let correct=0,skipped=0;const wrongList=[];
  qs.forEach((q,i)=>{const ua=userAnswers[i];if(ua===-1||ua===null)skipped++;else if(isAnswerCorrect(q,ua))correct++;else wrongList.push({testName:currentTest.name,testId:currentTest.id,qIndex:i,q,userAnswer:ua,timestamp:Date.now(),attempts:getErrorAttemptCount(currentTest.id,i)+1});});
  const pct=Math.round(correct/qs.length*100);
  if(currentTest.id!=='__practice__'){AppState.scores[currentTest.id]=pct;localStorage.setItem('quizScores',JSON.stringify(AppState.scores));clearProgress(currentTest.id);dbSaveAnalytics(currentTest.id,{score:pct,correct,wrong:qs.length-correct-skipped,skipped,total:qs.length,elapsed:elapsedSecs});}
  updateErrorTracking(wrongList);showResults(pct,correct,skipped,qs.length,elapsedSecs);
}
function getErrorAttemptCount(testId,qIndex){return AppState.errors.find(e=>e.testId===testId&&e.qIndex===qIndex)?.attempts||0;}
function updateErrorTracking(wrongList){
  const{currentTest}=AppState;
  wrongList.forEach(w=>{const idx=AppState.errors.findIndex(e=>e.testId===w.testId&&e.qIndex===w.qIndex);if(idx>=0)AppState.errors[idx]={...AppState.errors[idx],...w,attempts:(AppState.errors[idx].attempts||1)+1};else AppState.errors.push(w);});
  AppState.userAnswers.forEach((ua,i)=>{if(ua!==null&&ua!==-1&&isAnswerCorrect(currentTest.questions[i],ua))AppState.errors=AppState.errors.filter(e=>!(e.testId===currentTest.id&&e.qIndex===i));});
  AppState.errors.sort((a,b)=>(b.attempts||1)-(a.attempts||1));localStorage.setItem('quizErrors',JSON.stringify(AppState.errors));
}
function showResults(pct,correct,skipped,total,elapsed){
  showPage('results');const wrong=total-correct-skipped;
  const icon=pct>=90?'🏆':pct>=70?'🎉':pct>=50?'📚':'💪';
  const grade=pct>=90?'ممتاز':pct>=80?'جيد جداً':pct>=70?'جيد':pct>=60?'مقبول':'راجع المادة';
  const gColor=pct>=70?'var(--green)':pct>=50?'var(--accent)':'var(--red)';const arcColor=pct>=70?'#10b981':pct>=50?'#fbbf24':'#ef4444';
  setText('results-icon',icon);setText('results-score',pct+'%');setText('score-pct',pct+'%');setText('results-label',AppState.currentTest.name);
  const ge=$id('results-grade');if(ge){ge.textContent=grade;ge.style.cssText=`background:${gColor}22;color:${gColor};border:1px solid ${gColor}44`;}
  setText('r-correct',correct);setText('r-wrong',wrong);setText('r-skipped',skipped);setText('r-time',fmtTime(elapsed));
  const arc=$id('score-arc');if(arc){arc.style.stroke=arcColor;setTimeout(()=>{arc.style.strokeDashoffset=326.7-(326.7*pct/100);},100);}
  renderBreakdownDots();renderReviewList();
}
function renderBreakdownDots(){const{currentTest,userAnswers}=AppState;const grid=$id('breakdown-grid');if(!grid)return;const frag=document.createDocumentFragment();currentTest.questions.forEach((q,i)=>{const ua=userAnswers[i];const dot=document.createElement('div');let cls='s',sym='⏭';if(ua!==null&&ua!==-1&&isAnswerCorrect(q,ua)){cls='c';sym=i+1;}else if(ua!==null&&ua!==-1){cls='w';sym=i+1;}dot.className='breakdown-dot '+cls;dot.title='سؤال '+(i+1);dot.textContent=sym;frag.appendChild(dot);});grid.innerHTML='';grid.appendChild(frag);}
function renderReviewList(){
  const{currentTest,userAnswers}=AppState;const qs=currentTest.questions,letters=['أ','ب','ج','د','هـ','و'];
  const rvList=$id('review-list');if(!rvList)return;const frag=document.createDocumentFragment();
  qs.forEach((q,i)=>{const ua=userAnswers[i],correct=getCorrectAnswers(q);const isCorrect=ua!==null&&ua!==-1&&isAnswerCorrect(q,ua);const item=document.createElement('div');item.className='review-item '+(isCorrect?'r-correct':'r-wrong');let ch='';q.choices.forEach((c,ci)=>{const isCor=correct.includes(ci),isUser=ua===ci;let cls2='';if(isCor)cls2='r-answer';else if(isUser&&!isCor)cls2='r-user-wrong';if(cls2)ch+=`<div class="review-choice ${cls2}">${isCor?'✅':'❌'} ${letters[ci]||ci+1}. ${escapeHtml(c)}</div>`;});const noteHtml=q.note?`<div class="review-note"><span>💡 ملاحظة المعلم</span>${escapeHtml(q.note)}</div>`:'';const imgHtml=q.image?`<img src="${q.image}" style="max-width:100%;max-height:140px;border-radius:8px;margin-bottom:6px;object-fit:contain" alt="صورة"/>`:'';item.innerHTML=`<div class="review-q">${i+1}. ${escapeHtml(q.text)}</div>${imgHtml}<div class="review-choices">${ch}</div>${noteHtml}`;frag.appendChild(item);});
  rvList.innerHTML='';rvList.appendChild(frag);
}
function retryQuiz(){const{currentTest}=AppState;if(currentTest.firebaseId!=='__practice__')startQuiz(currentTest.firebaseId);else startCustomQuiz(currentTest.questions,currentTest.name);}
function renderErrors(){
  const container=$id('errors-container'),panel=$id('practice-panel');const{errors}=AppState;
  if(!errors.length){if(panel)panel.style.display='none';if(container)container.innerHTML='<div class="empty-state"><div class="icon">🎉</div><p>لا توجد أخطاء مسجّلة — أحسنت!</p></div>';return;}
  if(panel)panel.style.display='block';
  const size=parseInt($id('practice-size')?.value)||10;setText('practice-splits-info',`${errors.length} خطأ • ${Math.ceil(errors.length/size)} جلسة`);
  const grouped={};errors.forEach(e=>{const k=AppState.adminSettings.categorizedErrors?(e.testId||'general'):'all';if(!grouped[k])grouped[k]={name:e.testName||'الكل',items:[]};grouped[k].items.push(e);});
  const letters=['أ','ب','ج','د','هـ','و'];const frag=document.createDocumentFragment();
  Object.entries(grouped).forEach(([key,g])=>{
    const folder=document.createElement('div');folder.className='errors-folder';const bid='ef_'+key.replace(/[^a-z0-9]/gi,'_');let ih='';
    g.items.forEach((e,idx)=>{const ua=e.userAnswer,ci=getCorrectAnswers(e.q);const cText=ci.map(c=>`${letters[c]||c+1}. ${escapeHtml(e.q.choices?.[c]||'—')}`).join(' ، ');const uText=ua>=0?`${letters[ua]||'?'}. ${escapeHtml(e.q.choices?.[ua]||'—')}`:null;const at=(e.attempts>1)?`<span class="error-attempts">🔁 ${e.attempts} مرات</span>`:'';ih+=`<div class="error-item"><div class="error-q-num">${idx+1}</div><div class="error-content"><div class="error-q">${escapeHtml(e.q.text)}</div><div class="error-answers">${uText?`<span class="error-wrong">❌ إجابتك: ${uText}</span>`:'<span class="error-wrong">⏭️ تخطي</span>'}<span class="error-correct">✅ الصحيح: ${cText}</span>${at}</div></div></div>`;});
    folder.innerHTML=`<div class="folder-top" onclick="const b=document.getElementById('${bid}');b.style.display=b.style.display==='none'?'flex':'none'"><div class="folder-top-left"><span>📁</span><span class="folder-title">${escapeHtml(g.name)}</span></div><div class="folder-actions"><button class="folder-retake-btn" onclick="event.stopPropagation();retakeErrorsForQuiz('${key}')">🔁 إعادة التدريب</button><span class="folder-count">${g.items.length} خطأ</span></div></div><div class="folder-body" id="${bid}" style="display:none">${ih}</div>`;
    frag.appendChild(folder);
  });
  if(container){container.innerHTML='';container.appendChild(frag);}
}
function retakeErrorsForQuiz(key){const sub=key==='all'?AppState.errors:AppState.errors.filter(e=>e.testId===key);if(!sub.length){showToast('لا توجد أخطاء','error');return;}startCustomQuiz([...sub].sort((a,b)=>(b.attempts||1)-(a.attempts||1)).map(e=>({...e.q})),`تدريب أخطاء: ${sub[0]?.testName||'عام'}`);}
function startPracticeSession(all=false){
  const{errors}=AppState;if(!errors.length){showToast('لا توجد أخطاء','error');return;}
  const sorted=[...errors].sort((a,b)=>(b.attempts||1)-(a.attempts||1));const questions=sorted.map(e=>({...e.q}));
  if(all){startCustomQuiz(questions,'تدريب الأخطاء — كل الأسئلة');return;}
  const size=parseInt($id('practice-size')?.value)||10;const splits=[];for(let i=0;i<questions.length;i+=size)splits.push(questions.slice(i,i+size));
  if(splits.length===1){startCustomQuiz(splits[0],'تدريب الأخطاء — جلسة 1');return;}
  setText('practice-modal-desc',`${questions.length} سؤال مقسّم على ${splits.length} جلسات`);
  let lh='';splits.forEach((chunk,i)=>{lh+=`<div class="manage-item"><div class="manage-item-info"><div class="manage-item-name">الجلسة ${i+1}</div><div class="manage-item-meta">${chunk.length} سؤال</div></div><button class="btn btn-primary" style="font-size:0.82rem;padding:8px 14px" onclick="closeModal('practice-modal');startCustomQuiz(window.__pChunks[${i}],'جلسة ${i+1}')">▶</button></div>`;});
  const le=$id('practice-sessions-list');if(le)le.innerHTML=lh;window.__pChunks=splits;openModal('practice-modal');
}
/* ── OMR ── */
function openOmrPanel(){const panel=$id('omr-panel'),qp=document.querySelector('.quiz-page');if(panel)panel.style.display='block';if(qp)qp.style.display='none';panel?.scrollIntoView({behavior:'smooth'});}
function closeOmrPanel(){const panel=$id('omr-panel'),qp=document.querySelector('.quiz-page');if(panel)panel.style.display='none';if(qp)qp.style.display='block';const c=$id('omr-canvas');if(c)c.style.display='none';const p=$id('omr-processing');if(p)p.style.display='none';const r=$id('omr-results-preview');if(r)r.style.display='none';const t=$id('omr-upload-text');if(t)t.textContent='📷 اضغط لرفع الصورة';}
async function handleOmrUpload(event){const file=event.target.files[0];if(!file)return;const proc=$id('omr-processing'),txt=$id('omr-upload-text');if(txt)txt.textContent='⏳ جارٍ التحليل...';if(proc)proc.style.display='block';const img=new Image();img.onload=()=>processOmrImage(img);img.onerror=()=>{showToast('فشل تحميل الصورة','error');if(proc)proc.style.display='none';};img.src=URL.createObjectURL(file);}
function processOmrImage(img){
  const canvas=$id('omr-canvas'),proc=$id('omr-processing');if(!canvas)return;
  const MAX_W=800;const scale=Math.min(1,MAX_W/img.width);canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
  const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
  gradeOmrWithPixels(ctx,canvas.width,canvas.height);canvas.style.display='block';if(proc)proc.style.display='none';const txt=$id('omr-upload-text');if(txt)txt.textContent='✅ تم رفع الصورة';
}
function gradeOmrWithPixels(ctx,W,H){
  const{currentTest}=AppState;if(!currentTest)return;const questions=currentTest.questions,numQ=questions.length;
  const marginX=Math.round(W*0.1),marginY=Math.round(H*0.08),usableW=W-2*marginX,usableH=H-2*marginY;
  const rowH=usableH/Math.max(numQ,1),colW=usableW/4;
  const detectedAnswers=[];const darkThreshold=110,fillRatio=0.35;
  for(let qi=0;qi<numQ;qi++){const rowY=marginY+qi*rowH;let bestCol=-1,bestDensity=0;for(let ci=0;ci<4;ci++){const colX=marginX+ci*colW;const bx=Math.round(colX+colW*0.2),by=Math.round(rowY+rowH*0.15),bw=Math.round(colW*0.6),bh=Math.round(rowH*0.7);const bx2=Math.min(bx+bw,W),by2=Math.min(by+bh,H);const imgData=ctx.getImageData(bx,by,bx2-bx,by2-by);const pixels=imgData.data;let darkCount=0;const total=(bx2-bx)*(by2-by);for(let p=0;p<pixels.length;p+=4){const gray=0.299*pixels[p]+0.587*pixels[p+1]+0.114*pixels[p+2];if(gray<darkThreshold)darkCount++;}const density=total>0?darkCount/total:0;if(density>bestDensity){bestDensity=density;bestCol=ci;}}if(bestDensity<fillRatio)bestCol=-1;detectedAnswers.push(bestCol);}
  const detected=detectedAnswers.filter(a=>a!==-1).length;if(detected<numQ*0.5)showToast('⚠️ الإضاءة ضعيفة — تأكد من وضوح الصورة','warning',5000);
  showOmrResults(detectedAnswers,questions,['أ','ب','ج','د']);
}
function showOmrResults(detectedAnswers,questions,letters){
  const container=$id('omr-results-preview');if(!container)return;const{currentTest}=AppState;
  let correct=0,wrong=0,empty=0;const wrongList=[];
  const rows=questions.map((q,i)=>{const det=detectedAnswers[i];const correctIdxs=getCorrectAnswers(q);let cls='omr-answer-empty',statusText='—';if(det===-1||det===undefined){empty++;statusText='لم يُكتشف';}else if(correctIdxs.includes(det)){correct++;cls='omr-answer-correct';statusText=letters[det]+' — صحيح ✓';}else{wrong++;cls='omr-answer-wrong';statusText=letters[det]+' — خطأ ✗';wrongList.push({testName:currentTest.name,testId:currentTest.id,qIndex:i,q,userAnswer:det,timestamp:Date.now(),attempts:getErrorAttemptCount(currentTest.id,i)+1});}return`<div class="omr-answer-row"><div class="omr-answer-num">${i+1}</div><div style="flex:1;font-size:0.82rem;color:var(--text2);font-family:'ThmanyahSerif',serif">${(q.text||'').substring(0,50)}</div><div class="omr-answer-detected ${cls}">${statusText}</div></div>`;}).join('');
  const pct=Math.round(correct/questions.length*100);const gColor=pct>=70?'var(--green)':pct>=50?'var(--accent)':'var(--red)';
  container.innerHTML=`<div style="background:rgba(251,191,36,.06);border:1px solid var(--glass-border);border-radius:var(--radius-sm);padding:16px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><div style="font-family:'Foda',serif;font-size:2rem;color:${gColor}">${pct}%</div><div style="display:flex;gap:12px;font-size:0.82rem"><span style="color:var(--green)">✅ ${correct}</span><span style="color:var(--red)">❌ ${wrong}</span><span style="color:var(--text3)">⬜ ${empty}</span></div></div></div><div style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">${rows}</div><div style="display:flex;gap:10px;margin-top:14px"><button class="btn btn-primary" onclick="applyOmrResults(${JSON.stringify(detectedAnswers).replace(/"/g,'&quot;')})" style="font-size:0.85rem">✅ تطبيق النتيجة</button></div>`;
  container.style.display='block';if(wrongList.length){updateErrorTracking(wrongList);showToast(`${wrongList.length} خطأ تم تسجيله`);}
}
function applyOmrResults(detectedAnswers){const{currentTest}=AppState;if(!currentTest)return;AppState.userAnswers=detectedAnswers.map(a=>a===undefined?null:a);const qs=currentTest.questions;let correct=0,skipped=0;qs.forEach((q,i)=>{const ua=AppState.userAnswers[i];if(ua===-1||ua===null)skipped++;else if(isAnswerCorrect(q,ua))correct++;});const pct=Math.round(correct/qs.length*100);if(currentTest.id!=='__practice__'){AppState.scores[currentTest.id]=pct;localStorage.setItem('quizScores',JSON.stringify(AppState.scores));dbSaveAnalytics(currentTest.id,{score:pct,total:qs.length,method:'omr'});}closeOmrPanel();clearInterval(AppState.timerInterval);showResults(pct,correct,skipped,qs.length,AppState.elapsedSecs);}
function generateOmrTemplate(){const{currentTest}=AppState;if(!currentTest){showToast('ابدأ اختباراً أولاً','error');return;}const numQ=currentTest.questions.length;const letters=['أ','ب','ج','د'];let html=`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>نموذج البابل شيت</title><style>body{font-family:Arial,sans-serif;direction:rtl;padding:30px;background:#fff}h2{text-align:center;font-size:18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 10px;text-align:center;font-size:13px}th{background:#f5f5f5}.circle{display:inline-block;width:22px;height:22px;border-radius:50%;border:2px solid #333;line-height:18px;text-align:center;font-size:11px}@media print{button{display:none}}</style></head><body><h2>📝 ورقة الإجابات — ${currentTest.name}</h2><p style="text-align:center">اسم الطالب: _________________________</p><table><tr><th>رقم السؤال</th>${letters.map(l=>`<th>○ ${l}</th>`).join('')}</tr>`;for(let i=0;i<numQ;i++){html+=`<tr><td style="font-weight:bold">${i+1}</td>${letters.map(l=>`<td><span class="circle">${l}</span></td>`).join('')}</tr>`;}html+=`</table><script>window.print();<\/script></body></html>`;const win=window.open('','_blank');if(win){win.document.write(html);win.document.close();}else showToast('تعذّر فتح نافذة الطباعة','warning');}

/* ── Pomodoro ── */
function updatePomoSettings(){const p=AppState.pomodoro;if(p.running)return;p.focusMins=parseInt($id('pomo-focus-input')?.value)||25;p.breakMins=parseInt($id('pomo-break-input')?.value)||5;p.totalSessions=parseInt($id('pomo-sessions-input')?.value)||4;p.remaining=p.focusMins*60;p.phase='focus';updatePomoDisplay();}
function togglePomodoro(){const p=AppState.pomodoro;if(p.running){clearInterval(p.interval);p.running=false;setText('pomo-start-btn','▶ ابدأ');setText('pomo-status-text','متوقف مؤقتاً');}else{p.running=true;setText('pomo-start-btn','⏸ إيقاف');p.interval=setInterval(tickPomo,1000);}}
function tickPomo(){const p=AppState.pomodoro;p.remaining--;if(p.remaining<=0){if(p.phase==='focus'){p.completedSessions++;p.phase='break';p.remaining=p.breakMins*60;showToast('🍅 وقت الاستراحة!','info');}else{p.phase='focus';p.remaining=p.focusMins*60;p.currentSession=Math.min(p.currentSession+1,p.totalSessions);if(p.completedSessions>=p.totalSessions){showToast('🏆 انتهت جميع الجلسات!','success');resetPomodoro();return;}showToast('✏️ وقت التركيز!','info');}}updatePomoDisplay();}
function skipPomoPhase(){AppState.pomodoro.remaining=0;tickPomo();}
function resetPomodoro(){const p=AppState.pomodoro;clearInterval(p.interval);p.running=false;p.phase='focus';p.currentSession=1;p.completedSessions=0;p.remaining=p.focusMins*60;setText('pomo-start-btn','▶ ابدأ');updatePomoDisplay();}
function updatePomoDisplay(){const p=AppState.pomodoro;const f=p.phase==='focus';const total=(f?p.focusMins:p.breakMins)*60,off=188.5-(188.5*p.remaining/total);setText('pomo-display',fmtTime(p.remaining));const de=$id('pomo-display');if(de)de.className='pomo-time '+(f?'focus':'break');const le=$id('pomo-label');if(le){le.textContent=f?'تركيز':'استراحة';le.className='pomo-label '+(f?'focus':'break');}const re=$id('pomo-ring-fill');if(re){re.style.strokeDashoffset=off;re.className='pomo-ring-fill '+(f?'focus-ring':'break-ring');}setText('pomo-sessions-inner',p.currentSession+'/'+p.totalSessions);setText('pomo-status-text',p.running?(f?'⏳ جلسة تركيز جارية...':'☕ استرح قليلاً...'):'ابدأ جلسة دراسة منتجة');let dots='';for(let i=0;i<p.totalSessions;i++)dots+=`<div class="pomo-dot ${i<p.completedSessions?'done':''}"></div>`;const de2=$id('pomo-dots');if(de2)de2.innerHTML=dots;}

/* ── Tools ── */
function initToolsPage(){const tg=JSON.parse(localStorage.getItem('toolGoal')||'null');if(tg){setVal('tool-goal-name',tg.name||'');setVal('tool-goal-target',tg.target||20);setVal('tool-goal-done',tg.done||0);updateToolGoal();}updateCdDisplay();updateQtDisplay();}
function updateCdDisplay(){const r=AppState.tools.cd.remaining,e=$id('cd-display');if(!e)return;e.textContent=fmtTime(r);e.className='tool-timer-val'+(r<=10&&r>0?' danger':r<=30?' warning':AppState.tools.cd.running?' running':'');}
function toggleCountdown(){const cd=AppState.tools.cd;if(cd.running){clearInterval(cd.interval);cd.running=false;setText('cd-start-btn','▶ ابدأ');setText('cd-label','متوقف');}else{if(!cd.remaining){const m=parseInt($id('cd-mins')?.value)||0,s=parseInt($id('cd-secs')?.value)||0;cd.total=cd.remaining=m*60+s;if(!cd.remaining){showToast('حدد وقتاً أولاً','error');return;}}cd.running=true;setText('cd-start-btn','⏸ إيقاف');setText('cd-label','يعدّ...');cd.interval=setInterval(()=>{cd.remaining--;updateCdDisplay();if(cd.remaining<=0){clearInterval(cd.interval);cd.running=false;setText('cd-start-btn','▶ ابدأ');setText('cd-label','✅ انتهى الوقت!');showToast('⏰ انتهى الوقت!','info');}},1000);}}
function resetCountdown(){const cd=AppState.tools.cd;clearInterval(cd.interval);cd.running=false;cd.remaining=0;setText('cd-start-btn','▶ ابدأ');setText('cd-label','جاهز للبدء');updateCdDisplay();}
function toggleStopwatch(){const sw=AppState.tools.sw;if(sw.running){clearInterval(sw.interval);sw.running=false;setText('sw-start-btn','▶ ابدأ');setText('sw-label','متوقفة');const lb=$id('sw-lap-btn');if(lb)lb.disabled=true;}else{sw.running=true;setText('sw-start-btn','⏸ إيقاف');setText('sw-label','تعمل...');const lb=$id('sw-lap-btn');if(lb)lb.disabled=false;sw.interval=setInterval(()=>{sw.elapsed++;setText('sw-display',fmtTime(sw.elapsed));},1000);}}
function lapStopwatch(){const sw=AppState.tools.sw,le=$id('sw-laps');if(!le)return;sw.laps.push(sw.elapsed);const d=document.createElement('div');d.style.cssText='background:var(--surface2);border-radius:6px;padding:4px 10px;font-size:0.78rem;color:var(--text3);display:flex;justify-content:space-between';d.innerHTML=`<span>لفة ${sw.laps.length}</span><span style="color:var(--accent);font-weight:700">${fmtTime(sw.elapsed)}</span>`;le.appendChild(d);le.scrollTop=le.scrollHeight;}
function resetStopwatch(){const sw=AppState.tools.sw;clearInterval(sw.interval);sw.running=false;sw.elapsed=0;sw.laps=[];setText('sw-display','00:00');setText('sw-start-btn','▶ ابدأ');setText('sw-label','متوقفة');const lb=$id('sw-lap-btn');if(lb)lb.disabled=true;const le=$id('sw-laps');if(le)le.innerHTML='';}
function updateToolGoal(){const t=parseInt($id('tool-goal-target')?.value)||1,d=parseInt($id('tool-goal-done')?.value)||0,p=Math.min(100,Math.round(d/t*100));setText('tool-goal-pct',p+'%');setText('tool-goal-sub',`${d} من ${t}`);const b=$id('tool-goal-bar');if(b)b.style.width=p+'%';}
function incrementGoalDone(){const i=$id('tool-goal-done');if(i){i.value=(parseInt(i.value)||0)+1;updateToolGoal();}}
function saveToolGoal(){localStorage.setItem('toolGoal',JSON.stringify({name:$id('tool-goal-name')?.value.trim(),target:parseInt($id('tool-goal-target')?.value)||20,done:parseInt($id('tool-goal-done')?.value)||0}));showToast('تم حفظ الهدف ✓');}
function updateQtDisplay(){const qt=AppState.tools.qt,r=qt.remaining,t=qt.perQ||1,p=Math.max(0,r/t*100),e=$id('qt-display');if(e){e.textContent=fmtTime(r);e.className='tool-timer-val'+(r<=5?' danger':r<=10?' warning':'');}setText('qt-label',qt.qIdx?`سؤال ${qt.qIdx} / ${qt.total}`:'جاهز');const b=$id('qt-bar');if(b)b.style.width=p+'%';}
function toggleQTimer(){const qt=AppState.tools.qt;if(qt.running){clearInterval(qt.interval);qt.running=false;setText('qt-start-btn','▶ ابدأ');const nb=$id('qt-next-btn');if(nb)nb.disabled=true;}else{if(!qt.qIdx){qt.perQ=parseInt($id('qt-secs')?.value)||30;qt.total=parseInt($id('qt-count')?.value)||10;qt.qIdx=1;qt.remaining=qt.perQ;}qt.running=true;setText('qt-start-btn','⏸ إيقاف');const nb=$id('qt-next-btn');if(nb)nb.disabled=false;qt.interval=setInterval(()=>{qt.remaining--;updateQtDisplay();if(qt.remaining<=0)nextQTimer();},1000);}}
function nextQTimer(){const qt=AppState.tools.qt;qt.qIdx++;if(qt.qIdx>qt.total){clearInterval(qt.interval);qt.running=false;qt.qIdx=0;setText('qt-start-btn','▶ ابدأ');const nb=$id('qt-next-btn');if(nb)nb.disabled=true;setText('qt-label','✅ انتهت الأسئلة!');showToast('✅ انتهت جميع الأسئلة!','success');return;}qt.remaining=qt.perQ;updateQtDisplay();}
function resetQTimer(){const qt=AppState.tools.qt;clearInterval(qt.interval);qt.running=false;qt.qIdx=0;qt.remaining=0;setText('qt-start-btn','▶ ابدأ');const nb=$id('qt-next-btn');if(nb)nb.disabled=true;updateQtDisplay();}

/* ── INIT ── */
function initApp(){
  initTheme();updatePomoSettings();
  attachFirebaseListener();attachFoldersListener();attachBanksListener();
  onAuthStateChange((user,isAdmin)=>{applyAdminUI(user,isAdmin);if($id('page-home')?.classList.contains('active'))renderHome();});
}
document.addEventListener('DOMContentLoaded',initApp);
