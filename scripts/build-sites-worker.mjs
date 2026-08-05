import {cp,mkdir,readdir,writeFile} from "node:fs/promises";

const output=`export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") return response;
    const accept = request.headers.get("accept") || "";
    if (!accept.includes("text/html")) return response;
    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  },
};
`;

await mkdir("dist/client",{recursive:true});
for(const entry of await readdir("dist")){
  if(entry==="client"||entry==="server")continue;
  await cp(`dist/${entry}`,`dist/client/${entry}`,{recursive:true});
}
await mkdir("dist/.openai",{recursive:true});
try{
  await cp(".openai/hosting.json","dist/.openai/hosting.json");
}catch(error){
  if(error?.code!=="ENOENT")throw error;
}
await mkdir("dist/server",{recursive:true});
await writeFile("dist/server/index.js",output);
