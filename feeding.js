/* Milky Feeding: measured calories, owner-only cloud edits. No AI-generated medical prescriptions. */
(()=>{'use strict';
const $=id=>document.getElementById(id), KEY='milky_feeding_v1';
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
 return {kg,ageMonths,lowKcal:rer*low,highKcal:rer*high,target:rer*(low+high)/2};
}
function describeQuantity(grams,food){
 if(!food||!Number.isFinite(grams))return '—';
 if(food.type==='wet'&&num(food.canGrams)>0)return `${fmt(grams/num(food.canGrams))} 罐（${fmt(grams)} g）`;
 return `${fmt(grams)} g${food.type==='wet'?' 罐头':''}`;
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
 $('feedEstimateText').textContent=estimate?`当前体重 ${estimate.kg} kg · 约 ${estimate.ageMonths.toFixed(1)} 月龄。`:'请先在左侧「体重成长」添加最新体重，系统将自动计算生长期参考范围。';
 document.querySelectorAll('[data-food-delete]').forEach(b=>b.onclick=async()=>{if(!owner())return;data.foods=data.foods.filter(f=>f.id!==b.dataset.foodDelete);render();await persist()});
 document.querySelectorAll('[data-meal-delete]').forEach(b=>b.onclick=async()=>{if(!owner())return;data.meals=data.meals.filter(m=>m.id!==b.dataset.mealDelete);render();await persist()});
}
$('feedFoodSelect').addEventListener('change',render);
$('feedAddFood').onclick=async()=>{
 if(!owner())return message('请先以主人账号登录。');
 const name=$('feedFoodName').value.trim(),v=Number($('feedFoodKcal').value),type=$('feedFoodType').value,canGrams=Number($('feedCanGrams').value);
 if(!name||name.length>70||!Number.isFinite(v)||v<=0||v>10000)return message('请输入食物名称和包装上的 kcal/kg（必须大于 0）。');
 if(type==='wet'&&(!Number.isFinite(canGrams)||canGrams<=0||canGrams>2000))return message('罐头请填写每罐净含量（克）。');data.foods.push({id:crypto.randomUUID?.()||'f'+Date.now(),name,type,kcalPerKg:v,canGrams:type==='wet'?canGrams:null});$('feedFoodName').value='';$('feedFoodKcal').value='';$('feedCanGrams').value='';render();await persist();
};
$('feedAddMeal').onclick=async()=>{
 if(!owner())return message('请先以主人账号登录。');
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
