const root=document.documentElement;
const media=matchMedia('(min-width:960px)');
function layout(){root.dataset.layout=media.matches?'desktop':'mobile'}
layout();media.addEventListener('change',layout);
const scenes={
 image:{title:'让想象，拥有自己的样子。',description:'角色写真、造型与场景，延展属于你的视觉表达。',alt:'光影中的人物与场景，图片创作示意'},
 video:{title:'让角色，走进新的故事。',description:'从一张画面出发，延展为有情绪、有节奏的影像。',alt:'夕阳下，围着橘色围巾的女孩回望海岸，影像创作示意'},
 script:{title:'让一个想法，长成一个世界。',description:'故事设定、剧本与分镜，让灵感有处可去。',alt:'故事与剧本创作的视觉示意'}
};
const tabs=[...document.querySelectorAll('[role=tab]')];
function selectScene(tab){
 const name=tab.dataset.scene,item=scenes[name];
 tabs.forEach(t=>{t.setAttribute('aria-selected',String(t===tab));t.tabIndex=t===tab?0:-1});
 document.querySelector('#main-art').src=`assets/${name}.png`;
 document.querySelector('#main-art').alt=item.alt;
 document.querySelector('#showcase-title').textContent=item.title;
 document.querySelector('#showcase-description').textContent=item.description;
 document.querySelector('#showcase-panel').setAttribute('aria-labelledby',tab.id);
}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>selectScene(tab));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();tabs[next].focus();selectScene(tabs[next])}})});
const dialog=document.querySelector('#flow-dialog'),accept=document.querySelector('#accept'),existing=document.querySelector('#existing'),stateInput=document.querySelector('#preview-state');
function showFlow(existingAccount=false){
 document.querySelector('#dialog-copy').textContent=existingAccount?'正式接入后，这里会完成已有账号登录，再自动回到 IP Studio；不会新增或改写邀请关系。':'正式接入后，这里会前往统一账号中心完成注册或登录，再自动回到 IP Studio。';
 dialog.showModal();
}
accept.addEventListener('click',()=>{if(stateInput.value==='error'){setState('normal');return}if(stateInput.value==='expired'){document.querySelector('#possibilities').scrollIntoView({behavior:'smooth'});return}showFlow(stateInput.value==='existing')});
existing.addEventListener('click',()=>showFlow(true));
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
function setState(state){
 if(!['normal','existing','expired','error'].includes(state))state='normal';
 stateInput.value=state;const message=document.querySelector('#state-message');
 const config={normal:{text:'',label:'接受邀请，开始创作',inviter:true},existing:{text:'你已有账号，可以直接进入 Studio。原有邀请关系保持不变。',label:'进入 IP Studio',inviter:true},expired:{text:'这次邀请暂不可用。你仍然可以了解 Studio，或联系朋友重新获取邀请链接。',label:'了解 IP Studio',inviter:false},error:{text:'暂时无法读取朋友的邀请。请重试，或稍后重新打开链接。',label:'重新读取邀请',inviter:false}}[state]||{};
 message.textContent=config.text;message.hidden=!config.text;document.querySelector('#inviter').hidden=!config.inviter;
 accept.querySelector('span').textContent=config.label;document.querySelector('#return-note').hidden=state==='expired'||state==='error';existing.hidden=state==='existing';
}
stateInput.addEventListener('change',()=>setState(stateInput.value));setState(new URLSearchParams(location.search).get('state')||'normal');
