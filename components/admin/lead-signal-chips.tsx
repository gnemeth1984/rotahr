/** Lead Engine v2 trigger display: grade badge and signal chips ("Hiring Head Chef", "Food Hygiene Rating 2"). */
export type SignalSummary = {lead_score:number;signals:string[];breakdown?:{type:string;label:string;points:number;sourceUrl:string;eventDate:string|null}[]};
const GRADE_STYLE:Record<string,string> = {
  "A+":"bg-emerald-700 text-white","A":"bg-emerald-100 text-emerald-800","B":"bg-sky-100 text-sky-800","C":"bg-slate-100 text-slate-600","D":"bg-slate-50 text-slate-400",
};
export function GradeBadge({grade}:{grade:string}) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${GRADE_STYLE[grade]??GRADE_STYLE.D}`}>{grade}</span>;
}
export function chipStyle(type:string) {
  return type.startsWith("hiring_")?"border-violet-200 bg-violet-50 text-violet-800":type==="fhrs_rating"?"border-amber-200 bg-amber-50 text-amber-800":type.startsWith("fsai_")?"border-red-200 bg-red-50 text-red-800":"border-slate-200 bg-slate-50 text-slate-700";
}
export function SignalChips({summary,max=3}:{summary:SignalSummary|null|undefined;max?:number}) {
  const items = summary?.breakdown ?? summary?.signals.map(label=>({type:"",label,points:0,sourceUrl:"",eventDate:null})) ?? [];
  if (!items.length) return <span className="text-slate-400">—</span>;
  return <div className="flex flex-wrap gap-1">{items.slice(0,max).map(s=><span key={s.label} title={s.points?`+${s.points}`:undefined} className={`rounded-full border px-2 py-0.5 text-[11px] ${chipStyle(s.type)}`}>{s.label}</span>)}{items.length>max&&<span className="text-[11px] text-slate-500">+{items.length-max}</span>}</div>;
}
