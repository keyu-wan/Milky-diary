/* Milky cloud sync: GitHub Pages + Firebase. Do not place admin credentials in this file. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const status=msg=>{$('cloudStatus').textContent=msg};
const config=window.MILKY_FIREBASE_CONFIG;
const ownerUid=window.MILKY_OWNER_UID;
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
let isOwner=false, signedIn=false, cloudReady=false, saving=false, cloudPhotoDocs=[];
const photoRefs=new Map();
const setOwner=flag=>{
 isOwner=flag;document.body.classList.toggle('cloud-viewer',!flag);
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
 const remote=cloudPhotoDocs.map(p=>({id:p.id,date:p.date,title:p.title,uploaderName:p.uploaderName||'',src:photoRefs.get(p.id)||'',cloud:true}));
 uploaded=remote;
 originalRenderPhotos();
 // only owner may remove photos; visitor-created images are displayed but not editable
 if(isOwner){document.querySelectorAll('#photos .photo').forEach(card=>{const id=card.dataset.id;if(cloudPhotoDocs.some(p=>p.id===id)){const b=document.createElement('button');b.type='button';b.dataset.remove=id;b.setAttribute('aria-label','删除照片');b.textContent='✕';card.appendChild(b)}})}
 document.querySelectorAll('#photos [data-remove]').forEach(b=>{
  b.hidden=!isOwner;
  if(isOwner)b.onclick=async()=>{
   const id=b.dataset.remove,p=cloudPhotoDocs.find(x=>x.id===id);
   if(!p||!confirm('从云端删除这张照片？'))return;
   try{await db.collection('photos').doc(id).delete();await storage.ref(p.path).delete().catch(()=>{});status('照片已删除。')}catch(e){showError(e)}
  };
 });
};
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
uploadButton.onclick=async()=>{
 if(!signedIn){photoMsg.textContent='正在建立安全上传会话，请稍后再试。';return}
 const files=[...$('uploadPhoto').files],date=$('photoDate').value,title=$('photoTitle').value.trim(),uploaderName=nameInput.value.trim();
 if(!files.length||!date){photoMsg.textContent='请先选择照片和拍摄日期。';return}
 if(files.length>MAX_FILES){photoMsg.textContent='每次最多上传 5 张照片。';return}
 if(!uploaderName||uploaderName.length>30){photoMsg.textContent='请填写 1–30 个字的昵称。';return}if(title.length>80){photoMsg.textContent='标题最多 80 个字。';return}
 uploadButton.disabled=true;
 try{
  for(let i=0;i<files.length;i++){
   const file=files[i];
   if(!file.type.startsWith('image/')||file.size>MAX_INPUT)throw Error('请选择不超过 10MB 的图片文件。');
   photoMsg.textContent=`正在上传 ${i+1}/${files.length} 张…`;
   const blob=await compressJpeg(file);
   if(blob.size>=MAX_OUTPUT)throw Error('处理后照片仍超过 10MB，请换一张或缩小图片。');
   const id=db.collection('photos').doc().id;
   const path=`photos/${auth.currentUser.uid}/${id}.jpg`;
   await storage.ref(path).put(blob,{contentType:'image/jpeg',customMetadata:{source:'milky-diary'}});
   try{
    await db.collection('photos').doc(id).set({id,uid:auth.currentUser.uid,date,uploaderName,title:title||(files.length>1?`Milky 的照片 ${i+1}`:'Milky 的新照片'),path,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
   }catch(e){await storage.ref(path).delete().catch(()=>{});throw e}
  }
  localStorage.setItem(NAME_KEY,uploaderName);$('uploadPhoto').value='';photoMsg.textContent='上传成功！照片已经公开，所有访客都可以看到。';
 }catch(e){photoMsg.textContent='上传失败：'+e.message}finally{uploadButton.disabled=false}
};
$('cloudLogin').onclick=async()=>{
 try{
  // Anonymous visitor sessions must be upgraded by signing out before Google login.
  if(auth.currentUser?.isAnonymous)await auth.signOut();
  await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
 }catch(e){showError(e);if(!auth.currentUser)await auth.signInAnonymously().catch(showError)}
};
$('cloudLogout').onclick=async()=>{try{await auth.signOut();await auth.signInAnonymously()}catch(e){showError(e)}};
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
 if(!user){setOwner(false);try{await auth.signInAnonymously()}catch(e){showError(e)}return}
 setOwner(!user.isAnonymous&&ownerUid!=='REPLACE_WITH_OWNER_UID'&&user.uid===ownerUid);
 if(isOwner){status('主人已登录 · UID: '+user.uid);$('cloudSeed').hidden=cloudReady}
 else if(!user.isAnonymous){status('此账号不是指定的主人账号。UID: '+user.uid+'（请在配置文件和安全规则中设置主人 UID）')}
 else status('访客模式 · 可以直接上传照片');
 renderMilkyEvents();renderMilkyWeights();renderAllTasks();renderPhotos();
});
})();
