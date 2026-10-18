import {apiFetch} from "./_client";
export interface TestAccount{uid:string;displayName:string;status:string;createdAt:string}
export interface TestAccountList{accounts:TestAccount[];total:number;page:number}
export const TestAccountsApi={
 list:(page=0)=>apiFetch<TestAccountList>("/admin/test-accounts",{query:{page}}),
 create:(displayName:string)=>apiFetch<TestAccount>("/admin/test-accounts",{method:"POST",body:{displayName}}),
 login:(uid:string)=>apiFetch<{loginUrl:string;expiresAt:string}>(`/admin/test-accounts/${encodeURIComponent(uid)}/login`,{method:"POST"}),
 suspend:(uid:string)=>apiFetch(`/admin/test-accounts/${encodeURIComponent(uid)}/suspend`,{method:"POST"}),
};
