const accts=[["Elvira","elvira1234"],["Natalya","natalya1234"],["Elvira","elvira1234"],["Natalya","natalya1234"]];
for (const [u,p] of accts){const r=await fetch("http://127.0.0.1:4000/api/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:p})});const t=await r.text();console.log(u,r.status,t.slice(0,120));}
