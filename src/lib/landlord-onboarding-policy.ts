export function bootstrapOwnerAllowed(input:{enabled:boolean;active:boolean;product:string|null;role:string;users:number}) {
 return input.enabled && input.active && input.product==='STUDENTSHOSTELS' && input.role==='OWNER' && input.users===0;
}
export function publicationProblems(p:{name:string;physicalAddress:string|null;phone:string|null;publicDescription:string|null;customDomain:string|null},roomCount:number){
 const errors:string[]=[];
 if(p.name.trim().length<3)errors.push('Add the property name.');
 if(!p.physicalAddress?.trim())errors.push('Add the property location.');
 if(!p.phone || !/^\+?[0-9][0-9 ()-]{8,19}$/.test(p.phone))errors.push('Add a valid public phone number.');
 if(!p.publicDescription?.trim())errors.push('Add an advertising description.');
 if(!p.customDomain || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.studentshostels\.com$/.test(p.customDomain))errors.push('A StudentsHostels website address must be assigned.');
 if(roomCount<1)errors.push('Add at least one active room with positive rent and capacity.');
 return errors;
}
