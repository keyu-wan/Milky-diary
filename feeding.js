/* Milky Feeding: measured calories, owner-only cloud edits. No AI-generated medical prescriptions. */
(()=>{'use strict';
const $=id=>document.getElementById(id), KEY='milky_feeding_v1', SETTINGS_KEY='milky_feeding_review_settings_v1';
const defaultSettings=()=>({factor:2.2,neuterDate:'2026-11-05',lastReviewed:null});
let settings=defaultSettings();
try{const stored=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');if(stored&&typeof stored==='object')settings={...settings,...stored}}catch{}
const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const parseDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s))?new Date(s+'T12:00:00'):null;
const daysSince=s=>{const d=parseDay(s);return d?Math.floor((new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),12)-d)/86400000):null};
const saveSettings=()=>{try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));return true}catch{return false}};
const blank=()=>({foods:[],meals:[],target:null});
let data=blank(), cloudSeen=false, pending=false;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&Array.isArray(saved.foods)&&Array.isArray(saved.meals))data=saved;}catch{}
const owner=()=>!!window.milkyFeedCloud?.isOwner?.();
const day=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const num=v=>Number.isFinite(+v)?+v:0;
const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kcal=(food,grams)=>num(food?.kcalPerKg)*num(grams)/1000;
const fmt=v=>Math.round(v*10)/10;
const message=t=>{$('feedStatus').textContent=t};
const persist=async()=>{
 try{localStorage.setItem(KEY,JSON.stringify(data))}catch{message('本机存储不足，无法保存本地备份。')}
 if(!owner())return;
 if(!window.milkyFeedCloud){message('云端未连接，暂存在本机。');return}
 try{pending=true;await window.milkyFeedCloud.save(data);message('已同步到 Firebase ✓')}catch(e){message('云端保存失败：'+e.message)}finally{pending=false}
};
function automaticEstimate(){
 const list=(typeof milkyWeights!=='undefined'&&Array.isArray(milkyWeights))?milkyWeights.slice().filter(x=>Number(x.kg)>0).sort((a,b)=>String(b.date).localeCompare(String(a.date))):[];
 const kg=Number(list[0]?.kg);
 if(!kg)return null;
 const ageMonths=Math.max(0,(Date.now()-new Date('2026-06-16T12:00:00').getTime())/(86400000*30.4375));
 const rer=70*Math.pow(kg,0.75);
 // Broad, non-prescriptive growth-stage reference factors, not a veterinary feeding prescription.
 const low=ageMonths<4?2.5:ageMonths<12?2:1.2;
 const high=ageMonths<4?3:ageMonths<12?2.5:1.6;
 return {kg,ageMonths,lowKcal:rer*low,highKcal:rer*high,target:rer*(ageMonths<12?Number(settings.factor):1.4)};
}
function describeQuantity(grams,food){
 if(!food||!Number.isFinite(grams))return '—';
 if(food.type==='wet'&&num(food.canGrams)>0)return `${fmt(grams/num(food.canGrams))} 罐（${fmt(grams)} g）`;
 return `${fmt(grams)} g${food.type==='wet'?' 罐头':''}`;
}
function renderReview(estimate){
 const box=$('feedReview'),done=$('feedReviewDone'),status=$('feedReviewStatus');if(!box)return;
 const neuterAge=daysSince(settings.neuterDate),reviewAge=daysSince(settings.lastReviewed);
 const weights=(typeof milkyWeights!=='undefined'&&Array.isArray(milkyWeights))?milkyWeights.filter(w=>Number(w.kg)>0&&parseDay(w.date)).sort((a,b)=>b.date.localeCompare(a.date)):[];
 const latest=weights[0],weightAge=latest?daysSince(latest.date):null;
 const nextPostOp=neuterAge===null?null:neuterAge<7?7:neuterAge<14?14:neuterAge<28?28:null;
 const postOpDue=nextPostOp!==null&&neuterAge>=nextPostOp;
 const reviewDue=reviewAge===null||reviewAge>=28;
 const reminders=[];
 if(neuterAge!==null&&neuterAge>=0&&neuterAge<7)reminders.push(`术后第 ${neuterAge+1} 天：优先遵守医院术后喂食说明，恢复期不要强制补足计算器目标。`);
 if(neuterAge!==null&&neuterAge>=7&&neuterAge<14)reminders.push('术后约一周：检查食欲、精神和伤口恢复，按医院要求复查。');
 if(neuterAge!==null&&neuterAge>=14&&neuterAge<28)reminders.push('术后两周：结合最新体重、肋骨触感和腰身评估喂养量。');
 if(neuterAge!==null&&neuterAge>=28)reminders.push('绝育已满四周：复查体况及生长趋势，必要时调整系数。');
 if(weightAge===null)reminders.push('尚无有效体重记录，请先记录体重。');
 else if(weightAge>=7)reminders.push(`最近一次体重记录距今 ${weightAge} 天：建议重新称重。`);
 if(weights.length>=2){const previous=weights.find(w=>w!==latest&&w.date!==latest.date);if(previous){const diff=(Number(latest.kg)-Number(previous.kg))*1000;reminders.push(`最近两次不同日期称重：${diff>=0?'+':''}${Math.round(diff)} g。幼猫正常长大也会增重，不能仅凭增重判断肥胖。`)}}
 if(reviewDue)reminders.push('喂养评估待完成：检查体况评分（理想通常为 4–5/9）、体重趋势和实际进食量。');
 if(!reminders.length)reminders.push('目前没有到期提醒。继续每周称重，约每四周重新评估喂养量。');
 box.textContent=reminders.join('\n');box.style.whiteSpace='pre-line';
 done.disabled=!owner();done.title=owner()?'记录本次评估完成日期':'仅主人可操作';
 status.textContent=settings.lastReviewed?'上次完成评估：'+settings.lastReviewed:'尚未标记完成评估';
 $('feedFactor').value=String(settings.factor);$('feedNeuterDate').value=settings.neuterDate||'';
}
function render(){
 const today=day(), meals=data.meals.filter(m=>m.date===today), eaten=meals.reduce((a,m)=>a+num(m.kcal),0),estimate=automaticEstimate(),target=estimate?.target||0;
 $('feedDateLabel').textContent=today;
 const sel=$('feedFoodSelect'),selected=sel.value;
 sel.innerHTML='<option value="">选择已添加的食物</option>'+data.foods.map(f=>`<option value="${clean(f.id)}">${clean(f.name)}</option>`).join('');
 if(data.foods.some(f=>f.id===selected))sel.value=selected;
 const food=data.foods.find(f=>f.id===sel.value),remaining=Math.max(0,target-eaten);
 const consumedGrams=meals.reduce((sum,m)=>sum+num(m.grams),0);
 $('feedEaten').textContent=meals.length?`${fmt(consumedGrams)} g 已记录`:'暂无记录';
 $('feedTarget').textContent=estimate?(food?describeQuantity(target*1000/num(food.kcalPerKg),food):'选择食物换算'):'缺少体重';
 $('feedRemaining').textContent=estimate?(remaining<=0?'已达参考值':food?describeQuantity(remaining*1000/num(food.kcalPerKg),food):'选择食物换算'):'—';
 $('feedAdvice').textContent=!estimate?'请先添加最新体重。':remaining<=0?'今日已达到参考热量。':food?`如果剩余热量全部由「${food.name}」补充，约需 ${describeQuantity(remaining*1000/num(food.kcalPerKg),food)}。`:'请选择一种粮食或罐头，查看今日还需补充多少克或多少罐。';
 $('feedAdviceKcal').textContent=estimate?`已摄入 ${fmt(eaten)} kcal · 参考目标 ${Math.round(target)} kcal · 剩余 ${fmt(remaining)} kcal`:`已摄入 ${fmt(eaten)} kcal`;
 $('feedFoods').innerHTML=data.foods.length?data.foods.map(f=>`<div class="feed-item"><span>${clean(f.name)} <span class="feed-mini">${fmt(f.kcalPerKg)} kcal/kg · ${clean(f.type==='wet'?'罐头/湿粮':f.type==='dry'?'干粮':'其他')}${f.type==='wet'&&num(f.canGrams)>0?' · '+fmt(f.canGrams)+' g/罐':''}</span></span><button type="button" class="feed-btn" data-food-delete="${clean(f.id)}">删除</button></div>`).join(''):'<p class="feed-muted">还没有添加食物，请从包装填写真实热量。</p>';
 $('feedMeals').innerHTML=meals.length?meals.slice().reverse().map(m=>`<div class="feed-item"><span>${clean(m.name)} · ${describeQuantity(num(m.grams),data.foods.find(f=>f.id===m.foodId)||{type:m.foodType,canGrams:m.canGrams})} <span class="feed-mini">(${fmt(m.kcal)} kcal)</span> <span class="feed-mini">${clean(m.time||'')}</span></span><button type="button" class="feed-btn" data-meal-delete="${clean(m.id)}">删除</button></div>`).join(''):'<p class="feed-muted">今天还没有进食记录。</p>';
 renderReview(estimate);
 $('feedEstimateText').textContent=estimate?`当前体重 ${estimate.kg} kg · 约 ${estimate.ageMonths.toFixed(1)} 月龄 · 当前系数 ${estimate.ageMonths<12?settings.factor:'成年阶段 1.4'} × RER。`:'请先在左侧「体重成长」添加最新体重，系统将自动计算生长期参考范围。';
 document.querySelectorAll('[data-food-delete]').forEach(b=>b.onclick=async()=>{if(!owner())return;data.foods=data.foods.filter(f=>f.id!==b.dataset.foodDelete);render();await persist()});
 document.querySelectorAll('[data-meal-delete]').forEach(b=>b.onclick=async()=>{if(!owner())return;data.meals=data.meals.filter(m=>m.id!==b.dataset.mealDelete);render();await persist()});
}
$('feedSaveSettings').onclick=()=>{
 if(!owner())return message('请先登录主人账号，再修改喂养设置。');
 const factor=Number($('feedFactor').value),date=$('feedNeuterDate').value;
 if(!Number.isFinite(factor)||factor<1||factor>4)return message('请输入 1.0–4.0 之间的系数。');
 if(date&&!parseDay(date))return message('请输入有效的绝育日期。');
 settings.factor=factor;settings.neuterDate=date;
 if(!saveSettings())return message('当前设备无法保存喂养设置。');
 render();message('喂养设置已保存到当前设备（不会修改云端食物记录）。');
};
$('feedReviewDone').onclick=()=>{
 if(!owner())return message('请先登录主人账号。');
 settings.lastReviewed=day();if(!saveSettings())return message('当前设备无法保存评估日期。');
 render();message('已记录本次评估完成。');
};
$('feedFoodSelect').addEventListener('change',render);
$('feedAddFood').onclick=async()=>{
 if(!owner()){const info=window.milkyFeedCloud?.authInfo?.();return message(info?.uid?'当前登录账号未获得主人权限（UID: '+info.uid+'）。请检查主人 UID 与网页版本。':'登录状态尚未同步，请等待页面顶部显示「主人已登录」后重试；若一直未出现，请刷新页面。');}
 const name=$('feedFoodName').value.trim(),v=Number($('feedFoodKcal').value),type=$('feedFoodType').value,canGrams=Number($('feedCanGrams').value);
 if(!name||name.length>70||!Number.isFinite(v)||v<=0||v>10000)return message('请输入食物名称和包装上的 kcal/kg（必须大于 0）。');
 if(type==='wet'&&(!Number.isFinite(canGrams)||canGrams<=0||canGrams>2000))return message('罐头请填写每罐净含量（克）。');data.foods.push({id:crypto.randomUUID?.()||'f'+Date.now(),name,type,kcalPerKg:v,canGrams:type==='wet'?canGrams:null});$('feedFoodName').value='';$('feedFoodKcal').value='';$('feedCanGrams').value='';render();await persist();
};
$('feedAddMeal').onclick=async()=>{
 if(!owner()){const info=window.milkyFeedCloud?.authInfo?.();return message(info?.uid?'当前登录账号未获得主人权限（UID: '+info.uid+'）。请检查主人 UID 与网页版本。':'登录状态尚未同步，请等待页面顶部显示「主人已登录」后重试；若一直未出现，请刷新页面。');}
 const food=data.foods.find(f=>f.id===$('feedFoodSelect').value),grams=Number($('feedGrams').value);
 if(!food||!Number.isFinite(grams)||grams<=0||grams>1000)return message('请选择食物并输入实际吃下的克数。');
 const d=new Date();data.meals.push({id:crypto.randomUUID?.()||'m'+Date.now(),date:day(),time:d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),foodId:food.id,name:food.name,grams,kcal:kcal(food,grams),foodType:food.type,canGrams:food.canGrams||null});
 $('feedGrams').value='';render();await persist();
};
window.addEventListener('milky-feeding-cloud',e=>{const remote=e.detail;if(remote&&Array.isArray(remote.foods)&&Array.isArray(remote.meals)&&!pending){data=remote;cloudSeen=true;try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}render()}});
window.addEventListener('milky-feeding-auth',()=>{render()});
let weightSignature='';setInterval(()=>{const x=(typeof milkyWeights!=='undefined'&&Array.isArray(milkyWeights))?JSON.stringify(milkyWeights):'';if(x!==weightSignature){weightSignature=x;render()}},2500);
render();
})();
