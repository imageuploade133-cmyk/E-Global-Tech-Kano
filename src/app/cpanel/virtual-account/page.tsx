"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type User = { uid:string; name:string; email:string; phoneNumber:string; kycStatus:string; kycDocumentType?:string|null; bvn?:string|null; nin?:string|null };
type Details = User & { account:any; history:any[] };

export default function VirtualAccountPage() {
  const [query,setQuery]=useState("");
  const [users,setUsers]=useState<User[]>([]);
  const [selected,setSelected]=useState<Details|null>(null);
  const [loading,setLoading]=useState(false);
  const [replacing,setReplacing]=useState(false);
  const [confirm,setConfirm]=useState("");
  const [showConfirm,setShowConfirm]=useState(false);

  async function search() {
    const q=query.trim();
    if(q.length<2){ toast.error("Enter at least 2 characters."); return; }
    setLoading(true);
    try {
      const r=await fetch(`/api/admin/virtual-accounts/search?q=${encodeURIComponent(q)}`,{cache:"no-store"});
      const d=await r.json();
      if(!r.ok) throw new Error(d.message||"Search failed.");
      setUsers(d.users||[]);
      setSelected(null);
    } catch(e:any){ toast.error(e.message||"Search failed."); }
    finally{setLoading(false);}
  }

  async function load(uid:string) {
    setLoading(true);
    try {
      const r=await fetch(`/api/admin/virtual-accounts/${encodeURIComponent(uid)}`,{cache:"no-store"});
      const d=await r.json();
      if(!r.ok) throw new Error(d.message||"Unable to load user.");
      setSelected(d.data);
      setUsers([]);
    } catch(e:any){toast.error(e.message||"Unable to load user.");}
    finally{setLoading(false);}
  }

  async function replaceAccount() {
    if(confirm!=="GENERATE" || !selected) return;
    setReplacing(true);
    try {
      const r=await fetch(`/api/admin/virtual-accounts/${encodeURIComponent(selected.uid)}`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmation:"GENERATE"})
      });
      const d=await r.json();
      if(!r.ok || !d.success) throw new Error(d.message||"Replacement failed.");
      toast.success("New virtual account generated successfully.");
      setShowConfirm(false); setConfirm("");
      await load(selected.uid);
    } catch(e:any){toast.error(e.message||"Replacement failed.");}
    finally{setReplacing(false);}
  }

  useEffect(()=>{ if(query.trim()==="") setUsers([]); },[query]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-black">Virtual Account</h1>
        <p className="text-sm text-gray-500 mt-1">Search a verified customer, inspect their current funding account, and securely replace it when required.</p>
      </div>

      <div className="rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}
            placeholder="Search BVN, NIN, email, phone, name or UID"
            className="flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-950 dark:border-gray-700"/>
          <button onClick={search} disabled={loading}
            className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-black text-white disabled:opacity-50">
            {loading?"Searching...":"Search User"}
          </button>
        </div>
      </div>

      {users.length>0 && (
        <div className="rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          {users.map(u=>(
            <button key={u.uid} onClick={()=>load(u.uid)} className="w-full text-left p-4 border-b last:border-b-0 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <div className="font-bold">{u.name}</div>
              <div className="text-xs text-gray-500 mt-1">{u.email} · {u.phoneNumber}</div>
              <div className="text-xs mt-2">KYC: <b>{u.kycStatus}</b> · {u.kycDocumentType?.toUpperCase()||"N/A"}</div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-5 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-black">{selected.name}</h2><p className="text-xs text-gray-500">{selected.uid}</p></div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">{selected.kycStatus}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Email</span><div className="font-semibold">{selected.email||"—"}</div></div>
              <div><span className="text-gray-500">Phone</span><div className="font-semibold">{selected.phoneNumber||"—"}</div></div>
              <div><span className="text-gray-500">BVN</span><div className="font-semibold">{selected.bvn||"Not available"}</div></div>
              <div><span className="text-gray-500">NIN</span><div className="font-semibold">{selected.nin||"Not available"}</div></div>
            </div>

            <div className="rounded-2xl border p-5 dark:border-gray-700">
              <div className="flex justify-between gap-4">
                <div><p className="text-xs uppercase font-black text-gray-400">Current Virtual Account</p>
                  {selected.account ? <><p className="text-xl font-black mt-2">{selected.account.accountNumber}</p><p className="font-semibold">{selected.account.accountName}</p><p className="text-sm text-gray-500">{selected.account.bankName} · {selected.account.currency}</p></> :
                  <p className="mt-2 text-gray-500">No active account found.</p>}
                </div>
                {selected.account?.status==="active" && <span className="text-xs font-black text-green-600">ACTIVE</span>}
              </div>
              {selected.account && <button onClick={()=>setShowConfirm(true)} className="mt-5 rounded-xl bg-black px-5 py-3 text-sm font-black text-white hover:bg-orange-500">
                Generate New Account
              </button>}
            </div>

            <div>
              <h3 className="font-black mb-3">Account History</h3>
              <div className="space-y-2">{selected.history?.length ? selected.history.map(h=><div key={h.id} className="rounded-xl border p-3 dark:border-gray-700 text-sm flex justify-between"><span>{h.bankName} · {h.accountNumber}</span><b>{h.status}</b></div>) : <p className="text-sm text-gray-500">No previous account records.</p>}</div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-5 h-fit">
            <h3 className="font-black">Security</h3>
            <ul className="mt-3 text-sm text-gray-500 space-y-2">
              <li>• Existing verified NIN/BVN is reused server-side.</li>
              <li>• Browser cannot supply replacement identity data.</li>
              <li>• Replacement requires the management permission.</li>
              <li>• Concurrent replacement is locked.</li>
              <li>• Wallet balance and transactions are not modified.</li>
              <li>• Previous account remains in audit history.</li>
            </ul>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6">
            <h2 className="text-xl font-black">Generate New Virtual Account?</h2>
            <p className="text-sm text-gray-500 mt-2">The current account will be deactivated and the new account will become active. The user's existing verified NIN/BVN will be reused. Wallet balance will not change.</p>
            <input value={confirm} onChange={e=>setConfirm(e.target.value.toUpperCase())} placeholder="Type GENERATE"
              className="mt-5 w-full rounded-xl border px-4 py-3 dark:bg-gray-950 dark:border-gray-700"/>
            <div className="flex gap-3 mt-4">
              <button onClick={()=>{setShowConfirm(false);setConfirm("")}} disabled={replacing} className="flex-1 rounded-xl border px-4 py-3 font-bold">Cancel</button>
              <button onClick={replaceAccount} disabled={confirm!=="GENERATE"||replacing} className="flex-1 rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-40">{replacing?"Generating...":"Generate"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
