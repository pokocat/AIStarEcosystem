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
const form=document.querySelector('#registration-form');
const phone=document.querySelector('#phone'),codeInput=document.querySelector('#verification-code');
const sendCode=document.querySelector('#send-code'),submit=document.querySelector('#register');
const stateInput=document.querySelector('#preview-state');
const error=document.querySelector('#form-error'),status=document.querySelector('#form-status');
let resendTimer,codeIssued=false;
function feedback(text,isError=false){
 const target=isError?error:status,other=isError?status:error;
 other.hidden=true;other.textContent='';target.textContent=text;target.hidden=!text;
}
function validPhone(){
 if(/^1[3-9]\d{9}$/.test(phone.value.trim())){phone.removeAttribute('aria-invalid');return true}
 phone.setAttribute('aria-invalid','true');feedback('请输入正确的 11 位手机号。',true);phone.focus();return false;
}
sendCode.addEventListener('click',()=>{
 if(sendCode.disabled||!validPhone())return;
 codeIssued=true;sendCode.disabled=true;
 feedback('设计演示：验证码 123456，不会发送短信。');
 let remaining=60;sendCode.textContent=remaining+' 秒后重试';
 resendTimer=setInterval(()=>{remaining--;sendCode.textContent=remaining+' 秒后重试';if(remaining<=0){clearInterval(resendTimer);sendCode.disabled=false;sendCode.textContent='重新获取'}},1000);
 codeInput.focus();
});
phone.addEventListener('input',()=>{
 codeIssued=false;clearInterval(resendTimer);sendCode.disabled=false;sendCode.textContent='获取验证码';
 phone.removeAttribute('aria-invalid');feedback('');
});
codeInput.addEventListener('input',()=>{codeInput.removeAttribute('aria-invalid');error.hidden=true});
form.addEventListener('submit',event=>{
 event.preventDefault();if(submit.disabled||!validPhone())return;
 if(!codeIssued){feedback('请先获取验证码。',true);sendCode.focus();return}
 if(codeInput.value.trim()!=='123456'){codeInput.setAttribute('aria-invalid','true');feedback('请输入演示验证码 123456。',true);codeInput.focus();return}
 codeInput.removeAttribute('aria-invalid');submit.disabled=true;submit.querySelector('span').textContent='演示已完成';
 feedback('演示完成。正式接入后将直接进入 Studio。');
 clearInterval(resendTimer);sendCode.disabled=true;
});
function setState(state){
 if(!['normal','existing','expired','error'].includes(state))state='normal';
 stateInput.value=state;form.reset();clearInterval(resendTimer);codeIssued=false;
 submit.disabled=false;submit.querySelector('span').textContent=state==='existing'?'登录并进入 Studio':'注册并进入 Studio';
 sendCode.disabled=false;sendCode.textContent='获取验证码';feedback('');
 phone.removeAttribute('aria-invalid');codeInput.removeAttribute('aria-invalid');
 const message=document.querySelector('#state-message');
 message.textContent=state==='expired'?'邀请已失效，仍可正常注册。':state==='error'?'暂时无法读取邀请，请重试。':'';
 message.hidden=!message.textContent;
 document.querySelector('#inviter').hidden=state==='expired'||state==='error';
 document.querySelector('#registration-fields').hidden=state==='error';
 document.querySelector('#retry-invitation').hidden=state!=='error';
}
document.querySelector('#retry-invitation').addEventListener('click',()=>setState('normal'));
stateInput.addEventListener('change',()=>setState(stateInput.value));
setState(new URLSearchParams(location.search).get('state')||'normal');
