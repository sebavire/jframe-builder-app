// Obtener API de VS Code
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

// Escuchar si VS Code envía código Java abierto
window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'loadJavaCode') {
        parseJavaFile(message.code, message.filename);
        if (typeof renderCanvas === 'function') renderCanvas();
    }
});

// Pedir a VS Code el código del archivo activo
function importFromActiveEditor() {
    if (vscode) {
        vscode.postMessage({ command: 'getActiveJavaCode' });
    }
}

// Sobrescribir o guardar el código Java en el editor activo
function exportJavaFile(filename, codeContent) {
    if (vscode) {
        vscode.postMessage({
            command: 'saveJava',
            filename: filename,
            code: codeContent
        });
    } else {
        // Modo fallback por si lo abres en un navegador normal
        const blob = new Blob([codeContent], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    }
}

let components=[], selectedId=null, idCounter=0, draggingType=null;
let dragging=null, dragOffX=0, dragOffY=0;
let resizing=null, resizeStartX=0, resizeStartY=0, resizeStartW=0, resizeStartH=0;

// Variables para almacenar bloques editados por el usuario
let userImports = "";
let userDecls = "";
let userActions = {}; // Almacena tanto acciones de botones como de JMenuItems
let userMethods = "";

const defaults={
  label:{w:80,h:20,text:'Label',varName:'label'},
  textfield:{w:120,h:22,text:'',varName:'txtField'},
  password:{w:120,h:22,text:'',varName:'txtPass'},
  textarea:{w:150,h:80,text:'',varName:'txtArea'},
  button:{w:90,h:25,text:'Aceptar',varName:'btn'},
  checkbox:{w:100,h:20,text:'Opcion',varName:'chk'},
  radio:{w:100,h:20,text:'Opcion',varName:'rdb'},
  combobox:{w:120,h:22,text:'',varName:'cmb'},
  list:{w:120,h:80,text:'',varName:'lst'},
  panel:{w:180,h:120,text:'',varName:'panel'},
  table:{w:280,h:120,text:'',varName:'table',columns:'Nombre,Edad,Ciudad',rows:'Juan,30,Madrid\nAna,25,Lima'},
  scrollpane:{w:180,h:100,text:'',varName:'scroll'},
  spinner:{w:100,h:22,text:'',varName:'spinner',spinMin:0,spinMax:100,spinStep:1,spinVal:0},
  slider:{w:160,h:40,text:'',varName:'slider',sliderMin:0,sliderMax:100,sliderVal:50,sliderTicks:true},
  progressbar:{w:180,h:22,text:'',varName:'progress',progressVal:60,progressMin:0,progressMax:100,progressString:true},
  tabbedpane:{w:220,h:150,text:'',varName:'tabbedPane',tabs:'Tab 1,Tab 2,Tab 3'},
  separator:{w:200,h:10,text:'',varName:'separator',separatorH:true},
  menubar:{w:500,h:24,text:'',varName:'menuBar',menuStructure:'Archivo: Item 1, Item 2 | Salir'}
};

function dragStart(e,type){draggingType=type;e.dataTransfer.setData('text/plain',type);}

function dropOnCanvas(e){
  e.preventDefault();
  if(!draggingType)return;
  const body=document.getElementById('frameBody');
  const rect=body.getBoundingClientRect();
  const d=defaults[draggingType];
  const id=++idCounter;
  
  const isMenuBar = draggingType === 'menubar';
  const posX = isMenuBar ? 0 : Math.max(0,Math.round(e.clientX-rect.left));
  const posY = isMenuBar ? 0 : Math.max(0,Math.round(e.clientY-rect.top));
  const posW = isMenuBar ? (parseInt(document.getElementById('frameW').value)||500) : d.w;

  const comp={id,type:draggingType,
    x:posX, y:posY, w:posW, h:d.h, text:d.text, varName:d.varName+id,
    fontSize:11,enabled:true,visible:true,tooltip:'',
    items:'Item 1,Item 2,Item 3',
    columns:d.columns||'Col1,Col2,Col3',
    rows:d.rows||'A,B,C',
    spinMin:d.spinMin||0,spinMax:d.spinMax||100,spinStep:d.spinStep||1,spinVal:d.spinVal||0,
    sliderMin:d.sliderMin||0,sliderMax:d.sliderMax||100,sliderVal:d.sliderVal||50,sliderTicks:d.sliderTicks!==undefined?d.sliderTicks:true,
    progressVal:d.progressVal||0,progressMin:d.progressMin||0,progressMax:d.progressMax||100,progressString:d.progressString!==undefined?d.progressString:true,
    tabs:d.tabs||'Tab 1,Tab 2',
    separatorH:d.separatorH!==undefined?d.separatorH:true,
    menuStructure:d.menuStructure||'Gestionar: Contactos, Tareas | Salir'
  };
  components.push(comp);
  renderComp(comp);
  selectComp(id);
  draggingType=null;
  updateStatus();
}

const NEEDS_OVERLAY=['combobox','list','textfield','password','textarea','button','checkbox','radio','spinner','slider','progressbar','tabbedpane','menubar'];

function getCompHTML(comp){
  const fs = comp.fontSize || 11;
  
  // 1. Preparamos las reglas CSS de color si están definidas
  const bgStyle = comp.bgColor ? `background-color:${comp.bgColor};` : '';
  const fgStyle = comp.fgColor ? `color:${comp.fgColor};` : '';
  
  // Estilo combinado listo para inyectar
  const customStyles = `font-size:${fs}px;${bgStyle}${fgStyle}`;

  let inner = '';
  switch(comp.type){
    case 'label':
      inner = `<div class="w98-label" style="${customStyles}">${comp.text||'Label'}</div>`;
      break;
    case 'textfield':
      inner = `<input class="w98-input" style="${customStyles}" value="${comp.text||''}" readonly tabindex="-1">`;
      break;
    case 'password':
      inner = `<input class="w98-input" type="password" style="${customStyles}" value="password" readonly tabindex="-1">`;
      break;
    case 'textarea':
      inner = `<textarea class="w98-textarea" style="${customStyles}" readonly tabindex="-1">${comp.text||''}</textarea>`;
      break;
    case 'button':
      inner = `<button class="w98-btn" style="${customStyles}" tabindex="-1">${comp.text||'Button'}</button>`;
      break;
    case 'checkbox':
      inner = `<div class="w98-check" style="${customStyles}"><input type="checkbox" disabled tabindex="-1"> ${comp.text||'CheckBox'}</div>`;
      break;
    case 'radio':
      inner = `<div class="w98-radio" style="${customStyles}"><input type="radio" disabled tabindex="-1"> ${comp.text||'RadioButton'}</div>`;
      break;
    case 'combobox':
      inner = `<select class="w98-combo" style="${customStyles}" tabindex="-1">${(comp.items||'').split(',').map(i=>`<option>${i.trim()}</option>`).join('')}</select>`;
      break;
    case 'list':
      inner = `<select class="w98-list" multiple style="${customStyles}" tabindex="-1">${(comp.items||'').split(',').map(i=>`<option>${i.trim()}</option>`).join('')}</select>`;
      break;
    case 'panel':
      // Si el usuario eligió un bgColor usa ese, si no, usa el color por defecto #d4d0c8
      const panelBg = comp.bgColor ? comp.bgColor : '#d4d0c8';
      inner = `<div style="width:100%;height:100%;border:2px inset #808080;background:${panelBg};${fgStyle}display:flex;align-items:flex-start;padding:2px"><span style="font-size:9px;color:#888;font-family:Tahoma">JPanel</span></div>`;
      break;
    case 'table':{
      const cols = (comp.columns||'Col1,Col2,Col3').split(',').map(c=>c.trim());
      const rows = (comp.rows||'').split('\n').filter(r=>r.trim());
      const thead = cols.map(c=>`<th>${c}</th>`).join('');
      const tbody = rows.map(r=>{const cells=r.split(',').map(c=>`<td>${c.trim()}</td>`).join('');return`<tr>${cells}</tr>`;}).join('');
      inner = `<div class="w98-table-wrap" style="${customStyles}"><table class="w98-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
      break;
    }
    case 'scrollpane':
      inner = `<div class="w98-scrollpane" style="${bgStyle}${fgStyle}"><span style="font-size:9px;color:#888;font-family:Tahoma">JScrollPane</span></div>`;
      break;
    case 'spinner':
      inner = `<div class="w98-spinner"><input value="${comp.spinVal||0}" readonly tabindex="-1" style="${customStyles}"><div class="w98-spinner-btns"><span>▲</span><span>▼</span></div></div>`;
      break;
    case 'slider':{
      inner = `<div class="w98-slider" style="${bgStyle}"><input type="range" min="${comp.sliderMin||0}" max="${comp.sliderMax||100}" value="${comp.sliderVal||50}" style="width:100%" tabindex="-1"></div>`;
      break;
    }
    case 'progressbar':{
      const pct = ((comp.progressVal-comp.progressMin)/(comp.progressMax-comp.progressMin)*100)||0;
      inner = `<div class="w98-progress" style="${bgStyle}"><div class="w98-progress-bar" style="width:${pct}%"></div>${comp.progressString?`<span style="position:absolute;width:100%;text-align:center;top:50%;transform:translateY(-50%);font-size:10px;font-family:Tahoma;color:#fff;mix-blend-mode:difference">${Math.round(pct)}%</span>`:''}</div>`;
      break;
    }
    case 'tabbedpane':{
      const tabList = (comp.tabs||'Tab 1,Tab 2').split(',').map((t,i)=>`<div class="w98-tabpane-tab${i===0?' active':''}" style="${customStyles}">${t.trim()}</div>`).join('');
      inner = `<div class="w98-tabpane"><div class="w98-tabpane-tabs">${tabList}</div><div class="w98-tabpane-body" style="${bgStyle}"></div></div>`;
      break;
    }
    case 'separator':
      inner = comp.separatorH ? `<div class="w98-separator-h" style="width:100%"></div>` : `<div class="w98-separator-v" style="height:100%"></div>`;
      break;
    case 'menubar':{
      const menus = (comp.menuStructure||'').split('|').map(m=>m.split(':')[0].trim());
      inner = `<div class="w98-menubar" style="${customStyles}">${menus.map(m=>`<span class="w98-menu-item">${m}</span>`).join('')}</div>`;
      break;
    }
    default:
      inner = '';
  }
  const overlay = NEEDS_OVERLAY.includes(comp.type) ? '<div class="drag-overlay"></div>' : '';
  return inner + overlay;
}

function renderComp(comp){
  const body=document.getElementById('frameBody');
  let old=document.getElementById('comp-'+comp.id);
  if(old)old.remove();
  const el=document.createElement('div');
  el.className='placed';
  el.id='comp-'+comp.id;
  el.style.cssText=`left:${comp.x}px;top:${comp.y}px;width:${comp.w}px;height:${comp.h}px`;
  el.innerHTML=getCompHTML(comp)+'<div class="resize-h"></div><div class="del-h">x</div>';

  el.addEventListener('mousedown',e=>{
    if(e.target.classList.contains('resize-h')){
      resizing=comp.id;resizeStartX=e.clientX;resizeStartY=e.clientY;
      resizeStartW=comp.w;resizeStartH=comp.h;e.preventDefault();return;
    }
    if(e.target.classList.contains('del-h'))return;
    selectComp(comp.id);dragging=comp.id;
    dragOffX=e.clientX-comp.x;dragOffY=e.clientY-comp.y;e.preventDefault();
  });
  el.querySelector('.del-h').addEventListener('click',()=>deleteComp(comp.id));
  body.appendChild(el);
}

function selectComp(id){
  selectedId=id;
  document.querySelectorAll('.placed').forEach(el=>el.classList.remove('selected'));
  const el=document.getElementById('comp-'+id);
  if(el)el.classList.add('selected');
  showProps(components.find(c=>c.id===id));
  updateStatus();
}

function showProps(comp){
  if(!comp)return;
  document.getElementById('noSel').style.display='none';
  const pc=document.getElementById('propsContent');
  pc.style.display='block';
  let extra='';
  if(comp.type==='menubar'){
    extra=`<div class="prop-row"><label class="prop-label">Estructura de Menú (Ej: Gestionar: Contactos, Tareas | Salir)</label>
      <input class="prop-input" value="${comp.menuStructure||''}" oninput="setProp(${comp.id},'menuStructure',this.value)"></div>`;
  }
  if(['combobox','list'].includes(comp.type)){
    extra=`<div class="prop-row"><label class="prop-label">Items (coma separados)</label>
      <input class="prop-input" value="${comp.items||''}" oninput="setProp(${comp.id},'items',this.value)"></div>`;
  }
  if(comp.type==='table'){
    extra=`<div class="prop-row"><label class="prop-label">Columnas (coma separados)</label>
      <input class="prop-input" value="${comp.columns||''}" oninput="setProp(${comp.id},'columns',this.value)"></div>
      <div class="prop-row"><label class="prop-label">Filas (coma por celda, enter por fila)</label>
      <textarea class="prop-input" rows="4" style="resize:vertical" oninput="setProp(${comp.id},'rows',this.value)">${comp.rows||''}</textarea></div>`;
  }
  if(comp.type==='spinner'){
    extra=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="prop-row"><label class="prop-label">Min</label><input class="prop-input" type="number" value="${comp.spinMin||0}" oninput="setProp(${comp.id},'spinMin',+this.value)"></div>
      <div class="prop-row"><label class="prop-label">Max</label><input class="prop-input" type="number" value="${comp.spinMax||100}" oninput="setProp(${comp.id},'spinMax',+this.value)"></div>
      <div class="prop-row"><label class="prop-label">Paso</label><input class="prop-input" type="number" value="${comp.spinStep||1}" oninput="setProp(${comp.id},'spinStep',+this.value)"></div>
      <div class="prop-row"><label class="prop-label">Valor inicial</label><input class="prop-input" type="number" value="${comp.spinVal||0}" oninput="setProp(${comp.id},'spinVal',+this.value)"></div>
    </div>`;
  }
  if(comp.type==='slider'){
    extra=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="prop-row"><label class="prop-label">Min</label><input class="prop-input" type="number" value="${comp.sliderMin||0}" oninput="setProp(${comp.id},'sliderMin',+this.value)"></div>
      <div class="prop-row"><label class="prop-label">Max</label><input class="prop-input" type="number" value="${comp.sliderMax||100}" oninput="setProp(${comp.id},'sliderMax',+this.value)"></div>
      <div class="prop-row"><label class="prop-label">Valor</label><input class="prop-input" type="number" value="${comp.sliderVal||50}" oninput="setProp(${comp.id},'sliderVal',+this.value)"></div>
    </div>
    <div class="prop-row" style="margin-top:4px"><label style="font-size:11px;color:var(--text2)"><input type="checkbox" ${comp.sliderTicks?'checked':''} onchange="setProp(${comp.id},'sliderTicks',this.checked)"> Mostrar marcas</label></div>`;
  }
  if(comp.type==='progressbar'){
    extra=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="prop-row"><label class="prop-label">Min</label><input class="prop-input" type="number" value="${comp.progressMin||0}" oninput="setProp(${comp.id},'progressMin',+this.value)"></div>
      <div class="prop-row"><label class="prop-label">Max</label><input class="prop-input" type="number" value="${comp.progressMax||100}" oninput="setProp(${comp.id},'progressMax',+this.value)"></div>
      <div class="prop-row"><label class="prop-label">Valor</label><input class="prop-input" type="number" value="${comp.progressVal||0}" oninput="setProp(${comp.id},'progressVal',+this.value)"></div>
    </div>
    <div class="prop-row" style="margin-top:4px"><label style="font-size:11px;color:var(--text2)"><input type="checkbox" ${comp.progressString?'checked':''} onchange="setProp(${comp.id},'progressString',this.checked)"> Mostrar porcentaje</label></div>`;
  }
  if(comp.type==='tabbedpane'){
    extra=`<div class="prop-row"><label class="prop-label">Tabs (coma separados)</label>
      <input class="prop-input" value="${comp.tabs||'Tab 1,Tab 2'}" oninput="setProp(${comp.id},'tabs',this.value)"></div>`;
  }
  if(comp.type==='separator'){
    extra=`<div class="prop-row"><label style="font-size:11px;color:var(--text2)"><input type="checkbox" ${comp.separatorH?'checked':''} onchange="setProp(${comp.id},'separatorH',this.checked)"> Horizontal (desmarcar = vertical)</label></div>`;
  }
  let textRow='';
  if(!['combobox','list','panel','table','scrollpane','spinner','slider','progressbar','tabbedpane','separator','menubar'].includes(comp.type)){
    textRow=`<div class="prop-row"><label class="prop-label">Texto</label>
      <input class="prop-input" value="${comp.text||''}" oninput="setProp(${comp.id},'text',this.value)"></div>`;
  }
  pc.innerHTML=`
    <div class="prop-group">
      <div class="prop-group-title">Identificacion</div>
      <div class="prop-row"><label class="prop-label">Variable Java</label>
        <input class="prop-input" value="${comp.varName}" oninput="setProp(${comp.id},'varName',this.value)"></div>
      ${textRow}
      <div class="prop-row"><label class="prop-label">Tooltip</label>
        <input class="prop-input" value="${comp.tooltip||''}" oninput="setProp(${comp.id},'tooltip',this.value)"></div>
      ${extra}
    </div>
    <div class="prop-group">
      <div class="prop-group-title">Posicion y Tamano</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="prop-row"><label class="prop-label">X</label>
          <input class="prop-input" type="number" value="${comp.x}" oninput="setProp(${comp.id},'x',+this.value,true)"></div>
        <div class="prop-row"><label class="prop-label">Y</label>
          <input class="prop-input" type="number" value="${comp.y}" oninput="setProp(${comp.id},'y',+this.value,true)"></div>
        <div class="prop-row"><label class="prop-label">Ancho</label>
          <input class="prop-input" type="number" value="${comp.w}" oninput="setProp(${comp.id},'w',+this.value,true)"></div>
        <div class="prop-row"><label class="prop-label">Alto</label>
          <input class="prop-input" type="number" value="${comp.h}" oninput="setProp(${comp.id},'h',+this.value,true)"></div>
      </div>
    </div>
    <div class="prop-group">
      <div class="prop-group-title">Apariencia</div>
      <div class="prop-row">
        <label class="prop-label">Font Size</label>
        <input class="prop-input" type="number" value="${comp.fontSize||11}" oninput="setProp(${comp.id},'fontSize',+this.value)">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
        <div class="prop-row">
          <label class="prop-label">Color Fondo</label>
          <input class="prop-input" type="color" value="${comp.bgColor||'#ffffff'}" oninput="setProp(${comp.id},'bgColor',this.value)">
        </div>
        <div class="prop-row">
          <label class="prop-label">Color Texto</label>
          <input class="prop-input" type="color" value="${comp.fgColor||'#000000'}" oninput="setProp(${comp.id},'fgColor',this.value)">
        </div>
      </div>
    </div>
    <div class="prop-group">
      <div class="prop-group-title">Estado</div>
      <div style="display:flex;gap:12px;font-size:11px;color:var(--text2);align-items:center">
        <label><input type="checkbox" ${comp.enabled?'checked':''} onchange="setProp(${comp.id},'enabled',this.checked)"> Enabled</label>
        <label><input type="checkbox" ${comp.visible?'checked':''} onchange="setProp(${comp.id},'visible',this.checked)"> Visible</label>
      </div>
    </div>
    <div style="margin-top:8px">
      <button class="btn" style="width:100%;color:var(--red);border-color:var(--red)" onclick="deleteComp(${comp.id})">Eliminar componente</button>
    </div>`;
}

function setProp(id,key,val,repos){
  const comp=components.find(c=>c.id===id);
  if(!comp)return;
  comp[key]=val;
  const el=document.getElementById('comp-'+id);
  if(!el)return;
  if(repos){el.style.left=comp.x+'px';el.style.top=comp.y+'px';el.style.width=comp.w+'px';el.style.height=comp.h+'px';}
  const rh=el.querySelector('.resize-h').outerHTML;
  const dh=el.querySelector('.del-h').outerHTML;
  el.innerHTML=getCompHTML(comp)+rh+dh;
  el.querySelector('.del-h').addEventListener('click',()=>deleteComp(comp.id));
}

function deleteComp(id){
  components=components.filter(c=>c.id!==id);
  const el=document.getElementById('comp-'+id);
  if(el)el.remove();
  if(selectedId===id){
    selectedId=null;
    document.getElementById('noSel').style.display='';
    document.getElementById('propsContent').style.display='none';
  }
  updateStatus();
}

document.addEventListener('mousemove',e=>{
  if(dragging!==null){
    const comp=components.find(c=>c.id===dragging);
    const fw=parseInt(document.getElementById('frameW').value)||500;
    const fh=parseInt(document.getElementById('frameH').value)||380;
    comp.x=Math.max(0,Math.min(Math.round(e.clientX-dragOffX),fw-comp.w));
    comp.y=Math.max(0,Math.min(Math.round(e.clientY-dragOffY),fh-comp.h));
    const el=document.getElementById('comp-'+dragging);
    el.style.left=comp.x+'px';el.style.top=comp.y+'px';
  }
  if(resizing!==null){
    const comp=components.find(c=>c.id===resizing);
    comp.w=Math.max(20,resizeStartW+e.clientX-resizeStartX);
    comp.h=Math.max(14,resizeStartH+e.clientY-resizeStartY);
    const el=document.getElementById('comp-'+resizing);
    el.style.width=comp.w+'px';el.style.height=comp.h+'px';
  }
});

document.addEventListener('mouseup',()=>{
  if(dragging!==null&&selectedId)showProps(components.find(c=>c.id===selectedId));
  dragging=null;resizing=null;
});

document.getElementById('frameBody').addEventListener('click',e=>{
  if(e.target===document.getElementById('frameBody')){
    selectedId=null;
    document.querySelectorAll('.placed').forEach(el=>el.classList.remove('selected'));
    document.getElementById('noSel').style.display='';
    document.getElementById('propsContent').style.display='none';
    updateStatus();
  }
});

function updateFrameTitle(){document.getElementById('frameTitleBar').textContent=document.getElementById('frameTitle').value;}

function resizeFrame(){
  const w=parseInt(document.getElementById('frameW').value)||500;
  const h=parseInt(document.getElementById('frameH').value)||380;
  document.getElementById('frameBody').style.width=w+'px';
  document.getElementById('frameBody').style.height=h+'px';
  
  components.filter(c=>c.type==='menubar').forEach(comp=>{
    comp.w = w;
    const el = document.getElementById('comp-'+comp.id);
    if(el) el.style.width = w+'px';
  });
}
resizeFrame();

// Aplica el tema visual (Look & Feel) al preview del canvas. Aditivo: 'default' deja el modo clasico intacto.
function applyLookFeel(){
  const sel=document.getElementById('lookFeel');
  const val=sel?sel.value:'default';
  const sim=document.getElementById('frameSim');
  if(!sim)return;
  sim.classList.remove('laf-flatlight','laf-flatdark');
  if(val==='flatlight')sim.classList.add('laf-flatlight');
  else if(val==='flatdark')sim.classList.add('laf-flatdark');
  const codePanel=document.getElementById('panel-code');
  if(codePanel&&codePanel.classList.contains('active'))generateCode();
}

function switchTab(tab){
  document.querySelectorAll('.rtab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('.rpanel').forEach(p=>{p.classList.remove('active');p.style.display='none';});
  document.querySelectorAll('.code-panel').forEach(p=>{p.classList.remove('active');p.style.display='none';});
  if(tab==='code'){
    const cp=document.getElementById('panel-code');
    cp.classList.add('active');cp.style.display='flex';
    generateCode();
  } else {
    const pp=document.getElementById('panel-props');
    pp.classList.add('active');pp.style.display='block';
  }
}

// Analiza el cuadro de código para extraer fragmentos editados
function scanCodeBoxForUserChanges() {
  const currentCode = document.getElementById('codeBox').value;
  if(!currentCode || currentCode.startsWith("// Haz clic")) return;

  const impMatch = currentCode.match(/\/\/ \[USER_IMPORTS_START\]([\s\S]*?)\/\/ \[USER_IMPORTS_END\]/);
  if(impMatch) userImports = impMatch[1].trim();

  const declMatch = currentCode.match(/\/\/ \[USER_DECLS_START\]([\s\S]*?)\/\/ \[USER_DECLS_END\]/);
  if(declMatch) userDecls = declMatch[1].trim();

  const actionRegex = /\/\/ \[USER_ACTION_START:(\w+)\]([\s\S]*?)\/\/ \[USER_ACTION_END:\1\]/g;
  let match;
  while ((match = actionRegex.exec(currentCode)) !== null) {
    userActions[match[1]] = match[2].trim();
  }

  const methodsMatch = currentCode.match(/\/\/ \[USER_METHODS_START\]([\s\S]*?)\/\/ \[USER_METHODS_END\]/);
  if(methodsMatch) userMethods = methodsMatch[1].trim();
}

function hexToJavaColor(hex) {
  if (!hex || hex === 'none') return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `new Color(${r}, ${g}, ${b})`;
}

function generateCode(){
  scanCodeBoxForUserChanges();

  const title = document.getElementById('frameTitle').value || 'MiFormulario';
  const w = document.getElementById('frameW').value || 500;
  const h = parseInt(document.getElementById('frameH').value || 380) + 30;
  const layout = document.getElementById('layoutType').value;
  const className = title.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '') || 'MiFormulario';

  const javaType = {
    label:'JLabel', textfield:'JTextField', password:'JPasswordField', textarea:'JTextArea',
    button:'JButton', checkbox:'JCheckBox', radio:'JRadioButton', combobox:'JComboBox',
    list:'JList', panel:'JPanel', table:'JTable', scrollpane:'JScrollPane',
    spinner:'JSpinner', slider:'JSlider', progressbar:'JProgressBar',
    tabbedpane:'JTabbedPane', separator:'JSeparator', menubar:'JMenuBar'
  };
  const imports = new Set(['javax.swing.*', 'java.awt.*', 'java.awt.event.*']);

  let decls = '', inits = '', adds = '', events = '';

  components.forEach(comp => {
    const jt = javaType[comp.type];
    decls += `    private ${jt} ${comp.varName};\n`;
    switch(comp.type){
      case 'label':
        inits += `        ${comp.varName} = new JLabel("${comp.text||''}");\n`;
        inits += `        ${comp.varName}.setFont(new Font("Tahoma", Font.PLAIN, ${comp.fontSize||11}));\n`;
        break;
      case 'textfield':
        inits += `        ${comp.varName} = new JTextField();\n`;
        if(comp.text) inits += `        ${comp.varName}.setText("${comp.text}");\n`;
        inits += `        ${comp.varName}.setFont(new Font("Tahoma", Font.PLAIN, ${comp.fontSize||11}));\n`;
        break;
      case 'password':
        inits += `        ${comp.varName} = new JPasswordField();\n`;
        inits += `        ${comp.varName}.setFont(new Font("Tahoma", Font.PLAIN, ${comp.fontSize||11}));\n`;
        break;
      case 'textarea':
        inits += `        ${comp.varName} = new JTextArea();\n`;
        inits += `        ${comp.varName}.setFont(new Font("Tahoma", Font.PLAIN, ${comp.fontSize||11}));\n`;
        inits += `        ${comp.varName}.setLineWrap(true);\n        ${comp.varName}.setWrapStyleWord(true);\n`;
        break;
      case 'button':
        inits += `        ${comp.varName} = new JButton("${comp.text||'Button'}");\n`;
        inits += `        ${comp.varName}.setFont(new Font("Tahoma", Font.PLAIN, ${comp.fontSize||11}));\n`;
        
        // Agrupación del evento en initEvents()
        if (userActions[comp.varName]) {
          events += `        // [USER_ACTION_START:${comp.varName}]\n${userActions[comp.varName]}\n        // [USER_ACTION_END:${comp.varName}]\n\n`;
        } else {
          events += `        // [USER_ACTION_START:${comp.varName}]\n`;
          events += `        ${comp.varName}.addActionListener(e -> {\n`;
          events += `            // TODO: accion de ${comp.varName}\n`;
          events += `        });\n`;
          events += `        // [USER_ACTION_END:${comp.varName}]\n\n`;
        }
        break;
      case 'checkbox':
        inits += `        ${comp.varName} = new JCheckBox("${comp.text||'CheckBox'}");\n`;
        inits += `        ${comp.varName}.setOpaque(false);\n`;
        break;
      case 'radio':
        inits += `        ${comp.varName} = new JRadioButton("${comp.text||'RadioButton'}");\n`;
        inits += `        ${comp.varName}.setOpaque(false);\n`;
        break;
      case 'combobox':{
        const ci = (comp.items||'Item 1,Item 2').split(',').map(i=>`"${i.trim()}"`).join(', ');
        inits += `        ${comp.varName} = new JComboBox<>(new String[]{${ci}});\n`;
        break;
      }
      case 'list':{
        const li = (comp.items||'Item 1,Item 2').split(',').map(i=>`"${i.trim()}"`).join(', ');
        inits += `        ${comp.varName} = new JList<>(new String[]{${li}});\n`;
        break;
      }
      case 'panel':
        inits += `        ${comp.varName} = new JPanel();\n`;
        inits += `        ${comp.varName}.setLayout(null);\n`;
        break;
      case 'table':{
        const cols = (comp.columns||'Col1,Col2,Col3').split(',').map(c=>`"${c.trim()}"`).join(', ');
        const modelName = 'modelo' + comp.varName.charAt(0).toUpperCase() + comp.varName.slice(1);
        decls += `    private DefaultTableModel ${modelName};\n`;
        inits += `        ${modelName} = new DefaultTableModel(\n`;
        inits += `            new String[]{${cols}}, 0\n`;
        inits += `        ) {\n`;
        inits += `            @Override public boolean isCellEditable(int row, int col) { return false; }\n`;
        inits += `        };\n`;
        inits += `        ${comp.varName} = new JTable(${modelName});\n`;
        inits += `        ${comp.varName}.setAutoResizeMode(JTable.AUTO_RESIZE_ALL_COLUMNS);\n`;
        inits += `        ${comp.varName}.getTableHeader().setReorderingAllowed(false);\n`;
        imports.add('javax.swing.table.*');
        break;
      }
      case 'scrollpane':
        inits += `        ${comp.varName} = new JScrollPane();\n`;
        break;
      case 'spinner':
        inits += `        SpinnerNumberModel ${comp.varName}Model = new SpinnerNumberModel(${comp.spinVal||0}, ${comp.spinMin||0}, ${comp.spinMax||100}, ${comp.spinStep||1});\n`;
        inits += `        ${comp.varName} = new JSpinner(${comp.varName}Model);\n`;
        imports.add('javax.swing.SpinnerNumberModel');
        break;
      case 'slider':
        inits += `        ${comp.varName} = new JSlider(JSlider.HORIZONTAL, ${comp.sliderMin||0}, ${comp.sliderMax||100}, ${comp.sliderVal||50});\n`;
        if(comp.sliderTicks){
          const range = (comp.sliderMax||100) - (comp.sliderMin||0);
          const major = Math.round(range/5) || 10;
          const minor = Math.round(major/5) || 2;
          inits += `        ${comp.varName}.setMajorTickSpacing(${major});\n`;
          inits += `        ${comp.varName}.setMinorTickSpacing(${minor});\n`;
          inits += `        ${comp.varName}.setPaintTicks(true);\n`;
          inits += `        ${comp.varName}.setPaintLabels(true);\n`;
        }
        break;
      case 'progressbar':
        inits += `        ${comp.varName} = new JProgressBar(${comp.progressMin||0}, ${comp.progressMax||100});\n`;
        inits += `        ${comp.varName}.setValue(${comp.progressVal||0});\n`;
        if(comp.progressString) inits += `        ${comp.varName}.setStringPainted(true);\n`;
        break;
      case 'tabbedpane':{
        inits += `        ${comp.varName} = new JTabbedPane();\n`;
        (comp.tabs||'Tab 1,Tab 2').split(',').forEach(t => {
          inits += `        ${comp.varName}.addTab("${t.trim()}", new JPanel());\n`;
        });
        break;
      }
      case 'separator':
        inits += `        ${comp.varName} = new JSeparator(${comp.separatorH!==false?'SwingConstants.HORIZONTAL':'SwingConstants.VERTICAL'});\n`;
        imports.add('javax.swing.SwingConstants');
        break;
      case 'menubar':{
        inits += `        ${comp.varName} = new JMenuBar();\n`;
        const groups = (comp.menuStructure || '').split('|');
        
        groups.forEach((group, gIdx) => {
          const parts = group.split(':');
          const menuName = parts[0] ? parts[0].trim() : `Menu${gIdx+1}`;
          const menuVar = `menu_${gIdx+1}`;
          inits += `        JMenu ${menuVar} = new JMenu("${menuName}");\n`;
          
          if (parts[1]) {
            const items = parts[1].split(',');
            items.forEach((item, iIdx) => {
              const itemName = item.trim();
              if (itemName) {
                const itemVar = `item_${gIdx+1}_${iIdx+1}`;
                inits += `        JMenuItem ${itemVar} = new JMenuItem("${itemName}");\n`;
                
                if (userActions[itemVar]) {
                  events += `        // [USER_ACTION_START:${itemVar}]\n${userActions[itemVar]}\n        // [USER_ACTION_END:${itemVar}]\n\n`;
                } else {
                  events += `        // [USER_ACTION_START:${itemVar}]\n`;
                  events += `        ${itemVar}.addActionListener(e -> {\n`;
                  events += `            // TODO: accion para ${itemName}\n`;
                  events += `        });\n`;
                  events += `        // [USER_ACTION_END:${itemVar}]\n\n`;
                }
                
                inits += `        ${menuVar}.add(${itemVar});\n`;
              }
            });
          } else {
            const itemVar = `item_${gIdx+1}_1`;
            inits += `        JMenuItem ${itemVar} = new JMenuItem("${menuName}");\n`;
            if (userActions[itemVar]) {
              events += `        // [USER_ACTION_START:${itemVar}]\n${userActions[itemVar]}\n        // [USER_ACTION_END:${itemVar}]\n\n`;
            } else {
              events += `        // [USER_ACTION_START:${itemVar}]\n`;
              events += `        ${itemVar}.addActionListener(e -> {\n`;
              events += `            // TODO: accion para ${menuName}\n`;
              events += `        });\n`;
              events += `        // [USER_ACTION_END:${itemVar}]\n\n`;
            }
            inits += `        ${menuVar}.add(${itemVar});\n`;
          }
          inits += `        ${comp.varName}.add(${menuVar});\n`;
        });
        adds += `        setJMenuBar(${comp.varName});\n`;
        break;
      }
    }

    // === INICIO DE NUEVA LÓGICA DE COLORES ===
    imports.add('java.awt.Color');

    if (comp.bgColor && comp.bgColor.toLowerCase() !== '#ffffff') {
      if (['label', 'panel'].includes(comp.type)) {
        inits += `        ${comp.varName}.setOpaque(true);\n`;
      }
      inits += `        ${comp.varName}.setBackground(${hexToJavaColor(comp.bgColor)});\n`;
    }

    if (comp.fgColor && comp.fgColor !== '#000000') {
      inits += `        ${comp.varName}.setForeground(${hexToJavaColor(comp.fgColor)});\n`;
    }
    // === FIN DE NUEVA LÓGICA DE COLORES ===

    if(!comp.enabled) inits += `        ${comp.varName}.setEnabled(false);\n`;
    if(!comp.visible) inits += `        ${comp.varName}.setVisible(false);\n`;
    if(comp.tooltip) inits += `        ${comp.varName}.setToolTipText("${comp.tooltip}");\n`;
    
    if (comp.type !== 'menubar') {
      if(layout==='null'){
        if(['textarea','table','list'].includes(comp.type)){
          inits += `        JScrollPane scroll_${comp.varName} = new JScrollPane(${comp.varName});\n`;
          inits += `        scroll_${comp.varName}.setBounds(${comp.x}, ${comp.y}, ${comp.w}, ${comp.h});\n`;
          adds += `        getContentPane().add(scroll_${comp.varName});\n`;
        } else {
          inits += `        ${comp.varName}.setBounds(${comp.x}, ${comp.y}, ${comp.w}, ${comp.h});\n`;
          adds += `        getContentPane().add(${comp.varName});\n`;
        }
      } else {
        adds += `        getContentPane().add(${comp.varName});\n`;
      }
    }
  });

  const layoutCode = {
    'null':'getContentPane().setLayout(null);',
    'flow':'getContentPane().setLayout(new FlowLayout());',
    'border':'getContentPane().setLayout(new BorderLayout());',
    'grid':'getContentPane().setLayout(new GridLayout(0, 2, 5, 5));',
    'gridbag':'getContentPane().setLayout(new GridBagLayout());'
  }[layout];

  const imp = [...imports].map(i=>`import ${i};`).join('\n');

  // === LOOK & FEEL (FlatLaf) - aditivo: solo se inyecta si se elige un tema Flat ===
  const lookFeel = document.getElementById('lookFeel') ? document.getElementById('lookFeel').value : 'default';
  let lafImportLine = '';
  let lafSetup = '';
  if (lookFeel === 'flatlight') {
    lafImportLine = '\nimport com.formdev.flatlaf.FlatLightLaf;';
    lafSetup = '        // Look & Feel FlatLaf (requiere la libreria flatlaf en el classpath)\n        FlatLightLaf.setup();\n';
  } else if (lookFeel === 'flatdark') {
    lafImportLine = '\nimport com.formdev.flatlaf.FlatDarkLaf;';
    lafSetup = '        // Look & Feel FlatLaf (requiere la libreria flatlaf en el classpath)\n        FlatDarkLaf.setup();\n';
  }

  const formattedUserImports = userImports.trim() ? userImports : 
`    //  ESCRIBE TUS IMPORTS AQUI (Ej: import java.io.*;)
    // ----------------------------------------------------`;

  const formattedUserDecls = userDecls.trim() ? userDecls : 
`    //  DECLARA TUS VARIABLES AQUI (Ej: private int contador;)
    // ----------------------------------------------------`;

  const formattedUserMethods = userMethods.trim() ? userMethods : 
`    //  AGREGA TUS METODOS PERSONALIZADOS AQUI
    // ----------------------------------------------------
    public void actualizarTabla() {
        // TODO: recargar datos en la(s) tabla(s)
    }

    public void limpiarFormulario() {
        // TODO: limpiar campos del formulario
    }`;

  const code = `${imp}${lafImportLine}

// [USER_IMPORTS_START]
${formattedUserImports}
// [USER_IMPORTS_END]

public class ${className} extends JFrame {

    private Gestion gestion;

${decls}
// [USER_DECLS_START]
${formattedUserDecls}
// [USER_DECLS_END]

    public ${className}(Gestion gestion) {
${lafSetup}        this.gestion = gestion;
        setTitle("${title}");
        setSize(${w}, ${h});
        setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
        setLocationRelativeTo(null);
        ${layoutCode}
        initComponents();
        initEvents();
    }

    private void initComponents() {
${inits}${adds}    }

    private void initEvents() {
${events}    }

// [USER_METHODS_START]
${formattedUserMethods}
// [USER_METHODS_END]
}`;

  document.getElementById('codeBox').value = code;
}

function copyCode(){
  navigator.clipboard.writeText(document.getElementById('codeBox').value).then(()=>{
    const btn=document.querySelector('.code-actions .btn-primary');
    const orig=btn.textContent;btn.textContent='Copiado!';
    setTimeout(()=>btn.textContent=orig,1500);
  });
}

function downloadCode(){
  generateCode();
  const title=document.getElementById('frameTitle').value||'MiFormulario';
  const className=title.replace(/\s+/g,'').replace(/[^a-zA-Z0-9_]/g,'')||'MiFormulario';
  const blob=new Blob([document.getElementById('codeBox').value],{type:'text/plain'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=className+'.java';a.click();
}

function clearAll(){
  if(!components.length||confirm('Limpiar todos los componentes?')){
    components=[];document.getElementById('frameBody').innerHTML='';
    selectedId=null;document.getElementById('noSel').style.display='';
    document.getElementById('propsContent').style.display='none';
    userImports = "";
    userDecls = "";
    userActions = {};
    userMethods = "";
    document.getElementById('codeBox').value = '// Haz clic en "Generar Codigo Java"';
    updateStatus();
  }
}

function updateStatus(){
  document.getElementById('statusComp').textContent=components.length+' componentes';
  const sel=selectedId?components.find(c=>c.id===selectedId):null;
  document.getElementById('statusSel').textContent=sel?`${sel.varName} (${sel.type})`:'Ninguno seleccionado';
}

function loadJavaFile(event){
  const file=event.target.files[0];
  if(!file)return;
  event.target.value='';
  const reader=new FileReader();
  reader.onload=e=>parseJavaFile(e.target.result,file.name);
  reader.readAsText(file);
}

function parseJavaFile(src, filename){
  userImports = "";
  userDecls = "";
  userActions = {};
  userMethods = "";

  const impMatch = src.match(/\/\/ \[USER_IMPORTS_START\]([\s\S]*?)\/\/ \[USER_IMPORTS_END\]/);
  if(impMatch) userImports = impMatch[1].trim();

  const declMatch = src.match(/\/\/ \[USER_DECLS_START\]([\s\S]*?)\/\/ \[USER_DECLS_END\]/);
  if(declMatch) userDecls = declMatch[1].trim();

  const actionRegex = /\/\/ \[USER_ACTION_START:(\w+)\]([\s\S]*?)\/\/ \[USER_ACTION_END:\1\]/g;
  let match;
  while ((match = actionRegex.exec(src)) !== null) {
    userActions[match[1]] = match[2].trim();
  }

  const methodsMatch = src.match(/\/\/ \[USER_METHODS_START\]([\s\S]*?)\/\/ \[USER_METHODS_END\]/);
  if(methodsMatch) userMethods = methodsMatch[1].trim();

  const titleM=src.match(/setTitle\("([^"]*)"\)/);
  const sizeM=src.match(/setSize\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  const title=titleM?titleM[1]:'MiFormulario';
  const fw=sizeM?parseInt(sizeM[1]):500;
  const fh=sizeM?parseInt(sizeM[2])-30:380;

  let layout='null';
  if(src.includes('FlowLayout'))layout='flow';
  else if(src.includes('GridLayout'))layout='grid';
  else if(src.includes('GridBagLayout'))layout='gridbag';
  else if(src.includes('BorderLayout'))layout='border';

  // Detecta el Look & Feel FlatLaf para restaurar el selector de estilo
  let lookFeel='default';
  if(src.includes('FlatLightLaf.setup'))lookFeel='flatlight';
  else if(src.includes('FlatDarkLaf.setup'))lookFeel='flatdark';

  const javaToType={
    JLabel:'label', JTextField:'textfield', JPasswordField:'password',
    JTextArea:'textarea', JButton:'button', JCheckBox:'checkbox',
    JRadioButton:'radio', JComboBox:'combobox', JList:'list',
    JPanel:'panel', JTable:'table', JScrollPane:'scrollpane',
    JSpinner:'spinner', JSlider:'slider', JProgressBar:'progressbar',
    JTabbedPane:'tabbedpane', JSeparator:'separator', JMenuBar:'menubar'
  };

  const declRe=/private\s+(J\w+)\s+(\w+)\s*;/g;
  const varTypeMap={};
  let m;
  while((m=declRe.exec(src))!==null){
    const jt=m[1], vn=m[2];
    if(javaToType[jt])varTypeMap[vn]=javaToType[jt];
  }

  const boundsRe=/(\w+)\.setBounds\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  const boundsMap={};
  while((m=boundsRe.exec(src))!==null){
    boundsMap[m[1]]={x:parseInt(m[2]),y:parseInt(m[3]),w:parseInt(m[4]),h:parseInt(m[5])};
  }

  const parsed=[];
  let newCounter=0;

  Object.keys(varTypeMap).forEach(varName=>{
    const type=varTypeMap[varName];
    newCounter++;

    const bk=boundsMap['scroll_'+varName]||boundsMap[varName]||{x:10+newCounter*5,y:10+newCounter*20,w:120,h:22};

    // === EXTRAER COLORES DESDE EL CÓDIGO JAVA ===
    // 1. Color de Fondo (setBackground)
    const bgMatch = src.match(new RegExp(`${varName}\\.setBackground\\(new\\s+Color\\((\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\)\\);`));
    let bgColor = '#ffffff';
    if (bgMatch) {
      const r = parseInt(bgMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(bgMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(bgMatch[3]).toString(16).padStart(2, '0');
      bgColor = `#${r}${g}${b}`;
    }

    // 2. Color de Texto (setForeground)
    const fgMatch = src.match(new RegExp(`${varName}\\.setForeground\\(new\\s+Color\\((\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\)\\);`));
    let fgColor = '#000000';
    if (fgMatch) {
      const r = parseInt(fgMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(fgMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(fgMatch[3]).toString(16).padStart(2, '0');
      fgColor = `#${r}${g}${b}`;
    }

    const comp={
      id:newCounter, type, varName,
      x:type==='menubar'?0:bk.x, y:type==='menubar'?0:bk.y, w:type==='menubar'?fw:bk.w, h:type==='menubar'?24:bk.h,
      fontSize:11, enabled:true, visible:true, tooltip:'',
      bgColor, fgColor, // <--- PROPIEDADES RECUPERADAS Y ASIGNADAS
      text:'', items:'Item 1,Item 2,Item 3',
      columns:'Col1,Col2,Col3', rows:'',
      spinMin:0,spinMax:100,spinStep:1,spinVal:0,
      sliderMin:0,sliderMax:100,sliderVal:50,sliderTicks:true,
      progressVal:0,progressMin:0,progressMax:100,progressString:true,
      tabs:'Tab 1,Tab 2',
      separatorH:true,
      menuStructure:'Gestionar: Contactos, Tareas | Salir'
    };
    const textRe=new RegExp(`${varName}\\s*=\\s*new\\s+\\w+\\("([^"]*)"\\)`);
    const textM=src.match(textRe);
    if(textM)comp.text=textM[1];

    const fontRe=new RegExp(`${varName}\\.setFont\\(new Font\\("\\w+",\\s*Font\\.\\w+,\\s*(\\d+)\\)\\)`);
    const fontM=src.match(fontRe);
    if(fontM)comp.fontSize=parseInt(fontM[1]);

    const enabledRe=new RegExp(`${varName}\\.setEnabled\\(false\\)`);
    if(enabledRe.test(src))comp.enabled=false;
    const visibleRe=new RegExp(`${varName}\\.setVisible\\(false\\)`);
    if(visibleRe.test(src))comp.visible=false;

    const tipRe=new RegExp(`${varName}\\.setToolTipText\\("([^"]*)"\\)`);
    const tipM=src.match(tipRe);
    if(tipM)comp.tooltip=tipM[1];

    if(type==='combobox'||type==='list'){
      const itemsRe=new RegExp(`${varName}\\s*=\\s*new\\s+\\w+<?>\\(new String\\[\\]\\{([^}]*)\\}\\)`);
      const itemsM=src.match(itemsRe);
      if(itemsM){
        comp.items=itemsM[1].split(',').map(s=>s.trim().replace(/^"|"$/g,'')).join(',');
      }
    }

    if(type==='spinner'){
      const spRe=new RegExp(`SpinnerNumberModel\\s+${varName}Model\\s*=\\s*new\\s+SpinnerNumberModel\\(([-\\d.]+),\\s*([-\\d.]+),\\s*([-\\d.]+),\\s*([-\\d.]+)\\)`);
      const spM=src.match(spRe);
      if(spM){comp.spinVal=parseFloat(spM[1]);comp.spinMin=parseFloat(spM[2]);comp.spinMax=parseFloat(spM[3]);comp.spinStep=parseFloat(spM[4]);}
    }

    if(type==='slider'){
      const slRe=new RegExp(`${varName}\\s*=\\s*new\\s+JSlider\\(JSlider\\.HORIZONTAL,\\s*([-\\d]+),\\s*([-\\d]+),\\s*([-\\d]+)\\)`);
      const slM=src.match(slRe);
      if(slM){comp.sliderMin=parseInt(slM[1]);comp.sliderMax=parseInt(slM[2]);comp.sliderVal=parseInt(slM[3]);}
      comp.sliderTicks=new RegExp(`${varName}\\.setPaintTicks\\(true\\)`).test(src);
    }

    if(type==='progressbar'){
      const pbRe=new RegExp(`${varName}\\s*=\\s*new\\s+JProgressBar\\((\\d+),\\s*(\\d+)\\)`);
      const pbM=src.match(pbRe);
      if(pbM){comp.progressMin=parseInt(pbM[1]);comp.progressMax=parseInt(pbM[2]);}
      const pvRe=new RegExp(`${varName}\\.setValue\\((\\d+)\\)`);
      const pvM=src.match(pvRe);
      if(pvM)comp.progressVal=parseInt(pvM[1]);
      comp.progressString=new RegExp(`${varName}\\.setStringPainted\\(true\\)`).test(src);
    }

    if(type==='tabbedpane'){
      const tabRe=new RegExp(`${varName}\\.addTab\\("([^"]*)"`,  'g');
      const tabNames=[];
      let tm;
      while((tm=tabRe.exec(src))!==null)tabNames.push(tm[1]);
      if(tabNames.length)comp.tabs=tabNames.join(',');
    }

    if(type==='table'){
      const modelName='modelo'+varName.charAt(0).toUpperCase()+varName.slice(1);
      const dtmRe=new RegExp(`${modelName}\\s*=\\s*new\\s+DefaultTableModel\\(\\s*new\\s+String\\[\\]\\{([^}]*)\\}`);
      const dtmM=src.match(dtmRe);
      if(dtmM){
        comp.columns=dtmM[1].split(',').map(s=>s.trim().replace(/^"|"$/g,'')).join(',');
      }
    }

    if(type==='separator'){
      comp.separatorH=!new RegExp(`${varName}\\s*=\\s*new\\s+JSeparator\\(SwingConstants\\.VERTICAL\\)`).test(src);
    }

    parsed.push(comp);
  });

  if(!parsed.length){
    alert('No se encontraron componentes en el archivo.\n¿Es un .java generado por JFrame Builder?');
    return;
  }

  components=[];
  document.getElementById('frameBody').innerHTML='';
  selectedId=null;
  document.getElementById('noSel').style.display='';
  document.getElementById('propsContent').style.display='none';

  document.getElementById('frameTitle').value=title;
  document.getElementById('frameTitleBar').textContent=title;
  document.getElementById('frameW').value=fw;
  document.getElementById('frameH').value=fh;
  document.getElementById('layoutType').value=layout;
  // Restaura el estilo (Look & Feel) detectado en el archivo
  if(document.getElementById('lookFeel')){
    document.getElementById('lookFeel').value=lookFeel;
    const sim=document.getElementById('frameSim');
    sim.classList.remove('laf-flatlight','laf-flatdark');
    if(lookFeel==='flatlight')sim.classList.add('laf-flatlight');
    else if(lookFeel==='flatdark')sim.classList.add('laf-flatdark');
  }
  resizeFrame();

  idCounter=newCounter;

  parsed.forEach(comp=>{
    components.push(comp);
    renderComp(comp);
  });

  updateStatus();
  document.getElementById('codeBox').value = src;
  
  alert(`✓ Cargado: "${filename}"\n${parsed.length} componentes importados.\nEventos de menú y botones restaurados.`);
}
