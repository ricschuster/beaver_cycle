const [port]=process.argv.slice(2);
const list = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(list[0].webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const send=(m,p)=>new Promise(res=>{const i=++id; const h=e=>{const x=JSON.parse(e.data); if(x.id===i){ws.removeEventListener('message',h);res(x)}}; ws.addEventListener('message',h); ws.send(JSON.stringify({id:i,method:m,params:p}))});
const k={key:' ',code:'Space',windowsVirtualKeyCode:32};
await send('Input.dispatchKeyEvent',{type:'keyDown',...k}); await new Promise(r=>setTimeout(r,150)); await send('Input.dispatchKeyEvent',{type:'keyUp',...k});
ws.close();
