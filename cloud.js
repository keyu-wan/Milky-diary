/* Milky cloud sync: GitHub Pages + Firebase. Do not place admin credentials in this file. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const status=msg=>{$('cloudStatus').textContent=msg};
const config=window.MILKY_FIREBASE_CONFIG;
const ownerUids=window.MILKY_OWNER_UIDS || [window.MILKY_OWNER_UID];
document.body.classList.add('cloud-viewer');
if(!config || !config.apiKey || config.apiKey.startsWith('PASTE_') || !config.projectId || config.projectId.startsWith('PASTE_')){
 status('尚未连接云端：请按 README 配置 Firebase。当前页面是静态预览，上传功能未启用。');
 $('addPhoto').disabled=true;
 return;
}
if(typeof firebase==='undefined'){status('Firebase 脚本加载失败，请检查网络。');return}
let app,auth,db,storage;
try{app=firebase.initializeApp(config);auth=firebase.auth();db=firebase.firestore();storage=firebase.storage()}catch(e){status('Firebase 初始化失败：'+e.message);return}
const contentRef=db.collection('site').doc('content');
const feedingRef=db.collection('site').doc('feeding');
window.milkyFeedCloud={save:async data=>{if(!isOwner)throw Error('仅主人可以修改喂养记录');await feedingRef.set({data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()})},isOwner:()=>isOwner,authInfo:()=>({uid:auth.currentUser?.uid||null,anonymous:auth.currentUser?.isAnonymous??null,recognized:isOwner})};
feedingRef.onSnapshot(snap=>{if(snap.exists&&snap.data().data)window.dispatchEvent(new CustomEvent('milky-feeding-cloud',{detail:snap.data().data}));},showError);

let isOwner=false, signedIn=false, cloudReady=false, saving=false, cloudPhotoDocs=[];
let loginPending=false, authTransition=false, anonymousPending=false;
const photoRefs=new Map();
const setOwner=flag=>{
 isOwner=flag;document.body.classList.toggle('cloud-viewer',!flag);window.dispatchEvent(new Event('milky-feeding-auth'));
 $('cloudLogin').hidden=flag;$('cloudLogout').hidden=!flag;
 $('cloudSeed').hidden=!flag || cloudReady;
 document.querySelectorAll('.taskRow input[type=checkbox]').forEach(el=>el.disabled=!flag);document.querySelectorAll('.taskStar').forEach(el=>el.disabled=!flag);
};
const showError=e=>{status('操作失败：'+(e&&e.message||String(e)))};
const originalRenderAll=renderAllTasks, originalRenderEvents=renderMilkyEvents, originalRenderWeights=renderMilkyWeights;
renderAllTasks=function(){originalRenderAll();document.querySelectorAll('.taskRow input[type=checkbox]').forEach(el=>el.disabled=!isOwner);document.querySelectorAll('.taskStar').forEach(el=>el.disabled=!isOwner)};
renderMilkyEvents=function(){originalRenderEvents();document.querySelectorAll('[data-ev]').forEach(el=>el.hidden=!isOwner)};
renderMilkyWeights=function(){originalRenderWeights();document.querySelectorAll('[data-wt]').forEach(el=>el.hidden=!isOwner)};
const originalRenderPhotos=renderPhotos;
renderPhotos=function(){
 const remote=cloudPhotoDocs.map(p=>({id:p.id,date:p.date,title:p.title,uploaderName:p.uploaderName||'',description:p.description||'',src:photoRefs.get(p.id)||'',cloud:true}));
 uploaded=remote;
 originalRenderPhotos();
 // only owner may remove photos; visitor-created images are displayed but not editable
 if(isOwner){document.querySelectorAll('#photos .photo').forEach(card=>{const id=card.dataset.id;if(cloudPhotoDocs.some(p=>p.id===id)){const b=document.createElement('button');b.type='button';b.dataset.remove=id;b.setAttribute('aria-label','删除照片');b.textContent='✕';card.appendChild(b);const edit=document.createElement('button');edit.type='button';edit.className='photo-edit-btn';edit.dataset.edit=id;edit.textContent='✎';edit.title='编辑照片信息';edit.setAttribute('aria-label','编辑照片信息');card.appendChild(edit)}})}
 document.querySelectorAll('#photos [data-edit]').forEach(b=>{b.onclick=e=>{e.stopPropagation();if(!isOwner)return;openPhotoEditor(b.dataset.edit)}});
 document.querySelectorAll('#photos [data-remove]').forEach(b=>{
  b.hidden=!isOwner;
  if(isOwner)b.onclick=async()=>{
   const id=b.dataset.remove,p=cloudPhotoDocs.find(x=>x.id===id);
   if(!p||!confirm('从云端删除这张照片？'))return;
   try{await db.collection('photos').doc(id).delete();await storage.ref(p.path).delete().catch(()=>{});status('照片已删除。')}catch(e){showError(e)}
  };
 });
};
// Edit metadata only. Original photo bytes, storage path and content hashes are immutable.
const editor=document.createElement('dialog');editor.id='milkyPhotoEditor';editor.setAttribute('aria-label','编辑照片信息');
editor.innerHTML=`<form id="milkyPhotoEditForm" method="dialog"><h3>✎ 编辑照片信息</h3><label>照片标题<input id="milkyEditTitle" maxlength="80" required></label><label>拍摄日期<input id="milkyEditDate" type="date" required></label><label>上传者昵称<input id="milkyEditUploader" maxlength="30" required></label><label>照片描述<textarea id="milkyEditDescription" maxlength="500" rows="3" placeholder="记录这张照片背后的故事（可选）"></textarea></label><p id="milkyEditError" role="alert"></p><div class="milky-editor-actions"><button type="button" id="milkyEditCancel">取消</button><button type="submit" id="milkyEditSave">保存修改</button></div></form>`;
document.body.appendChild(editor);
let editingId=null;
function openPhotoEditor(id){
 if(!isOwner)return;
 const p=cloudPhotoDocs.find(x=>x.id===id);if(!p)return;
 editingId=id;$('milkyEditTitle').value=p.title||'';$('milkyEditDate').value=p.date||'';
 $('milkyEditUploader').value=p.uploaderName||'Milky 的手账';$('milkyEditDescription').value=p.description||'';
 $('milkyEditError').textContent='';editor.showModal();
}
$('milkyEditCancel').onclick=()=>editor.close();
$('milkyPhotoEditForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!isOwner||!editingId)return;
 const title=$('milkyEditTitle').value.trim(),date=$('milkyEditDate').value,uploaderName=$('milkyEditUploader').value.trim(),description=$('milkyEditDescription').value.trim();
 if(!title||title.length>80||!/^20\d\d-\d\d-\d\d$/.test(date)||!uploaderName||uploaderName.length>30||description.length>500){$('milkyEditError').textContent='请检查标题、日期、昵称及描述长度。';return}
 const btn=$('milkyEditSave');btn.disabled=true;$('milkyEditError').textContent='正在保存…';
 try{await db.collection('photos').doc(editingId).update({title,date,uploaderName,description,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});editor.close();status('照片信息已保存 ✓')}
 catch(err){$('milkyEditError').textContent='保存失败：'+err.message}finally{btn.disabled=false}
});
// Existing handlers call these functions; overriding them makes owner edits auto-save.
const originalStoreMilky=storeMilky, originalStoreTasks=storeTasks;
let saveTimer;
const saveContent=()=>{
 if(!isOwner)return;
 clearTimeout(saveTimer);
 status('正在自动保存…');
 saveTimer=setTimeout(async()=>{
  try{
   saving=true;
   await contentRef.set({events:milkyEvents,weights:milkyWeights,tasks:taskData,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
   status('已自动保存到云端 ✓');
  }catch(e){showError(e)}finally{saving=false}
 },400);
};
storeMilky=function(){originalStoreMilky();saveContent()};
storeTasks=function(){originalStoreTasks();saveContent()};
// Owner may export a JSON snapshot, but import requires explicit migration tooling.
$('milkyImportAll').disabled=true;
$('milkyImportAll').parentElement.style.display='none';
$('importPhotos').disabled=true;
$('importPhotos').parentElement.style.display='none';
$('exportPhotos').style.display='none';
const uploadButton=$('addPhoto');
const originalResize=resizeImage;
async function compressJpeg(file){
 const data=await originalResize(file);
 const r=await fetch(data);return r.blob();
}
const nameInput=$('photoUploaderName');
const NAME_KEY='milky_visitor_nickname_v1';
nameInput.value=localStorage.getItem(NAME_KEY)||'';
nameInput.addEventListener('change',()=>localStorage.setItem(NAME_KEY,nameInput.value.trim()));
const photoMsg=$('photoMsg');
const MAX_FILES=5, MAX_INPUT=10*1024*1024, MAX_OUTPUT=10*1024*1024;
// SHA-256 is calculated locally before upload. fileHash catches byte-identical files;
// imageHash catches images that produce the same normalized JPEG (e.g. differing metadata).
const normalizeTitle=value=>(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
async function hashBlob(blob){
 if(!globalThis.crypto?.subtle)throw Error('当前浏览器不支持安全哈希校验，请通过 HTTPS 打开网页。');
 return hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));
}
function duplicateInfo(candidate,known){
 const sameHash=known.find(p=>(p.fileHash&&p.fileHash===candidate.fileHash)||(p.imageHash&&p.imageHash===candidate.imageHash));
 if(sameHash)return {kind:'exact',photo:sameHash};
 const sameTitle=known.find(p=>normalizeTitle(p.title)===normalizeTitle(candidate.title)&&normalizeTitle(candidate.title));
 return sameTitle?{kind:'title',photo:sameTitle}:null;
}
const existingPhotos=()=>[
 ...cloudPhotoDocs.map(p=>({title:p.title||'',date:p.date||'',fileHash:p.fileHash||'',imageHash:p.imageHash||''})),
 // Embedded starter photos have no hashes but still participate in title warnings.
 ...initialPhotos.map(p=>({title:p.title||'',date:p.date||'',fileHash:'',imageHash:''}))
];
// Check on file selection as well as on upload. A warning never silently deletes a photo.
$('uploadPhoto').addEventListener('change',async()=>{
 const files=[...$('uploadPhoto').files];if(!files.length)return;
 const known=existingPhotos();let dup=0;
 for(const file of files){
  if(file.size>MAX_INPUT)continue;
  try{const fileHash=await hashBlob(file);if(known.some(p=>p.fileHash&&p.fileHash===fileHash))dup++}catch(e){break}
 }
 if(dup)photoMsg.textContent=`⚠️ 选中的照片中有 ${dup} 张与云端文件完全相同；上传时会自动跳过。`;
 else photoMsg.textContent='已选择 '+files.length+' 张照片。上传时会检查内容哈希和重复标题。';
});
uploadButton.onclick=async()=>{
 if(!auth.currentUser){
  photoMsg.textContent='正在建立访客上传会话…';
  try{await ensureAnonymous()}catch(e){photoMsg.textContent='访客登录失败：'+e.message;return}
  if(!auth.currentUser){photoMsg.textContent='访客上传会话尚未建立，请稍后重试。';return}
 }
 const files=[...$('uploadPhoto').files],date=$('photoDate').value,title=$('photoTitle').value.trim(),uploaderName=nameInput.value.trim();
 if(!files.length||!date){photoMsg.textContent='请先选择照片和拍摄日期。';return}
 if(files.length>MAX_FILES){photoMsg.textContent='每次最多上传 5 张照片。';return}
 if(!uploaderName||uploaderName.length>30){photoMsg.textContent='请填写 1–30 个字的昵称。';return}
 if(title.length>80){photoMsg.textContent='标题最多 80 个字。';return}
 uploadButton.disabled=true;
 let uploadedCount=0,skipped=0,failed=0;
 try{
  // Refresh remote metadata just before checking, reducing stale-list false negatives.
  const snap=await db.collection('photos').get();
  const known=[...snap.docs.map(d=>d.data()),...initialPhotos.map(p=>({title:p.title}))];
  for(let i=0;i<files.length;i++){
   const file=files[i];
   if(!file.type.startsWith('image/')||file.size>MAX_INPUT){failed++;photoMsg.textContent='第 '+(i+1)+' 张不是有效图片或超过 10MB。';continue}
   const photoTitle=title||(files.length>1?`Milky 的照片 ${i+1}`:'Milky 的新照片');
   photoMsg.textContent=`正在检查第 ${i+1}/${files.length} 张…`;
   try{
    const fileHash=await hashBlob(file);
    // Fast path for identical original bytes: no need to compress again.
    if(known.some(p=>p.fileHash&&p.fileHash===fileHash)){skipped++;continue}
    const blob=await compressJpeg(file);
    if(blob.size>=MAX_OUTPUT)throw Error('处理后照片仍超过 10MB');
    const imageHash=await hashBlob(blob);
    const candidate={title:photoTitle,date,fileHash,imageHash};
    const dup=duplicateInfo(candidate,known);
    if(dup?.kind==='exact'){skipped++;continue}
    if(dup?.kind==='title'){
     const ok=confirm(`⚠️ 已存在同名照片「${dup.photo.title}」。\n\n这可能是不同照片，也可能是重复内容。是否仍然上传本张？`);
     if(!ok){skipped++;continue}
    }
    photoMsg.textContent=`正在上传 ${i+1}/${files.length} 张…`;
    const id=db.collection('photos').doc().id;
    const path=`photos/${auth.currentUser.uid}/${id}.jpg`;
    await storage.ref(path).put(blob,{contentType:'image/jpeg',customMetadata:{source:'milky-diary'}});
    try{
     await db.collection('photos').doc(id).set({id,uid:auth.currentUser.uid,date,uploaderName,title:photoTitle,path,fileHash,imageHash,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    }catch(e){await storage.ref(path).delete().catch(()=>{});throw e}
    known.push(candidate);uploadedCount++;
   }catch(e){failed++;photoMsg.textContent=`第 ${i+1} 张上传失败：${e.message}`}
  }
  localStorage.setItem(NAME_KEY,uploaderName);
  $('uploadPhoto').value='';
  photoMsg.textContent=`完成：成功上传 ${uploadedCount} 张，跳过重复/取消 ${skipped} 张${failed?'，失败 '+failed+' 张':''}。上传的照片已公开。`;
 }catch(e){photoMsg.textContent='检查失败：'+e.message}finally{uploadButton.disabled=false}
};
// Do not automatically start anonymous auth at page load or on sign-out.
// It races with Google popup auth on iOS and can cancel the popup request.
// Anonymous authentication is created only when a visitor explicitly uploads.
$('cloudLogin').onclick=()=>{
 if(loginPending||authTransition)return;
 loginPending=true;authTransition=true;$('cloudLogin').disabled=true;
 status('正在打开 Google 登录…');
 // IMPORTANT: invoke signInWithPopup synchronously from the click gesture.
 // Never await signOut() first: Firebase replaces the anonymous session itself.
 const provider=new firebase.auth.GoogleAuthProvider();
 let attempt;
 try{attempt=auth.signInWithPopup(provider)}
 catch(e){showError(e);loginPending=false;authTransition=false;$('cloudLogin').disabled=false;return}
 // iOS installed web apps may stall rather than return a popup error.
 const help=setTimeout(()=>{if(loginPending)status('Google 登录尚未完成。若未出现 Google 账号页面，请关闭此窗口，在 Safari 中打开网站重试；不要连续点击登录。')},15000);
 attempt.then(()=>status('Google 登录成功，正在验证主人权限…')).catch(e=>{
  const code=e?.code||'';
  if(code==='auth/cancelled-popup-request')status('Google 登录请求被取消。请关闭其他登录窗口，刷新页面后只点击一次登录。');
  else if(code==='auth/popup-blocked'||code==='auth/popup-closed-by-user')status('Google 登录窗口未完成。请允许弹出窗口，并在 Safari 中尝试登录。');
  else showError(e);
 }).finally(()=>{clearTimeout(help);authTransition=false;loginPending=false;$('cloudLogin').disabled=false});
};
$('cloudLogout').onclick=async()=>{
 if(loginPending||authTransition)return;
 authTransition=true;
 try{await auth.signOut();status('已退出主人模式。')}catch(e){showError(e)}finally{authTransition=false}
};
async function ensureAnonymous(){
 if(authTransition||loginPending)throw Error('正在登录主人账号，请稍后重试');
 if(auth.currentUser)return auth.currentUser;
 if(anonymousPending)return anonymousPending;
 anonymousPending=auth.signInAnonymously();
 try{return (await anonymousPending).user}
 finally{anonymousPending=false}
}
$('cloudSeed').onclick=async()=>{
 if(!isOwner||cloudReady)return;
 if(!confirm('首次发布当前网页的健康记录、体重和护理清单到云端？此操作只需执行一次。'))return;
 try{await contentRef.set({events:milkyEvents,weights:milkyWeights,tasks:taskData,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});status('初始记录已发布 ✓')}catch(e){showError(e)}
};
contentRef.onSnapshot(snap=>{
 if(snap.exists){
  const d=snap.data();cloudReady=true;
  if(Array.isArray(d.events))milkyEvents=d.events;
  if(Array.isArray(d.weights))milkyWeights=d.weights;
  if(d.tasks&&['daily','weekly','once'].every(k=>Array.isArray(d.tasks[k])))taskData=d.tasks;
  renderMilkyEvents();renderMilkyWeights();renderAllTasks();
  $('cloudSeed').hidden=true;
  if(!saving)status(isOwner?'已连接云端 · 主人编辑模式':'已连接云端 · 访客浏览模式');
 }else{cloudReady=false;$('cloudSeed').hidden=!isOwner;status(isOwner?'请点击「首次发布现有记录」':'云端已连接 · 等待主人首次发布记录')}
},showError);
db.collection('photos').orderBy('createdAt','desc').onSnapshot(async snap=>{
 cloudPhotoDocs=snap.docs.map(d=>d.data()).filter(p=>p&&p.path&&p.id);
 await Promise.all(cloudPhotoDocs.map(async p=>{
  if(!photoRefs.has(p.id))try{photoRefs.set(p.id,await storage.ref(p.path).getDownloadURL())}catch(e){photoRefs.set(p.id,'')}
 }));
 renderPhotos();
},showError);
auth.onAuthStateChanged(async user=>{
 signedIn=!!user;
 if(!user){setOwner(false);signedIn=false;status('访客模式 · 可以浏览照片，上传时自动建立访客会话');return}
 setOwner(!user.isAnonymous&&ownerUids.includes(user.uid));
 if(isOwner){status('主人已登录 · UID: '+user.uid);$('cloudSeed').hidden=cloudReady}
 else if(!user.isAnonymous){status('此账号不是指定的主人账号。UID: '+user.uid+'（请在配置文件和安全规则中设置主人 UID）')}
 else status('访客模式 · 可以直接上传照片');
 renderMilkyEvents();renderMilkyWeights();renderAllTasks();renderPhotos();
});
})();
