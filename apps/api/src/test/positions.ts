export function normalizePosition(pos:number){return Number.isFinite(pos)?Math.max(1,Math.floor(pos)):1000}
export function midpoint(prev?:number,next?:number){if(prev===undefined&&next===undefined)return 1000;if(prev===undefined)return next!-1000;if(next===undefined)return prev+1000;return (prev+next)/2}
export function needsReindex(prev:number,next:number){return next-prev<1}
export function reindex<T extends {position:number}>(items:T[]){return items.map((x,i)=>({...x,position:(i+1)*1000}))}
