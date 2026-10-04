const FALLBACK_URL='/market';
self.addEventListener('push',event=>{
  let message={};
  try{message=event.data?.json()??{}}catch{}
  const title=typeof message.title==='string'?message.title:'VivrePlay Market';
  const body=typeof message.body==='string'?message.body:'There is new activity on your Market account.';
  const url=typeof message.url==='string'&&message.url.startsWith('/')?message.url:FALLBACK_URL;
  event.waitUntil(self.registration.showNotification(title,{body,icon:'/brand/vivreplay-icon-192.png',badge:'/brand/vivreplay-icon-192.png',tag:typeof message.tag==='string'?message.tag:'vivreplay-market',renotify:true,data:{url}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||FALLBACK_URL,self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    for(const client of windows){if(client.url.startsWith(self.location.origin)&&'focus'in client)return client.navigate(target).then(()=>client.focus());}
    return self.clients.openWindow(target);
  }));
});
