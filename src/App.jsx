import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import hero from './assets/smash-hero.webp'
import burgerSticker from './assets/burger-sticker-v2.webp'
import rolleSticker from './assets/rolle-sticker.webp'
import friesSticker from './assets/fries-sticker-v2.webp'
import burgerLayer1 from './assets/burger-layer-v3-1.webp'
import burgerLayer2 from './assets/burger-layer-v3-2.webp'
import burgerLayer3 from './assets/burger-layer-v3-3.webp'
import burgerLayer4 from './assets/burger-layer-v3-4.webp'
import burgerLayer5 from './assets/burger-layer-v3-5.webp'
import burgerLayer6 from './assets/burger-layer-v3-6.webp'
import burgerLayer7 from './assets/burger-layer-v3-7.webp'
import './App.css'

const orderUrl = 'https://www.foodbooking.com/ordering/restaurant/menu?company_uid=ce2536b2-77bd-4a90-9430-fdc666215e81&restaurant_uid=9f9fd048-f041-4902-8e76-df9ac7e69126&facebook=true'
const reviewsUrl = 'https://share.google/SRs5KK0ET2HBvEL4k'
const menu = {
  Burgers: [
    ['1', 'Chicken Burger', 'Mit Hähnchen, Käse, Avocado-Sauce und Salat', '8,00 €'],
    ['2', '7mo Rolle', 'Mit Hähnchen, Käse, Senf-Sauce und Salat', '8,00 €'],
    ['3', 'Graffiti Burger', 'Mit Hackfleisch, Ei, Käse, Tomaten, Rucola, Zwiebeln und Joghurt-Sauce', '10,00 €'],
    ['4', 'Smash Burger', 'Mit Hackfleisch, Zwiebeln, Käse und Saurer Sauce', '8,50 €'],
    ['5', 'Classic Burger', 'Mit Hackfleisch, Zwiebeln, Käse, Tomaten, Salat und Sauce', '7,50 €'],
  ],
  Fries: [
    ['7', 'Mushroom', 'Fries mit Pilzen, Zwiebeln und Käse', '7,00 €'],
    ['8', 'Onion', 'Fries mit Röstzwiebeln und Käse', '6,00 €'],
    ['9', 'Delicious', 'Fries mit Hackfleisch, Käse und Joghurt-Sauce', '7,00 €'],
    ['10', 'Sausage', 'Fries mit Wurst und unserer leckeren BBQ-Sauce', '7,00 €'],
    ['11', 'Fried Chicken', 'Fries mit Hähnchen, Käse und Senf-Sauce', '7,50 €'],
    ['12', 'Classic', 'Fries klassisch rot oder weiß, mit Majo oder Ketchup', '5,00 €'],
  ],
  Beilagen: [['6', 'Fried Chicken Box', '6 saftige Chicken Stripes', '7,50 €']],
  Drinks: [
    ['', 'Wasser', '', '1,50 €'], ['', 'Fanta', '', '2,50 €'], ['', 'Sprite', '', '2,50 €'],
    ['', 'Coca Cola', '', '2,50 €'], ['', 'Pepsi', '', '2,50 €'], ['', 'RedBull', '', '3,00 €'],
  ],
}
const reviews = [
  ['Andrea', 5, 'Wow, was für ein Burger! Definitiv der beste Burger, den ich bisher gegessen habe. Die Fleischqualität ist der Hammer, der restliche Belag köstlich.'],
  ['Liza Al-homsi', 5, 'Habe viel gehört, dass das der beste Burger hier im Umkreis ist. Heute probiert – und das ist der beste Burger, den ich je gegessen habe. Alles frisch zubereitet.'],
  ['Matthias P.', 5, 'Bin auf der Durchreise hier eingekehrt und war in allen Belangen begeistert! Der Burger war sehr gut!'],
  ['Yassi', 5, 'Mein Sohn und ich waren positiv überrascht. Das Essen ist sehr lecker, sehr freundlich und einladend. Wir kommen definitiv wieder.'],
  ['Rainer Aschemeier', 4, 'Die Burger sind wirklich gut. Beim Smash Burger war ich positiv überrascht von der guten Qualität des Hackfleischs. Die Preise finde ich fair.'],
  ['rehman', 5, 'Best smash burger eaten lately!'],
]

const burgerLayers = [burgerLayer1, burgerLayer2, burgerLayer3, burgerLayer4, burgerLayer5, burgerLayer6, burgerLayer7]
const closedLayerY = [115, 240, 305, 325, 365, 395, 440]
const openLayerY = [0, 165, 285, 375, 470, 565, 655]

function ScrollBurger() {
  const section = useRef(null)

  useLayoutEffect(() => {
    const node = section.current
    if (!node) return
    let frame = 0
    let targetProgress = 0
    let displayedProgress = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const readProgress = () => {
      const rect = node.getBoundingClientRect()
      const travel = Math.max(1, rect.height - window.innerHeight)
      return reduceMotion ? 1 : Math.min(1, Math.max(0, -rect.top / travel))
    }
    const render = progress => {
      const stage = node.querySelector('.layer-stage')
      const verticalScale = stage.clientHeight / 760
      stage.querySelectorAll('.burger-layer').forEach((image, index) => {
        const y = (closedLayerY[index] + (openLayerY[index] - closedLayerY[index]) * progress) * verticalScale
        image.style.transform = `translate3d(-50%, ${y}px, 0)`
      })
    }
    const animate = () => {
      const delta = targetProgress - displayedProgress
      displayedProgress = Math.abs(delta) < .0005 ? targetProgress : displayedProgress + delta * .2
      render(displayedProgress)
      frame = displayedProgress === targetProgress ? 0 : requestAnimationFrame(animate)
    }
    const updateTarget = () => {
      targetProgress = readProgress()
      if (!frame) frame = requestAnimationFrame(animate)
    }
    targetProgress = readProgress()
    displayedProgress = targetProgress
    render(displayedProgress)
    window.addEventListener('scroll', updateTarget, { passive: true })
    window.addEventListener('resize', updateTarget)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateTarget)
      window.removeEventListener('resize', updateTarget)
    }
  }, [])

  return <section className="burger-deconstruction" ref={section} aria-label="Der Smash Burger in seinen Schichten">
    <div className="burger-sticky">
      <div className="deconstruction-copy">
        <span className="kicker">SCROLL TO SMASH</span>
        <h2>JEDE SCHICHT.<br/><em>VOLLER IMPACT.</em></h2>
        <p>Weiter scrollen und der Signature Smash zeigt, was in ihm steckt. Hochscrollen setzt ihn wieder zusammen.</p>
      </div>
      <div className="layer-stage" aria-hidden="true">
        {burgerLayers.map((layer, index) =>
          <img key={layer} src={layer} alt="" className={`burger-layer layer-${index + 1}`} />
        )}
      </div>
      <span className="scroll-note">SCROLL ↓</span>
    </div>
  </section>
}

function SmashMap() {
  const container = useRef(null)

  useEffect(() => {
    if (!container.current) return
    let map
    let cancelled = false
    import('maplibre-gl').then(maplibregl => {
      if (cancelled || !container.current) return
      map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 512,
            attribution: '© CARTO · © OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'carto-dark', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 20 }],
      },
      center: [9.447593, 51.829864],
      zoom: 15.8,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      const marker = document.createElement('div')
      marker.className = 'smash-map-marker'
      marker.innerHTML = '<span>G</span><i></i>'
      new maplibregl.Marker({ element: marker, anchor: 'bottom-left' })
        .setLngLat([9.447593, 51.829864])
        .setPopup(new maplibregl.Popup({ offset: 32, closeButton: false }).setHTML('<strong>GRAFFITI SMASH</strong><small>Oberbachstraße 4</small>'))
        .addTo(map)
    })
    return () => { cancelled = true; map?.remove() }
  }, [])

  return <div className="smash-map" ref={container} aria-label="Interaktive Karte von Holzminden" />
}

const legalContent = {
  impressum: {
    eyebrow: 'RECHTLICHES',
    title: 'Impressum',
    body: <><h3>Angaben gemäß § 5 DDG</h3><p>Graffiti Smash Burgers<br/>Oberbachstraße 4<br/>37603 Holzminden<br/>Deutschland</p><h3>Kontakt</h3><p>Telefon: <a href="tel:+4955319827378">05531 9827378</a><br/>E-Mail: <a href="mailto:info@graffitismash.de">info@graffitismash.de</a></p><h3>Verbraucherstreitbeilegung</h3><p>Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p><p className="legal-note">Hinweis: Auf der bisherigen Website sind keine weitergehenden Betreiber-, Register- oder Umsatzsteuerangaben veröffentlicht. Sollten solche Angaben bestehen, müssen sie hier vor Veröffentlichung ergänzt werden.</p></>,
  },
  datenschutz: {
    eyebrow: 'DEINE DATEN',
    title: 'Datenschutz',
    body: <><h3>1. Verantwortlicher</h3><p>Graffiti Smash Burgers, Oberbachstraße 4, 37603 Holzminden<br/>E-Mail: <a href="mailto:info@graffitismash.de">info@graffitismash.de</a></p><h3>2. Hosting und Server-Logfiles</h3><p>Beim Aufruf dieser Website kann der Hostinganbieter technisch notwendige Verbindungsdaten verarbeiten, insbesondere IP-Adresse, Zeitpunkt, aufgerufene Datei, Referrer und Browserinformationen. Die Verarbeitung dient der sicheren und stabilen Bereitstellung der Website auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.</p><h3>3. Kartendarstellung</h3><p>Die interaktive Karte wird mit MapLibre und Kartenkacheln von CARTO bereitgestellt. Beim Laden der Karte wird technisch bedingt eine Verbindung zu CARTO hergestellt, wobei insbesondere die IP-Adresse übertragen werden kann. Kartendaten basieren auf OpenStreetMap-Beiträgen.</p><h3>4. Externe Links</h3><p>Bestelllinks führen zu FoodBooking, Bewertungs- und Routenlinks zu Google. Erst beim Anklicken gelten die Datenschutzbestimmungen des jeweiligen Anbieters.</p><h3>5. Google Fonts</h3><p>Zur Darstellung der Schriften kann eine Verbindung zu Google Fonts hergestellt werden. Dabei kann Ihre IP-Adresse an Google übertragen werden.</p><h3>6. Kontaktaufnahme</h3><p>Wenn Sie uns per E-Mail oder Telefon kontaktieren, verarbeiten wir Ihre Angaben zur Bearbeitung der Anfrage gemäß Art. 6 Abs. 1 lit. b oder lit. f DSGVO.</p><h3>7. Ihre Rechte</h3><p>Sie haben insbesondere Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch sowie ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.</p><p className="legal-note">Stand: Juli 2026. Diese Datenschutzerklärung beschreibt die aktuell auf dieser Website eingebundenen Dienste.</p></>,
  },
}

function App() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [category, setCategory] = useState('Burgers')
  const [panel, setPanel] = useState(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll(); window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!panel) return
    document.body.classList.add('modal-open')
    const closePanel = event => event.key === 'Escape' && setPanel(null)
    window.addEventListener('keydown', closePanel)
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', closePanel) }
  }, [panel])

  useEffect(() => {
    document.body.classList.toggle('menu-open', open)
    return () => document.body.classList.remove('menu-open')
  }, [open])

  const close = () => setOpen(false)

  return <div className="page">
    <header className={scrolled ? 'nav scrolled' : 'nav'}>
      <a className="brand brand-logo" href="#top" onClick={close}><img src="/graffiti-smash-logo.svg" alt="Graffiti Smash Burgers" /></a>
      <nav id="mobile-navigation" className={open ? 'nav-links open' : 'nav-links'}>
        <a href="#menu" onClick={close}>Speisekarte</a><a href="#story" onClick={close}>Unser Smash</a><a href="#location" onClick={close}>Standort</a><a href="#contact" onClick={close}>Kontakt</a>
        <a className="nav-order" href={orderUrl} target="_blank" rel="noreferrer" onClick={close}>Online bestellen <span>↗</span></a>
      </nav>
      <button className={open ? 'menu-toggle active' : 'menu-toggle'} onClick={() => setOpen(!open)} aria-label={open ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={open} aria-controls="mobile-navigation"><span/><span/><span/></button>
      <button className={open ? 'menu-backdrop visible' : 'menu-backdrop'} onClick={close} aria-label="Menü schließen"/>
    </header>

    <main>
      <section className="split-hero" id="top">
        <div className="split-copy"><div className="eyebrow">SMASH BURGERS · HOLZMINDEN</div><h1>NO<br/>RULES.<br/><em>JUST SMASH.</em></h1><p>Farbige Buns. Knusprige Kanten. Saftiger Kern. Streetfood aus der Oberbachstraße.</p><div className="split-actions"><a className="btn primary" href={orderUrl} target="_blank" rel="noreferrer">Jetzt abholen ↗</a><a className="text-link" href="#menu">Karte ansehen ↓</a></div><div className="split-meta"><span><b>4.8</b> / 5 GOOGLE</span><span><i className="pulse"/> HEUTE 14–22 UHR</span></div></div>
        <div className="split-visual"><img src={hero} alt="Frisch zubereiteter Double Smash Burger"/><span className="visual-tag">DOUBLE<br/>SMASH</span><div className="visual-price">FRESH<br/>DAILY</div></div>
      </section>
      <div className="street-ticker"><div>SMASHED FRESH ✦ COLORFUL BUNS ✦ HOLZMINDEN ✦ ORDER & PICK UP ✦ SMASHED FRESH ✦ COLORFUL BUNS ✦ HOLZMINDEN ✦ ORDER & PICK UP ✦</div></div>

      <section className="menu-lab" id="menu">
        <aside className="menu-aside"><img className="food-sticker menu-sticker" src={burgerSticker} alt="" aria-hidden="true"/><span className="kicker">THE FULL MENU</span><h2>WHAT’S<br/><em>YOUR MOVE?</em></h2><a href={orderUrl} target="_blank" rel="noreferrer">Direkt online bestellen ↗</a><span className="swipe-hint" aria-hidden="true">Kategorien wischen <b>→</b></span><div className="category-stack" role="tablist">{Object.keys(menu).map((name,i)=><button key={name} className={category===name?'active':''} onClick={()=>setCategory(name)}><span>0{i+1}</span>{name}<b>→</b></button>)}</div></aside>
        <div className="menu-list"><div className="menu-list-head"><span>{category}</span><span>{menu[category].length} ITEMS</span></div>{menu[category].map(([number,name,description,price])=><article className="menu-row" key={`${category}-${name}`}><span className="row-number">{number||'•'}</span><div><h3>{name}</h3>{description&&<p>{description}</p>}</div><strong>{price}</strong><a href={orderUrl} target="_blank" rel="noreferrer" aria-label={`${name} bestellen`}>+</a></article>)}</div>
      </section>

      <ScrollBurger/>

      <section className="smash-process" id="story">
        <img className="food-sticker rolle-sticker" src={rolleSticker} alt="Die 7mo Rolle mit Hähnchen, Käse, Salat und Senf-Sauce"/>
        <header><span className="kicker">THE SMASH METHOD</span><h2>PRESS. CRUST.<br/><em>DESTROY.</em></h2></header>
        <div className="process-grid"><article><b>01</b><h3>HEISSE PLATTE</h3><p>Maximale Hitze. Keine Kompromisse.</p></article><article><b>02</b><h3>HARTER PRESS</h3><p>Beef direkt auf die Platte gesmashed.</p></article><article><b>03</b><h3>VOLLE KRUSTE</h3><p>Außen kross. Innen brutal saftig.</p></article><div className="process-poster"><span>100%</span><strong>SMASH<br/>LOVE</strong></div></div>
      </section>

      <section className="review-wall" id="reviews">
        <div className="review-score"><img className="food-sticker fries-sticker" src={friesSticker} alt="Dicke Fries mit Fried Chicken und Käsesauce in einer braunen Pappschale"/><span>GOOGLE</span><b>4.8</b><div>★★★★★</div><small>86 Bewertungen</small><a href={reviewsUrl} target="_blank" rel="noreferrer">Alle ansehen ↗</a></div>
        <div className="review-rail">{reviews.map(([name,stars,text],i)=><article key={name} className={`quote q${i+1}`}><div>{'★'.repeat(stars)}</div><p>„{text}“</p><footer><b>{name}</b><span>Google Review</span></footer></article>)}</div>
      </section>

      <section className="visit-hub" id="location">
        <div className="hub-map"><SmashMap/><div className="map-label"><span className="brand-mark">G</span><div><b>GRAFFITI SMASH</b><small>OBERBACHSTRASSE 4</small></div></div></div>
        <div className="hub-info"><span className="kicker">COME THROUGH</span><h2>FIND US.<br/><em>GET SMASHED.</em></h2><div className="hub-cards"><div><small>ADRESSE</small><b>Oberbachstraße 4<br/>37603 Holzminden</b></div><div><small>ÖFFNUNGSZEITEN</small><b>Mo & Mi–So · 14–22 Uhr</b><span>Dienstag Ruhetag</span></div></div><div className="hub-actions"><a className="btn primary" target="_blank" rel="noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=51.829864%2C9.447593">Route ↗</a><a href="tel:+4955319827378">05531 9827378</a></div></div>
      </section>

      <section className="contact-deck" id="contact">
        <div className="contact-call"><span>QUESTIONS?</span><h2>LET’S<br/><em>TALK.</em></h2><a href="mailto:info@graffitismash.de">info@graffitismash.de ↗</a><a href="tel:+4955319827378">05531 9827378 ↗</a></div>
        <form className="contact-form" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);window.location.href=`mailto:info@graffitismash.de?subject=${encodeURIComponent(data.get('subject'))}&body=${encodeURIComponent(`Name: ${data.get('name')}\nE-Mail: ${data.get('email')}\nDSGVO-Einwilligung: erteilt\n\n${data.get('message')}`)}`}}><label>Name<input name="name" required placeholder="Dein Name"/></label><label>E-Mail<input name="email" type="email" required placeholder="deine@email.de"/></label><label>Betreff<input name="subject" required placeholder="Worum geht’s?"/></label><label>Nachricht<textarea name="message" rows="4" required placeholder="Sag uns was …"/></label><label className="consent-field"><input name="consent" type="checkbox" required/><span>Ich stimme der Verarbeitung meiner Angaben zur Bearbeitung dieser Anfrage gemäß der <button type="button" onClick={() => setPanel('datenschutz')}>Datenschutzerklärung</button> zu.</span></label><button className="btn primary">Nachricht senden ↗</button></form>
      </section>
    </main>
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand"><a className="brand brand-logo" href="#top"><img src="/graffiti-smash-logo.svg" alt="Graffiti Smash Burgers" /></a><p>Come hungry.<br/><em>Leave smashed.</em></p></div>
        <div className="footer-column"><small>BESUCH UNS</small><address>Oberbachstraße 4<br/>37603 Holzminden</address><a href="#location">Route planen ↗</a></div>
        <div className="footer-column"><small>ÖFFNUNGSZEITEN</small><p>Mo & Mi–So<br/><b>14:00–22:00</b></p><span>Dienstag Ruhetag</span></div>
        <div className="footer-column"><small>KONTAKT</small><a href="tel:+4955319827378">05531 9827378</a><a href="mailto:info@graffitismash.de">info@graffitismash.de</a></div>
      </div>
      <div className="footer-bottom"><span>© 2026 Graffiti Smash Holzminden</span><nav aria-label="Rechtliche Links"><a href="#contact">Kontakt</a><button onClick={() => setPanel('impressum')}>Impressum</button><button onClick={() => setPanel('datenschutz')}>Datenschutz</button></nav><a className="footer-top" href="#top" aria-label="Nach oben">↑</a></div>
    </footer>
    <a className="mobile-order" href={orderUrl} target="_blank" rel="noreferrer"><span>Abholung bestellen</span><b>↗</b></a>
    {panel && <div className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-title" onMouseDown={event => event.target === event.currentTarget && setPanel(null)}><article><button className="legal-close" onClick={() => setPanel(null)} aria-label="Schließen">×</button><span className="kicker">{legalContent[panel].eyebrow}</span><h2 id="legal-title">{legalContent[panel].title}</h2><div className="legal-body">{legalContent[panel].body}</div></article></div>}
  </div>
}
export default App
