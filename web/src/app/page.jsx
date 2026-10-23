export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 40, maxWidth: 800, margin: '0 auto' }}>
      <h1>🤖 MultiBot — Web Dashboard</h1>
      <p style={{ color: '#666' }}>🚧 En construcción — placeholder</p>
      <h2>Bots disponibles</h2>
      <ul>
        <li><strong>universal-bot</strong> — Universal Bot (Termux, Baileys QR & Pairing Code, sin NSFW) ✅</li>
        <li><em>Próximamente más bots vía bots/</em></li>
      </ul>
      <h2>Estado</h2>
      <p>Por ahora gestiona tus bots directo por Termux:</p>
      <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
cd ../bots/universal-bot
npm install
npm start
# elige "code" o "qr"
      </pre>
      <p>Docs: <a href="https://github.com/lyanvalentinmail-prog/MultiBot">github.com/lyanvalentinmail-prog/MultiBot</a></p>
    </main>
  )
}
