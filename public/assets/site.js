const L=a=>a.map(x=>`<li>${x}</li>`).join('');
const T={
 en:{
  nav1:"Solutions",nav2:"Security",nav3:"Architectures",nav4:"Approach",nav5:"FAQ",nav_cta:"Request an audit",
  h1:"AI systems that work inside your operations, under your control.",
  badge:"AI automation for mid-sized and large companies",
  lead:"Hostio designs, integrates and maintains AI automation for mid-sized and large companies.<span class=\"l2\"> We connect it to your CRM, ERP and communication channels, with checks that prevent made-up answers and human approval wherever it is needed.</span>",
  cta:"Request an operational audit",cta2:"How the system makes decisions",
  facts:L(["Works with your existing systems","Human approval for sensitive actions","Replies in the customer's language"]),
  tr_title:"Processing one enquiry",tr_res:"Outcome",tr_note:"Illustrative examples with made-up data.",
  pr_h:"Where companies lose time and revenue",pr_p:"AI makes sense where the same work repeats hundreds of times a month and where delay has a cost. Before every proposal we measure the baseline, so the result can be compared.",
  pr1_h:"Slow first response",pr1_p:"Enquiries arrive on WhatsApp, email, the website and social media, and the reply waits until someone is free. The slower the reply, the lower the chance the enquiry becomes business.",pr1_m:"We measure time to first response and the share of enquiries answered.",
  pr2_h:"Manual re-entry",pr2_p:"The same data is typed from a message into the CRM, from an email into the ERP, from a spreadsheet into a quote. It costs hours and creates errors that are expensive to fix later.",pr2_m:"We measure hours of work per month and the number of corrections.",
  pr3_h:"After-hours and foreign-language enquiries",pr3_p:"Customers in other time zones and languages write when your team is offline or does not speak their language. Those enquiries are usually lost without a trace.",pr3_m:"We measure these enquiries and what happens to them.",
  so_h:"What we build",so_p:"Four kinds of systems, always shaped around your process and connected to the tools you already use. We do not sell off-the-shelf packages.",
  so1_h:"Multichannel intake agents",so1_p:"They answer enquiries on WhatsApp, Instagram, the web and email, in the customer's language. They qualify the enquiry, collect the details needed and hand it to the right person or system.",
  so1_l:L(["Answers grounded in your data, not guesswork","Qualification and tagging by your criteria","Handover to staff with the full conversation context"]),
  so2_h:"Operational workflow automation",so2_p:"Orders, requests, documents and quotes move through a defined flow without manual re-entry. AI extracts the data, the system validates it, and a person approves what needs approval.",
  so2_l:L(["Data extraction from emails, PDFs and forms","Routing by request type, priority and location","Draft quotes and replies ready for approval"]),
  so3_h:"Integration with existing systems",so3_p:"We do not ask you to replace your CRM, ERP or web shop. We connect to them through APIs and webhooks, so data stays where your team already works with it.",
  so3_l:L(["Two-way sync with CRM and ERP","Retries and a record of every data exchange","No change to how your staff work"]),
  so4_h:"Control layer and reporting",so4_p:"An optional view for management and the team: what the system did, what is waiting for approval and what the results are. We only offer it when your existing tools do not cover this.",
  so4_l:L(["Approval queue for sensitive replies and actions","Rules and permissions by role","Reports on response times and outcomes"]),
  ct_h:"You stay in control",ct_p:"Every action the system takes is visible and traceable. Sensitive decisions, such as discounts, partial deliveries or medical questions, wait for approval from an authorised person.",
  d_co:"Example Ltd.",d_dep:"Sales and support",d_n1:"Overview",d_n2:"Enquiries",d_n3:"Approvals",d_n4:"Rules",d_n5:"Integrations",d_n6:"Logs",d_ai:"System running",d_ai2:"4 channels, 2 integrations",d_hi:"Operations overview",d_date:"Thursday, 19 November",d_search:"Search enquiries, customers…",
  k1:"Enquiries today",k2:"Median first response",k3:"Resolved without staff",k4:"Awaiting approval",k4e:"open",
  c1:"Enquiries by channel",c1s:"Last 14 days",c2:"Enquiry languages",c2s:"Today",lg_bs:"Bosnian",lg_en:"English",lg_de:"German",lg_ar:"Arabic",c2n:"<b>3 replies</b> are waiting for your approval",
  c3:"Approval queue",c3s:"Average wait 6 min",q1:"Order of 40 pallets, item 1187",q1r:"Partial delivery",q2:"5% discount on two flats",q2r:"Above AI authority",q3:"Delivery complaint",q3r:"Complaint",q4:"Rental price, 3 months",q4r:"Confidence 0.71",s_wait:"Waiting",s_new:"Assigned",s_ok:"Approved",c4:"Event log",
  d_note:"Illustration of the control layer with made-up data. Layout and features are tailored to each client.",
  se_h:"How the system makes decisions",se_p:"The language model understands the message. Decisions about prices, availability and commitments come from your data and your rules. Every enquiry goes through the same steps.",
  p1_h:"Intake",p1_p:"The message arrives from any channel and gets a unique record: channel, language, time and sender.",
  p2_h:"Understanding",p2_p:"The model identifies the intent and extracts the data into a strictly defined structure. Output that does not match the schema is rejected.",
  p3_h:"Verification",p3_p:"Prices, stock, slots and statuses are read from your system at the moment of the enquiry. The model does not invent them.",
  p4_h:"Rules",p4_p:"Business rules and a confidence threshold decide what goes through automatically and what goes to a person: discounts, exceptions, complaints and sensitive topics.",
  p5_h:"Action and record",p5_p:"The reply is sent or waits for approval, data is written to the CRM or ERP, and every step is logged.",
  rel_h:"Reliability",rel_l:L(["Retries with back-off when an external API or webhook does not respond","Respecting rate limits of channels and model providers","Fallback: if the model or an integration is unavailable, the enquiry goes to staff and is not lost","Monitoring and error alerts","A test set of scenarios run before every change to the system"]),
  dat_h:"Data and access",dat_l:L(["Only the data needed for a given workflow is processed","Data in an EU region or on your own infrastructure, as agreed","Role-based access and a record of who approved what","Models are used through business APIs where, under the providers' terms, data is not used for training","A non-disclosure agreement before we access your data","Data deletion on request and when the agreed period ends"]),
  ar_h:"Reference architectures",ar_p:"Three typical systems we design, presented as reference solutions rather than as descriptions of client projects. We show the demo versions live at the introductory meeting.",
  ta:"Real estate and hospitality",tb:"Private clinics",tc:"Wholesale and distribution",a_lab:"Reference architecture",
  a_h:"Multilingual sales enquiries",a_p:"Buyers and guests from abroad and from the diaspora write in English, German, Arabic or Bosnian, often outside working hours. The sales team misses enquiries or replies hours later.",
  a_f:L(["The enquiry arrives from WhatsApp, Instagram, the website or a property portal","The agent identifies the language, the property and the intent: purchase, rental or viewing","Availability and price are read from the property database","Qualification: budget, timeline and payment method","The lead is written to the CRM, and the salesperson gets a summary and a proposed viewing slot"]),
  h_guard:"Safeguards",h_int:"Integrations",h_kpi:"What is measured",
  a_g:L(["Price and availability only from the database","Discounts and reservations always go to a salesperson","Reply in the customer's language, summary in the team's"]),
  a_i:"CRM (e.g. HubSpot or Pipedrive), property database, the sales team's calendar.",a_k:"Time to first response, share of qualified enquiries, number of viewings booked.",
  b_h:"Patient intake and scheduling",b_p:"Reception is overloaded with calls and messages, and part of the enquiries arrive at night and at weekends. Medical content needs particular care and a clear line between administration and clinical judgement.",
  b_f:L(["The enquiry arrives from any of the clinic's channels","The agent separates administrative questions (appointments, service prices, preparation) from medical ones","Free slots are read from the clinic's calendar or system","An appointment is proposed and confirmed according to the clinic's rules","Reminders and changes are sent automatically"]),
  b_g:L(["The agent gives no medical advice or diagnoses","Symptoms and emergencies go straight to staff","Access to patient data is restricted by role"]),
  b_i:"The clinic's scheduling or information system via API, calendar, reminders via WhatsApp or SMS.",b_k:"Reception workload, share of appointments booked outside working hours, number of missed appointments.",
  c_h:"B2B orders and enquiries",c_p:"Orders arrive by email, message and phone, in different formats. Sales staff check stock by hand and re-type line items into the ERP.",
  c_f:L(["The order arrives by email or message, as text, PDF or spreadsheet","Line items are extracted into a structure and matched to item codes","Stock, customer-specific prices and lead times are read from the ERP","Rules decide what goes through automatically and what goes to a salesperson","A draft order or quote is created in the ERP and waits for confirmation"]),
  c_g:L(["Customer prices only from the ERP","Partial deliveries and exceptions always need approval","Every line item can be traced back to the original document"]),
  c_i:"ERP via API or an agreed data export, business email, CRM.",c_k:"Order processing time, hours of manual entry, number of line-item errors.",
  in_h:"We work with the tools you already have",in_p:"Connections use official APIs and webhooks. For systems without an API we agree a secure way to exchange data.",
  i1:"Channels",i1p:"WhatsApp Business Platform, Instagram, Facebook Messenger, web chat, email (Microsoft 365, Google Workspace)",i3:"E-commerce",i4:"ERP and internal systems",i4p:"REST or SOAP APIs, webhooks, an agreed data export or direct database access with your permission",i5:"Calendars",i6:"Technology",i6p:"Node.js, Python, PostgreSQL, n8n and Make for quick workflows, models from Anthropic and OpenAI",
  in_note:"Product names belong to their owners and do not imply a partnership.",
  ho_h:"From audit to production",ho_p:"Every phase has a clear result and a decision at the end. We only move to the next phase with your agreement.",
  s1_h:"Audit and ROI map",s1_d:"1 to 2 weeks",s1_p:"Interviews with your team, a process map, baseline metrics, an estimate of savings and a proposed architecture. The result is a written report and a fixed-price proposal.",
  s2_h:"Architecture and sandbox",s2_d:"2 to 4 weeks",s2_p:"The system is built and tested on real, anonymised examples from your business, against agreed acceptance criteria.",
  s3_h:"Controlled rollout",s3_d:"2 to 4 weeks",s3_p:"One channel or team first, with human approval switched on. Automation expands only when the results justify it.",
  s4_h:"Maintenance and monitoring",s4_d:"monthly",s4_p:"Monitoring, fixes, rule adjustments and a monthly results report, within the agreed scope of support.",
  ho_note:"Durations are indicative and depend on scope and on access to your systems.",
  mk_h:"Local and international",mk_p:"Systems are built and maintained remotely, so your location is not a constraint. We adapt how we work to each market.",
  m1_h:"Bosnia and Herzegovina and the Adriatic region",m1_p:"Private polyclinics and aesthetic centres, wholesale and distribution, logistics, real estate developers and agencies, insurance, multi-location chains and larger online stores.",m1_w:"Communication in Bosnian, Croatian and Serbian. Meetings in person in Bosnia and Herzegovina or online. Proposals in BAM or EUR.",
  m2_h:"EU, DACH, United Kingdom and United States",m2_p:"B2B service firms, private clinics, software companies with heavy support queues, real estate agencies and online brands.",m2_w:"Communication in English. Remote work from the Central European time zone (CET). Proposals in EUR.",
  fq_h:"Frequently asked questions",fq_p:"Answers to the questions most often asked before a first meeting.",
  q1q:"Do we have to change the software we use?",q1a:"No. The system connects to your existing CRM, ERP, web shop and communication channels. We only offer our own control layer when your existing tools do not cover the need.",
  q2q:"What if the AI makes a mistake?",q2a:"The model does not decide on prices, availability or commitments; it reads them from your data. When confidence is low or the topic is sensitive, the enquiry goes to staff. Before going live the system passes a test set of scenarios agreed with you.",
  q3q:"Where is our data stored?",q3a:"As agreed: in an EU region with vetted service providers or on your own infrastructure. Only what the system needs is kept, and only for as long as agreed.",
  q4q:"Is our data used to train models?",q4a:"No. Models are used through business APIs where, under the providers' terms, customer data is not used for training.",
  q5q:"How long does implementation take?",q5a:"Roughly five to ten weeks from audit to controlled production use, depending on the number of channels, integrations and access to your systems.",
  q6q:"How is pricing set?",q6a:"The audit is a separate step at a fixed price. The build is offered at a fixed price based on the audit, and maintenance as a monthly agreement with a clearly defined scope. API and infrastructure costs are shown separately.",
  q7q:"Who owns the system and the data?",q7a:"Your data is always yours. Ownership of code, access and documentation is set out in the contract before work begins.",
  q8q:"Which languages does the system work in?",q8a:"The system replies in the customer's language, including Bosnian, Croatian, Serbian, English, German and Arabic. Summaries for your team can be in the language your team uses.",
  k_h:"Request an operational audit",k_p:"Describe the process you want to improve. The first step is a short introductory call with no obligation, where we assess whether an audit makes sense.",
  k_l:L(["Process map and baseline metrics","Estimate of time and cost savings","Proposed architecture and integrations","Fixed-price proposal for the build"]),
  hub_ec:"E-commerce",hub_cal:"Calendar",hub_c:"checks and rules",f_name:"Full name",f_co:"Company",f_role:"Role",f_mail:"Business email",f_country:"Country",f_size:"Number of employees",f_msg:"Which process do you want to improve?",f_send:"Send enquiry",privacy:"Privacy",
  pr_p_s:"AI makes sense where the same work repeats hundreds of times a month and where delay has a cost.",
  pr1_s:"Enquiries wait until someone is free, and every hour of delay lowers the chance of winning the business.",
  pr2_s:"The same data is typed by hand from messages into the CRM and ERP. It costs hours and creates errors.",
  pr3_s:"Customers in other time zones and languages write when your team is offline. Those enquiries quietly disappear.",
  so_p_s:"Four kinds of systems, always shaped around your process. We do not sell off-the-shelf packages.",
  so1_s:"They answer enquiries on every channel, in the customer's language, and hand them to the right person or system.",
  so2_s:"Orders, documents and quotes move through a defined flow, without manual re-entry.",
  so3_s:"We connect to your CRM, ERP and web shop, without replacing the tools your team already uses.",
  so4_s:"An overview of everything the system does and an approval queue for sensitive actions.",
  more_sol:"All solutions and integrations",more_sec:"Security and data",more_int:"All integrations",more_how:"How we work, step by step",
  p1_s:"A message from any channel gets a unique record.",p2_s:"The model extracts intent and data into a strict structure.",p3_s:"Prices, stock and slots are read from your systems.",p4_s:"Discounts, exceptions and sensitive topics go to a person.",p5_s:"Reply, write to the CRM or ERP, and a log entry.",
  ar_p_s:"Three typical systems we design. We show the demo versions live at the introductory meeting.",
  at_a:"Enquiries from abroad get a reply in the customer's language, and the qualified lead goes to the CRM.",
  at_b:"The system handles administrative questions, and anything medical goes straight to staff.",
  at_c:"Orders from emails and PDFs become drafts in the ERP, with stock and prices checked.",
  tz_go:"View the architecture",ho_p_s:"Four phases, each with a clear result. We move to the next only with your agreement.",
  crumb:"Hostio, home",
  rj_h1:"Solutions that work with your existing systems.",rj_lead:"We build intake agents, operational workflow automation, integrations and a control layer. Every solution starts by measuring the baseline.",
  sg_h1:"The language model understands. Your data and rules decide.",sg_lead:"How the system processes an enquiry, how it stays reliable when something fails, and how we handle your data.",
  se_h2:"Five steps for every enquiry",fq_h_s:"Questions about data and control",
  ar_h1:"Reference architectures.",ar_lead:"What the systems we design look like: the enquiry flow, safeguards, integrations and what is measured.",ar_h2:"Three systems, three industries",
  pa_h1:"From audit to production.",pa_lead:"What working together looks like, how long each phase takes, how pricing is set and how we work with companies in the region and abroad.",
  ho_h2:"Four phases of working together",band_h:"Let's look at your process together.",band_p:"A short introductory call with no obligation. If an audit makes sense, you get a fixed-price proposal.",band_cta:"Request an operational audit",
  ft_p:"AI automation and custom systems for mid-sized and large companies, in the region and beyond.",ft_h1:"Pages",ft_h2:"Contact"

 },
 bs:{}
};
/* processing trace scenes */
const SC={
 bs:[
  {ch:"WhatsApp",lang:"njemački",time:"21:14",msg:"Guten Abend, ist die Wohnung B-14 noch verfügbar? Was kostet sie?",
   steps:[["ok","Prijem","WhatsApp, njemački, 21:14"],["ok","Razumijevanje","Upit o dostupnosti i cijeni, stan B-14"],["ok","Provjera","Baza objekata: B-14 slobodan, 182.000 €"],["ok","Pravila","Pouzdanost 0,96, iznad praga 0,85"],["ok","Akcija","Odgovor poslan, lead upisan u CRM"]],
   outMeta:"Poslano automatski",out:"Guten Abend! Die Wohnung B-14 ist verfügbar, der Preis beträgt 182.000 €. Möchten Sie einen Besichtigungstermin vereinbaren?",end:"Riješeno automatski"},
  {ch:"Web chat",lang:"bosanski",time:"02:37",msg:"Nakon vađenja zuba imam jak bol i otok. Šta da radim?",
   steps:[["ok","Prijem","Web chat, bosanski, 02:37"],["ok","Razumijevanje","Namjera: medicinski simptom"],["ok","Provjera","Postojeći pacijent pronađen u sistemu klinike"],["esc","Pravila","Medicinska tema: automatski savjet nije dozvoljen"],["esc","Akcija","Proslijeđeno dežurnom osoblju"]],
   outMeta:"Poslano automatski, standardna poruka",out:"Vaša poruka je proslijeđena dežurnom osoblju klinike. Ako je stanje hitno, pozovite hitnu pomoć.",end:"Eskalirano osoblju"},
  {ch:"E-mail",lang:"engleski",time:"09:02",msg:"Please send 40 pallets of item 1187 by Friday. Customer no. K-2207.",
   steps:[["ok","Prijem","E-mail, engleski, 09:02"],["ok","Razumijevanje","Narudžba: art. 1187, 40 paleta, rok petak"],["ok","Provjera","ERP: na zalihi 26 paleta, kupac K-2207"],["esc","Pravila","Djelimična isporuka zahtijeva odobrenje"],["esc","Akcija","Nacrt narudžbe u ERP-u, čeka komercijalistu"]],
   outMeta:"Nacrt, čeka odobrenje",out:"We can deliver 26 pallets by Friday and the remaining 14 within 9 days. Shall we proceed?",end:"Čeka odobrenje"}
 ],
 en:[
  {ch:"WhatsApp",lang:"German",time:"21:14",msg:"Guten Abend, ist die Wohnung B-14 noch verfügbar? Was kostet sie?",
   steps:[["ok","Intake","WhatsApp, German, 21:14"],["ok","Understanding","Availability and price enquiry, flat B-14"],["ok","Verification","Property database: B-14 available, €182,000"],["ok","Rules","Confidence 0.96, above the 0.85 threshold"],["ok","Action","Reply sent, lead written to the CRM"]],
   outMeta:"Sent automatically",out:"Guten Abend! Die Wohnung B-14 ist verfügbar, der Preis beträgt 182.000 €. Möchten Sie einen Besichtigungstermin vereinbaren?",end:"Resolved automatically"},
  {ch:"Web chat",lang:"Bosnian",time:"02:37",msg:"Nakon vađenja zuba imam jak bol i otok. Šta da radim?",
   steps:[["ok","Intake","Web chat, Bosnian, 02:37"],["ok","Understanding","Intent: medical symptom"],["ok","Verification","Existing patient found in the clinic's system"],["esc","Rules","Medical topic: automated advice not allowed"],["esc","Action","Passed to on-call staff"]],
   outMeta:"Sent automatically, standard message",out:"Vaša poruka je proslijeđena dežurnom osoblju klinike. Ako je stanje hitno, pozovite hitnu pomoć.",end:"Escalated to staff"},
  {ch:"E-mail",lang:"English",time:"09:02",msg:"Please send 40 pallets of item 1187 by Friday. Customer no. K-2207.",
   steps:[["ok","Intake","Email, English, 09:02"],["ok","Understanding","Order: item 1187, 40 pallets, due Friday"],["ok","Verification","ERP: 26 pallets in stock, customer K-2207"],["esc","Rules","Partial delivery requires approval"],["esc","Action","Draft order in the ERP, waiting for sales"]],
   outMeta:"Draft, awaiting approval",out:"We can deliver 26 pallets by Friday and the remaining 14 within 9 days. Shall we proceed?",end:"Awaiting approval"}
 ]};
const FEED={bs:[["Cijena za B-14 pročitana iz baze objekata","Provjera"],["CRM webhook: ponovni pokušaj 1/3 uspješan","Integracija"],["Odgovor odobrila A. Hodžić","Odobrenje"],["Upit o simptomu proslijeđen osoblju","Eskalacija"],["Nacrt narudžbe kreiran u ERP-u","Akcija"],["Lead upisan u CRM: K. Weber, DE","Akcija"]],
 en:[["Price for B-14 read from the property database","Verification"],["CRM webhook: retry 1/3 succeeded","Integration"],["Reply approved by A. Hodžić","Approval"],["Symptom enquiry passed to staff","Escalation"],["Draft order created in the ERP","Action"],["Lead written to the CRM: K. Weber, DE","Action"]]};
const AGO={bs:["upravo sada","prije 1 min","prije 3 min","prije 6 min"],en:["just now","1 min ago","3 min ago","6 min ago"]};

const $=id=>document.getElementById(id);
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
let LANG="bs";
document.querySelectorAll('[data-i]').forEach(el=>{if(!(el.dataset.i in T.bs))T.bs[el.dataset.i]=el.innerHTML;});

/* ---------- hero trace (home only) ---------- */
const HAS_TRACE=!!$('trSteps');
const ICO='<svg class="i-ok" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><svg class="i-esc" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" stroke-width="3.2" stroke-linecap="round"><path d="M12 6v7M12 18v.5"/></svg>';
let timers=[],si=0;
const later=(f,ms)=>timers.push(setTimeout(f,ms));
function renderScene(sc,instant){
 $('trInMeta').innerHTML=`<span>${sc.ch}</span><span>${sc.lang}</span><span>${sc.time}</span>`;$('trInText').textContent=sc.msg;
 $('trSteps').innerHTML=sc.steps.map(([s,a,b])=>`<li data-s="${s}"><span class="ic">${ICO}</span><b>${a}</b><span>${b}</span></li>`).join('');
 $('trOutMeta').textContent=sc.outMeta;$('trOutText').textContent=sc.out;$('trOut').classList.remove('show');$('trEnd').innerHTML='&nbsp;';
 if(instant){[...$('trSteps').children].forEach(li=>li.classList.add('on',li.dataset.s));$('trOut').classList.add('show');$('trEnd').textContent=sc.end;}
}
function play(){
 const list=SC[LANG],sc=list[si%list.length];$('trIdx').textContent=(si%list.length+1)+'/'+list.length;si++;
 document.querySelectorAll('.fch').forEach(c=>c.classList.toggle('on',c.dataset.ch===sc.ch));
 renderScene(sc,false);const lis=[...$('trSteps').children];let t=700;
 lis.forEach(li=>{later(()=>{lis.forEach(x=>x.classList.remove('cur'));li.classList.add('on','cur');},t);t+=650;later(()=>li.classList.add(li.dataset.s),t-200);});
 later(()=>{lis.forEach(x=>x.classList.remove('cur'));$('trOut').classList.add('show');},t+200);
 later(()=>{$('trEnd').textContent=sc.end;},t+700);
 later(play,t+5200);
}
function restart(){if(!HAS_TRACE)return;timers.forEach(clearTimeout);timers=[];si=Math.max(0,si-1);
 if(reduce){renderScene(SC[LANG][0],true);$('trIdx').textContent='1/'+SC[LANG].length;return;}play();}

/* ---------- headings ---------- */
const h1=$('h1');
function splitH1(){if(!h1)return;const ws=h1.textContent.trim().split(/\s+/),n=ws.length,hl=h1.closest('.hero')&&!h1.closest('.page-hero');
 h1.innerHTML=ws.map((w,i)=>{const mark=hl&&i>=n-3;const d=.045*i;const bd=mark?(1.0+(i-(n-3))*.22):0;return `<span class="w${mark?' hl':''}"><span style="transition-delay:${d}s${mark?`,${bd}s`:''}">${w.replace(/\.$/,'<span class="dot">.</span>')}</span></span>`;}).join(' ');}
function splitH2(){document.querySelectorAll('.sec-head h2').forEach(h=>{h.innerHTML=h.textContent.trim().split(/\s+/).map((w,i)=>`<span class="w"><span style="transition-delay:${.06*i}s">${w}</span></span>`).join(' ');});}

/* ---------- language ---------- */
function setLang(l){
 LANG=l;document.documentElement.lang=l;
 document.querySelectorAll('[data-i]').forEach(el=>{const v=T[l][el.dataset.i];if(v!=null)el.innerHTML=v;});
 document.querySelectorAll('.lang button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.lang===l));
 const tt=document.body.dataset['title'+(l==='en'?'En':'Bs')];if(tt)document.title=tt;
 try{localStorage.setItem('hostio_lang',l)}catch(e){}
 splitH1();splitH2();feedFill();restart();
}
document.querySelectorAll('.lang button').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));
splitH1();splitH2();requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('ready')));

/* ---------- reveal on scroll ---------- */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;e.target.classList.add('in');io.unobserve(e.target);}),{threshold:.15});
document.querySelectorAll('.rv,#steps').forEach(el=>io.observe(el));

/* ---------- tabs (architectures page) ---------- */
const tabs=[...document.querySelectorAll('[role=tab]')];let fstep=0;
function selTab(t){tabs.forEach(x=>{const on=x===t;x.setAttribute('aria-selected',on);x.tabIndex=on?0:-1;const p=$(x.getAttribute('aria-controls'));p.hidden=!on;if(on){p.classList.add('in');p.classList.remove('sw');void p.offsetWidth;p.classList.add('sw');}});fstep=0;}
tabs.forEach((t,i)=>{t.addEventListener('click',()=>{selTab(t);try{history.replaceState(null,'','#'+t.dataset.hash)}catch(e){}});t.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];selTab(n);n.focus();}});});
if(tabs.length){const h=location.hash.slice(1);const t=tabs.find(x=>x.dataset.hash===h);if(t)selTab(t);}
setInterval(()=>{if(reduce)return;const p=document.querySelector('.arch:not([hidden])');if(!p)return;const lis=[...p.querySelectorAll('.flowlist li')];
 lis.forEach((li,j)=>{li.classList.toggle('done',j<fstep);li.classList.toggle('act',j===fstep);});fstep=(fstep+1)%(lis.length+2);},1300);

/* ---------- dashboard ---------- */
const dash=$('dash'),dfit=$('dashFit'),tilt=$('tilt'),feed=$('feed');
function fitDash(){if(!dash)return;const cw=dfit.clientWidth;dash.classList.toggle('compact',cw<700);const W=cw<700?640:1180;const k=Math.min(1,cw/W);dash.style.transform=`scale(${k})`;dfit.style.height=(dash.offsetHeight*k)+'px';}
addEventListener('resize',fitDash);
let fi=0,ftimer=null;
function feedTimes(){[...feed.children].forEach((li,i)=>{li.querySelector('small').textContent=li.dataset.k+', '+AGO[LANG][i];});}
function feedAdd(){if(!feed)return;const F=FEED[LANG];const [a,b]=F[fi%F.length];fi++;feed.insertAdjacentHTML('afterbegin',`<li data-k="${b}"><i></i><div>${a}<small></small></div></li>`);while(feed.children.length>4)feed.lastElementChild.remove();feedTimes();fitDash();}
function feedFill(){if(!feed)return;feed.innerHTML='';fi=0;for(let i=0;i<4;i++)feedAdd();}
if(dash){feedFill();
 new IntersectionObserver(es=>es.forEach(e=>{
  if(e.isIntersecting){if(!dash.classList.contains('go')){dash.classList.add('go');dash.querySelectorAll('.dc').forEach(c=>{const to=+c.dataset.to;let t0=null;const f=t=>{t0=t0||t;const k=Math.min(1,(t-t0)/1400);c.textContent=Math.round(to*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)});}
   if(!ftimer&&!reduce)ftimer=setInterval(feedAdd,3400);}
  else{clearInterval(ftimer);ftimer=null;}}),{threshold:.3}).observe(dash);}

/* ---------- scroll progress, dashboard tilt, header line ---------- */
const prog=$('prog'),hd=$('hd');let sTick=false;
function onScroll(){sTick=false;const h=document.documentElement;prog.style.transform=`scaleX(${Math.min(1,scrollY/Math.max(1,h.scrollHeight-innerHeight))})`;hd.classList.toggle('scrolled',scrollY>8);
 if(tilt&&!reduce){const r=dfit.getBoundingClientRect();const k=Math.max(0,Math.min(1,(r.top-innerHeight*.15)/(innerHeight*.75)));tilt.style.setProperty('--rx',(k*16).toFixed(2)+'deg');}}
addEventListener('scroll',()=>{if(!sTick){sTick=true;requestAnimationFrame(onScroll)}},{passive:true});

/* ---------- spotlight cards ---------- */
document.querySelectorAll('.sol,.tz').forEach(c=>c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px');}));

/* ---------- pipeline: steps light up with the packet ---------- */
const pli=[...document.querySelectorAll('.pipe li')];
if(pli.length){if(!reduce){const t0=performance.now();(function pl(){const k=((performance.now()-t0)/5000)%1;const i=Math.min(4,Math.floor(k*5));pli.forEach((li,j)=>li.classList.toggle('act',j===i));requestAnimationFrame(pl);})();}else pli.forEach(li=>li.classList.add('act'));}

$('yr').textContent=new Date().getFullYear();
/* dotted globe with routes from Sarajevo */
(function(){const cv=$('globe');if(!cv)return;const ctx=cv.getContext('2d');const W=cv.width,R=W*0.42,C=W/2;
 const N=1100,pts=[];for(let i=0;i<N;i++){const y=1-2*(i+.5)/N,r=Math.sqrt(1-y*y),t=i*2.399963;pts.push([Math.cos(t)*r,y,Math.sin(t)*r]);}
 const ll=(la,lo)=>{la*=Math.PI/180;lo*=Math.PI/180;return[Math.cos(la)*Math.sin(lo),Math.sin(la),Math.cos(la)*Math.cos(lo)];};
 const SA=ll(43.86,18.41),CITIES=[ll(52.52,13.40),ll(51.5,-0.12),ll(40.71,-74.0),ll(25.2,55.27),ll(48.2,16.37),ll(45.81,15.98)];
 const slerp=(a,b,t)=>{const d=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])));if(d<1e-6)return a;const s1=Math.sin((1-t)*d)/Math.sin(d),s2=Math.sin(t*d)/Math.sin(d);return[a[0]*s1+b[0]*s2,a[1]*s1+b[1]*s2,a[2]*s1+b[2]*s2];};
 let run=false,t0=performance.now();
 function proj(p,rot,tilt){const c=Math.cos(rot),s=Math.sin(rot);let x=p[0]*c-p[2]*s,z=p[0]*s+p[2]*c,y=p[1];const ct=Math.cos(tilt),st=Math.sin(tilt);const y2=y*ct-z*st,z2=y*st+z*ct;return[C+x*R,C-y2*R,z2];}
 function frame(now){const t=(now-t0)/1000;const rot=0.12+0.38*Math.sin(t*0.16);const tl=0.68;ctx.clearRect(0,0,W,W);
  const g=ctx.createRadialGradient(C-R*.3,C-R*.3,R*.1,C,C,R*1.05);g.addColorStop(0,'rgba(126,217,87,.10)');g.addColorStop(1,'rgba(126,217,87,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(C,C,R*1.05,0,7);ctx.fill();
  for(const p of pts){const q=proj(p,rot,tl);if(q[2]<0)continue;ctx.fillStyle=`rgba(200,232,210,${(.12+q[2]*.45).toFixed(3)})`;ctx.fillRect(q[0]-1.6,q[1]-1.6,3.2,3.2);}
  CITIES.forEach((b,ci)=>{const ph=((t*0.35+ci*0.17)%1);ctx.lineWidth=2.4;let prev=null;
   for(let k=0;k<=40;k++){const u=k/40;const v=slerp(SA,b,u);const lift=1+0.22*Math.sin(Math.PI*u)*Math.min(1,Math.acos(SA[0]*b[0]+SA[1]*b[1]+SA[2]*b[2])*1.2);const q=proj([v[0]*lift,v[1]*lift,v[2]*lift],rot,tl);
    if(prev&&q[2]>-0.05&&prev[2]>-0.05){ctx.strokeStyle=`rgba(${ci%2?'60,200,160':'126,217,87'},${(.25+.6*Math.max(0,q[2])).toFixed(2)})`;ctx.beginPath();ctx.moveTo(prev[0],prev[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();}
    if(Math.abs(u-ph)<0.013&&q[2]>0){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(q[0],q[1],4.5,0,7);ctx.fill();}prev=q;}
   const e=proj(b,rot,tl);if(e[2]>0){ctx.fillStyle='#7ED957';ctx.beginPath();ctx.arc(e[0],e[1],5,0,7);ctx.fill();}});
  const s0=proj(SA,rot,tl);if(s0[2]>0){const pr=(t%2)/2;ctx.strokeStyle=`rgba(126,217,87,${1-pr})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(s0[0],s0[1],6+pr*22,0,7);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s0[0],s0[1],7,0,7);ctx.fill();}
  if(run)requestAnimationFrame(frame);}
 if(reduce){frame(performance.now());return;}
 new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&!run){run=true;requestAnimationFrame(frame);}else if(!e.isIntersecting)run=false;})).observe(cv);
})();

/* contact form -> Supabase leads (insert only) */
const SB_URL="https://eauwnwvieyepzrbildqt.supabase.co",SB_KEY="sb_publishable_iQCs2n49JzTcJyrPadZIiw_xXSI4Qh_";
if($('cf')){
const cf=$('cf'),cfMsg=$('cfMsg'),cfBtn=$('cfBtn');
const M={bs:{need:"Upišite ime, firmu i ispravan poslovni e-mail.",sending:"Šaljem…",ok:"Hvala. Upit je primljen, a odgovor stiže na e-mail koji ste upisali.",err:"Slanje nije uspjelo. Provjerite internet vezu i pokušajte ponovo."},
 en:{need:"Please enter your name, company and a valid business email.",sending:"Sending…",ok:"Thank you. Your enquiry has been received, and the reply will go to the email you entered.",err:"Sending failed. Check your connection and try again."}};
cf.addEventListener('submit',async e=>{
 e.preventDefault();const d=Object.fromEntries(new FormData(cf));if(d.website)return;
 const name=(d.name||'').trim(),co=(d.company||'').trim(),mail=(d.email||'').trim();
 if(name.length<2||co.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){cfMsg.className='fmsg err';cfMsg.textContent=M[LANG].need;return;}
 const msg=[`Firma: ${co}`,d.role&&`Uloga: ${d.role.trim()}`,d.country&&`Država: ${d.country.trim()}`,d.size&&`Zaposlenih: ${d.size}`].filter(Boolean).join('\n')+'\n\n'+(d.message||'').trim();
 cfBtn.disabled=true;cfMsg.className='fmsg';cfMsg.textContent=M[LANG].sending;
 try{const r=await fetch(SB_URL+'/rest/v1/leads',{method:'POST',headers:{apikey:SB_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},
   body:JSON.stringify({name:`${name} (${co})`,contact:mail,message:msg,source:'hostio-audit-'+LANG})});
  if(!r.ok)throw new Error(r.status);cf.reset();cfMsg.className='fmsg ok';cfMsg.textContent=M[LANG].ok;}
 catch(err){cfMsg.className='fmsg err';cfMsg.textContent=M[LANG].err;}
 finally{cfBtn.disabled=false;}
});

}
/* initial language: ?lang=, saved choice, or the browser's language */
let init='bs';
try{const q=new URLSearchParams(location.search).get('lang');const s=localStorage.getItem('hostio_lang');
 init=q==='en'||q==='bs'?q:(s||(/^(bs|hr|sr|sh|cnr)/i.test(navigator.language||'')?'bs':'en'));}catch(e){}
fitDash();onScroll();
if(init==='en')setLang('en');else restart();
