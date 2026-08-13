import { MUSCLES } from "./data/formGuide.js";

const base={strokeWidth:1.2,vectorEffect:"non-scaling-stroke"};

export default function MuscleHeatmap({scores={},onSelect,selected,mode="coverage"}) {
  const color=value=>mode==="sets"
    ? value>20?"#A855F7":value>=13?"#F59E0B":value>=6?"#22C55E":value>=1?"#3B82F6":value>0?"#60A5FA":"#351D26"
    : value>=2?"#22C55E":value>=1?"#3B82F6":value>0?"#F59E0B":"#351D26";
  const paint=id=>({
    ...base,
    "data-muscle":id,
    fill:color(scores[id]||0),
    stroke:selected===id?"#FFFFFF":scores[id]>0?"#E5E7EB55":"#7F1D1D88",
    style:{cursor:onSelect?"pointer":"default"},
  });
  const title=id=><title>{MUSCLES[id]||id}: {scores[id]>0?"trained":"missed"}</title>;
  const choose=event=>{const muscle=event.target?.dataset?.muscle;if(muscle&&onSelect)onSelect(muscle);};
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,maxWidth:330,margin:"0 auto"}}>
    <div><div style={{fontSize:9,color:"#666",textAlign:"center",marginBottom:3}}>FRONT</div><svg onClick={choose} viewBox="0 0 120 220" style={{width:"100%",height:250}} aria-label="Front muscle heatmap">
      <circle cx="60" cy="18" r="12" fill="#171824" stroke="#303247"/><rect x="54" y="30" width="12" height="9" rx="3" fill="#171824"/>
      <path d="M40 43Q29 45 27 59L42 55Z" {...paint("sideDelts")}>{title("sideDelts")}</path><path d="M80 43Q91 45 93 59L78 55Z" {...paint("sideDelts")}>{title("sideDelts")}</path>
      <path d="M42 43Q49 39 57 44L56 57L40 56Z" {...paint("frontDelts")}>{title("frontDelts")}</path><path d="M78 43Q71 39 63 44L64 57L80 56Z" {...paint("frontDelts")}>{title("frontDelts")}</path>
      <path d="M43 48Q51 43 59 48V67Q47 70 40 62Z" {...paint("chest")}>{title("chest")}</path><path d="M77 48Q69 43 61 48V67Q73 70 80 62Z" {...paint("chest")}>{title("chest")}</path>
      <path d="M27 59Q21 71 24 84L34 80L36 59Z" {...paint("biceps")}>{title("biceps")}</path><path d="M93 59Q99 71 96 84L86 80L84 59Z" {...paint("biceps")}>{title("biceps")}</path>
      <path d="M23 84Q19 101 23 116L31 112L31 81Z" {...paint("forearms")}>{title("forearms")}</path><path d="M97 84Q101 101 97 116L89 112L89 81Z" {...paint("forearms")}>{title("forearms")}</path>
      <path d="M49 68Q60 65 71 68L68 101Q60 105 52 101Z" {...paint("abs")}>{title("abs")}</path><path d="M43 67L50 69L52 101L45 96Z" {...paint("obliques")}>{title("obliques")}</path><path d="M77 67L70 69L68 101L75 96Z" {...paint("obliques")}>{title("obliques")}</path>
      <path d="M46 102Q51 98 59 103L57 151L46 149Z" {...paint("quads")}>{title("quads")}</path><path d="M74 102Q69 98 61 103L63 151L74 149Z" {...paint("quads")}>{title("quads")}</path>
      <path d="M57 103H63L66 143L60 151L54 143Z" {...paint("adductors")}>{title("adductors")}</path>
      <path d="M47 153L58 154L56 207L47 207Z" {...paint("calves")}>{title("calves")}</path><path d="M73 153L62 154L64 207L73 207Z" {...paint("calves")}>{title("calves")}</path>
    </svg></div>
    <div><div style={{fontSize:9,color:"#666",textAlign:"center",marginBottom:3}}>BACK</div><svg onClick={choose} viewBox="0 0 120 220" style={{width:"100%",height:250}} aria-label="Back muscle heatmap">
      <circle cx="60" cy="18" r="12" fill="#171824" stroke="#303247"/><rect x="54" y="30" width="12" height="9" rx="3" fill="#171824"/>
      <path d="M48 40Q60 35 72 40L68 53H52Z" {...paint("traps")}>{title("traps")}</path><path d="M40 43Q29 45 27 59L43 55Z" {...paint("rearDelts")}>{title("rearDelts")}</path><path d="M80 43Q91 45 93 59L77 55Z" {...paint("rearDelts")}>{title("rearDelts")}</path>
      <path d="M46 51Q60 46 74 51L71 70Q60 75 49 70Z" {...paint("midBack")}>{title("midBack")}</path><path d="M43 55L51 53L54 78L45 88Q39 70 43 55Z" {...paint("lats")}>{title("lats")}</path><path d="M77 55L69 53L66 78L75 88Q81 70 77 55Z" {...paint("lats")}>{title("lats")}</path>
      <path d="M27 59Q21 71 24 84L34 80L36 59Z" {...paint("triceps")}>{title("triceps")}</path><path d="M93 59Q99 71 96 84L86 80L84 59Z" {...paint("triceps")}>{title("triceps")}</path>
      <path d="M23 84Q19 101 23 116L31 112L31 81Z" {...paint("forearms")}>{title("forearms")}</path><path d="M97 84Q101 101 97 116L89 112L89 81Z" {...paint("forearms")}>{title("forearms")}</path>
      <path d="M50 73Q60 70 70 73L69 99Q60 103 51 99Z" {...paint("lowerBack")}>{title("lowerBack")}</path><path d="M47 101Q60 96 73 101L70 119Q60 125 50 119Z" {...paint("glutes")}>{title("glutes")}</path>
      <path d="M47 121Q52 117 59 121L57 153L47 151Z" {...paint("hamstrings")}>{title("hamstrings")}</path><path d="M73 121Q68 117 61 121L63 153L73 151Z" {...paint("hamstrings")}>{title("hamstrings")}</path>
      <path d="M47 154L58 155L56 207L47 207Z" {...paint("calves")}>{title("calves")}</path><path d="M73 154L62 155L64 207L73 207Z" {...paint("calves")}>{title("calves")}</path>
    </svg></div>
  </div>;
}
