export const isOwner=(role?:string|null)=>role==="owner";
export const isAdmin=(role?:string|null)=>role==="admin"||role==="owner";
