/* =====================================================================
   3. SHARED SAMPLE DATA — one source of truth for every page.
      endpoints · vulnerabilities · hardeningControls · securityTools ·
      notifications · profile
   Only RAW facts are stored here. Everything shown on screen (SCCM
   status, patch %, open vulnerability counts, hardening scores, tool
   totals, "last update" times, chart series, badges, report rows) is
   DERIVED from these arrays by the functions in section 3b, so the
   whole dashboard stays consistent when data is added/edited/deleted.
   All records are fictional sample data.
===================================================================== */
const PATCH_SLA_THRESHOLD = 90;   // proposed: endpoint is SCCM-compliant when >= 90% of applicable updates are installed
const STALE_CHECK_DAYS = 7;       // proposed: SCCM check older than 7 days (vs latest fleet check) needs attention
const PROTOTYPE_BUILD = '2026-09-25';

/* REAL-DATA MODE: no seeded endpoint or vulnerability records.
   Import actual inventory and security-tool exports before these arrays populate. */
let endpoints = [];
let vulnerabilities = [];

/* Proposed SAMPLE hardening baseline — NOT FGV Prodata's actual policy.
   Each control is evaluated per endpoint with check(e); compliance %,
   affected endpoints and per-endpoint hardening scores all come from it. */
let hardeningControls = [
  {key:'patch', control:'Security updates installed', source:'SCCM', tool:'sccm',
    expected:`At least ${PATCH_SLA_THRESHOLD}% of applicable updates installed`,
    check:e=>e.sccm==='Compliant', remediation:'Deploy outstanding updates in the next SCCM maintenance window', remediationStatus:'In Progress'},
  {key:'antivirus', control:'Antivirus real-time protection', source:'Kaspersky', tool:'kaspersky',
    expected:'Real-time protection on and signatures current',
    check:e=>e.kaspersky==='Protected', remediation:'Update signatures and re-enable the protection service', remediationStatus:'In Progress'},
  {key:'defender', control:'Microsoft Defender protection', source:'Microsoft Defender', tool:'defender',
    expected:'Protection active and reporting to the console',
    check:e=>e.defender==='Protected', remediation:'Investigate active alerts and reconnect offline devices', remediationStatus:'In Progress'},
  {key:'edr', control:'EDR / XDR risk level', source:'Trend Micro Vision One', tool:'trendmicro',
    expected:'Endpoint risk level Low or Medium',
    check:e=>['Low Risk','Medium Risk'].includes(e.trendmicro), remediation:'Triage high and critical risk detections in Vision One', remediationStatus:'Not Started'},
  {key:'firewall', control:'Host firewall enabled', source:'Endpoint configuration', tool:null,
    expected:'Firewall on for domain, private and public profiles',
    check:e=>!!e.config.firewall, remediation:'Re-apply the sample firewall baseline via policy', remediationStatus:'Not Started'},
  {key:'diskEncryption', control:'Full-disk encryption', source:'Endpoint configuration', tool:null,
    expected:'System drive encrypted, recovery key escrowed',
    check:e=>!!e.config.diskEncryption, remediation:'Enable disk encryption and escrow recovery keys', remediationStatus:'Not Started'},
  {key:'usbControl', control:'Removable media control', source:'Endpoint configuration', tool:null,
    expected:'USB storage limited to approved devices',
    check:e=>!!e.config.usbControl, remediation:'Apply device-control policy for removable storage', remediationStatus:'In Progress'},
  {key:'passwordPolicy', control:'Password & screen-lock policy', source:'Endpoint configuration', tool:null,
    expected:'Complex password; screen lock within 15 minutes',
    check:e=>!!e.config.passwordPolicy, remediation:'Re-apply account and screen-lock policy', remediationStatus:'In Progress'},
];
const CONFIG_FIELDS = [
  {key:'firewall', label:'Host firewall enabled'},
  {key:'diskEncryption', label:'Full-disk encryption'},
  {key:'usbControl', label:'Removable media control'},
  {key:'passwordPolicy', label:'Password & screen-lock policy'},
  {key:'edrEnabled', label:'Endpoint protection / EDR enabled'},
  {key:'realtimeProtection', label:'Real-time protection enabled'},
  {key:'autoSecurityUpdates', label:'Automatic security updates enabled'},
  {key:'secureBoot', label:'Secure Boot enabled'},
  {key:'localAdminRestrictions', label:'Local administrator restrictions'},
  {key:'appControl', label:'Application control enabled'},
];

/* The four core security tools. "healthy"/"affected" define which
   endpoint statuses count as covered vs needing attention — the same
   definition drives the tool cards, tool modal, coverage chart and the
   "affected only" filter on Endpoint Security. */
const securityTools = [
  {key:'defender', name:'Microsoft Defender', icon:'shieldPlain', tone:'blue', field:'defender', status:'Operational',
    healthy:['Protected'], affected:['At Risk','Offline'], affectedLabel:'At Risk or Offline', timeLabel:'Last update',
    note:'Protection status and threat indicators reported per endpoint.'},
  {key:'sccm', name:'SCCM', icon:'monitor', tone:'slate', field:'sccm', status:'Operational',
    healthy:['Compliant'], affected:['Non-Compliant'], affectedLabel:'Non-Compliant', timeLabel:'Last check',
    note:`Patch status evaluated against the proposed ${PATCH_SLA_THRESHOLD}% update SLA.`},
  {key:'kaspersky', name:'Kaspersky', icon:'shieldCheck', tone:'green', field:'kaspersky', status:'Operational',
    healthy:['Protected'], affected:['At Risk'], affectedLabel:'At Risk', timeLabel:'Last update',
    note:'Real-time protection and signature status reported per endpoint.'},
  {key:'trendmicro', name:'Trend Micro Vision One', icon:'radar', tone:'amber', field:'trendmicro', status:'Operational',
    healthy:['Low Risk','Medium Risk'], affected:['High Risk','Critical Risk'], affectedLabel:'High or Critical Risk', timeLabel:'Last activity',
    note:'XDR risk level correlated across monitored endpoints.'},
];
const TOOL_BY_SOURCE = {'Microsoft Defender':'defender','SCCM':'sccm','Kaspersky':'kaspersky','Trend Micro Vision One':'trendmicro'};

/* Mock SOC ticket queue — standalone from endpoints/vulnerabilities for now.
   Feeds the Global Executive KPI bar (Active SOC Tickets) in this pass, and
   is expected to become the data source for the Trend Micro / SOC alerts
   module in a later pass. "Active" = status is Open or In Progress.
   ASSUMPTION TO CONFIRM WITH SUPERVISOR: ticket priority labels (P1-P4) and
   which tool "owns" a ticket are illustrative — not specified in the brief. */
/* REAL-DATA MODE: SOC tickets are empty until a real source is connected. */
let socTickets = [];
function activeSocTickets(){ return socTickets.filter(t=>t.status!=='Closed').length; }

/* REAL-DATA MODE: notifications are empty until generated from real events. */
let notifications = [];
let notifSeq = 1;

