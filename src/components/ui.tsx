import {type ReactNode,useRef} from "react";

type IconName="search"|"filter"|"add"|"recipes"|"untried"|"tried"|"categories"|"tools"|"settings"|"upload"|"camera"|"more"|"drag";
export function Icon({name}:{name:IconName}){
  const paths:Record<IconName,ReactNode>={
    search:<><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    filter:<><path d="M4 6h16M7 12h10M10 18h4"/></>,
    add:<><path d="M12 5v14M5 12h14"/></>,
    recipes:<><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 4.5v17M9 7h7M9 11h7"/></>,
    untried:<circle cx="12" cy="12" r="8"/>,
    tried:<path d="m5 12 4.5 4.5L19 7"/>,
    categories:<><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    tools:<><path d="M7 3v7M4.5 3v4.5A2.5 2.5 0 0 0 7 10v11M9.5 3v4.5A2.5 2.5 0 0 1 7 10"/><path d="M17 3c-2 2.4-2.2 6.2-.5 8.5L15.5 21M17 3c2.8 2.6 3.1 6.4.5 8.5L18.5 21"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.5 1a8 8 0 0 0-1.8-1L14.2 3h-4.4l-.4 3a8 8 0 0 0-1.8 1L5.1 6 3 9.4 5.1 11a7 7 0 0 0 0 2L3 14.6 5.1 18l2.5-1a8 8 0 0 0 1.8 1l.4 3h4.4l.4-3a8 8 0 0 0 1.8-1l2.5 1 2.1-3.4-2.1-1.6a7 7 0 0 0 .1-1z"/></>,
    upload:<><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v5h14v-5"/></>,
    camera:<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 7 1.5-3h5L16 7"/><circle cx="12" cy="13" r="3"/></>,
    more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    drag:<><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></>
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function PageHeader({title,actions}:{title?:string;actions?:ReactNode}){
  return <header className="page-header"><div><h1>PourRecipe</h1>{title&&<span className="page-context">{title}</span>}</div>{actions&&<div className="header-actions">{actions}</div>}</header>;
}

export function IconButton({label,children,onClick,primary=false}:{label:string;children:ReactNode;onClick:()=>void;primary?:boolean}){
  const lastTap = useRef(0);
  const fire = () => {
    const now = Date.now();
    if(now - lastTap.current < 280) return;
    lastTap.current = now;
    onClick();
  };
  return <button
    type="button"
    className={`icon-button${primary?" primary":""}`}
    aria-label={label}
    title={label}
    onTouchStart={()=>fire()}
    onPointerUp={()=>fire()}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick()}}}
    onClick={fire}
  >{children}</button>;
}

export function SegmentedControl<T extends string>({value,items,onChange,label}:{value:T;items:readonly {value:T;label:string}[];onChange:(value:T)=>void;label:string}){
  return <div className="segmented" role="tablist" aria-label={label}>{items.map(item=><button type="button" role="tab" aria-selected={value===item.value} key={item.value} onClick={()=>onChange(item.value)}>{item.label}</button>)}</div>;
}

export function BottomNavigation<T extends string>({value,items,onChange}:{value:T;items:readonly {value:T;label:string;icon:ReactNode;href?:string}[];onChange:(value:T)=>void}){
  return <nav className="bottom-nav" aria-label="主要导航">{items.map(item=>{
    const href=item.href ?? `#/${item.value==="all"?"":item.value as string}`;
    return <a href={href} key={item.value} aria-current={value===item.value?"page":undefined} onClick={e=>{e.preventDefault();onChange(item.value as T);}}><span aria-hidden="true">{item.icon}</span>{item.label}</a>;
  })}</nav>;
}
