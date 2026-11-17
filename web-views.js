'use strict';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPwaHeadTags(titleText) {
  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${escapeHtml(titleText)}</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#0F172A">
  <meta name="application-name" content="CLIENTE VIP">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="CLIENTE VIP">
  <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">`;
}

function renderDriverPortalHtml(firebaseWebConfig, publicBaseUrl) {
  const safeBaseUrl = escapeHtml(publicBaseUrl);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>${renderPwaHeadTags('CLIENTE VIP — Área do Motorista')}
  <style>
    :root {
      --bg-deep: #070b14;
      --bg-navy: #0f172a;
      --bg-card: rgba(15, 23, 42, 0.94);
      --bg-elevated: #1e293b;
      --border-subtle: #334155;
      --gold: #ffd700;
      --gold-deep: #eab308;
      --emerald: #10b981;
      --emerald-soft: rgba(16, 185, 129, 0.14);
      --danger: #ef4444;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at top center, #1e293b 0%, var(--bg-navy) 45%, var(--bg-deep) 100%);
      color: var(--text-main);
      min-height: 100vh;
      padding: 14px 12px 52px;
      line-height: 1.45;
    }
    .shell { max-width: 1120px; margin: 0 auto; }
    .topbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--bg-card);
      border: 1px solid rgba(234, 179, 8, 0.45);
      border-radius: 20px;
      padding: 12px 16px;
      margin-bottom: 16px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      overflow: hidden;
      border: 1.5px solid var(--gold);
      box-shadow: 0 4px 14px rgba(234, 179, 8, 0.35);
      flex-shrink: 0;
      background: #0f172a;
    }
    .brand-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .brand-title { font-size: 19px; font-weight: 900; color: var(--gold); letter-spacing: 0.8px; }
    .brand-sub { font-size: 12px; color: var(--text-muted); font-weight: 600; }
    .topbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .driver-chip {
      display: none;
      align-items: center;
      gap: 8px;
      background: rgba(234, 179, 8, 0.12);
      border: 1px solid rgba(234, 179, 8, 0.45);
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
    }
    .driver-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid var(--gold);
    }
    .pwa-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.14) 0%, rgba(15, 23, 42, 0.95) 100%);
      border: 1px solid rgba(234, 179, 8, 0.45);
      border-radius: 16px;
      padding: 12px 16px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    .auth-wrapper { max-width: 460px; margin: 28px auto; }
    .card {
      background: var(--bg-card);
      border: 1.5px solid rgba(234, 179, 8, 0.55);
      border-radius: 22px;
      padding: 22px 18px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
    }
    .card-subtle {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 22px;
      padding: 18px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
    }
    .badge {
      display: inline-block;
      background: rgba(234, 179, 8, 0.16);
      border: 1px solid var(--gold-deep);
      color: var(--gold);
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 1px;
      padding: 4px 12px;
      border-radius: 14px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .btn-gold {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      background: linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%);
      color: #0f172a;
      font-size: 15px;
      font-weight: 800;
      padding: 15px 18px;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      min-height: 48px;
      box-shadow: 0 8px 22px rgba(234, 179, 8, 0.28);
    }
    .btn-gold:disabled { opacity: 0.6; cursor: wait; }
    .btn-google {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      background: #ffffff;
      color: #111827;
      font-size: 15px;
      font-weight: 800;
      padding: 15px 18px;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      min-height: 50px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    }
    .btn-google:disabled { opacity: 0.65; cursor: wait; }
    .btn-outline {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: var(--bg-elevated);
      border: 1px solid #475569;
      color: var(--text-main);
      font-size: 13px;
      font-weight: 700;
      padding: 10px 14px;
      border-radius: 12px;
      cursor: pointer;
      min-height: 44px;
      text-decoration: none;
    }
    .btn-emerald {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: var(--emerald-soft);
      border: 1px solid var(--emerald);
      color: #34d399;
      font-size: 13px;
      font-weight: 800;
      padding: 10px 14px;
      border-radius: 12px;
      cursor: pointer;
      min-height: 44px;
    }
    .btn-danger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: rgba(239, 68, 68, 0.14);
      border: 1px solid #ef4444;
      color: #fca5a5;
      font-size: 13px;
      font-weight: 700;
      padding: 10px 14px;
      border-radius: 12px;
      cursor: pointer;
      min-height: 44px;
    }
    .alert {
      display: none;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13px;
      font-weight: 600;
      margin-top: 12px;
      text-align: left;
    }
    .alert-error { background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; display: block; }
    .alert-info { background: rgba(59, 130, 246, 0.14); border: 1px solid #3b82f6; color: #93c5fd; display: block; }
    .alert-success { background: var(--emerald-soft); border: 1px solid var(--emerald); color: #6ee7b7; display: block; }
    .alert-warn { background: rgba(245, 158, 11, 0.16); border: 1px solid #f59e0b; color: #fde047; display: block; }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-box {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 14px;
      text-align: left;
    }
    .kpi-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; }
    .kpi-value { font-size: 24px; font-weight: 900; color: var(--gold); margin-top: 4px; font-variant-numeric: tabular-nums; }

    .main-grid {
      display: grid;
      grid-template-columns: 380px minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 900px) {
      .main-grid { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    .section-title { font-size: 17px; font-weight: 900; color: var(--gold); margin-bottom: 4px; }
    .section-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; }

    .qr-panel {
      display: none;
      margin-top: 14px;
      background: var(--bg-elevated);
      border: 1px dashed var(--gold-deep);
      border-radius: 18px;
      padding: 14px;
      text-align: center;
    }
    .qr-svg-wrap {
      background: #ffffff;
      border-radius: 16px;
      padding: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 8px auto 10px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    }
    .qr-svg-wrap svg { width: 220px; height: 220px; display: block; }
    .qr-code-pill {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 2px;
      color: var(--gold);
      margin-bottom: 4px;
      font-variant-numeric: tabular-nums;
    }
    .qr-timer {
      display: inline-block;
      font-size: 12px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 10px;
      background: rgba(234, 179, 8, 0.16);
      color: #fde047;
      margin-bottom: 10px;
      font-variant-numeric: tabular-nums;
    }
    .qr-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .search-input {
      width: 100%;
      padding: 13px 14px;
      border-radius: 12px;
      border: 1px solid #475569;
      background: #0b1220;
      color: var(--text-main);
      font-size: 14px;
      outline: none;
      margin-bottom: 12px;
    }
    .search-input:focus { border-color: var(--gold); }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; }
    .tab-btn {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 700;
      padding: 9px 13px;
      border-radius: 12px;
      cursor: pointer;
      min-height: 42px;
    }
    .tab-btn.active {
      background: rgba(234, 179, 8, 0.18);
      border-color: var(--gold-deep);
      color: var(--gold);
    }

    .clients-stack { display: flex; flex-direction: column; gap: 12px; }
    .client-card {
      background: rgba(30, 41, 59, 0.72);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 14px;
    }
    .client-card.has-reward {
      border-color: rgba(234, 179, 8, 0.75);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(234, 179, 8, 0.08) 100%);
    }
    .client-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
    .client-name { font-size: 16px; font-weight: 800; color: var(--text-main); }
    .client-phone { font-size: 13px; color: #cbd5e1; margin-top: 2px; font-variant-numeric: tabular-nums; }
    .points-badge {
      background: #0f172a;
      border: 1px solid var(--gold-deep);
      color: var(--gold);
      font-size: 14px;
      font-weight: 900;
      padding: 6px 11px;
      border-radius: 12px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .progress-track {
      width: 100%;
      height: 8px;
      background: #0f172a;
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #eab308 0%, #ffd700 100%);
      border-radius: 999px;
      transition: width 0.25s ease;
    }
    .client-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .reward-pill {
      background: linear-gradient(135deg, var(--gold) 0%, #f59e0b 100%);
      color: #111827;
      font-weight: 900;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
    }
    .status-pill-redeemed {
      background: rgba(16, 185, 129, 0.16);
      border: 1px solid var(--emerald);
      color: #6ee7b7;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11px;
    }
    .client-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .client-actions button { flex: 1 1 auto; }

    .history-row {
      background: rgba(30, 41, 59, 0.68);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .empty-state {
      text-align: center;
      padding: 28px 16px;
      color: var(--text-muted);
      border: 1px dashed var(--border-subtle);
      border-radius: 16px;
      font-size: 14px;
    }

    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.8);
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 50;
    }
    .modal-backdrop.open { display: flex; }
    .modal-card {
      background: #0f172a;
      border: 1.5px solid var(--gold-deep);
      border-radius: 20px;
      padding: 22px;
      max-width: 460px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
    }
    .modal-card h3 { font-size: 18px; color: var(--gold); margin-bottom: 8px; }
    .form-group { margin-bottom: 12px; text-align: left; }
    .form-group label { display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; }
    .form-group input {
      width: 100%;
      padding: 13px;
      border-radius: 12px;
      border: 1px solid #475569;
      background: #070b14;
      color: #ffffff;
      font-size: 15px;
    }
    .modal-actions { display: flex; gap: 10px; margin-top: 16px; }
    .modal-actions button { flex: 1; }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-icon"><img src="/icons/icon-192.png" alt="Ícone CLIENTE VIP" /></div>
        <div>
          <div class="brand-title">CLIENTE VIP</div>
          <div class="brand-sub">Área do Motorista &bull; Sistema Web PWA</div>
        </div>
      </div>
      <div class="topbar-right">
        <button id="btnInstallPwa" type="button" class="btn-outline" style="display:none;" onclick="installPwa()">📲 Instalar App Web</button>
        <button id="btnPwaHelp" type="button" class="btn-outline" onclick="openPwaModal()">📌 Tela Inicial</button>
        <div id="driverChip" class="driver-chip">
          <img id="driverAvatar" class="driver-avatar" alt="Foto do motorista" style="display:none;" />
          <span id="driverLabel"></span>
        </div>
        <button id="btnSignOut" type="button" class="btn-outline" style="display:none;" onclick="signOutDriver()">Sair</button>
      </div>
    </header>

    <div id="pwaInstallBanner" class="pwa-banner" style="display:none;">
      <div>
        <strong style="color:var(--gold);">Adicione o CLIENTE VIP à tela inicial do celular</strong>
        <div style="font-size:12px;color:var(--text-muted);">Abra como aplicativo direto no navegador sem precisar instalar APK.</div>
      </div>
      <button type="button" class="btn-gold" style="width:auto;padding:10px 16px;min-height:42px;font-size:13px;" onclick="installPwa()">📲 Adicionar Ícone</button>
    </div>

    <section id="authSection" class="auth-wrapper">
      <div class="card" style="text-align:center;">
        <div class="badge">Acesso do Motorista</div>
        <h1 style="font-size:24px;font-weight:900;color:var(--gold);margin-bottom:8px;">Bem-vindo, Motorista VIP</h1>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:22px;">
          Entre com sua conta Google para gerar QR Codes de uso único, controlar pontos e recompensas e acompanhar seus clientes em tempo real.
        </p>
        <button id="btnGoogleSignIn" type="button" class="btn-google" onclick="signInWithGoogle()">
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
          </svg>
          Entrar com Google
        </button>
        <div id="authStatus" class="alert" style="display:none;"></div>
      </div>
    </section>

    <main id="dashboardSection" style="display:none;">
      <div class="kpi-grid">
        <div class="kpi-box">
          <div class="kpi-label">Clientes Ativos</div>
          <div class="kpi-value" id="kpiClients">0</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Corridas Registradas</div>
          <div class="kpi-value" id="kpiRides">0</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Prêmios Disponíveis</div>
          <div class="kpi-value" id="kpiRewardsAvail">0</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">Prêmios Resgatados</div>
          <div class="kpi-value" id="kpiRewardsRedeemed">0</div>
        </div>
      </div>

      <div id="globalNotice" class="alert" style="display:none;margin-bottom:16px;"></div>

      <div class="main-grid">
        <section class="card">
          <div class="section-title">Gerar QR Code da Corrida</div>
          <div class="section-sub">
            O passageiro lê com a câmera e abre direto no navegador (sem app e sem login), informando apenas nome e telefone.
          </div>

          <button id="btnGenerateQr" type="button" class="btn-gold" onclick="generateNewQrCode()">
            📱 GERAR QR CODE (+1 PONTO)
          </button>

          <div id="qrPanel" class="qr-panel">
            <div class="qr-code-pill" id="qrCodeLabel">VIP-0000-0000</div>
            <div class="qr-timer" id="qrTimerLabel">Expira em 15:00</div>
            <div id="qrStatusBanner" class="alert alert-info" style="margin-top:0;margin-bottom:10px;text-align:center;">
              ⏳ Aguardando passageiro escanear...
            </div>
            <div class="qr-svg-wrap" id="qrSvgBox"></div>
            <div style="font-size:11px;color:var(--text-muted);word-break:break-all;margin-bottom:8px;" id="qrUrlPreview"></div>
            <div class="qr-actions">
              <button type="button" class="btn-outline" onclick="copyQrLink()">📋 Copiar Link</button>
              <button type="button" class="btn-outline" onclick="shareQrLink()">📤 Compartilhar</button>
            </div>
          </div>
        </section>

        <section class="card-subtle">
          <div class="toolbar">
            <div class="tabs">
              <button type="button" class="tab-btn active" id="navClients" onclick="setMainSection('clients')">👥 Clientes (<span id="navCountClients">0</span>)</button>
              <button type="button" class="tab-btn" id="navRides" onclick="setMainSection('rides')">🧾 Corridas (<span id="navCountRides">0</span>)</button>
              <button type="button" class="tab-btn" id="navRewards" onclick="setMainSection('rewards')">🎁 Recompensas (<span id="navCountRewards">0</span>)</button>
            </div>
            <div class="toolbar-actions">
              <button type="button" class="btn-outline" onclick="downloadDriverBackup()">💾 Backup</button>
              <button type="button" class="btn-outline" onclick="loadDriverDashboard(true)">🔄 Atualizar</button>
            </div>
          </div>

          <input id="searchClients" type="search" class="search-input" placeholder="🔎 Buscar por nome, telefone ou código VIP..." oninput="renderMainContent()" />

          <div id="clientSubTabs" class="tabs" style="margin-bottom:14px;">
            <button type="button" class="tab-btn active" id="tabActive" onclick="setFilterTab('active')">Ativos (<span id="countActive">0</span>)</button>
            <button type="button" class="tab-btn" id="tabRewards" onclick="setFilterTab('rewards')">Com Prêmio (<span id="countRewards">0</span>)</button>
            <button type="button" class="tab-btn" id="tabArchived" onclick="setFilterTab('archived')">Arquivados (<span id="countArchived">0</span>)</button>
          </div>

          <div id="mainContentArea" class="clients-stack"></div>
        </section>
      </div>
    </main>
  </div>

  <div id="editModal" class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal-card">
      <h3>Editar Cliente VIP</h3>
      <form onsubmit="submitEditClient(event)">
        <div class="form-group">
          <label for="editClientName">Nome Completo</label>
          <input id="editClientName" type="text" required minlength="2" maxlength="100" />
        </div>
        <div class="form-group">
          <label for="editClientPhone">Telefone com DDD</label>
          <input id="editClientPhone" type="tel" inputmode="numeric" required />
        </div>
        <div id="editModalError" class="alert alert-error" style="display:none;"></div>
        <div class="modal-actions">
          <button type="button" class="btn-outline" onclick="closeEditModal()">Cancelar</button>
          <button type="submit" id="btnSaveEdit" class="btn-gold">Salvar</button>
        </div>
      </form>
    </div>
  </div>

  <div id="historyModal" class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal-card">
      <h3 id="historyModalTitle">Histórico do Cliente</h3>
      <p id="historyModalSub" style="font-size:12px;color:var(--text-muted);margin-bottom:12px;"></p>
      <div id="historyModalBody" class="clients-stack"></div>
      <div class="modal-actions">
        <button type="button" class="btn-outline" onclick="closeHistoryModal()">Fechar</button>
      </div>
    </div>
  </div>

  <div id="deleteModal" class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal-card">
      <h3 style="color:#fca5a5;">Excluir Cliente?</h3>
      <p id="deleteModalText" style="font-size:13px;color:#cbd5e1;line-height:1.5;"></p>
      <div class="modal-actions">
        <button type="button" class="btn-outline" onclick="closeDeleteModal()">Cancelar</button>
        <button type="button" id="btnConfirmDelete" class="btn-danger" onclick="confirmDeleteClient()">Excluir Definitivo</button>
      </div>
    </div>
  </div>

  <div id="pwaModal" class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal-card">
      <h3>Adicionar CLIENTE VIP à Tela Inicial</h3>
      <p style="font-size:13px;color:#cbd5e1;line-height:1.55;margin-bottom:12px;">
        Tenha acesso rápido ao painel do motorista como um aplicativo direto na tela do seu celular:
      </p>
      <div style="font-size:13px;color:#e2e8f0;background:#1e293b;padding:12px;border-radius:12px;line-height:1.6;">
        <strong>No Android (Chrome):</strong><br>
        Toque no menu <strong>&#8942;</strong> (3 pontinhos) no canto superior direito &rarr; toque em <strong>&ldquo;Adicionar à tela inicial&rdquo;</strong> ou <strong>&ldquo;Instalar app&rdquo;</strong>.<br><br>
        <strong>No iPhone (Safari):</strong><br>
        Toque no botão <strong>Compartilhar</strong> (quadrado com seta) &rarr; escolha <strong>&ldquo;Adicionar à Tela de Início&rdquo;</strong>.
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-gold" onclick="closePwaModal()">Entendi</button>
      </div>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
  <script>
    var FIREBASE_CONFIG = ${JSON.stringify(firebaseWebConfig)};
    var PUBLIC_BASE_URL = ${JSON.stringify(safeBaseUrl)};
    var currentUser = null;
    var allClients = [];
    var allRides = [];
    var allRewards = [];
    var mainSection = 'clients';
    var currentFilter = 'active';
    var activeQr = null;
    var qrTimerInterval = null;
    var qrPollInterval = null;
    var editingClient = null;
    var deletingClient = null;
    var deferredInstallPrompt = null;

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').catch(function() {});
      });
    }

    window.addEventListener('beforeinstallprompt', function(ev) {
      ev.preventDefault();
      deferredInstallPrompt = ev;
      document.getElementById('btnInstallPwa').style.display = 'inline-flex';
      document.getElementById('pwaInstallBanner').style.display = 'flex';
    });

    window.addEventListener('appinstalled', function() {
      deferredInstallPrompt = null;
      document.getElementById('btnInstallPwa').style.display = 'none';
      document.getElementById('pwaInstallBanner').style.display = 'none';
    });

    async function installPwa() {
      if (!deferredInstallPrompt) {
        openPwaModal();
        return;
      }
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch (_) {}
      deferredInstallPrompt = null;
      document.getElementById('btnInstallPwa').style.display = 'none';
      document.getElementById('pwaInstallBanner').style.display = 'none';
    }

    function openPwaModal() { document.getElementById('pwaModal').className = 'modal-backdrop open'; }
    function closePwaModal() { document.getElementById('pwaModal').className = 'modal-backdrop'; }

    if (typeof firebase !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey) {
      firebase.initializeApp(FIREBASE_CONFIG);
      firebase.auth().languageCode = 'pt';
      firebase.auth().getRedirectResult().catch(function(err) {
        if (err && err.code) showAuthAlert('alert-error', formatFirebaseAuthError(err));
      });
      firebase.auth().onAuthStateChanged(function(user) {
        currentUser = user || null;
        if (currentUser) onSignedIn(currentUser);
        else onSignedOut();
      });
    } else {
      showAuthAlert('alert-error', 'Não foi possível carregar o serviço de login do Google neste navegador.');
    }

    function showAuthAlert(cls, text) {
      var el = document.getElementById('authStatus');
      if (!text) { el.style.display = 'none'; el.className = 'alert'; el.textContent = ''; return; }
      el.className = 'alert ' + cls;
      el.style.display = 'block';
      el.textContent = text;
    }

    function showGlobalNotice(cls, text) {
      var el = document.getElementById('globalNotice');
      if (!text) { el.style.display = 'none'; return; }
      el.className = 'alert ' + cls;
      el.style.display = 'block';
      el.textContent = text;
    }

    function formatFirebaseAuthError(err) {
      var code = (err && err.code) || '';
      if (code === 'auth/unauthorized-domain') {
        return 'Este domínio (' + window.location.hostname + ') precisa ser autorizado em Firebase Authentication -> Authorized domains para liberar o login Google.';
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return 'Login cancelado antes de concluir.';
      }
      return (err && err.message) ? err.message : 'Falha ao autenticar com o Google.';
    }

    async function signInWithGoogle() {
      if (typeof firebase === 'undefined') return;
      var btn = document.getElementById('btnGoogleSignIn');
      btn.disabled = true;
      showAuthAlert('alert-info', 'Conectando com sua conta Google...');
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await firebase.auth().signInWithPopup(provider);
      } catch (err) {
        if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) {
          try { await firebase.auth().signInWithRedirect(provider); return; }
          catch (rErr) { showAuthAlert('alert-error', formatFirebaseAuthError(rErr)); }
        } else {
          showAuthAlert('alert-error', formatFirebaseAuthError(err));
        }
      } finally {
        btn.disabled = false;
      }
    }

    async function signOutDriver() {
      stopQrMonitoring();
      activeQr = null;
      allClients = [];
      allRides = [];
      allRewards = [];
      if (typeof firebase !== 'undefined') await firebase.auth().signOut();
    }

    function onSignedIn(user) {
      document.getElementById('authSection').style.display = 'none';
      document.getElementById('dashboardSection').style.display = 'block';
      document.getElementById('btnSignOut').style.display = 'inline-flex';
      var chip = document.getElementById('driverChip');
      chip.style.display = 'inline-flex';
      document.getElementById('driverLabel').textContent = user.displayName || user.email || 'Motorista VIP';
      var avatar = document.getElementById('driverAvatar');
      if (user.photoURL) { avatar.src = user.photoURL; avatar.style.display = 'block'; }
      else { avatar.style.display = 'none'; }
      showAuthAlert('', '');
      loadDriverDashboard(false);
    }

    function onSignedOut() {
      stopQrMonitoring();
      document.getElementById('authSection').style.display = 'block';
      document.getElementById('dashboardSection').style.display = 'none';
      document.getElementById('btnSignOut').style.display = 'none';
      document.getElementById('driverChip').style.display = 'none';
      document.getElementById('qrPanel').style.display = 'none';
    }

    async function authorizedFetch(path, options) {
      if (!currentUser) throw new Error('Sessão encerrada.');
      var token = await currentUser.getIdToken();
      var opts = Object.assign({}, options || {});
      opts.headers = Object.assign({}, opts.headers || {}, {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      });
      var resp = await fetch(path, opts);
      if (resp.status === 401) {
        token = await currentUser.getIdToken(true);
        opts.headers['Authorization'] = 'Bearer ' + token;
        resp = await fetch(path, opts);
      }
      var data = await resp.json().catch(function() { return {}; });
      if (!resp.ok || data.ok === false) throw new Error(data.error || ('Erro HTTP ' + resp.status));
      return data;
    }

    async function loadDriverDashboard(showFeedback) {
      try {
        showGlobalNotice('', '');
        var data = await authorizedFetch('/api/driver/clients', { method: 'GET' });
        allClients = data.clients || [];
        allRides = data.rides || [];
        allRewards = data.rewards || [];
        updateKpis();
        renderMainContent();
        if (data.activeQr && (!activeQr || activeQr.codeId === data.activeQr.codeId)) {
          displayActiveQr(data.activeQr);
        }
        if (showFeedback) {
          showGlobalNotice('alert-success', 'Painel atualizado com sucesso!');
          setTimeout(function() { showGlobalNotice('', ''); }, 2500);
        }
      } catch (err) {
        showGlobalNotice('alert-error', err.message || 'Erro ao carregar dados do motorista.');
      }
    }

    function updateKpis() {
      var active = allClients.filter(function(c) { return !c.isArchived; });
      var archived = allClients.filter(function(c) { return !!c.isArchived; });
      var withRewards = active.filter(function(c) { return Number(c.rewardsAvailable || 0) > 0; });
      var totalRewardsAvail = active.reduce(function(sum, c) { return sum + Number(c.rewardsAvailable || 0); }, 0);
      var totalRewardsRed = allClients.reduce(function(sum, c) { return sum + Number(c.rewardsRedeemed || 0); }, 0);
      var totalRides = Math.max(
        allRides.length,
        allClients.reduce(function(sum, c) { return sum + Number(c.totalRides || 0); }, 0)
      );

      document.getElementById('kpiClients').textContent = active.length;
      document.getElementById('kpiRides').textContent = totalRides;
      document.getElementById('kpiRewardsAvail').textContent = totalRewardsAvail;
      document.getElementById('kpiRewardsRedeemed').textContent = totalRewardsRed;

      document.getElementById('navCountClients').textContent = active.length;
      document.getElementById('navCountRides').textContent = allRides.length;
      document.getElementById('navCountRewards').textContent = allRewards.length;

      document.getElementById('countActive').textContent = active.length;
      document.getElementById('countRewards').textContent = withRewards.length;
      document.getElementById('countArchived').textContent = archived.length;
    }

    function setMainSection(section) {
      mainSection = section;
      document.getElementById('navClients').className = 'tab-btn' + (section === 'clients' ? ' active' : '');
      document.getElementById('navRides').className = 'tab-btn' + (section === 'rides' ? ' active' : '');
      document.getElementById('navRewards').className = 'tab-btn' + (section === 'rewards' ? ' active' : '');
      document.getElementById('clientSubTabs').style.display = section === 'clients' ? 'flex' : 'none';
      renderMainContent();
    }

    function setFilterTab(tab) {
      currentFilter = tab;
      document.getElementById('tabActive').className = 'tab-btn' + (tab === 'active' ? ' active' : '');
      document.getElementById('tabRewards').className = 'tab-btn' + (tab === 'rewards' ? ' active' : '');
      document.getElementById('tabArchived').className = 'tab-btn' + (tab === 'archived' ? ' active' : '');
      renderMainContent();
    }

    function formatBrPhoneDisplay(digits) {
      var d = String(digits || '').replace(/\\D/g, '');
      if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
      if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return digits || '';
    }

    function formatDateTimePt(iso) {
      if (!iso) return 'Agora';
      var ms = Date.parse(iso);
      if (isNaN(ms)) return String(iso);
      return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    }

    function esc(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function renderMainContent() {
      if (mainSection === 'rides') return renderRidesHistory();
      if (mainSection === 'rewards') return renderRewardsHistory();
      return renderClientsList();
    }

    function renderClientsList() {
      var container = document.getElementById('mainContentArea');
      var query = (document.getElementById('searchClients').value || '').trim().toLowerCase();
      var queryDigits = query.replace(/\\D/g, '');

      var filtered = allClients.filter(function(c) {
        if (currentFilter === 'archived' && !c.isArchived) return false;
        if (currentFilter !== 'archived' && c.isArchived) return false;
        if (currentFilter === 'rewards' && Number(c.rewardsAvailable || 0) <= 0) return false;
        if (!query) return true;
        var nameMatch = String(c.name || '').toLowerCase().indexOf(query) !== -1;
        var phoneMatch = queryDigits ? String(c.phone || '').indexOf(queryDigits) !== -1 : String(c.phone || '').indexOf(query) !== -1;
        return nameMatch || phoneMatch;
      });

      if (filtered.length === 0) {
        var msg = query
          ? 'Nenhum cliente encontrado para a busca informada.'
          : (currentFilter === 'archived'
              ? 'Nenhum cliente arquivado.'
              : (currentFilter === 'rewards' ? 'Nenhum cliente com corrida grátis disponível no momento.' : 'Nenhum cliente VIP registrado ainda. Gere um QR Code ao lado para começar!'));
        container.innerHTML = '<div class="empty-state">' + esc(msg) + '</div>';
        return;
      }

      container.innerHTML = filtered.map(function(c) {
        var pts = Number(c.points || 0);
        var pct = Math.max(0, Math.min(100, pts * 10));
        var rewardsAvail = Number(c.rewardsAvailable || 0);
        var rewardsRed = Number(c.rewardsRedeemed || 0);
        var rides = Number(c.totalRides || 0);
        var stars = '';
        for (var i = 1; i <= 10; i++) stars += (i <= pts ? '★' : '☆');

        var safeIdAttr = esc(c.id);
        return '<article class="client-card' + (rewardsAvail > 0 ? ' has-reward' : '') + '">' +
          '<div class="client-top">' +
            '<div>' +
              '<div class="client-name">' + esc(c.name) + '</div>' +
              '<div class="client-phone">📞 ' + esc(formatBrPhoneDisplay(c.phone)) + '</div>' +
            '</div>' +
            '<div class="points-badge">' + pts + '/10 pts</div>' +
          '</div>' +
          '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
          '<div class="client-meta">' +
            '<span style="color:var(--gold);letter-spacing:1.5px;">' + stars + '</span>' +
            '<span>&bull; ' + rides + ' corrida(s)</span>' +
            (rewardsAvail > 0 ? '<span class="reward-pill">🎁 ' + rewardsAvail + ' Grátis Disponível</span>' : '') +
            (rewardsRed > 0 ? '<span>&bull; ' + rewardsRed + ' resgatada(s)</span>' : '') +
          '</div>' +
          '<div class="client-actions">' +
            (rewardsAvail > 0 ? '<button type="button" class="btn-emerald" onclick="redeemClientReward(\\'' + safeIdAttr + '\\')">🎁 Resgatar Grátis</button>' : '') +
            '<button type="button" class="btn-outline" onclick="openHistoryModal(\\'' + safeIdAttr + '\\')">📜 Histórico</button>' +
            '<button type="button" class="btn-outline" onclick="openEditModal(\\'' + safeIdAttr + '\\')">✏️ Editar</button>' +
            '<button type="button" class="btn-outline" onclick="toggleArchiveClient(\\'' + safeIdAttr + '\\', ' + (c.isArchived ? 'false' : 'true') + ')">' + (c.isArchived ? '♻️ Restaurar' : '📦 Arquivar') + '</button>' +
            '<button type="button" class="btn-danger" onclick="openDeleteModal(\\'' + safeIdAttr + '\\')">🗑️ Excluir</button>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    function renderRidesHistory() {
      var container = document.getElementById('mainContentArea');
      var query = (document.getElementById('searchClients').value || '').trim().toLowerCase();
      var queryDigits = query.replace(/\\D/g, '');

      var filtered = allRides.filter(function(r) {
        if (!query) return true;
        return String(r.clientName || '').toLowerCase().indexOf(query) !== -1 ||
          String(r.qrCodeId || '').toLowerCase().indexOf(query) !== -1 ||
          (queryDigits && String(r.clientPhone || '').indexOf(queryDigits) !== -1);
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma corrida registrada ainda.</div>';
        return;
      }

      container.innerHTML = filtered.map(function(r) {
        return '<div class="history-row">' +
          '<div style="text-align:left;">' +
            '<div style="font-weight:800;font-size:14px;">' + esc(r.clientName) + ' <span style="color:var(--text-muted);font-weight:600;font-size:12px;">(' + esc(formatBrPhoneDisplay(r.clientPhone)) + ')</span></div>' +
            '<div style="font-size:12px;color:var(--text-muted);">Código: ' + esc(r.qrCodeId) + ' &bull; ' + esc(formatDateTimePt(r.timestamp)) + '</div>' +
          '</div>' +
          '<div class="points-badge">+' + Number(r.pointsEarned || 1) + ' pt</div>' +
        '</div>';
      }).join('');
    }

    function renderRewardsHistory() {
      var container = document.getElementById('mainContentArea');
      var query = (document.getElementById('searchClients').value || '').trim().toLowerCase();
      var queryDigits = query.replace(/\\D/g, '');

      var filtered = allRewards.filter(function(rw) {
        if (!query) return true;
        return String(rw.clientName || '').toLowerCase().indexOf(query) !== -1 ||
          (queryDigits && String(rw.clientPhone || '').indexOf(queryDigits) !== -1);
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma recompensa gerada ainda. Ao completar 10 pontos o cliente ganha 1 corrida grátis.</div>';
        return;
      }

      container.innerHTML = filtered.map(function(rw) {
        var isAvail = rw.status === 'AVAILABLE';
        var matchingClient = allClients.find(function(c) { return c.phone === rw.clientPhone && Number(c.rewardsAvailable || 0) > 0; });
        return '<div class="history-row">' +
          '<div style="text-align:left;">' +
            '<div style="font-weight:800;font-size:14px;">' + esc(rw.clientName) + ' <span style="color:var(--text-muted);font-weight:600;font-size:12px;">(' + esc(formatBrPhoneDisplay(rw.clientPhone)) + ')</span></div>' +
            '<div style="font-size:12px;color:var(--text-muted);">Criada: ' + esc(formatDateTimePt(rw.createdAt)) + (rw.redeemedAt ? (' &bull; Resgatada: ' + esc(formatDateTimePt(rw.redeemedAt))) : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            (isAvail
              ? '<span class="reward-pill">🎁 DISPONÍVEL</span>' + (matchingClient ? '<button type="button" class="btn-emerald" style="min-height:36px;padding:6px 12px;" onclick="redeemClientReward(\\'' + esc(matchingClient.id) + '\\')">Resgatar</button>' : '')
              : '<span class="status-pill-redeemed">✅ RESGATADA</span>') +
          '</div>' +
        '</div>';
      }).join('');
    }

    function openHistoryModal(clientId) {
      var c = allClients.find(function(x) { return x.id === clientId; });
      if (!c) return;
      document.getElementById('historyModalTitle').textContent = c.name;
      document.getElementById('historyModalSub').textContent = formatBrPhoneDisplay(c.phone) + ' • ' + c.points + '/10 pontos • ' + c.totalRides + ' corrida(s)';
      var rides = allRides.filter(function(r) { return r.clientPhone === c.phone; });
      var rewards = allRewards.filter(function(rw) { return rw.clientPhone === c.phone; });

      var html = '';
      if (rewards.length > 0) {
        html += '<div style="font-size:12px;font-weight:800;color:var(--gold);margin-top:4px;">RECOMPENSAS</div>';
        html += rewards.map(function(rw) {
          return '<div class="history-row"><div>' + (rw.status === 'AVAILABLE' ? '🎁 Corrida Grátis Disponível' : '✅ Corrida Grátis Resgatada') + '<div style="font-size:11px;color:var(--text-muted);">' + esc(formatDateTimePt(rw.redeemedAt || rw.createdAt)) + '</div></div></div>';
        }).join('');
      }
      html += '<div style="font-size:12px;font-weight:800;color:var(--gold);margin-top:6px;">CORRIDAS (' + rides.length + ')</div>';
      if (rides.length === 0) {
        html += '<div class="empty-state">Nenhuma corrida registrada para este telefone.</div>';
      } else {
        html += rides.map(function(r) {
          return '<div class="history-row"><div><strong>' + esc(r.qrCodeId) + '</strong><div style="font-size:11px;color:var(--text-muted);">' + esc(formatDateTimePt(r.timestamp)) + '</div></div><div class="points-badge">+1 pt</div></div>';
        }).join('');
      }
      document.getElementById('historyModalBody').innerHTML = html;
      document.getElementById('historyModal').className = 'modal-backdrop open';
    }

    function closeHistoryModal() { document.getElementById('historyModal').className = 'modal-backdrop'; }

    async function downloadDriverBackup() {
      if (!currentUser) return;
      try {
        var token = await currentUser.getIdToken();
        var resp = await fetch('/api/driver/backup', {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!resp.ok) throw new Error('Falha ao exportar backup (' + resp.status + ')');
        var blob = await resp.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'cliente-vip-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 3000);
        showGlobalNotice('alert-success', 'Backup exportado com sucesso!');
      } catch (err) {
        showGlobalNotice('alert-error', err.message || 'Erro ao baixar backup.');
      }
    }

    async function generateNewQrCode() {
      var btn = document.getElementById('btnGenerateQr');
      btn.disabled = true;
      btn.textContent = 'Gerando QR Code...';
      showGlobalNotice('', '');
      try {
        var driverName = (currentUser && (currentUser.displayName || currentUser.email)) || 'Motorista VIP';
        var data = await authorizedFetch('/api/driver/qrcodes', {
          method: 'POST',
          body: JSON.stringify({ driverName: driverName })
        });
        if (data.qrCode) displayActiveQr(data.qrCode);
      } catch (err) {
        showGlobalNotice('alert-error', err.message || 'Erro ao gerar QR Code.');
      } finally {
        btn.disabled = false;
        btn.textContent = '📱 GERAR QR CODE (+1 PONTO)';
      }
    }

    function displayActiveQr(qr) {
      stopQrMonitoring();
      activeQr = qr;
      document.getElementById('qrPanel').style.display = 'block';
      document.getElementById('qrCodeLabel').textContent = qr.codeId;
      document.getElementById('qrSvgBox').innerHTML = qr.qrSvg || '';
      document.getElementById('qrUrlPreview').textContent = qr.rideUrl || '';

      var statusBanner = document.getElementById('qrStatusBanner');
      statusBanner.className = 'alert alert-info';
      statusBanner.style.display = 'block';
      statusBanner.textContent = '⏳ Aguardando o passageiro apontar a câmera...';

      updateQrCountdown();
      qrTimerInterval = setInterval(updateQrCountdown, 1000);
      qrPollInterval = setInterval(pollQrStatus, 3000);
    }

    function updateQrCountdown() {
      if (!activeQr || !activeQr.expiresAt) return;
      var remMs = Date.parse(activeQr.expiresAt) - Date.now();
      var timerEl = document.getElementById('qrTimerLabel');
      if (remMs <= 0) {
        timerEl.textContent = 'Expirado';
        var banner = document.getElementById('qrStatusBanner');
        if (activeQr.status !== 'USED') {
          banner.className = 'alert alert-warn';
          banner.textContent = '⌛ Este QR Code expirou. Gere um novo código quando precisar.';
        }
        stopQrMonitoring();
        return;
      }
      var totalSec = Math.floor(remMs / 1000);
      var mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
      var secs = String(totalSec % 60).padStart(2, '0');
      timerEl.textContent = 'Expira em ' + mins + ':' + secs;
    }

    async function pollQrStatus() {
      if (!activeQr || !activeQr.codeId || !currentUser) return;
      try {
        var data = await authorizedFetch('/api/driver/qrcodes/' + encodeURIComponent(activeQr.codeId), { method: 'GET' });
        if (data.qrCode && data.qrCode.status === 'USED') {
          activeQr.status = 'USED';
          stopQrMonitoring();
          document.getElementById('qrTimerLabel').textContent = 'Utilizado';
          var banner = document.getElementById('qrStatusBanner');
          banner.className = 'alert alert-success';
          banner.textContent = '✅ QR Code lido por ' + (data.qrCode.usedByName || 'Passageiro') + '! +1 ponto somado.';
          loadDriverDashboard(false);
        }
      } catch (_) {}
    }

    function stopQrMonitoring() {
      if (qrTimerInterval) { clearInterval(qrTimerInterval); qrTimerInterval = null; }
      if (qrPollInterval) { clearInterval(qrPollInterval); qrPollInterval = null; }
    }

    function copyQrLink() {
      if (!activeQr || !activeQr.rideUrl) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(activeQr.rideUrl).then(function() {
          showGlobalNotice('alert-success', 'Link do passageiro copiado para a área de transferência!');
          setTimeout(function() { showGlobalNotice('', ''); }, 2500);
        });
      }
    }

    function shareQrLink() {
      if (!activeQr || !activeQr.rideUrl) return;
      var text = 'Valide sua corrida no CLIENTE VIP e ganhe +1 ponto (direto no navegador): ' + activeQr.rideUrl;
      if (navigator.share) {
        navigator.share({ title: 'CLIENTE VIP - Pontuar Corrida', text: text, url: activeQr.rideUrl }).catch(function() {});
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
      }
    }

    async function redeemClientReward(clientId) {
      try {
        await authorizedFetch('/api/driver/clients/' + encodeURIComponent(clientId) + '/redeem', {
          method: 'POST',
          body: JSON.stringify({})
        });
        showGlobalNotice('alert-success', 'Corrida grátis resgatada com sucesso!');
        await loadDriverDashboard(false);
      } catch (err) {
        showGlobalNotice('alert-error', err.message || 'Não foi possível resgatar a corrida grátis.');
      }
    }

    async function toggleArchiveClient(clientId, archived) {
      var client = allClients.find(function(c) { return c.id === clientId; });
      if (!client) return;
      try {
        await authorizedFetch('/api/driver/clients/' + encodeURIComponent(clientId) + '/update', {
          method: 'POST',
          body: JSON.stringify({ name: client.name, phone: client.phone, isArchived: archived })
        });
        showGlobalNotice('alert-success', archived ? 'Cliente arquivado.' : 'Cliente restaurado para ativos.');
        await loadDriverDashboard(false);
      } catch (err) {
        showGlobalNotice('alert-error', err.message || 'Erro ao atualizar status do cliente.');
      }
    }

    function openEditModal(clientId) {
      editingClient = allClients.find(function(c) { return c.id === clientId; });
      if (!editingClient) return;
      document.getElementById('editClientName').value = editingClient.name || '';
      document.getElementById('editClientPhone').value = formatBrPhoneDisplay(editingClient.phone || '');
      document.getElementById('editModalError').style.display = 'none';
      document.getElementById('editModal').className = 'modal-backdrop open';
    }

    function closeEditModal() { editingClient = null; document.getElementById('editModal').className = 'modal-backdrop'; }

    async function submitEditClient(ev) {
      ev.preventDefault();
      if (!editingClient) return;
      var errEl = document.getElementById('editModalError');
      errEl.style.display = 'none';
      var btn = document.getElementById('btnSaveEdit');
      btn.disabled = true;
      try {
        var newName = document.getElementById('editClientName').value.trim();
        var newPhone = document.getElementById('editClientPhone').value.trim();
        await authorizedFetch('/api/driver/clients/' + encodeURIComponent(editingClient.id) + '/update', {
          method: 'POST',
          body: JSON.stringify({ name: newName, phone: newPhone, isArchived: !!editingClient.isArchived })
        });
        closeEditModal();
        showGlobalNotice('alert-success', 'Dados do cliente atualizados!');
        await loadDriverDashboard(false);
      } catch (err) {
        errEl.style.display = 'block';
        errEl.textContent = err.message || 'Erro ao salvar alterações.';
      } finally {
        btn.disabled = false;
      }
    }

    function openDeleteModal(clientId) {
      deletingClient = allClients.find(function(c) { return c.id === clientId; });
      if (!deletingClient) return;
      document.getElementById('deleteModalText').textContent =
        'Deseja excluir permanentemente o cliente ' + deletingClient.name + ' (' + formatBrPhoneDisplay(deletingClient.phone) + ') e todo o histórico vinculado? Esta ação não pode ser desfeita.';
      document.getElementById('deleteModal').className = 'modal-backdrop open';
    }

    function closeDeleteModal() { deletingClient = null; document.getElementById('deleteModal').className = 'modal-backdrop'; }

    async function confirmDeleteClient() {
      if (!deletingClient) return;
      var btn = document.getElementById('btnConfirmDelete');
      btn.disabled = true;
      try {
        await authorizedFetch('/api/driver/clients/' + encodeURIComponent(deletingClient.id), { method: 'DELETE' });
        closeDeleteModal();
        showGlobalNotice('alert-success', 'Cliente excluído permanentemente.');
        await loadDriverDashboard(false);
      } catch (err) {
        closeDeleteModal();
        showGlobalNotice('alert-error', err.message || 'Erro ao excluir cliente.');
      } finally {
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

function renderRideWebHtml(cleanCode) {
  const safeCode = escapeHtml(cleanCode);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>${renderPwaHeadTags('CLIENTE VIP — Área do Passageiro')}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at top, #1e293b 0%, #0f172a 55%, #070b14 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 20px 14px 48px;
      text-align: center;
      overflow-y: auto;
    }
    .card {
      background: rgba(15, 23, 42, 0.94);
      border: 1.5px solid #eab308;
      border-radius: 24px;
      padding: 24px 18px;
      max-width: 440px;
      width: 100%;
      margin: 10px auto;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.65);
    }
    .badge {
      display: inline-block;
      background: rgba(234, 179, 8, 0.16);
      border: 1px solid #eab308;
      color: #ffd700;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 1px;
      padding: 5px 12px;
      border-radius: 16px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    h1 { font-size: 24px; font-weight: 900; color: #ffd700; margin-bottom: 6px; letter-spacing: 1px; }
    .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 16px; line-height: 1.45; }
    .code-box {
      background: #1e293b;
      border: 1px dashed #eab308;
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .code-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .code-value { font-size: 22px; font-weight: 900; color: #ffd700; letter-spacing: 2px; word-break: break-all; }
    .status-banner {
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 14px;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.45;
      text-align: left;
    }
    .status-loading { background: rgba(30, 41, 59, 0.85); border: 1px solid #475569; color: #cbd5e1; }
    .status-valid { background: rgba(16, 185, 129, 0.14); border: 1px solid #10b981; color: #6ee7b7; }
    .status-error { background: rgba(239, 68, 68, 0.16); border: 1px solid #ef4444; color: #fca5a5; }
    .form-group { text-align: left; margin-bottom: 12px; }
    .form-group label { display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; }
    .form-group input {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid #475569;
      background: #0f172a;
      color: #ffffff;
      font-size: 15px;
      outline: none;
    }
    .form-group input:focus { border-color: #ffd700; }
    .hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .progress-track {
      width: 100%;
      height: 8px;
      background: #0f172a;
      border-radius: 999px;
      overflow: hidden;
      margin: 8px 0 4px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #eab308 0%, #ffd700 100%);
      border-radius: 999px;
      transition: width 0.25s ease;
    }
    .btn-primary {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #ffd700 0%, #eab308 100%);
      color: #0f172a;
      text-decoration: none;
      font-size: 15px;
      font-weight: 800;
      padding: 16px;
      border-radius: 14px;
      margin-top: 4px;
      border: none;
      cursor: pointer;
      min-height: 48px;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .success-card {
      display: none;
      background: rgba(16, 185, 129, 0.12);
      border: 1.5px solid #10b981;
      border-radius: 16px;
      padding: 18px;
      margin-top: 8px;
    }
    .success-card h2 { color: #34d399; font-size: 19px; margin-bottom: 8px; }
    .points-pill {
      display: inline-block;
      background: #eab308;
      color: #000000;
      font-weight: 900;
      font-size: 18px;
      padding: 8px 18px;
      border-radius: 12px;
      margin: 10px 0;
    }
    .stars-row { font-size: 18px; letter-spacing: 3px; color: #ffd700; margin: 8px 0; }
    .free-ride-box {
      background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%);
      color: #111827;
      border-radius: 12px;
      padding: 12px;
      font-weight: 800;
      font-size: 13px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Área do Passageiro &bull; Direto no Navegador</div>
    <h1>CLIENTE VIP</h1>
    <p class="subtitle">Informe apenas seu nome e telefone ou WhatsApp para somar +1 ponto. Ao completar 10 pontos você ganha 1 corrida grátis na cidade!</p>

    <div class="code-box">
      <div class="code-label">Código da Corrida</div>
      <div class="code-value" id="vipCodeDisplay">${safeCode || 'SEM CÓDIGO'}</div>
    </div>

    <div id="statusBanner" class="status-banner status-loading">
      Verificando validade do QR Code no servidor...
    </div>

    <div id="formSection" style="display:none;">
      <form id="rideForm" onsubmit="submitRideForm(event)">
        <div class="form-group">
          <label for="passengerName">Seu Nome Completo</label>
          <input id="passengerName" type="text" placeholder="Ex: Maria da Silva" required minlength="2" maxlength="100" autocomplete="name" />
        </div>
        <div class="form-group">
          <label for="passengerPhone">Seu Telefone ou WhatsApp com DDD</label>
          <input id="passengerPhone" type="tel" inputmode="numeric" placeholder="Ex: (11) 98765-4321" required autocomplete="tel" />
          <div class="hint">Se você já for cliente VIP, seus pontos serão somados automaticamente sem duplicar cadastro!</div>
        </div>
        <div id="formError" class="status-banner status-error" style="display:none;"></div>
        <button type="submit" id="btnSubmitRide" class="btn-primary">
          ⭐ CONFIRMAR CORRIDA (+1 PONTO)
        </button>
      </form>
    </div>

    <div id="successCard" class="success-card">
      <h2 id="successTitle">Corrida Confirmada!</h2>
      <p id="successGreeting" style="font-size:13px; color:#e2e8f0; margin-bottom:6px;"></p>
      <div id="pointsPill" class="points-pill">+1 PONTO</div>
      <div id="starsRow" class="stars-row"></div>
      <div class="progress-track"><div id="successBar" class="progress-fill" style="width:0%;"></div></div>
      <p id="successSub" style="font-size:12px; color:#cbd5e1; margin-top:8px;"></p>
      <div id="freeRideBox" class="free-ride-box" style="display:none;"></div>
    </div>
  </div>

  <script>
    var VIP_CODE = ${JSON.stringify(cleanCode)};

    function showBanner(cls, text) {
      var b = document.getElementById('statusBanner');
      b.className = 'status-banner ' + cls;
      b.textContent = text;
    }

    function normalizeBrDigits(val) {
      var d = String(val || '').replace(/\\D/g, '');
      if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) {
        var c = d.slice(2);
        var ddd = parseInt(c.slice(0, 2), 10);
        if (ddd >= 11 && ddd <= 99) d = c;
      }
      if ((d.length === 11 || d.length === 12) && d.indexOf('0') === 0) {
        var c0 = d.slice(1);
        var ddd0 = parseInt(c0.slice(0, 2), 10);
        if (ddd0 >= 11 && ddd0 <= 99) d = c0;
      }
      return d;
    }

    function formatBrPhoneInput(digits) {
      if (digits.length === 11) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
      if (digits.length === 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
      return digits;
    }

    async function validateCodeOnServer() {
      if (!VIP_CODE) {
        showBanner('status-error', 'Nenhum código VIP foi informado. Escaneie o QR Code do motorista novamente.');
        return;
      }
      showBanner('status-loading', 'Validando QR Code no servidor...');
      try {
        var resp = await fetch('/api/ride/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: VIP_CODE })
        });
        var data = await resp.json();
        if (resp.ok && data.ok) {
          var expText = '';
          if (data.expiresAt) {
            var minsLeft = Math.max(0, Math.ceil((Date.parse(data.expiresAt) - Date.now()) / 60000));
            expText = ' • Expira em ~' + minsLeft + ' min';
          }
          showBanner('status-valid', '✅ QR Code válido! Motorista: ' + (data.driverName || 'Motorista VIP') + expText + '. Preencha seu nome e telefone abaixo.');
          document.getElementById('formSection').style.display = 'block';
          loadSavedPassenger();
          return;
        }
        document.getElementById('formSection').style.display = 'none';
        showBanner('status-error', (data && data.error) || 'QR Code inválido ou indisponível.');
      } catch (err) {
        showBanner('status-error', 'Falha de conexão ao validar o QR Code. Verifique sua internet e tente novamente.');
      }
    }

    function loadSavedPassenger() {
      try {
        var savedName = localStorage.getItem('vip_passenger_name') || '';
        var savedPhone = localStorage.getItem('vip_passenger_phone') || '';
        var nameEl = document.getElementById('passengerName');
        var phoneEl = document.getElementById('passengerPhone');
        if (savedName && !nameEl.value) nameEl.value = savedName;
        if (savedPhone && !phoneEl.value) {
          phoneEl.value = formatBrPhoneInput(normalizeBrDigits(savedPhone));
        }
      } catch (_) {}
    }

    async function submitRideForm(ev) {
      ev.preventDefault();
      var btn = document.getElementById('btnSubmitRide');
      var errEl = document.getElementById('formError');
      errEl.style.display = 'none';

      var name = document.getElementById('passengerName').value.trim();
      var phoneRaw = document.getElementById('passengerPhone').value;
      var phone = normalizeBrDigits(phoneRaw);

      if (name.length < 2) {
        errEl.style.display = 'block';
        errEl.textContent = 'Informe seu nome completo.';
        return;
      }
      if (phone.length < 10 || phone.length > 11) {
        errEl.style.display = 'block';
        errEl.textContent = 'Informe um telefone válido com DDD (ex: 11987654321).';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Confirmando Corrida...';
      try {
        var resp = await fetch('/api/ride/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: VIP_CODE,
            name: name,
            phone: phone
          })
        });
        var data = await resp.json();
        if (resp.ok && data.ok && data.result) {
          try {
            localStorage.setItem('vip_passenger_name', data.result.clientName);
            localStorage.setItem('vip_passenger_phone', data.result.clientPhone);
          } catch (_) {}
          showSuccessCard(data.result);
          return;
        }
        errEl.style.display = 'block';
        errEl.textContent = (data && data.error) || 'Não foi possível registrar sua corrida.';
      } catch (err) {
        errEl.style.display = 'block';
        errEl.textContent = 'Erro de conexão ao registrar a corrida. Tente novamente.';
      } finally {
        btn.disabled = false;
        btn.textContent = '⭐ CONFIRMAR CORRIDA (+1 PONTO)';
      }
    }

    function showSuccessCard(r) {
      document.getElementById('formSection').style.display = 'none';
      showBanner('status-valid', '✅ Corrida registrada e código VIP utilizado com sucesso!');
      var card = document.getElementById('successCard');
      card.style.display = 'block';
      document.getElementById('successTitle').textContent = r.earnedFreeRide ? '🎉 PARABÉNS! CORRIDA GRÁTIS!' : 'Corrida Confirmada!';
      document.getElementById('successGreeting').textContent = 'Olá ' + r.clientName + ', sua pontuação foi atualizada em tempo real com o motorista ' + (r.driverName || '') + '.';
      document.getElementById('pointsPill').textContent = r.currentPoints + '/10 PONTOS VIP';

      var stars = '';
      for (var i = 1; i <= 10; i++) stars += (i <= r.currentPoints ? '★' : '☆');
      document.getElementById('starsRow').textContent = stars;
      document.getElementById('successBar').style.width = Math.min(100, Number(r.currentPoints || 0) * 10) + '%';
      document.getElementById('successSub').textContent = 'Total de corridas registradas: ' + r.totalRides + (r.earnedFreeRide ? '' : ' • Faltam ' + (10 - r.currentPoints) + ' corrida(s) para sua corrida gratuita na cidade!');

      if (r.rewardsAvailable > 0) {
        var freeBox = document.getElementById('freeRideBox');
        freeBox.style.display = 'block';
        freeBox.textContent = r.earnedFreeRide
          ? '🎁 Você completou 10 pontos e ganhou 1 corrida gratuita na cidade! Total disponível: ' + r.rewardsAvailable + '.'
          : '🎁 Você possui ' + r.rewardsAvailable + ' corrida(s) gratuita(s) disponível(is) com este motorista!';
      }
    }

    validateCodeOnServer();
  </script>
</body>
</html>`;
}

module.exports = {
  escapeHtml,
  renderDriverPortalHtml,
  renderRideWebHtml
};
