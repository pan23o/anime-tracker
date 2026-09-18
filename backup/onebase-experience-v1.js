/* ONEBASE EXPERIENCE v1
 * Data portability + profile progression + small UX polish hooks.
 * Uses the existing global library/save/render/backup pipeline; it does not create
 * a second database or a second persistence layer.
 */
(function(){
  'use strict';

  const VERSION='1.0.0';
  let mounted=false;
  let dataInput=null;
  let restoreInput=null;

  const q=(s,r=document)=>r.querySelector(s);
  const qs=(s,r=document)=>[...r.querySelectorAll(s)];
  const notify=(message)=>{ try{ if(typeof toast==='function') toast(message); else window.alert(message); }catch(_){ window.alert(message); } };
  const library=()=>{ try{return (typeof data!=='undefined'&&Array.isArray(data))?data:[];}catch(_){return [];} };
  const normTitle=s=>String(s||'').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,' ');
  const number=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const cleanText=v=>String(v??'').trim();
  const text=(node,name)=>node?.getElementsByTagName(name)?.[0]?.textContent?.trim()||'';

  function download(name,content,type='application/json'){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function currentSnapshot(){
    try{
      if(typeof appSnapshot==='function') return appSnapshot();
    }catch(_){ }
    return {schema:1,data:JSON.parse(JSON.stringify(library())),exportedAt:new Date().toISOString()};
  }

  function exportOneBase(){
    const payload={
      app:'OneBase',
      type:'library',
      version:1,
      exportedAt:new Date().toISOString(),
      data:JSON.parse(JSON.stringify(library().filter(x=>cleanText(x?.anime))))
    };
    download(`onebase-library-${localDateKeySafe()}.json`,JSON.stringify(payload,null,2));
    notify('Biblioteca OneBase exportada');
  }

  function exportBackup(){
    const payload={
      app:'OneBase',
      type:'full-backup',
      version:1,
      exportedAt:new Date().toISOString(),
      snapshot:currentSnapshot()
    };
    download(`onebase-backup-${localDateKeySafe()}.json`,JSON.stringify(payload,null,2));
    notify('Copia de seguridad descargada');
  }

  function localDateKeySafe(){
    try{if(typeof localDateKey==='function')return localDateKey();}catch(_){ }
    const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function setStatus(message,kind='info'){
    const el=q('#obxDataStatus');if(!el)return;
    el.textContent=message;
    el.dataset.kind=kind;
  }

  function statusMap(value){
    const s=cleanText(value).toLowerCase();
    if(/completed|finished|terminad|complet/.test(s))return 'terminado';
    if(/watching|current|releasing|viendo|watch/.test(s))return 'viendo';
    if(/plan|planning|pendiente|to watch/.test(s))return 'pendiente';
    if(/hold|paused|pausa/.test(s))return 'pausa';
    if(/drop|abandon/.test(s))return 'abandonado';
    return '';
  }

  function normalizeImported(raw){
    let base={};
    try{base=typeof normalizeItem==='function'?normalizeItem({}):{};}catch(_){ }
    const item={...base};
    const title=cleanText(raw.title||raw.anime||raw.name);
    if(!title)return null;
    item.anime=title.toLocaleUpperCase('es-ES');
    if(raw.aniId!=null&&cleanText(raw.aniId))item.aniId=String(raw.aniId);
    if(raw.malId!=null&&cleanText(raw.malId))item.malId=String(raw.malId);
    if(raw.watched!=null)item.watched=String(Math.max(0,Math.floor(number(raw.watched))));
    if(raw.total!=null&&number(raw.total)>0)item.total=String(Math.floor(number(raw.total)));
    if(raw.score!=null&&number(raw.score)>0)item.score=Math.max(0,Math.min(10,number(raw.score)));
    if(raw.state)item.state=statusMap(raw.state)||raw.state;
    item.updatedAt=Date.now();
    item.addedAt=number(item.addedAt)||Date.now();
    if(item.total&&number(item.watched)>=number(item.total)){item.watched=String(item.total);item.state='terminado';}
    return item;
  }

  function collectAniListEntries(root){
    const out=[];
    const seen=new Set();
    const visit=(node)=>{
      if(!node||typeof node!=='object'||seen.has(node))return;
      seen.add(node);
      if(Array.isArray(node)){node.forEach(visit);return;}
      if(node.media && (node.progress!=null || node.status || node.score!=null)){
        const m=node.media||{};
        const title=m.title?.userPreferred||m.title?.romaji||m.title?.english||m.title?.native||'';
        if(title)out.push(normalizeImported({title,aniId:m.id,watched:node.progress,total:m.episodes,score:node.score,state:node.status}));
      }
      if(node.title && (node.progress!=null || node.status || node.score!=null)){
        const title=node.title?.userPreferred||node.title?.romaji||node.title?.english||node.title?.native||'';
        if(title)out.push(normalizeImported({title,aniId:node.mediaId||node.id,watched:node.progress,total:node.episodes||node.media?.episodes,score:node.score,state:node.status}));
      }
      Object.values(node).forEach(visit);
    };
    visit(root);
    const unique=new Map();
    out.filter(Boolean).forEach(item=>unique.set(item.aniId?`ani:${item.aniId}`:`title:${normTitle(item.anime)}`,item));
    return [...unique.values()];
  }

  function collectMALJson(root){
    const list=root?.myanimelist?.anime||root?.anime||root?.data||root;
    if(!Array.isArray(list))return [];
    return list.map(x=>normalizeImported({
      title:x.series_title||x.title,
      malId:x.series_animedb_id||x.id||x.mal_id,
      watched:x.my_watched_episodes??x.watched_episodes??x.progress,
      total:x.series_episodes??x.episodes,
      score:x.my_score??x.score,
      state:x.my_status??x.status
    })).filter(Boolean);
  }

  function parseMALXml(xml){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('El XML de MyAnimeList no es válido.');
    return [...doc.getElementsByTagName('anime')].map(node=>normalizeImported({
      title:text(node,'series_title'),
      malId:text(node,'series_animedb_id'),
      watched:text(node,'my_watched_episodes'),
      total:text(node,'series_episodes'),
      score:text(node,'my_score'),
      state:text(node,'my_status')
    })).filter(Boolean);
  }

  function mergeImported(items,label){
    if(!items.length)throw new Error('No se encontraron animes válidos en el archivo.');
    const list=library();
    const byAni=new Map(),byMal=new Map(),byTitle=new Map();
    list.forEach((item,index)=>{
      if(cleanText(item.aniId))byAni.set(String(item.aniId),index);
      if(cleanText(item.malId))byMal.set(String(item.malId),index);
      if(cleanText(item.anime))byTitle.set(normTitle(item.anime),index);
    });
    let added=0,updated=0;
    for(const incoming of items){
      const idx=cleanText(incoming.aniId)&&byAni.has(String(incoming.aniId))?byAni.get(String(incoming.aniId)):
        cleanText(incoming.malId)&&byMal.has(String(incoming.malId))?byMal.get(String(incoming.malId)):
        byTitle.get(normTitle(incoming.anime));
      if(idx==null){
        list.push(incoming);const i=list.length-1;
        if(cleanText(incoming.aniId))byAni.set(String(incoming.aniId),i);
        if(cleanText(incoming.malId))byMal.set(String(incoming.malId),i);
        byTitle.set(normTitle(incoming.anime),i);added++;
      }else{
        const current=list[idx];
        list[idx]={...current,
          anime:incoming.anime||current.anime,
          aniId:incoming.aniId||current.aniId,
          malId:incoming.malId||current.malId,
          watched:incoming.watched!==''?incoming.watched:current.watched,
          total:incoming.total||current.total,
          score:incoming.score!==''?incoming.score:current.score,
          state:incoming.state||current.state,
          updatedAt:Date.now()
        };
        updated++;
      }
    }
    try{createBackup?.(`Antes de importar ${label}`,true);}catch(_){ }
    try{save();render();}catch(error){throw new Error('Los datos se importaron pero OneBase no pudo refrescar la biblioteca.');}
    setStatus(`${label}: ${added} añadidos · ${updated} actualizados · ${items.length} entradas procesadas.`,'success');
    notify(`Importación completada: ${added} añadidos, ${updated} actualizados`);
  }

  async function handleDataFile(file){
    if(!file)return;
    const name=file.name.toLowerCase();
    setStatus(`Leyendo ${file.name}…`);
    try{
      const raw=await file.text();
      if(name.endsWith('.xml')){
        const items=parseMALXml(raw);
        mergeImported(items,'MyAnimeList');
        return;
      }
      const obj=JSON.parse(raw);
      const items=collectAniListEntries(obj);
      if(items.length){mergeImported(items,'AniList');return;}
      const mal=collectMALJson(obj);
      if(mal.length){mergeImported(mal,'MyAnimeList');return;}
      throw new Error('No reconozco este JSON como una exportación de AniList, MyAnimeList o OneBase.');
    }catch(error){
      console.error('[ONEBASE] import failed',error);
      setStatus(error?.message||'No se pudo importar el archivo.','error');
      notify(`⚠️ ${error?.message||'No se pudo importar el archivo.'}`);
    }
  }

  async function handleRestore(file){
    if(!file)return;
    try{
      const obj=JSON.parse(await file.text());
      const snap=obj?.snapshot||obj;
      const hasLibrary=Array.isArray(snap?.data)||Array.isArray(snap);
      if(!hasLibrary)throw new Error('La copia no contiene una biblioteca OneBase válida.');
      if(!window.confirm('¿Restaurar esta copia? Se creará una copia del estado actual antes de continuar.'))return;
      try{createBackup?.('Antes de restaurar copia',true);}catch(_){ }
      if(typeof restoreSnapshot==='function')restoreSnapshot(snap);
      else{
        throw new Error('El restaurador de OneBase no está disponible todavía.');
      }
      try{render();}catch(_){ }
      setStatus(`Copia restaurada: ${Array.isArray(snap.data)?snap.data.length:snap.length} entradas.`,'success');
      notify('Copia de seguridad restaurada');
    }catch(error){
      console.error('[ONEBASE] restore failed',error);
      setStatus(error?.message||'No se pudo restaurar la copia.','error');
      notify(`⚠️ ${error?.message||'No se pudo restaurar la copia.'}`);
    }
  }

  function unlockedCount(){
    try{
      if(typeof achievements==='function')return achievements().filter(x=>x?.[3]).length;
    }catch(_){ }
    return 0;
  }

  function progression(){
    const list=library().filter(x=>cleanText(x?.anime));
    const chapters=list.reduce((s,x)=>s+number(x.watched),0);
    const completed=list.filter(x=>number(x.total)>0&&number(x.watched)>=number(x.total)).length;
    const unlocked=unlockedCount();
    const favorites=list.filter(x=>x.favorite).length;
    const xp=chapters*2+completed*100+list.length*20+unlocked*50+favorites*10;
    const level=Math.max(1,Math.floor(Math.sqrt(xp/100))+1);
    const floorXp=Math.pow(level-1,2)*100;
    const nextXp=Math.pow(level,2)*100;
    const progress=nextXp>floorXp?Math.min(1,Math.max(0,(xp-floorXp)/(nextXp-floorXp))):0;
    const titles=[[1,'Novato'],[5,'Aprendiz'],[10,'Aficionado'],[20,'Otaku avanzado'],[30,'Otaku veterano'],[45,'Maestro del anime'],[60,'Leyenda de OneBase']];
    let title=titles[0][1];titles.forEach(([min,t])=>{if(level>=min)title=t;});
    return {level,title,xp,progress,chapters,completed,unlocked};
  }

  function renderLevel(target){
    if(!target)return;
    const p=progression();
    target.innerHTML=`<div class="obx-level-card"><div class="obx-level-ring"><strong>${p.level}</strong></div><div class="obx-level-copy"><strong>Nivel ${p.level} — ${p.title}</strong><span>${p.xp.toLocaleString('es-ES')} XP · ${p.unlocked} logros desbloqueados · ${p.chapters} capítulos vistos</span><div class="obx-level-bar"><span style="width:${Math.round(p.progress*100)}%"></span></div></div></div>`;
  }

  function buildDataSection(){
    const overlay=q('#onebaseSettingsOverlay');
    const body=q('.ob-settings-body',overlay);
    if(!overlay||!body||q('#obxDataSection',body))return;
    const section=document.createElement('section');
    section.id='obxDataSection';section.className='ob-settings-section';
    section.innerHTML=`
      <div class="ob-settings-section-head"><strong>📦 Datos</strong><p>Portabilidad total. Importa tu biblioteca desde otros trackers, exporta OneBase y guarda una copia que puedas restaurar cuando quieras.</p></div>
      <div class="obx-data-grid">
        <div class="obx-data-card"><strong>Importar AniList</strong><p>Acepta exportaciones JSON de AniList y conserva progreso, estado, nota e ID.</p><button type="button" id="obxImportAniList">Seleccionar JSON</button></div>
        <div class="obx-data-card"><strong>Importar MyAnimeList</strong><p>Acepta el XML oficial de MAL y recupera títulos, episodios vistos, estado y nota.</p><button type="button" id="obxImportMAL">Seleccionar XML</button></div>
        <div class="obx-data-card"><strong>Exportar OneBase</strong><p>Descarga solo tu biblioteca en un JSON limpio, pensado para migraciones.</p><button type="button" id="obxExportOneBase">Exportar biblioteca</button></div>
        <div class="obx-data-card"><strong>Descargar copia de seguridad</strong><p>Incluye la configuración y el estado completo disponible en OneBase.</p><button type="button" id="obxExportBackup">Descargar copia</button></div>
        <div class="obx-data-card wide"><strong>Restaurar copia</strong><p>Vuelve a un estado anterior de OneBase. Antes de restaurar se crea automáticamente una copia del estado actual.</p><button type="button" id="obxRestoreBackup">Seleccionar copia JSON</button></div>
      </div>
      <div class="obx-data-status" id="obxDataStatus">Tus datos no salen del navegador durante la importación: el archivo se procesa localmente.</div>`;
    body.appendChild(section);

    dataInput=document.createElement('input');dataInput.type='file';dataInput.accept='.json,application/json';dataInput.hidden=true;document.body.appendChild(dataInput);
    restoreInput=document.createElement('input');restoreInput.type='file';restoreInput.accept='.json,application/json';restoreInput.hidden=true;document.body.appendChild(restoreInput);
    q('#obxImportAniList').addEventListener('click',()=>{dataInput.dataset.kind='anilist';dataInput.click();});
    q('#obxImportMAL').addEventListener('click',()=>{dataInput.dataset.kind='mal';dataInput.accept='.xml,text/xml,application/xml';dataInput.click();});
    q('#obxExportOneBase').addEventListener('click',exportOneBase);
    q('#obxExportBackup').addEventListener('click',exportBackup);
    q('#obxRestoreBackup').addEventListener('click',()=>restoreInput.click());
    dataInput.addEventListener('change',()=>{const f=dataInput.files?.[0];if(f)void handleDataFile(f);dataInput.value='';});
    restoreInput.addEventListener('change',()=>{const f=restoreInput.files?.[0];if(f)void handleRestore(f);restoreInput.value='';});
  }

  function buildProfileLevel(){
    const settings=q('#settingsModal');
    if(!settings)return;
    const grid=q('.settingsGrid',settings);
    if(!grid||q('#obxProfileLevel',grid))return;
    const section=document.createElement('section');section.id='obxProfileLevel';section.className='settingsSection full';
    section.innerHTML='<h3>🏆 Progresión</h3><p>Tu nivel resume el tiempo que llevas usando OneBase y los logros que has conseguido.</p><div id="obxProfileLevelMount"></div>';
    grid.insertBefore(section,grid.firstElementChild||null);
    renderLevel(q('#obxProfileLevelMount'));
  }

  function refreshProfileLevel(){renderLevel(q('#obxProfileLevelMount'));}

  function mount(){
    if(mounted)return;
    mounted=true;
    buildProfileLevel();
    const button=q('#onebaseSettingsButton');
    if(button)button.addEventListener('click',()=>setTimeout(buildDataSection,30),{passive:true});
    document.addEventListener('click',e=>{
      if(e.target.closest?.('#profileTopBtn,#settingsBtn'))setTimeout(()=>{buildProfileLevel();refreshProfileLevel();},40);
    },true);
    window.addEventListener('animetracker:saved',()=>setTimeout(refreshProfileLevel,0));
    window.addEventListener('animetracker:restored',()=>setTimeout(refreshProfileLevel,0));
    window.addEventListener('onebase:txt-restored',()=>setTimeout(refreshProfileLevel,0));
    setInterval(()=>{buildDataSection();refreshProfileLevel();},800);
  }

  function boot(){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  }

  window.OneBaseExperience={version:VERSION,exportOneBase,exportBackup,importFile:handleDataFile,restoreFile:handleRestore,progression};
  boot();
})();
