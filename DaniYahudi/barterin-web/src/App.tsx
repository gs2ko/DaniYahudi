import { useEffect, useState, FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, configured } from './supabase'

type Offer = { id: string; owner: string | null; title: string; description: string; category: string; city: string; price_idr: number; wants: string; images: string[]; status: string; is_sample: boolean }
type Trade = { id: string; offer_id: string; proposer: string; owner: string; cash_idr: number; note: string; status: string; offers: { title: string } | null; trade_items: { side: string; offers: { title: string } | null }[] }
type Msg = { id: string; sender: string; body: string }
type Say = (m: string) => void
type V = 'browse' | 'offer' | 'new' | 'mine' | 'trades' | 'auth'

const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<{ v: V; id?: string }>({ v: 'browse' })
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  const go = (v: V, id?: string) => { setView({ v, id }); window.scrollTo(0, 0) }
  const say: Say = (m) => { setToast(m); setTimeout(() => setToast(''), 3500) }
  const me = session?.user.id
  const need = (v: V) => (me ? go(v) : go('auth'))
  return (
    <>
      <header className="bar">
        <a className="brand" onClick={() => go('browse')}><img src="/logo/barterin-logo.svg" alt="Barterin, baterin aja" /></a>
        <nav>
          <button onClick={() => need('mine')}>My offers</button>
          <button onClick={() => need('trades')}>Trades</button>
          {me ? <button onClick={() => supabase.auth.signOut().then(() => go('browse'))}>Log out</button> : <button onClick={() => go('auth')}>Log in</button>}
        </nav>
      </header>
      {!configured && <div className="banner">Backend not configured. Copy .env.example to .env and add your Supabase URL and anon key (see README).</div>}
      <main>
        {view.v === 'browse' && <Browse open={(id) => go('offer', id)} />}
        {view.v === 'offer' && <OfferPage id={view.id!} me={me} say={say} done={() => go('trades')} login={() => go('auth')} />}
        {view.v === 'new' && me && <NewOffer me={me} say={say} done={() => go('mine')} />}
        {view.v === 'mine' && me && <Mine me={me} open={(id) => go('offer', id)} add={() => go('new')} say={say} />}
        {view.v === 'trades' && me && <Trades me={me} say={say} />}
        {view.v === 'auth' && <Auth say={say} done={() => go('browse')} />}
      </main>
      <button className="fab" title="New offer" onClick={() => need('new')}>+</button>
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

function Card({ o, open }: { o: Offer; open: (id: string) => void }) {
  return (
    <article className="card" onClick={() => open(o.id)}>
      <img src={o.images[0] || '/empty-offers.png'} alt={o.title} />
      <div className="pad">
        <h3>{o.title}</h3>
        <p className="price">{rp(o.price_idr)}</p>
        <p className="meta">{o.city}{o.is_sample && <span className="chip">Sample</span>}</p>
        {o.wants && <p className="meta">Wants: {o.wants}</p>}
      </div>
    </article>
  )
}

function Browse({ open }: { open: (id: string) => void }) {
  const [rows, setRows] = useState<Offer[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    if (!configured) { setRows([]); return }
    supabase.from('offers').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => (error ? setErr(error.message) : setRows(data as Offer[])))
  }, [])
  const list = (rows || []).filter((o) => (o.title + o.city + o.category + o.wants).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <section className="hero">
        <div>
          <h1>baterin aja</h1>
          <p>Trade what you have for what you need: items, cash, or both.</p>
          <input className="search" placeholder="Search items, cities, categories" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <img src="/barterin-hero.png" alt="" />
      </section>
      {err && <p className="error">{err}</p>}
      {!rows && !err && <p className="muted">Loading offers…</p>}
      {rows && !err && !list.length && <div className="empty"><img src="/empty-offers.png" alt="" /><p>No offers match yet. Post the first one with the + button.</p></div>}
      <div className="grid">{list.map((o) => <Card key={o.id} o={o} open={open} />)}</div>
    </>
  )
}

function OfferPage({ id, me, say, done, login }: { id: string; me?: string; say: Say; done: () => void; login: () => void }) {
  const [o, setO] = useState<Offer | null>(null)
  const [mine, setMine] = useState<Offer[]>([])
  const [pick, setPick] = useState<string[]>([])
  const [cash, setCash] = useState(0)
  const [dir, setDir] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { supabase.from('offers').select('*').eq('id', id).single().then(({ data }) => setO(data as Offer)) }, [id])
  useEffect(() => { if (me) supabase.from('offers').select('*').eq('owner', me).eq('status', 'open').then(({ data }) => setMine((data as Offer[]) || [])) }, [me])
  if (!o) return <p className="muted">Loading…</p>
  const target = o
  const canPropose = !!me && !!target.owner && target.owner !== me && !target.is_sample && target.status === 'open'
  async function send(e: FormEvent) {
    e.preventDefault()
    if (!pick.length && !cash) return say('Pick at least one item or add cash.')
    setBusy(true)
    const { data: t, error } = await supabase.from('trades').insert({ offer_id: target.id, proposer: me, owner: target.owner, cash_idr: cash * dir, note }).select('id').single()
    if (error || !t) { setBusy(false); return say(error?.message || 'Could not send the proposal.') }
    const items = [{ trade_id: t.id, offer_id: target.id, side: 'owner' }, ...pick.map((p) => ({ trade_id: t.id, offer_id: p, side: 'proposer' }))]
    const r = await supabase.from('trade_items').insert(items)
    setBusy(false)
    if (r.error) return say(r.error.message)
    say('Proposal sent.'); done()
  }
  return (
    <div className="detail">
      <div className="gallery">{(target.images.length ? target.images : ['/empty-offers.png']).map((s) => <img key={s} src={s} alt={target.title} />)}</div>
      <div>
        <h1>{target.title}</h1>
        <p className="price">{rp(target.price_idr)}</p>
        <p className="meta">{target.city} · {target.category}{target.is_sample && <span className="chip">Sample listing</span>}</p>
        <p>{target.description}</p>
        {target.wants && <p><b>Wants:</b> {target.wants}</p>}
        {target.is_sample && <p className="muted">Sample listings are for demonstration and can't receive proposals.</p>}
        {!me && <button className="btn" onClick={login}>Log in to propose a trade</button>}
        {me && target.owner === me && <p className="muted">This is your offer.</p>}
        {canPropose && (
          <form onSubmit={send} className="form">
            <h2>Propose a trade</h2>
            {mine.length ? (
              <fieldset><legend>Your items to offer</legend>
                {mine.map((m) => (
                  <label key={m.id} className="check"><input type="checkbox" checked={pick.includes(m.id)} onChange={(e) => setPick(e.target.checked ? [...pick, m.id] : pick.filter((x) => x !== m.id))} />{m.title} · {rp(m.price_idr)}</label>
                ))}
              </fieldset>
            ) : <p className="muted">You have no open offers yet, but you can still propose cash.</p>}
            <label>Cash (Rp)<input type="number" min={0} value={cash} onChange={(e) => setCash(Math.max(0, Number(e.target.value)))} /></label>
            <label>Cash direction<select value={dir} onChange={(e) => setDir(Number(e.target.value))}><option value={1}>I add cash</option><option value={-1}>I ask for cash</option></select></label>
            <label>Message<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send proposal'}</button>
          </form>
        )}
      </div>
    </div>
  )
}

function NewOffer({ me, say, done }: { me: string; say: Say; done: () => void }) {
  const [f, setF] = useState({ title: '', description: '', category: 'Elektronik', city: '', price: 0, wants: '' })
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string | number) => setF({ ...f, [k]: v })
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    const urls: string[] = []
    for (const [i, file] of files.slice(0, 5).entries()) {
      const path = `${me}/${Date.now()}-${i}-${file.name.replace(/[^\w.-]/g, '_')}`
      const up = await supabase.storage.from('offer-images').upload(path, file)
      if (up.error) { setBusy(false); return say('Image upload failed: ' + up.error.message) }
      urls.push(supabase.storage.from('offer-images').getPublicUrl(path).data.publicUrl)
    }
    const { error } = await supabase.from('offers').insert({ owner: me, title: f.title, description: f.description, category: f.category, city: f.city, price_idr: f.price, wants: f.wants, images: urls })
    setBusy(false)
    if (error) return say(error.message)
    say('Offer published.'); done()
  }
  return (
    <form className="form" onSubmit={save}>
      <h1>New offer</h1>
      <label>Title<input required value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
      <label>Category<select value={f.category} onChange={(e) => set('category', e.target.value)}>{['Elektronik', 'Fashion', 'Rumah', 'Hobi', 'Otomotif', 'Lainnya'].map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>City<input required value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Surabaya" /></label>
      <label>Estimated value (Rp)<input type="number" min={0} value={f.price} onChange={(e) => set('price', Number(e.target.value))} /></label>
      <label>What you want in return<input value={f.wants} onChange={(e) => set('wants', e.target.value)} /></label>
      <label>Description<textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      <label>Photos (up to 5)<input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></label>
      <button className="btn" disabled={busy}>{busy ? 'Publishing…' : 'Publish offer'}</button>
    </form>
  )
}

function Mine({ me, open, add, say }: { me: string; open: (id: string) => void; add: () => void; say: Say }) {
  const [rows, setRows] = useState<Offer[] | null>(null)
  const load = () => supabase.from('offers').select('*').eq('owner', me).neq('status', 'removed').order('created_at', { ascending: false }).then(({ data }) => setRows((data as Offer[]) || []))
  useEffect(() => { load() }, [])
  async function remove(id: string) {
    const { error } = await supabase.from('offers').update({ status: 'removed' }).eq('id', id)
    if (error) return say(error.message)
    say('Offer removed.'); load()
  }
  return (
    <>
      <div className="row"><h1>My offers</h1><button className="btn" onClick={add}>New offer</button></div>
      <p className="muted">Everyone browsing Barterin can see these.</p>
      {rows && !rows.length && <div className="empty"><img src="/empty-offers.png" alt="" /><p>You haven't posted anything yet.</p></div>}
      <div className="grid">{(rows || []).map((o) => <div key={o.id}><Card o={o} open={open} /><button className="link" onClick={() => remove(o.id)}>Remove</button></div>)}</div>
    </>
  )
}

function Trades({ me, say }: { me: string; say: Say }) {
  const [rows, setRows] = useState<Trade[] | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const load = () => supabase.from('trades').select('*, offers(title), trade_items(side, offers(title))').order('created_at', { ascending: false })
    .then(({ data, error }) => (error ? say(error.message) : setRows(data as unknown as Trade[])))
  useEffect(() => { load() }, [])
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from('trades').update({ status }).eq('id', id)
    if (error) return say(error.message)
    say('Trade ' + status + '.'); load()
  }
  return (
    <>
      <h1>Trades</h1>
      {rows && !rows.length && <div className="empty"><img src="/empty-matches.svg" alt="" /><p>No trades yet. Open a listing and propose one.</p></div>}
      {(rows || []).map((t) => {
        const you = t.proposer === me
        const titles = (side: string) => t.trade_items.filter((i) => i.side === side).map((i) => i.offers?.title || 'Item').join(', ') || 'no items'
        return (
          <section key={t.id} className="trade">
            <div className="row"><b>{t.offers?.title}</b><span className={'chip ' + t.status}>{t.status}</span></div>
            <p>{you ? 'You give' : 'They give'}: {titles('proposer')}{t.cash_idr > 0 ? ` + ${rp(t.cash_idr)}` : ''}</p>
            <p>{you ? 'They give' : 'You give'}: {titles('owner')}{t.cash_idr < 0 ? ` + ${rp(-t.cash_idr)}` : ''}</p>
            {t.note && <p className="muted">“{t.note}”</p>}
            <div className="row">
              {t.status === 'pending' && !you && <><button className="btn" onClick={() => setStatus(t.id, 'accepted')}>Accept</button><button className="btn ghost" onClick={() => setStatus(t.id, 'declined')}>Decline</button></>}
              {t.status === 'pending' && you && <button className="btn ghost" onClick={() => setStatus(t.id, 'cancelled')}>Cancel</button>}
              {t.status === 'accepted' && <button className="btn" onClick={() => setStatus(t.id, 'completed')}>Mark completed</button>}
              <button className="btn ghost" onClick={() => setSel(sel === t.id ? null : t.id)}>{sel === t.id ? 'Hide chat' : 'Chat'}</button>
            </div>
            {sel === t.id && <Chat tradeId={t.id} me={me} say={say} />}
          </section>
        )
      })}
    </>
  )
}

function Chat({ tradeId, me, say }: { tradeId: string; me: string; say: Say }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const add = (m: Msg) => setMsgs((all) => (all.some((x) => x.id === m.id) ? all : [...all, m]))
  useEffect(() => {
    supabase.from('messages').select('id, sender, body').eq('trade_id', tradeId).order('created_at').then(({ data }) => setMsgs((data as Msg[]) || []))
    const ch = supabase.channel('trade-' + tradeId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `trade_id=eq.${tradeId}` }, (p) => add(p.new as Msg))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tradeId])
  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const { data, error } = await supabase.from('messages').insert({ trade_id: tradeId, sender: me, body: text.trim() }).select('id, sender, body').single()
    if (error || !data) return say(error?.message || 'Message not sent.')
    add(data as Msg); setText('')
  }
  return (
    <div className="chat">
      {!msgs.length && <p className="muted">No messages yet. Say hello and agree on a meetup.</p>}
      {msgs.map((m) => <div key={m.id} className={'bubble' + (m.sender === me ? ' me' : '')}>{m.body}</div>)}
      <form onSubmit={send}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" /><button className="btn">Send</button></form>
    </div>
  )
}

function Auth({ say, done }: { say: Say; done: () => void }) {
  const [signup, setSignup] = useState(false)
  const [f, setF] = useState({ email: '', password: '', name: '', city: '' })
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!configured) return say('Backend not configured yet. See the README.')
    setBusy(true)
    const r = signup
      ? await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { name: f.name, city: f.city } } })
      : await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
    setBusy(false)
    if (r.error) return say(r.error.message)
    if (signup && !r.data.session) return say('Check your email to confirm your account, then log in.')
    done()
  }
  return (
    <form className="form" onSubmit={submit}>
      <h1>{signup ? 'Create your account' : 'Log in'}</h1>
      {signup && <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>}
      {signup && <label>City<input required value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>}
      <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label>Password<input type="password" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
      <button className="btn" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Sign up' : 'Log in'}</button>
      <button type="button" className="link" onClick={() => setSignup(!signup)}>{signup ? 'I already have an account' : 'Create an account'}</button>
    </form>
  )
}
