import { getPayload } from 'payload'
import config from '@payload-config'
const payload = await getPayload({ config })
const slugs = ['open-government','human-services','emergency-management','collaborative-economy']
const txt = (n:any)=>(n.children||[]).map((c:any)=>c.text||'').join('').trim()
const isSectionHeading = (n:any)=>/heading/.test(n.type) && /^(recent work|perspectives)$/i.test(txt(n))
const isFiller = (n:any)=> n.type==='horizontalrule' || (n.type==='paragraph' && !(n.children||[]).some((c:any)=>(c.text||'').trim()))
const trimFiller = (a:any[])=>{let s=0,e=a.length; while(s<e&&isFiller(a[s]))s++; while(e>s&&isFiller(a[e-1]))e--; return a.slice(s,e)}
for (const slug of slugs){
  const res = await payload.find({collection:'pages',where:{slug:{equals:slug}},depth:0,limit:1})
  const page:any = res.docs[0]; if(!page){console.warn('missing',slug);continue}
  let changed=false
  const layout=(page.layout||[]).map((b:any)=>{
    if(b.blockType!=='content') return b
    const cols=(b.columns||[]).map((col:any)=>{
      const kids=col.richText?.root?.children||[]
      const filtered=trimFiller(kids.filter((n:any)=>!isSectionHeading(n)))
      if(filtered.length!==kids.length) changed=true
      return {...col, richText:{root:{...col.richText.root, children:filtered}}}
    }).filter((col:any)=>(col.richText?.root?.children||[]).length>0)
    return {...b, columns:cols}
  }).filter((b:any)=> b.blockType!=='content' || (b.columns||[]).length>0)
  if(changed){
    await payload.update({collection:'pages',id:page.id,data:{layout,_status:'published'} as any,context:{disableRevalidate:true}})
    console.log(`${slug}: cleaned dangling section heading(s)`)
  } else console.log(`${slug}: clean (no change)`)
}
