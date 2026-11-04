import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createOrder, getCatalog, type CatalogPromotion } from './supabase'

type View = 'home' | 'story' | 'burgers' | 'more' | 'promos' | 'customize' | 'cart' | 'checkout' | 'confirmed' | 'contact'
type Product = { id: number; name: string; description: string; price: number; category: string; imageUrl: string | null; imageAlt: string }
type CartItem = Product & { qty: number; options?: string[]; unitPrice: number }
type Confirmation = { number: string; deliveryMethod: string; itemCount: number; items: CartItem[] }

const burgerPhotos = [
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1607013251379-e6eecfffe234?auto=format&fit=crop&w=900&q=85',
]

const productContent: Record<string, { description: string; alt: string }> = {
  'La Urbana': { description: 'Carne smash, queso fundido, vegetales frescos y salsa de la casa.', alt: 'Hamburguesa La Urbana con carne, queso, lechuga y tomate' },
  'Doble Fuego': { description: 'Doble carne, queso y salsa picante para quienes buscan más intensidad.', alt: 'Hamburguesa Doble Fuego con dos carnes y queso fundido' },
  'Papas Bravas': { description: 'Papas doradas y crujientes servidas con nuestra salsa brava.', alt: 'Porción de papas bravas con salsa' },
  'Alitas 8 piezas': { description: 'Ocho alitas jugosas, doradas y bañadas en salsa de la casa.', alt: 'Ocho alitas doradas con salsa de la casa' },
  'Combo Clásico': { description: 'Hamburguesa clásica acompañada de papas y gaseosa fría.', alt: 'Combo clásico con hamburguesa, papas y gaseosa' },
  'Gaseosa fría': { description: 'Gaseosa bien fría para acompañar tu pedido.', alt: 'Vaso de gaseosa fría con hielo' },
  'Milkshake de vainilla': { description: 'Batido cremoso de vainilla, frío y recién preparado.', alt: 'Milkshake cremoso de vainilla' },
}

const promotionAlt: Record<string, string> = {
  'Plan de panas': 'Promoción Plan de panas con hamburguesas, acompañamientos y bebidas',
  'Martes de brasa': 'Promoción Martes de brasa con hamburguesa a la parrilla',
}

const nav: { id: View; label: string }[] = [
  { id: 'home', label: 'Inicio' }, { id: 'story', label: 'Nuestra historia' }, { id: 'burgers', label: 'Hamburguesas' },
  { id: 'more', label: 'Más antojos' }, { id: 'promos', label: 'Promociones' }, { id: 'contact', label: 'Contacto' },
]

const pagePaths: Record<View, string> = {
  home: 'index.html', story: 'historia.html', burgers: 'hamburguesas.html', more: 'antojos.html',
  promos: 'promociones.html', customize: 'personalizar.html', cart: 'pedido.html',
  checkout: 'pago.html', confirmed: 'confirmacion.html', contact: 'contacto.html',
}

const pageByFile: Record<string, View> = Object.fromEntries(
  Object.entries(pagePaths).map(([view, file]) => [file, view as View]),
) as Record<string, View>

const money = (n: number) => `$${n.toFixed(2)}`
const productCountLabel = (count: number) => `${count} ${count === 1 ? 'producto' : 'productos'}`

function App() {
  const fileName = window.location.pathname.split('/').pop() || 'index.html'
  const view = pageByFile[fileName] || 'home'
  const [products, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<CatalogPromotion[]>([])
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [catalogError, setCatalogError] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('brasa-cart') || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<Product | null>(null)
  const [toast, setToast] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation>(() => {
    try { return JSON.parse(localStorage.getItem('brasa-confirmation') || '{"number":"","deliveryMethod":"Entrega","itemCount":0,"items":[]}') } catch { return { number: '', deliveryMethod: 'Entrega', itemCount: 0, items: [] } }
  })
  const count = cart.reduce((a, i) => a + i.qty, 0)

  useEffect(() => { localStorage.setItem('brasa-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => {
    getCatalog()
      .then(({ categories, products: rows, promotions }) => {
        const names = new Map(categories.map(category => [category.id, category.name]))
        const mapped = rows.map(product => ({
          id: product.id,
          name: product.name,
          description: product.description || productContent[product.name]?.description || `Una opción de ${names.get(product.category_id)?.toLowerCase() || 'nuestro menú'} preparada al momento.`,
          price: Number(product.price),
          category: names.get(product.category_id) || product.badge || 'Menú',
          imageUrl: product.image_url || null,
          imageAlt: productContent[product.name]?.alt || product.name,
        }))
        setProducts(mapped)
        const requestedId = Number(new URLSearchParams(window.location.search).get('id'))
        if (view === 'customize') setSelected(mapped.find(product => product.id === requestedId) || mapped[0] || null)
        setCart(current => current.map(item => {
          const fresh = mapped.find(product => product.id === item.id)
          return fresh ? { ...item, ...fresh } : item
        }))
        setPromotions(promotions)
        setCatalogState('ready')
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[Brasa Urbana] Error al cargar el catálogo:', message)
        setCatalogError(message)
        setCatalogState('error')
      })
  }, [view])

  const go = (next: View) => { window.location.href = pagePaths[next] }
  const add = (product: Product, unitPrice = product.price, options?: string[]) => {
    setCart(c => {
      const found = c.find(i => i.id === product.id && !options)
      const next = found ? c.map(i => i === found ? { ...i, qty: i.qty + 1 } : i) : [...c, { ...product, qty: 1, unitPrice, options }]
      localStorage.setItem('brasa-cart', JSON.stringify(next))
      return next
    })
    setToast(`${product.name} se añadió a tu pedido`)
    window.setTimeout(() => setToast(''), 2200)
  }
  const customize = (p: Product) => { window.location.href = `${pagePaths.customize}?id=${p.id}` }

  return (
    <div className="app">
      <a className="skip" href="#main">Saltar al contenido</a>
      <SharedHeader view={view} count={count} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} toast={toast} />
      {toast && <div className="toast" role="status">{toast}</div>}
      <main id="main" tabIndex={-1}>
        {view === 'home' && <Home go={go} customize={customize} products={products} catalogState={catalogState} />}
        {view === 'story' && <Story go={go} />}
        {view === 'burgers' && <Menu items={products.filter(p => p.category === 'Hamburguesas')} title="Hamburguesas a la brasa" categoryFilters={[]} add={add} customize={customize} catalogState={catalogState} catalogError={catalogError} />}
        {view === 'more' && <Menu items={products.filter(p => ['Acompañamientos', 'Combos', 'Bebidas', 'Postres'].includes(p.category))} title="Más antojos" categoryFilters={['Todas', 'Acompañamientos', 'Combos', 'Bebidas', 'Postres']} add={add} customize={customize} catalogState={catalogState} catalogError={catalogError} />}
        {view === 'promos' && <Promos go={go} promotions={promotions} catalogState={catalogState} />}
        {view === 'customize' && selected && <Customize product={selected} add={add} go={go} />}
        {view === 'cart' && <Cart cart={cart} setCart={setCart} go={go} />}
        {view === 'checkout' && <Checkout cart={cart} go={go} setConfirmation={setConfirmation} setCart={setCart} />}
        {view === 'confirmed' && <Confirmed confirmation={confirmation} go={go} />}
        {view === 'contact' && <Contact />}
      </main>
      <SharedFooter />
    </div>
  )
}

function SharedHeader({ view, count, mobileOpen, setMobileOpen, toast }: { view: View; count: number; mobileOpen: boolean; setMobileOpen: (open: boolean) => void; toast: string }) {
  return <header className="header">
    <a className="brand" href={pagePaths.home} aria-label="Ir al inicio"><span>BRASA</span><b>URBANA</b></a>
    <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-controls="main-navigation" aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}>MENÚ</button>
    <nav id="main-navigation" className={mobileOpen ? 'nav open' : 'nav'} aria-label="Navegación principal">
      {nav.map(n => <a key={n.id} className={view === n.id ? 'active' : ''} aria-current={view === n.id ? 'page' : undefined} href={pagePaths[n.id]}>{n.label}</a>)}
    </nav>
    <a className="cart-button" href={pagePaths.cart} aria-label={`Mi pedido, ${productCountLabel(count)}`}>MI PEDIDO <span className={toast ? 'count pop' : 'count'}>{count}</span></a>
  </header>
}

function SharedFooter() {
  return <footer><a className="brand footer-brand" href={pagePaths.home}><span>BRASA</span><b>URBANA</b></a><p>Carne, fuego y barrio. Todos los días, 12:00–23:00.</p><p>© 2026 Brasa Urbana</p></footer>
}

function Home({ go, customize, products, catalogState }: { go: (v: View) => void; customize: (p: Product) => void; products: Product[]; catalogState: string }) {
  return <>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow">HECHO AL FUEGO. HECHO EN EL BARRIO.</p><h1>Hamburguesas con <em>carácter.</em></h1><p className="lead">Carne recién molida, ingredientes honestos y ese toque de brasa que cambia todo.</p><div className="actions"><button className="primary" onClick={() => go('burgers')}>VER EL MENÚ</button><button className="secondary" onClick={() => go('story')}>NUESTRA HISTORIA</button></div></div>
      <div className="hero-image"><img src={burgerPhotos[2]} alt="Hamburguesa doble con queso y pepinillos de Brasa Urbana" /><span className="stamp">100%<br />BRASA</span></div>
    </section>
    <section className="section"><div className="section-head"><div><p className="eyebrow">FAVORITAS DEL BARRIO</p><h2>Elige tu próxima obsesión</h2></div><button className="text-link" onClick={() => go('burgers')}>VER TODAS →</button></div>{catalogState === 'loading' ? <div className="empty"><p>Cargando el menú…</p></div> : catalogState === 'error' ? <div className="empty" role="alert"><span className="error-icon" aria-hidden="true">!</span><h3>No pudimos cargar el menú</h3><p>Intenta de nuevo en unos minutos.</p></div> : <div className="grid">{products.slice(0, 3).map(p => <ProductCard key={p.id} product={p} onClick={() => customize(p)} />)}</div>}</section>
    <section className="band"><p className="eyebrow">LA PROMO DE HOY</p><h2>Doble sabor, mejor precio.</h2><p>2 Urbanas + papas para compartir por $24.90.</p><button className="primary" onClick={() => go('promos')}>VER PROMOCIONES</button></section>
  </>
}

function Story({ go }: { go: (v: View) => void }) {
  return <section className="split-page"><img src={burgerPhotos[1]} alt="Hamburguesa artesanal preparada en nuestra cocina" /><div><p className="eyebrow">NUESTRA HISTORIA</p><h1>Del fuego al barrio.</h1><p className="lead">Nacimos con una idea sencilla: servir hamburguesas honestas, hechas al momento y con la brasa como protagonista.</p><p>Trabajamos con productores cercanos, molemos nuestra carne cada día y hacemos cada salsa en casa. Sin atajos. Desde 2018, nuestra mesa es el punto de encuentro de quienes saben que comer bien también es compartir.</p><button className="primary" onClick={() => go('burgers')}>CONOCE EL MENÚ</button></div></section>
}

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  return <article className="card" role="link" aria-label={`Personalizar ${product.name}`} onClick={onClick} tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}>
    <ProductMedia product={product} /><div className="card-body"><p className="tag">{product.category}</p><div className="price-row"><h3>{product.name}</h3><strong>{money(product.price)}</strong></div><p>{product.description}</p><span className="card-link" aria-hidden="true">PERSONALIZAR →</span></div>
  </article>
}

function ProductMedia({ product, compact = false, eager = false }: { product: Product; compact?: boolean; eager?: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [product.imageUrl])
  return product.imageUrl && !failed
    ? <img className={compact ? 'compact-media' : undefined} src={product.imageUrl} alt={product.imageAlt} width={compact ? 112 : 900} height={compact ? 88 : 675} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
    : <div className={`product-placeholder${compact ? ' compact-media' : ''}`} role="img" aria-label={`${product.name}, imagen no disponible`}><span aria-hidden="true">◇</span><b>{product.name}</b></div>
}

function PromotionMedia({ promotion }: { promotion: CatalogPromotion }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [promotion.image_url])
  return promotion.image_url && !failed
    ? <img className="promo-media" src={promotion.image_url} alt={promotionAlt[promotion.name] || `Promoción ${promotion.name}`} width={112} height={96} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    : <div className="promo-placeholder" role="img" aria-label={`${promotion.name}, imagen no disponible`}><span aria-hidden="true">◇</span><b>{promotion.name}</b></div>
}

function Menu({ items, title, categoryFilters, add, customize, catalogState, catalogError }: { items: Product[]; title: string; categoryFilters: string[]; add: (p: Product) => void; customize: (p: Product) => void; catalogState: 'loading' | 'ready' | 'error'; catalogError: string }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const filtered = items.filter(i => (category === 'Todas' || i.category === category) && `${i.name} ${i.description}`.toLowerCase().includes(query.toLowerCase()))
  if (catalogState === 'loading') return <section className="section menu-page"><p className="eyebrow">NUESTRO MENÚ</p><h1>{title}</h1><div className="empty" role="status"><p>Cargando categorías y productos…</p></div></section>
  if (catalogState === 'error') return <section className="section menu-page"><p className="eyebrow">NUESTRO MENÚ</p><h1>{title}</h1><div className="empty error-panel" role="alert"><span className="error-icon" aria-hidden="true">!</span><h2>No pudimos cargar el menú</h2><p>Supabase no respondió correctamente. Actualiza la página para volver a intentarlo.</p><code>{catalogError}</code></div></section>
  return <section className="section menu-page"><p className="eyebrow">NUESTRO MENÚ</p><h1>{title}</h1><p className="lead">Preparado al momento. Siempre caliente, siempre brutal.</p>
    <div className="filters"><label><span>Buscar en el menú</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ej. queso, picante..." /></label>{categoryFilters.length > 0 && <div className="chips" aria-label="Filtrar por categoría">{categoryFilters.map(c => <button key={c} className={c === category ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div>}</div>
    {filtered.length ? <div className="grid">{filtered.map(p => <article className="card" key={p.id}><ProductMedia product={p} /><div className="card-body"><p className="tag">{p.category}</p><div className="price-row"><h3>{p.name}</h3><strong>{money(p.price)}</strong></div><p>{p.description}</p><div className="card-actions"><button className="secondary" onClick={() => customize(p)}>PERSONALIZAR</button><button className="primary" onClick={() => add(p)}>AÑADIR</button></div></div></article>)}</div> : <div className="empty"><h2>Sin resultados</h2><p>Prueba con otra búsqueda o categoría.</p></div>}
  </section>
}

function Promos({ go, promotions, catalogState }: { go: (v: View) => void; promotions: CatalogPromotion[]; catalogState: string }) {
  return <section className="section menu-page"><p className="eyebrow">PROMOCIONES</p><h1>Más brasa por menos.</h1>{catalogState === 'loading' ? <div className="empty"><p>Cargando promociones…</p></div> : catalogState === 'error' ? <div className="empty" role="alert"><span className="error-icon" aria-hidden="true">!</span><h2>No pudimos cargar las promociones</h2><p>Intenta nuevamente más tarde.</p></div> : <div className="promo-grid">{promotions.map((p, i) => <article className="promo" key={p.id}><PromotionMedia promotion={p} /><div><p className="promo-index">{String(i + 1).padStart(2, '0')}</p><h2>{p.name}</h2><p>{p.description || 'Una promoción para compartir productos seleccionados de Brasa Urbana.'}</p><strong>{money(Number(p.price))}</strong></div><button className="primary" onClick={() => go('burgers')}>ELEGIR PRODUCTOS</button></article>)}</div>}</section>
}

function Customize({ product, add, go }: { product: Product; add: (p: Product, price: number, options: string[]) => void; go: (v: View) => void }) {
  const [cook, setCook] = useState('Al punto')
  const [removed, setRemoved] = useState<string[]>([])
  const [extras, setExtras] = useState<string[]>([])
  const extraPrices: Record<string, number> = { 'Extra cheddar': 1.5, 'Bacon crocante': 2, Aguacate: 2.5 }
  const total = product.price + extras.reduce((a, e) => a + extraPrices[e], 0)
  const toggle = (value: string, list: string[], set: (v: string[]) => void) => set(list.includes(value) ? list.filter(x => x !== value) : [...list, value])
  return <section className="custom-page"><ProductMedia product={product} eager /><div className="custom-form"><button className="back" onClick={() => go(product.category === 'Hamburguesas' ? 'burgers' : 'more')}>← VOLVER AL MENÚ</button><p className="eyebrow">HAZLA TUYA</p><div className="price-row"><h1>{product.name}</h1><strong>{money(product.price)}</strong></div><p>{product.description}</p>
    <fieldset><legend>Punto de cocción</legend>{['Jugosa', 'Al punto', 'Bien cocida'].map(x => <label className="option" key={x}><input type="radio" name="cook" checked={cook === x} onChange={() => setCook(x)} /><span>{x}</span></label>)}</fieldset>
    <fieldset><legend>Quitar ingredientes</legend>{['Cebolla', 'Pepinillos', 'Salsa Brasa'].map(x => <label className="option" key={x}><input type="checkbox" checked={removed.includes(x)} onChange={() => toggle(x, removed, setRemoved)} /><span>Sin {x.toLowerCase()}</span></label>)}</fieldset>
    <fieldset><legend>Agregar extras</legend>{Object.entries(extraPrices).map(([x, price]) => <label className="option" key={x}><input type="checkbox" checked={extras.includes(x)} onChange={() => toggle(x, extras, setExtras)} /><span>{x}</span><b>+{money(price)}</b></label>)}</fieldset>
    <button className="primary full" onClick={() => { add(product, total, [cook, ...removed.map(x => `Sin ${x}`), ...extras]); go('cart') }}>AÑADIR AL PEDIDO · {money(total)}</button></div></section>
}

function Cart({ cart, setCart, go }: { cart: CartItem[]; setCart: (c: CartItem[]) => void; go: (v: View) => void }) {
  const subtotal = cart.reduce((a, i) => a + i.unitPrice * i.qty, 0), tax = subtotal * .08
  const qty = (index: number, delta: number) => setCart(cart.map((i, x) => x === index ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
  if (!cart.length) return <section className="empty cart-empty"><p className="eyebrow">MI PEDIDO</p><h1>Tu parrilla está vacía.</h1><p>Añade una hamburguesa y empieza algo bueno.</p><button className="primary" onClick={() => go('burgers')}>EXPLORAR EL MENÚ</button></section>
  return <section className="section cart-page"><p className="eyebrow">MI PEDIDO</p><h1>Revisa tu pedido</h1><div className="cart-layout"><div>{cart.map((item, i) => <article className="cart-item" key={`${item.id}-${i}`}><ProductMedia product={item} compact /><div className="cart-info"><h3>{item.name}</h3><p>{item.options?.join(' · ') || item.category}</p><button className="remove" onClick={() => setCart(cart.filter((_, x) => x !== i))}>Eliminar</button></div><div className="stepper"><button onClick={() => qty(i, -1)} aria-label="Reducir cantidad">−</button><span>{item.qty}</span><button onClick={() => qty(i, 1)} aria-label="Aumentar cantidad">+</button></div><strong>{money(item.unitPrice * item.qty)}</strong></article>)}</div><aside className="summary"><h2>Resumen</h2><p><span>Subtotal</span><b>{money(subtotal)}</b></p><p><span>Impuestos (8%)</span><b>{money(tax)}</b></p><hr /><p className="total"><span>Total</span><b>{money(subtotal + tax)}</b></p><button className="primary full" onClick={() => go('checkout')}>CONTINUAR AL PAGO</button><button className="text-link full" onClick={() => go('burgers')}>SEGUIR COMPRANDO</button></aside></div></section>
}

function Checkout({ cart, go, setConfirmation, setCart }: { cart: CartItem[]; go: (v: View) => void; setConfirmation: (value: Confirmation) => void; setCart: (c: CartItem[]) => void }) {
  const [delivery, setDelivery] = useState('Entrega')
  const [payment, setPayment] = useState('Tarjeta')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const total = useMemo(() => cart.reduce((a, i) => a + i.unitPrice * i.qty, 0) * 1.08, [cart])
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const data = new FormData(e.currentTarget); const next: Record<string, string> = {}
    ;['name', 'phone', 'email'].forEach(k => { if (!data.get(k)?.toString().trim()) next[k] = 'Este campo es obligatorio.' })
    if (delivery === 'Entrega' && !data.get('address')?.toString().trim()) next.address = 'Ingresa una dirección de entrega.'
    if (data.get('email') && !/^\S+@\S+\.\S+$/.test(String(data.get('email')))) next.email = 'Ingresa un correo válido.'
    setErrors(next); if (Object.keys(next).length) return
    setLoading(true)
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
    try {
      const result = await createOrder({
        customer: {
          name: String(data.get('name')),
          phone: String(data.get('phone')),
          email: String(data.get('email')),
          address: String(data.get('address') || ''),
        },
        deliveryMethod: delivery,
        paymentMethod: payment,
        subtotal,
        tax: subtotal * .08,
        total,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.name,
          quantity: item.qty,
          unitPrice: item.unitPrice,
          options: item.options || [],
        })),
      })
      const confirmedOrder = {
        number: result.orderNumber,
        deliveryMethod: delivery,
        itemCount: cart.reduce((sum, item) => sum + item.qty, 0),
        items: [...cart],
      }
      localStorage.setItem('brasa-confirmation', JSON.stringify(confirmedOrder))
      setConfirmation(confirmedOrder)
      localStorage.setItem('brasa-cart', '[]')
      setCart([])
      go('confirmed')
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'No pudimos guardar el pedido.' })
    } finally {
      setLoading(false)
    }
  }
  if (!cart.length) return <section className="empty cart-empty"><h1>No hay productos para pagar.</h1><button className="primary" onClick={() => go('burgers')}>IR AL MENÚ</button></section>
  return <section className="section checkout"><p className="eyebrow">ENTREGA Y PAGO</p><h1>Ya casi es tuya.</h1><form onSubmit={submit} noValidate><div className="checkout-form"><fieldset><legend>1. ¿Cómo la recibes?</legend><div className="choice-grid">{['Entrega', 'Retiro en local'].map(x => <label className="choice" key={x}><input type="radio" checked={delivery === x} onChange={() => setDelivery(x)} /><b>{x}</b><span>{x === 'Entrega' ? '30–45 min' : 'Lista en 20 min'}</span></label>)}</div></fieldset>
    <fieldset><legend>2. Tus datos</legend><div className="form-grid"><Field label="Nombre completo" name="name" error={errors.name} /><Field label="Teléfono" name="phone" error={errors.phone} /><Field label="Correo electrónico" name="email" type="email" error={errors.email} />{delivery === 'Entrega' && <Field label="Dirección de entrega" name="address" error={errors.address} />}</div></fieldset>
    <fieldset><legend>3. Método de pago</legend><div className="choice-grid">{['Tarjeta', 'Pago al recibir'].map(x => <label className="choice" key={x}><input type="radio" checked={payment === x} onChange={() => setPayment(x)} /><b>{x}</b><span>{x === 'Tarjeta' ? 'Visa, Mastercard o Amex' : 'Efectivo o tarjeta'}</span></label>)}</div></fieldset></div>
    <aside className="summary checkout-summary"><h2>Total del pedido</h2><div className="checkout-items" aria-label="Productos del pedido">{cart.map((item, index) => <article key={`${item.id}-${index}`}><ProductMedia product={item} compact /><div><b>{item.name}</b><span>{item.qty} × {money(item.unitPrice)}</span></div></article>)}</div><p><span>{productCountLabel(cart.reduce((a, i) => a + i.qty, 0))}</span><b>{money(total)}</b></p>{errors.submit && <p className="error" role="alert"><span className="error-icon small" aria-hidden="true">!</span>{errors.submit}</p>}<button className="primary full" disabled={loading}>{loading ? 'CONFIRMANDO…' : `CONFIRMAR · ${money(total)}`}</button><p className="safe">Pago seguro y datos protegidos.</p></aside></form></section>
}

function Field({ label, name, type = 'text', error }: { label: string; name: string; type?: string; error?: string }) {
  return <label className="field"><span>{label}</span><input name={name} type={type} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} />{error && <small id={`${name}-error`} className="error"><span className="error-icon small" aria-hidden="true">!</span>{error}</small>}</label>
}

function Confirmed({ confirmation, go }: { confirmation: Confirmation; go: (v: View) => void }) {
  const isDelivery = confirmation.deliveryMethod === 'Entrega'
  return <section className="confirmed"><div className="check">✓</div><p className="eyebrow">PEDIDO CONFIRMADO</p><h1>La brasa ya está encendida.</h1><p className="lead">Recibimos {productCountLabel(confirmation.itemCount)} y comenzaremos a preparar tu pedido. Enviaremos las novedades a tu correo.</p>{confirmation.items.length > 0 && <div className="confirmed-items" aria-label="Productos confirmados">{confirmation.items.map((item, index) => <article key={`${item.id}-${index}`}><ProductMedia product={item} compact /><div><b>{item.name}</b><span>{item.qty} × {money(item.unitPrice)}</span></div></article>)}</div>}<div className="order-number"><span>NÚMERO DE PEDIDO</span><strong>{confirmation.number || 'BU-00000'}</strong></div><p>{isDelivery ? 'Tiempo estimado de entrega' : 'Listo para retirar en'}: <b>{isDelivery ? '30–45 minutos' : '15–20 minutos'}</b></p><button className="primary" onClick={() => go('home')}>VOLVER AL INICIO</button></section>
}

function Contact() {
  return <section className="section contact"><div><p className="eyebrow">HABLEMOS</p><h1>Estamos en el barrio.</h1><p className="lead">¿Una pregunta, una idea o ganas de organizar algo grande? Escríbenos.</p><address><b>BRASA URBANA CENTRO</b><br />Calle del Fuego 128<br />Lun–Dom · 12:00–23:00<br /><br />hola@brasaurbana.com<br />+1 305 555 0148</address></div><form onSubmit={e => e.preventDefault()}><Field label="Nombre" name="contact-name" /><Field label="Correo electrónico" name="contact-email" type="email" /><label className="field"><span>Mensaje</span><textarea rows={6} /></label><button className="primary">ENVIAR MENSAJE</button></form></section>
}

export default App
