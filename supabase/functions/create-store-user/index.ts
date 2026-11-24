import {createClient} from "npm:@supabase/supabase-js@2.49.4";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store",...cors}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),pub=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!service||!pub)return reply({error:"configuration_missing"},503);
 const token=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 const identity=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:verified,error:verifyError}=await identity.auth.getUser(token);
 if(verifyError||!verified.user)return reply({error:"unauthorized"},401);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:actor}=await db.from("usuarios").select("cargo,loja_id,ativo,setor").eq("auth_user_id",verified.user.id).maybeSingle();
 if(!actor?.ativo)return reply({error:"forbidden"},403);
 const actorRole=String(actor.cargo||"").toLowerCase();
 const isSaas=actorRole==="saas_admin",isManager=actorRole.includes("gerente")||actorRole.includes("admin");
 const isSectorManager=/^gestor de setor(?:\s*-\s*.+)?$/.test(actorRole.trim());
 if(!isSaas&&!isManager&&!isSectorManager)return reply({error:"forbidden"},403);
 let input:Record<string,unknown>;try{input=await req.json()}catch{return reply({error:"invalid_json"},400)}
 if (!input || typeof input !== "object" || Array.isArray(input)) return reply({error:"invalid_input"},400);
 if(input.action === "list-sector-users" || isSectorManager) {
   if(!isSectorManager || !actor.loja_id) return reply({error:"forbidden"},403);
   const assigned=String(actor.setor||"").trim();
   if(!assigned || assigned.toUpperCase()==="GERAL") return reply({error:"forbidden_sector"},403);
   const requested=String(input.setor||"").trim();
   if(!requested || requested.length>64 || /^(todos|geral)$/i.test(requested)) return reply({error:"invalid_sector"},400);
   if(assigned.toUpperCase()!=="TODOS" && requested.toUpperCase()!==assigned.toUpperCase()) return reply({error:"forbidden_sector"},403);
   if(input.loja_id!==actor.loja_id) return reply({error:"forbidden_store"},403);
   const sector = assigned.toUpperCase()==="TODOS" ? requested.toUpperCase() : assigned;
   if(input.action === "list-sector-users") {
     const sectorPattern=sector.replace(/[\\%_]/g, value => "\\" + value);
     const page=typeof input.page==="number" && Number.isInteger(input.page) && input.page>=0 && input.page<500 ? input.page : 0;
     const {data:users,error}=await db.from("usuarios").select("id,nome,matricula,cargo,ativo")
       .eq("loja_id",actor.loja_id).ilike("setor",sectorPattern).order("matricula").order("id").range(page*50,page*50+50);
     if(error || !users) return reply({error:"list_failed"},500);
     return reply({success:true,users:users.slice(0,50),hasMore:users.length>50});
   }
   if(input.action !== "create-sector-user" || input.cargo !== "Operador de Loja") return reply({error:"forbidden_role"},403);
   input.setor=sector;
 }
 const customRegistration = input.matricula !== undefined || input.password !== undefined || input.ativo !== undefined;
 if (customRegistration && !isSaas) return reply({error:"forbidden_registration_options"},403);
 const requestedMatricula = typeof input.matricula === "string" ? input.matricula.trim().toUpperCase() : "";
 const requestedPassword = typeof input.password === "string" ? input.password : "";
 if (customRegistration && (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(requestedMatricula) ||
   requestedPassword === "1234567890123" || requestedPassword.length < 12 || requestedPassword.length > 128 || typeof input.ativo !== "boolean")) {
   return reply({error:"invalid_credentials"},400);
 }
 const name=String(input.nome||"").trim(),encryptedName=String(input.nome_cifrado||"").trim();
 const store=String(input.loja_id||"").trim(),role=String(input.cargo||"Operador").trim();
 const setor=String(input.setor||"TODOS").trim(),supplier=String(input.codigo_fornecedor||"").trim();
 if(name.length<2||name.length>120||encryptedName.length<10||encryptedName.length>1500||!store||store.length>64||role.length>64||setor.length>64||supplier.length>64)return reply({error:"invalid_input"},400);
 if(!isSaas&&actor.loja_id!==store)return reply({error:"forbidden_store"},403);
 if(role.toLowerCase()==="saas_admin"||role.toLowerCase().includes("gerente")&&!isSaas&&!actorRole.includes("gerente"))return reply({error:"forbidden_role"},403);
 if(role.toLowerCase()==="promotor"&&!supplier)return reply({error:"supplier_required"},400);
 const {data:shop,error:shopError}=await db.from("lojas").select("id,limite_usuarios,ativa").eq("id",store).maybeSingle();
 if(shopError||!shop?.ativa)return reply({error:"store_not_found"},404);
 const {count,error:countError}=await db.from("usuarios").select("id",{count:"exact",head:true}).eq("loja_id",store).neq("cargo","saas_admin");
 if(countError)return reply({error:"count_failed"},500);
 if((count||0)>=Number(shop.limite_usuarios||15))return reply({error:"license_limit"},409);
 const bytes=new Uint8Array(18);crypto.getRandomValues(bytes);
 const secret=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 const password=customRegistration ? requestedPassword : "Sp!"+secret;
 const userId=crypto.randomUUID();
 const prefix=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z]/g,"").slice(0,5).padEnd(5,"X");
 let matricula=requestedMatricula;
 if (customRegistration) {
   const {data: existing, error: lookupError} = await db.from("usuarios").select("id")
     .ilike("matricula", requestedMatricula.replaceAll("_", "\\_")).limit(1);
   if (lookupError) return reply({error:"registration_lookup_failed"},500);
   if (existing?.length) return reply({error:"matricula_unavailable"},409);
 }
 for(let attempt=0;!matricula && attempt<30;attempt++){
   const digits=crypto.getRandomValues(new Uint32Array(1))[0]%10000;
   const candidate=prefix+"-"+String(digits).padStart(4,"0");
   const {data:exists}=await db.from("usuarios").select("id").eq("matricula",candidate).maybeSingle();
   if(!exists){matricula=candidate;break}
 }
 if(!matricula)return reply({error:"matricula_exhausted"},409);
 const email=matricula.toLowerCase().replace(/[^a-z0-9]/g,"")+"_"+userId.replace(/[^a-z0-9]/gi,"").slice(0,16)+"@superpwa.app";
 const {data:created,error:createError}=await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{cargo:role,loja_id:store,matricula,require_mfa:true}});
 if(createError||!created.user)return reply({error:"auth_creation_failed"},500);
 const {error:insertError}=await db.from("usuarios").insert({id:userId,matricula,nome:encryptedName,senha:"",cargo:role,setor,loja_id:store,ativo:!customRegistration || input.ativo === true,primeiro_login:true,codigo_fornecedor:role.toLowerCase()==="promotor"?supplier:null,auth_user_id:created.user.id});
 if(insertError){await db.auth.admin.deleteUser(created.user.id);return reply({error:"user_creation_failed"},500)}
 return reply({success:true,matricula,...(customRegistration ? {} : {password}),user_id:userId});
});
