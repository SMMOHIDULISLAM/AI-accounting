import { describe,it,expect } from "vitest";
import { applyOperation, emptyOperations, marketShareBasisPoints, quantityFromText, validateOperations, type OperationCommand, type Operations } from "../src/lib/operations";
import { Ledger } from "../src/lib/db";
import { saveOperationalDraft } from "../src/lib/operations-posting";

const date="2026-11-27";
function fixture(){
 let state=emptyOperations();let sequence=0;
 const perform=(input:Record<string,unknown>)=>{const command={date,id:"test-"+(++sequence),...input} as OperationCommand;state=applyOperation(state,command);return command.id};
 const supplierId=perform({type:"contact",name:"Synthetic supplier",kind:"supplier"});
 const customerId=perform({type:"contact",name:"Synthetic customer",kind:"customer"});
 const raw=perform({type:"item",sku:"RAW",name:"Raw material",kind:"raw",unit:"kg",reorder:10000});
 const finished=perform({type:"item",sku:"FG",name:"Finished goods",kind:"finished",unit:"piece",reorder:0});
 const centreId=perform({type:"centre",name:"Synthetic line",minutesPerDay:480});
 perform({type:"bom",itemId:finished,components:[{itemId:raw,quantity:2000}]});
 const purchase=perform({type:"purchase",supplierId,itemId:raw,quantity:10000,total:100000});
 perform({type:"approve-purchase",entityId:purchase});perform({type:"receive-purchase",entityId:purchase});
 return {perform,state:()=>state,raw,finished,centreId,customerId,supplierId,purchase};
}
describe("manufacturing and SME operational controls",()=>{
 it("carries exact cost from raw stock through WIP, finished goods, transit and delivery",()=>{
  const f=fixture();const p=f.perform({type:"production",itemId:f.finished,quantity:3000,centreId:f.centreId,minutes:120});
  f.perform({type:"start-production",entityId:p});
  expect(f.state().stock.find(s=>s.itemId===f.raw&&s.location==="warehouse")).toMatchObject({quantity:4000,value:40000});
  expect(f.state().stock.find(s=>s.location==="wip")).toMatchObject({quantity:3000,value:60000});
  f.perform({type:"finish-production",entityId:p});
  const sale=f.perform({type:"sale",itemId:f.finished,customerId:f.customerId,quantity:2000,total:90000});
  f.perform({type:"approve-sale",entityId:sale});f.perform({type:"dispatch-sale",entityId:sale});
  expect(f.state().stock.find(s=>s.location==="transit")).toMatchObject({quantity:2000,value:40000});
  f.perform({type:"deliver-sale",entityId:sale});
  expect(f.state().stock.find(s=>s.location==="finished")).toMatchObject({quantity:1000,value:20000});
  expect(f.state().stock.reduce((n,s)=>n+s.value,0)).toBe(60000);
  expect(f.state().proposals.at(-1)?.lines).toEqual([{head:"ar",debit:90000,credit:0},{head:"sales",debit:0,credit:90000},{head:"cogs",debit:40000,credit:0},{head:"inventory",debit:0,credit:40000}]);
 });
 it("rejects shortages and capacity excess without altering the original state",()=>{
  const f=fixture();const p=f.perform({type:"production",itemId:f.finished,quantity:6000,centreId:f.centreId,minutes:120});
  const before=structuredClone(f.state());expect(()=>f.perform({type:"start-production",entityId:p})).toThrow("Insufficient stock");expect(f.state()).toEqual(before);
  const tooLong=f.perform({type:"production",itemId:f.finished,quantity:1000,centreId:f.centreId,minutes:481});expect(()=>f.perform({type:"start-production",entityId:tooLong})).toThrow("capacity");
 });
 it("prevents duplicate full receipts and rejects changed content for a replayed command",()=>{
  const f=fixture();expect(()=>f.perform({type:"receive-purchase",entityId:f.purchase})).toThrow("Approve the purchase");
  const command={id:"repeat",date,type:"contact" as const,name:"Repeat",kind:"customer" as const};
  const once=applyOperation(f.state(),command);expect(applyOperation(once,command)).toBe(once);
  expect(()=>applyOperation(once,{...command,name:"Changed"})).toThrow("different content");
 });
 it("handles service completion without a physical stock movement",()=>{
  const f=fixture();const item=f.perform({type:"item",sku:"SVC",name:"Consulting",kind:"service",unit:"hour",reorder:0});
  const sale=f.perform({type:"sale",itemId:item,customerId:f.customerId,quantity:1000,total:50000});f.perform({type:"approve-sale",entityId:sale});f.perform({type:"deliver-sale",entityId:sale});
  expect(f.state().stock.some(s=>s.itemId===item)).toBe(false);expect(f.state().proposals.at(-1)?.lines).toHaveLength(2);
 });
 it("calculates payroll accrual exactly, prevents duplicate periods and does not pay employees",()=>{
  const f=fixture();const e=f.perform({type:"employee",name:"Synthetic employee",role:"Operator",monthlySalary:3000000});
  const p=f.perform({type:"payroll",employeeId:e,period:"2026-11",scheduledDays:30,paidDays:29,allowances:100000,deductions:50000});
  expect(f.state().payroll[0]).toMatchObject({gross:3000000,net:2950000,status:"draft"});
  f.perform({type:"approve-payroll",entityId:p});expect(f.state().proposals.at(-1)?.lines).toEqual([{head:"wages",debit:3000000,credit:0},{head:"payroll-payable",debit:0,credit:2950000},{head:"deductions",debit:0,credit:50000}]);
  expect(()=>f.perform({type:"payroll",employeeId:e,period:"2026-11",scheduledDays:30,paidDays:30,allowances:0,deductions:0})).toThrow("already exists");
 });
 it("accepts Bangla quantities, rejects excess precision and does not invent market data",()=>{
  expect(quantityFromText("১.২৫০")).toBe(1250);expect(()=>quantityFromText("1.0001")).toThrow("three decimal");
  expect(marketShareBasisPoints(25000,100000)).toBe(2500);expect(()=>marketShareBasisPoints(100001,100000)).toThrow("Market total");
 });
 it("rejects corrupt operational balances",()=>{
  const f=fixture();const bad=structuredClone(f.state());bad.stock[0].value=-1;expect(()=>validateOperations(bad)).toThrow();
 });
 it("creates retry-safe ledger drafts while requiring a currency match and separate posting",async()=>{
  const f=fixture();const ledger=await Ledger.open();
  try{
   const proposal=f.state().proposals[0];await expect(saveOperationalDraft(ledger,proposal,"USD")).rejects.toThrow("currencies");
   const id=await saveOperationalDraft(ledger,proposal,"BDT");expect(ledger.snapshot().journals.find(j=>j.id===id)?.status).toBe("draft");
   await ledger.post(id);const count=ledger.snapshot().journals.length;expect(await saveOperationalDraft(ledger,proposal,"BDT")).toBe(id);expect(ledger.snapshot().journals).toHaveLength(count);
   await expect(saveOperationalDraft(ledger,{...proposal,description:"Changed"},"BDT")).rejects.toThrow("content changed");
  }finally{await ledger.release()}
 });
});
