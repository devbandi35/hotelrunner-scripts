// ==UserScript==
// @name         Supply Hub - Hibrit System
// @namespace    http://tampermonkey.net/
// @version      3.4.1
// @description  HotelRunner destek ekibi için hibrit modal sistem ile merkezi araçlar paneli
// @author       HotelRunner Destek Ekibi
// @match        *://*.hotelrunner.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @updateURL    https://devbandi35.github.io/hotelrunner-scripts/scripts/supply-hub.user.js
// @downloadURL  https://devbandi35.github.io/hotelrunner-scripts/scripts/supply-hub.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Global Supply Hub instance
    let supplyHubInstance = null;

    // ===== MODÜL SİSTEMİ =====
    class SupplyModule {
        constructor(config) {
            this.id = config.id;
            this.name = config.name;
            this.description = config.description;
            this.category = config.category;
            this.matchUrls = config.matchUrls || [];
            this.tools = config.tools || [];
            this.isActive = false;
        }

        // Modülün mevcut sayfada çalışıp çalışmayacağını kontrol et
        canRunOnCurrentPage() {
            if (this.matchUrls.length === 0) return true;
            const currentUrl = window.location.href;
            return this.matchUrls.some(pattern => {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(currentUrl);
            });
        }

        // Modülün UI'sını oluştur
        render() {
            const container = document.createElement('div');
            container.className = 'supply-module-container';

            // matchUrls boşsa (tüm sayfalarda aktif) veya URL kontrolü geçerse render et
            if (!this.canRunOnCurrentPage()) {
                container.innerHTML = `
                    <div class="module-inactive">
                        <p style="color: #888; font-style: italic;">
                            Bu modül mevcut sayfada kullanılamaz.
                        </p>
                    </div>
                `;
                return container;
            }

            const toolsHtml = this.tools.map(tool => `
                <button class="supply-tool-button" data-module="${this.id}" data-tool="${tool.id}">
                    ${tool.name}
                </button>
            `).join('');

            container.innerHTML = `
                <div class="module-header">
                    <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">
                        ${this.description}
                    </p>
                </div>
                <div class="tools-container">
                    ${toolsHtml}
                </div>
            `;

            return container;
        }
    }

    // ===== SUPPLY HUB ANA SINIF =====
    class SupplyHub {
        constructor() {
            this.modules = new Map();
            this.currentCategory = null;
            this.widget = null;
            this.isMinimized = false;
        }

        // Modül kaydetme
        registerModule(module) {
            this.modules.set(module.id, module);
            console.log(`Supply Hub: ${module.name} modülü kaydedildi`);
        }

        // Widget'ı başlat
        initialize() {
            this.loadState();
            this.createStyles();
            this.createWidget();
            this.attachEventListeners();
            this.renderModules();
        }

        // CSS stilleri ekle
        createStyles() {
            if (document.getElementById('supply-hub-styles')) return;

            const style = document.createElement('style');
            style.id = 'supply-hub-styles';
            style.textContent = `
                :root {
                    --sh-primary: #0ea5e9;
                    --sh-primary-dark: #0284c7;
                    --sh-bg: #ffffff;
                    --sh-border: #e5e5e5;
                    --sh-text: #333;
                    --sh-text-muted: #666;
                }

                #supply-hub-widget {
                    position: fixed;
                    width: min(380px, 90vw);
                    background: var(--sh-bg);
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                    z-index: 10000;
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                    font-size: 14px;
                    color: var(--sh-text);
                    transition: all 0.3s ease;
                    display: block;
                    opacity: 0;
                    transform: scale(0.95);
                }

                #supply-hub-widget.visible {
                    opacity: 1;
                    transform: scale(1);
                }

                #supply-hub-widget.minimized {
                    display: none !important;
                }

                .hub-header {
                    background: linear-gradient(135deg, var(--sh-primary) 0%, var(--sh-primary-dark) 100%);
                    color: white;
                    padding: 16px 20px;
                    border-radius: 12px 12px 0 0;
                    cursor: move;
                    user-select: none;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .hub-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 700;
                }

                .hub-controls {
                    display: flex;
                    gap: 8px;
                }

                .hub-control-btn {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    transition: background 0.2s;
                }

                .hub-control-btn:hover {
                    background: rgba(255,255,255,0.3);
                }

                .hub-categories {
                    background: #f8f9fa;
                    border-bottom: 1px solid var(--sh-border);
                    display: flex;
                    overflow-x: auto;
                }

                .category-tab {
                    padding: 12px 16px;
                    background: none;
                    border: none;
                    border-bottom: 3px solid transparent;
                    cursor: pointer;
                    font-weight: 600;
                    color: var(--sh-text-muted);
                    white-space: nowrap;
                    transition: all 0.2s;
                    min-width: fit-content;
                }

                .category-tab:hover {
                    background: #e9ecef;
                    color: var(--sh-text);
                }

                .category-tab.active {
                    color: var(--sh-primary);
                    border-bottom-color: var(--sh-primary);
                    background: white;
                }

                .hub-content {
                    padding: 20px;
                    max-height: 400px;
                    overflow-y: auto;
                }

                .module-section {
                    display: none;
                    margin-bottom: 20px;
                }

                .module-section.active {
                    display: block;
                }

                .module-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    color: var(--sh-text);
                    padding-bottom: 8px;
                    border-bottom: 2px solid #f0f0f0;
                }

                .supply-module-container {
                    margin-bottom: 16px;
                    padding: 16px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
                }

                .tools-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .supply-tool-button {
                    padding: 10px 16px;
                    background: white;
                    border: 1px solid var(--sh-primary);
                    color: var(--sh-primary);
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                    text-align: center;
                }

                .supply-tool-button:hover {
                    background: var(--sh-primary);
                    color: white;
                }

                .supply-tool-button:active {
                    transform: scale(0.98);
                }

                .module-inactive {
                    text-align: center;
                    padding: 20px;
                }

                #supply-hub-icon {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    width: 56px;
                    height: 56px;
                    background: var(--sh-primary);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    font-weight: 700;
                    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
                    z-index: 9999;
                    transition: all 0.2s;
                }

                #supply-hub-icon:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 16px rgba(14, 165, 233, 0.5);
                }

                #supply-hub-icon.visible {
                    display: flex;
                }

                .hub-status {
                    padding: 8px 20px;
                    background: #f8f9fa;
                    border-top: 1px solid var(--sh-border);
                    font-size: 12px;
                    color: var(--sh-text-muted);
                    border-radius: 0 0 12px 12px;
                }

                /* MODAL SYSTEM */
                .hub-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 10001;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.2s ease;
                }

                .hub-modal-overlay.visible {
                    display: flex;
                }

                .hub-mini-modal {
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    max-width: 500px;
                    width: 90vw;
                    max-height: 80vh;
                    overflow: hidden;
                    transform: scale(0.95);
                    transition: all 0.2s ease;
                }

                .hub-modal-overlay.visible .hub-mini-modal {
                    transform: scale(1);
                }

                .hub-modal-header {
                    background: linear-gradient(135deg, var(--sh-primary) 0%, var(--sh-primary-dark) 100%);
                    color: white;
                    padding: 20px 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .hub-modal-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 700;
                }

                .hub-modal-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    transition: background 0.2s;
                }

                .hub-modal-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .hub-modal-body {
                    padding: 24px;
                    max-height: 60vh;
                    overflow-y: auto;
                }

                .hub-form-group {
                    margin-bottom: 20px;
                }

                .hub-form-label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: var(--sh-text);
                    font-size: 14px;
                }

                .hub-form-input {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e9ecef;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }

                .hub-form-input:focus {
                    outline: none;
                    border-color: var(--sh-primary);
                    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
                }

                .hub-form-select {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e9ecef;
                    border-radius: 8px;
                    font-size: 14px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .hub-form-select:focus {
                    outline: none;
                    border-color: var(--sh-primary);
                    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
                }

                .hub-form-row {
                    display: flex;
                    gap: 16px;
                    align-items: end;
                }

                .hub-form-row .hub-form-group {
                    flex: 1;
                    margin-bottom: 0;
                }

                .hub-form-row .hub-form-group.auto {
                    flex: none;
                    min-width: 100px;
                }

                .hub-checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .hub-checkbox {
                    width: 18px;
                    height: 18px;
                    accent-color: var(--sh-primary);
                    cursor: pointer;
                }

                .hub-checkbox-label {
                    font-size: 14px;
                    cursor: pointer;
                    user-select: none;
                }

                .hub-modal-actions {
                    padding: 20px 24px;
                    border-top: 1px solid #e9ecef;
                    background: #f8f9fa;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }

                .hub-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }

                .hub-btn-secondary {
                    background: #f1f5f9;
                    color: #475569;
                    border: 2px solid #e2e8f0;
                }

                .hub-btn-secondary:hover {
                    background: #e2e8f0;
                    border-color: #cbd5e1;
                }

                .hub-btn-primary {
                    background: var(--sh-primary);
                    color: white;
                }

                .hub-btn-primary:hover {
                    background: var(--sh-primary-dark);
                    transform: translateY(-1px);
                }

                .hub-btn-danger {
                    background: #ef4444;
                    color: white;
                }

                .hub-btn-danger:hover {
                    background: #dc2626;
                }

                .hub-info-box {
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 16px;
                    font-size: 13px;
                    color: #0369a1;
                }

                .hub-warning-box {
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 16px;
                    font-size: 13px;
                    color: #92400e;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .hub-form-row {
                        flex-direction: column;
                    }

                    .hub-form-row .hub-form-group.auto {
                        min-width: auto;
                    }

                    .hub-modal-actions {
                        flex-direction: column;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Widget UI'sını oluştur
        createWidget() {
            // Ana widget
            this.widget = document.createElement('div');
            this.widget.id = 'supply-hub-widget';
            this.widget.style.left = '20px';
            this.widget.style.top = '20px';

            this.widget.innerHTML = `
                <div class="hub-header">
                    <h2 class="hub-title">Supply Hub</h2>
                    <div class="hub-controls">
                        <button class="hub-control-btn" id="hub-minimize" title="Küçült">−</button>
                    </div>
                </div>
                <div class="hub-categories" id="hub-categories">
                    <!-- Kategoriler buraya eklenecek -->
                </div>
                <div class="hub-content" id="hub-content">
                    <!-- Modül içerikleri buraya eklenecek -->
                </div>
                <div class="hub-status">
                    <span id="hub-status-text">Hazır</span>
                </div>
            `;

            document.body.appendChild(this.widget);

            // Minimize ikonu
            this.minimizeIcon = document.createElement('button');
            this.minimizeIcon.id = 'supply-hub-icon';
            this.minimizeIcon.innerHTML = 'SH';
            this.minimizeIcon.title = 'Supply Hub\'ı Aç';
            document.body.appendChild(this.minimizeIcon);

            // Widget'ı görünür yap (eğer minimize değilse)
            setTimeout(() => {
                if (!this.isMinimized) {
                    this.widget.classList.add('visible');
                }
            }, 100);

            // Minimize durumu varsa uygula
            if (this.isMinimized) {
                setTimeout(() => {
                    this.minimizeWidget();
                }, 150);
            }
        }

        // Modal sistem fonksiyonları
        showModal(config) {
            // Mevcut modal varsa kapat
            this.closeModal();

            // Modal overlay oluştur
            const overlay = document.createElement('div');
            overlay.className = 'hub-modal-overlay';
            overlay.id = 'hub-modal-overlay';

            // Modal content oluştur
            const modal = document.createElement('div');
            modal.className = 'hub-mini-modal';

            modal.innerHTML = `
                <div class="hub-modal-header">
                    <h3 class="hub-modal-title">${config.title}</h3>
                    <button class="hub-modal-close" id="hub-modal-close">×</button>
                </div>
                <div class="hub-modal-body" id="hub-modal-body">
                    ${config.content}
                </div>
                <div class="hub-modal-actions" id="hub-modal-actions">
                    ${config.actions || ''}
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Event listeners
            document.getElementById('hub-modal-close').addEventListener('click', () => this.closeModal());
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeModal();
            });

            // ESC key handling
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeModal();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);

            // Göster
            setTimeout(() => {
                overlay.classList.add('visible');
            }, 10);

            return overlay;
        }

        closeModal() {
            const overlay = document.getElementById('hub-modal-overlay');
            if (overlay) {
                overlay.classList.remove('visible');
                setTimeout(() => {
                    overlay.remove();
                }, 200);
            }
        }

        // Bulk Operations Modal'ları
        showBulkReadonlyModal() {
            const modalContent = `
                <div class="hub-info-box">
                    <strong>Toplu Salt Okunur İşlemi:</strong> Seçili planları salt okunur olarak işaretler veya işareti kaldırır. Standard Rate HR planları güvenlik nedeniyle atlanır.
                </div>

                <div class="hub-form-group">
                    <label class="hub-form-label">Filtre Metni (opsiyonel)</label>
                    <input type="text" class="hub-form-input" id="readonly-filter" placeholder="Örn: Non-refundable">
                    <small style="color: #666; font-size: 12px; margin-top: 4px; display: block;">
                        Boş bırakırsanız tüm planlar işlenir. Büyük/küçük harf duyarlı değildir.
                    </small>
                </div>

                <div class="hub-form-group">
                    <label class="hub-form-label">İşlem Türü</label>
                    <div style="display: flex; gap: 16px;">
                        <div class="hub-checkbox-group">
                            <input type="radio" id="readonly-add" name="readonly-action" value="add" checked class="hub-checkbox">
                            <label for="readonly-add" class="hub-checkbox-label">Salt Okunur Olarak İşaretle</label>
                        </div>
                        <div class="hub-checkbox-group">
                            <input type="radio" id="readonly-remove" name="readonly-action" value="remove" class="hub-checkbox">
                            <label for="readonly-remove" class="hub-checkbox-label">İşareti Kaldır</label>
                        </div>
                    </div>
                </div>
            `;

            const modalActions = `
                <button class="hub-btn hub-btn-secondary" id="bulk-readonly-cancel">İptal</button>
                <button class="hub-btn hub-btn-primary" id="bulk-readonly-apply">Uygula</button>
            `;

            this.showModal({
                title: 'Toplu Salt Okunur İşlemi',
                content: modalContent,
                actions: modalActions
            });

            // Event listeners
            document.getElementById('bulk-readonly-cancel').addEventListener('click', () => this.closeModal());
            document.getElementById('bulk-readonly-apply').addEventListener('click', () => {
                const filterText = document.getElementById('readonly-filter').value.trim();
                const isAdd = document.getElementById('readonly-add').checked;

                this.closeModal();
                this.executeBulkReadonly(filterText, isAdd);
            });
        }

        showBulkAdjustmentModal() {
            const modalContent = `
                <div class="hub-info-box">
                    <strong>Toplu Ek Düzenleme:</strong> Seçili planların ek düzenleme değerlerini toplu olarak ayarlar. Standard Rate HR planları güvenlik nedeniyle atlanır.
                </div>

                <div class="hub-form-row">
                    <div class="hub-form-group auto">
                        <label class="hub-form-label">İşaret</label>
                        <select class="hub-form-select" id="adj-sign">
                            <option value="1">+ (Artı)</option>
                            <option value="-1">- (Eksi)</option>
                        </select>
                    </div>
                    <div class="hub-form-group">
                        <label class="hub-form-label">Değer</label>
                        <input type="number" class="hub-form-input" id="adj-value" placeholder="Örn: 10" min="0">
                    </div>
                    <div class="hub-form-group auto">
                        <label class="hub-form-label">Tür</label>
                        <select class="hub-form-select" id="adj-type">
                            <option value="flat_rate">€ (Para)</option>
                            <option value="flat_percent">% (Yüzde)</option>
                        </select>
                    </div>
                </div>

                <div class="hub-form-group">
                    <label class="hub-form-label">Filtre Metni (opsiyonel)</label>
                    <input type="text" class="hub-form-input" id="adj-filter" placeholder="Örn: Yarım Pansiyon">
                    <small style="color: #666; font-size: 12px; margin-top: 4px; display: block;">
                        Belirli plan adları içeren planları seçmek için kullanın.
                    </small>
                </div>
            `;

            const modalActions = `
                <button class="hub-btn hub-btn-secondary" id="bulk-adj-cancel">İptal</button>
                <button class="hub-btn hub-btn-primary" id="bulk-adj-apply">Uygula</button>
            `;

            this.showModal({
                title: 'Toplu Ek Düzenleme',
                content: modalContent,
                actions: modalActions
            });

            // Event listeners
            document.getElementById('bulk-adj-cancel').addEventListener('click', () => this.closeModal());
            document.getElementById('bulk-adj-apply').addEventListener('click', () => {
                const sign = document.getElementById('adj-sign').value;
                const value = document.getElementById('adj-value').value;
                const type = document.getElementById('adj-type').value;
                const filter = document.getElementById('adj-filter').value.trim();

                if (!value || isNaN(value) || parseFloat(value) < 0) {
                    alert('Lütfen geçerli bir değer girin!');
                    return;
                }

                this.closeModal();
                this.executeBulkAdjustment(sign, value, type, filter);
            });
        }

        // Bulk operations execution functions
        executeBulkReadonly(filterText, isAdd) {
            try {
                const allItems = Array.from(document.querySelectorAll('.list-item'));
                if (allItems.length === 0) {
                    alert("İşlenecek öğe bulunamadı. Bu araç mapping sayfalarında çalışır.");
                    return;
                }

                let count = 0, skippedCount = 0;
                const filteredItems = allItems.filter(item =>
                    filterText === '' ||
                    item.querySelector('.five.main-channel')?.textContent.trim().toLowerCase().includes(filterText.toLowerCase())
                );

                filteredItems.forEach(item => {
                    const name = item.querySelector('.five.main-channel')?.textContent.trim().toLowerCase() || '';
                    if (name.includes('standard rate hr')) {
                        skippedCount++;
                        return;
                    }
                    const checkbox = item.querySelector('.read-only-checkbox');
                    if (checkbox && checkbox.checked !== isAdd) {
                        checkbox.click();
                        count++;
                    }
                });

                let message = `${count} plan için "Salt Okunur" durumu ${isAdd ? 'işaretlendi' : 'kaldırıldı'}.`;
                if (skippedCount > 0) message += `\n${skippedCount} adet "Standard Rate Hr" planı güvenlik nedeniyle atlandı.`;
                alert(message);

            } catch (error) {
                console.error('Bulk readonly error:', error);
                alert(`İşlem sırasında hata: ${error.message}`);
            }
        }

        executeBulkAdjustment(sign, value, type, filter) {
            try {
                const adjustmentItems = Array.from(document.querySelectorAll('.list-item'));
                if (adjustmentItems.length === 0) {
                    alert("İşlenecek öğe bulunamadı. Bu araç mapping sayfalarında çalışır.");
                    return;
                }

                let adjCount = 0, adjSkippedCount = 0;
                const adjFilteredItems = adjustmentItems.filter(item =>
                    filter === '' ||
                    item.querySelector('.five.main-channel')?.textContent.trim().toLowerCase().includes(filter.toLowerCase())
                );

                adjFilteredItems.forEach(item => {
                    const name = item.querySelector('.five.main-channel')?.textContent.trim().toLowerCase() || '';
                    if (name.includes('standard rate hr')) {
                        adjSkippedCount++;
                        return;
                    }
                    const form = item.querySelector('.advanced-settings-container .hr-form-group');
                    if (form) {
                        const signSelect = form.querySelector('.field_adjustment_select');
                        const valueInput = form.querySelector('.consider_data_sign');
                        const typeSelect = form.querySelector('select[name*="[adjustment_type]"]');
                        if (signSelect && valueInput && typeSelect) {
                            signSelect.value = sign;
                            valueInput.value = value;
                            typeSelect.value = type;
                            [signSelect, valueInput, typeSelect].forEach(el =>
                                el.dispatchEvent(new Event('change', { bubbles: true }))
                            );
                            adjCount++;
                        }
                    }
                });

                const typeText = type === 'flat_percent' ? '%' : '€';
                const signText = sign === '1' ? '+' : '-';
                let adjMessage = `${adjCount} plana "${signText}${value}${typeText}" ek düzenlemesi uygulandı.`;
                if (adjSkippedCount > 0) adjMessage += `\n${adjSkippedCount} adet "Standard Rate Hr" planı güvenlik nedeniyle atlandı.`;
                alert(adjMessage);

            } catch (error) {
                console.error('Bulk adjustment error:', error);
                alert(`İşlem sırasında hata: ${error.message}`);
            }
        }

        // Event listener'ları ekle
        attachEventListeners() {
            // Minimize/restore
            document.getElementById('hub-minimize').addEventListener('click', () => this.minimizeWidget());
            this.minimizeIcon.addEventListener('click', () => this.restoreWidget());

            // Drag functionality
            this.setupDragFunctionality();

            // Tool button clicks
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('supply-tool-button')) {
                    const moduleId = e.target.dataset.module;
                    const toolId = e.target.dataset.tool;
                    this.executeTool(moduleId, toolId);
                }
            });

            // Category tabs
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('category-tab')) {
                    this.switchCategory(e.target.dataset.category);
                }
            });
        }

        // Drag functionality
        setupDragFunctionality() {
            let isDragging = false;
            let startX, startY, startLeft, startTop;

            const header = this.widget.querySelector('.hub-header');

            header.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('hub-control-btn')) return;

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = this.widget.offsetLeft;
                startTop = this.widget.offsetTop;

                this.widget.style.transition = 'none';
                header.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';

                header.setPointerCapture?.(e.pointerId);
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const newLeft = startLeft + (e.clientX - startX);
                const newTop = startTop + (e.clientY - startY);

                const maxLeft = window.innerWidth - this.widget.offsetWidth;
                const maxTop = window.innerHeight - this.widget.offsetHeight;

                const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));
                const clampedTop = Math.max(0, Math.min(newTop, maxTop));

                this.widget.style.left = clampedLeft + 'px';
                this.widget.style.top = clampedTop + 'px';
            });

            document.addEventListener('mouseup', (e) => {
                if (isDragging) {
                    isDragging = false;

                    this.widget.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    header.style.cursor = 'move';
                    document.body.style.userSelect = '';

                    header.releasePointerCapture?.(e.pointerId);
                    this.saveState();
                }
            });

            // Touch support
            header.addEventListener('touchstart', (e) => {
                if (e.target.classList.contains('hub-control-btn')) return;

                const touch = e.touches[0];
                isDragging = true;
                startX = touch.clientX;
                startY = touch.clientY;
                startLeft = this.widget.offsetLeft;
                startTop = this.widget.offsetTop;

                this.widget.style.transition = 'none';
                header.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';

                e.preventDefault();
            }, { passive: false });

            document.addEventListener('touchmove', (e) => {
                if (!isDragging) return;

                const touch = e.touches[0];
                const newLeft = startLeft + (touch.clientX - startX);
                const newTop = startTop + (touch.clientY - startY);

                const maxLeft = window.innerWidth - this.widget.offsetWidth;
                const maxTop = window.innerHeight - this.widget.offsetHeight;

                this.widget.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
                this.widget.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';

                e.preventDefault();
            }, { passive: false });

            document.addEventListener('touchend', () => {
                if (isDragging) {
                    isDragging = false;
                    this.widget.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    header.style.cursor = 'move';
                    document.body.style.userSelect = '';
                    this.saveState();
                }
            });
        }

        // Modülleri render et
        renderModules() {
            const categoriesContainer = document.getElementById('hub-categories');
            const contentContainer = document.getElementById('hub-content');

            // Kategorileri grupla
            const categories = {};
            this.modules.forEach(module => {
                if (!categories[module.category]) {
                    categories[module.category] = [];
                }
                categories[module.category].push(module);
            });

            // Kategori tablarını oluştur
            categoriesContainer.innerHTML = '';
            const categoryKeys = Object.keys(categories);

            categoryKeys.forEach((category, index) => {
                const tab = document.createElement('button');
                tab.className = 'category-tab';
                tab.dataset.category = category;
                tab.textContent = category;
                if (index === 0) {
                    tab.classList.add('active');
                    this.currentCategory = category;
                }
                categoriesContainer.appendChild(tab);
            });

            // Modül içeriklerini oluştur
            contentContainer.innerHTML = '';
            Object.entries(categories).forEach(([category, modules]) => {
                const section = document.createElement('div');
                section.className = 'module-section';
                section.dataset.category = category;
                if (category === this.currentCategory) {
                    section.classList.add('active');
                }

                modules.forEach(module => {
                    const moduleElement = module.render();
                    section.appendChild(moduleElement);
                });

                contentContainer.appendChild(section);
            });

            // Status güncelle
            document.getElementById('hub-status-text').textContent =
                `${this.modules.size} modül yüklendi`;
        }

        // Kategori değiştir
        switchCategory(category) {
            document.querySelectorAll('.category-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.category === category);
            });

            document.querySelectorAll('.module-section').forEach(section => {
                section.classList.toggle('active', section.dataset.category === category);
            });

            this.currentCategory = category;
        }

        // Araç çalıştır
        executeTool(moduleId, toolId) {
            const module = this.modules.get(moduleId);
            if (!module) return;

            const tool = module.tools.find(t => t.id === toolId);
            if (!tool) return;

            try {
                document.getElementById('hub-status-text').textContent = `${tool.name} çalışıyor...`;

                if (typeof tool.action === 'function') {
                    tool.action();
                } else if (typeof tool.action === 'string') {
                    eval(tool.action);
                }

                document.getElementById('hub-status-text').textContent = `${tool.name} tamamlandı`;

                setTimeout(() => {
                    document.getElementById('hub-status-text').textContent = 'Hazır';
                }, 3000);

            } catch (error) {
                console.error('Tool execution error:', error);
                document.getElementById('hub-status-text').textContent = `Hata: ${tool.name}`;
                alert(`${tool.name} çalıştırılırken bir hata oluştu: ${error.message}`);
            }
        }

        // Widget'ı küçült
        minimizeWidget() {
            this.widget.classList.add('minimized');
            this.minimizeIcon.classList.add('visible');
            this.isMinimized = true;
            this.saveState();
        }

        // Widget'ı geri getir
        restoreWidget() {
            this.widget.classList.remove('minimized');
            this.widget.classList.add('visible');
            this.minimizeIcon.classList.remove('visible');
            this.isMinimized = false;
            this.saveState();
        }

        // State kaydet
        saveState() {
            const state = {
                position: {
                    left: this.widget.style.left,
                    top: this.widget.style.top
                },
                isMinimized: this.isMinimized,
                currentCategory: this.currentCategory
            };

            try {
                localStorage.setItem('supply-hub-state', JSON.stringify(state));
            } catch (e) {
                console.error('State save error:', e);
            }
        }

        // State yükle
        loadState() {
            try {
                const state = JSON.parse(localStorage.getItem('supply-hub-state') || '{}');

                if (state.position) {
                    // Position restore widget oluşturulduktan sonra yapılacak
                }

                this.isMinimized = state.isMinimized || false;
                this.currentCategory = state.currentCategory;
            } catch (e) {
                console.error('State load error:', e);
            }
        }
    }

    // ===== MAPPING MODÜLÜ =====
    const MappingModule = new SupplyModule({
        id: 'mapping',
        name: 'Mapping Tools',
        description: 'Oda eşleştirme araçları ve liste yönetimi',
        category: 'Mapping',
        matchUrls: [],
        tools: [
            {
                id: 'sorting',
                name: 'Sıralama',
                action: function() {
                    executeMapping('sorting');
                }
            },
            {
                id: 'coloring',
                name: 'Renklendir',
                action: function() {
                    executeMapping('coloring');
                }
            },
            {
                id: 'expand',
                name: 'Genişlet',
                action: function() {
                    executeMapping('expand');
                }
            },
            {
                id: 'filter-rooms',
                name: 'Yalnızca Seçili Odalar',
                action: function() {
                    executeMapping('filter-rooms');
                }
            }
        ]
    });

    // ===== GELİŞMİŞ AYARLAR MODÜLÜ =====
    const AdvancedSettingsModule = new SupplyModule({
        id: 'advanced-settings',
        name: 'Bulk Operations Panel',
        description: 'Acente eşleştirme sayfaları için toplu işlem araçları',
        category: 'Mapping',
        matchUrls: [],
        tools: [
            {
                id: 'toggle-advanced',
                name: 'Gelişmiş Ayarları Aç/Kapat',
                action: function() {
                    executeAdvancedSettings('toggle-advanced');
                }
            },
            {
                id: 'bulk-readonly',
                name: 'Toplu Salt Okunur İşlemi',
                action: function() {
                    executeAdvancedSettings('bulk-readonly');
                }
            },
            {
                id: 'bulk-adjustment',
                name: 'Toplu Ek Düzenleme',
                action: function() {
                    executeAdvancedSettings('bulk-adjustment');
                }
            },
            {
                id: 'audit-standard-rate',
                name: 'Standard Rate HR Kontrol',
                action: function() {
                    executeAdvancedSettings('audit-standard-rate');
                }
            }
        ]
    });

    // ===== ÖHS (FİYAT PLANLARI) MODÜLÜ =====
    const PricingPlansModule = new SupplyModule({
        id: 'pricing-plans',
        name: 'ÖHS - Pricing Plans Manager',
        description: 'Fiyat planları görünüm asistanı - renklendirme, sıralama ve analiz araçları',
        category: 'Tesisim',
        matchUrls: [],
        tools: [
            {
                id: 'load-all-pages',
                name: 'Tüm Sayfaları Yükle',
                action: function() {
                    executePricingPlans('load-all-pages');
                }
            },
            {
                id: 'repaint-plans',
                name: 'Yeniden Tara ve Sırala',
                action: function() {
                    executePricingPlans('repaint-plans');
                }
            },
            {
                id: 'show-occupancy',
                name: 'Kişi Farklarını Göster/Gizle',
                action: function() {
                    executePricingPlans('show-occupancy');
                }
            }
        ]
    });

    // ===== GELİŞMİŞ GÜNCELLEMELER MODÜLÜ =====
    const AdvancedUpdatesModule = new SupplyModule({
        id: 'advanced-updates',
        name: 'Advanced Update Tools',
        description: 'Gelişmiş rate ve availability yönetim araçları',
        category: 'Gelişmiş',
        matchUrls: [],
        tools: [
            {
                id: 'show-price-only',
                name: 'Sadece Fiyatı Göster',
                action: function() {
                    executeAdvanced('show-price-only');
                }
            },
            {
                id: 'show-availability-only',
                name: 'Sadece Müsaitlik Göster',
                action: function() {
                    executeAdvanced('show-availability-only');
                }
            },
            {
                id: 'availability-check',
                name: 'Müsaitlik Kontrolü',
                action: function() {
                    executeAdvanced('availability-check');
                }
            }
        ]
    });

    // ===== BASİT GÜNCELLEMELER MODÜLÜ =====
    const SimpleUpdatesModule = new SupplyModule({
        id: 'simple-updates',
        name: 'Simple Update Tools',
        description: 'Hızlı güncellemeler ve hata ayıklama araçları',
        category: 'Basit',
        matchUrls: [],
        tools: [
            {
                id: 'show-more',
                name: 'Daha Fazla',
                action: function() {
                    executeSimple('show-more');
                }
            },
            {
                id: 'price-only',
                name: 'Yalnızca Fiyat',
                action: function() {
                    executeSimple('price-only');
                }
            },
            {
                id: 'debug-errors',
                name: 'Hata Ayıkla',
                action: function() {
                    executeSimple('debug-errors');
                }
            }
        ]
    });

    // ===== GALLERY MODÜLÜ =====
    const GalleryModule = new SupplyModule({
        id: 'gallery',
        name: 'Gallery Tools',
        description: 'Fotoğraf galerisi için otomatik etiketleme araçları',
        category: 'Tesisim',
        matchUrls: [],
        tools: [
            {
                id: 'auto-tag',
                name: 'Otomatik Etiketleme Başlat',
                action: function() {
                    startGalleryTagging();
                }
            },
            {
                id: 'stop-tag',
                name: 'Etiketlemeyi Durdur',
                action: function() {
                    stopGalleryTagging();
                }
            }
        ]
    });

    // ===== ÖHS (FİYAT PLANLARI) FONKSİYONLARI =====

    // Global variables for ÖHS
    let tumPlanlar = new Map();
    const sayfaCache = new Map();
    const renkPaleti = [
        { master: '#B3E5FC', child: '#E1F5FE' }, { master: '#C8E6C9', child: '#E8F5E9' },
        { master: '#FFECB3', child: '#FFF8E1' }, { master: '#FFCDD2', child: '#FFEBEE' },
        { master: '#D1C4E9', child: '#EDE7F6' }, { master: '#FFE0B2', child: '#FFF3E0' },
        { master: '#D7CCC8', child: '#EFEBE9' }, { master: '#CFD8DC', child: '#ECEFF1' },
    ];
    const isteklerArasiBekleme = 200;

    // ÖHS Styles
    if (!document.getElementById('ohs-styles')) {
        const style = document.createElement('style');
        style.id = 'ohs-styles';
        style.textContent = `
            .hr-grup-vurgu { outline: 2px solid #007bff !important; box-shadow: 0 0 10px rgba(0, 123, 255, 0.5); transition: all 0.1s ease-in-out; }
            .hr-odaklanma-butonu { cursor: pointer; color: #007bff; font-size: 11px; font-weight: bold; margin-left: 15px; user-select: none; display: inline-block; }
            .hr-odaklanma-butonu:hover { text-decoration: underline; }
            body.hr-izole-modu #table-body > tbody.rate-plan-row-group:not(.hr-aktif-grup) { opacity: 0.15; pointer-events: none; }
            body.hr-izole-modu #table-body > tbody.rate-plan-row-group.hr-aktif-grup { opacity: 1; }
        `;
        document.head.appendChild(style);
    }

    const debounce = (fn, ms = 400) => {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    };

    function tamYenileme() {
        iliskileriTespitEtVeRenklendir();
        gruplariSirala();
    }

    function iliskileriTespitEtVeRenklendir() {
        console.log('ÖHS: Plan ilişkileri tespit ediliyor ve renklendiriliyor...');
        tumPlanlar.clear();
        document.querySelectorAll('tbody.rate-plan-row-group').forEach(planBlogu => {
            planBlogu.dataset.groupKey = '';
            planBlogu.classList.remove('hr-grup-vurgu', 'hr-aktif-grup');
            const eskiButon = planBlogu.querySelector('.hr-odaklanma-butonu');
            if(eskiButon) eskiButon.remove();
        });
        document.querySelectorAll('tbody.rate-plan-row-group tr.master > td').forEach(td => { td.style.backgroundColor = ''; });

        document.querySelectorAll('tbody.rate-plan-row-group').forEach(planBlogu => {
            const anaLink = planBlogu.querySelector('tr.master h5 > a');
            if (!anaLink) return;
            const planAdi = anaLink.textContent.trim();
            const linkIkonu = planBlogu.querySelector('tr.master small i.icon-link');
            let isChild = false; let parentName = null;
            if (linkIkonu) {
                isChild = true;
                const linkMetni = linkIkonu.parentElement.textContent.trim();
                const fiyatBilgisiIndex = linkMetni.indexOf(' (Önce:');
                parentName = (fiyatBilgisiIndex !== -1) ? linkMetni.substring(0, fiyatBilgisiIndex).trim() : linkMetni.split('(')[0].trim();
            }
            tumPlanlar.set(planAdi, { name: planAdi, element: planBlogu, isChild, parentName, isMaster: false, children: [], groupKey: planAdi });
        });

        for (const [planAdi, plan] of tumPlanlar.entries()) {
            const birilerininParentiMi = Array.from(tumPlanlar.values()).some(p => p.parentName === planAdi);
            if (birilerininParentiMi || !plan.isChild) {
                plan.isMaster = true;
            }
        }

        for (const childPlan of tumPlanlar.values()) {
            if (childPlan.parentName && tumPlanlar.has(childPlan.parentName)) {
                tumPlanlar.get(childPlan.parentName).children.push(childPlan);
            }
        }

        function findRootMaster(plan) {
            if (!plan.parentName || !tumPlanlar.has(plan.parentName)) {
                return plan;
            }
            return findRootMaster(tumPlanlar.get(plan.parentName));
        }
        for (const plan of tumPlanlar.values()) {
            const kokMaster = findRootMaster(plan);
            plan.groupKey = kokMaster.name;
            plan.element.dataset.groupKey = kokMaster.name;
        }

        let renkIndex = 0;
        for (const plan of tumPlanlar.values()) {
            if (plan.isMaster && !plan.isChild) {
                const renkler = renkPaleti[renkIndex % renkPaleti.length];
                renkIndex++;
                const masterGrubu = Array.from(tumPlanlar.values()).filter(p => p.groupKey === plan.name);
                masterGrubu.forEach(grupUyesi => {
                    const td = grupUyesi.element.querySelector('tr.master > td');
                    if (td) {
                        td.style.backgroundColor = grupUyesi.isMaster ? renkler.master : renkler.child;
                    }
                });
            }
        }
        etkilesimDinleyicileriEkle();
    }

    function etkilesimDinleyicileriEkle() {
        document.querySelectorAll('tbody.rate-plan-row-group').forEach(planBlogu => {
            if (planBlogu.dataset.hrBound === '1') return;
            planBlogu.dataset.hrBound = '1';
            planBlogu.addEventListener('mouseenter', () => {
                const groupKey = planBlogu.dataset.groupKey;
                if (groupKey) document.querySelectorAll(`tbody[data-group-key="${groupKey}"]`).forEach(el => el.classList.add('hr-grup-vurgu'));
            });
            planBlogu.addEventListener('mouseleave', () => {
                const groupKey = planBlogu.dataset.groupKey;
                if (groupKey) document.querySelectorAll(`tbody[data-group-key="${groupKey}"]`).forEach(el => el.classList.remove('hr-grup-vurgu'));
            });
        });

        for (const plan of tumPlanlar.values()) {
            if (plan.isMaster) {
                const masterTd = plan.element.querySelector('tr.master > td > h5');
                if (masterTd && !masterTd.querySelector('.hr-odaklanma-butonu')) {
                    const odakButon = document.createElement('span');
                    odakButon.className = 'hr-odaklanma-butonu';
                    odakButon.textContent = '[Odaklan]';
                    odakButon.dataset.groupKey = plan.groupKey;
                    masterTd.appendChild(odakButon);
                }
            }
        }

        const tableBody = document.getElementById('table-body');
        if (tableBody && !tableBody.dataset.focusListener) {
            tableBody.dataset.focusListener = 'true';
            tableBody.addEventListener('click', e => {
                if (e.target.classList.contains('hr-odaklanma-butonu')) {
                    e.preventDefault(); e.stopPropagation();
                    const odakButon = e.target;
                    const groupKey = odakButon.dataset.groupKey;
                    const body = document.body;
                    if (odakButon.textContent === '[Tümünü Göster]') {
                        body.classList.remove('hr-izole-modu');
                        document.querySelectorAll('.hr-odaklanma-butonu').forEach(btn => btn.textContent = '[Odaklan]');
                    } else {
                        document.querySelectorAll('.hr-odaklanma-butonu').forEach(btn => btn.textContent = '[Odaklan]');
                        document.querySelectorAll('tbody.hr-aktif-grup').forEach(el => el.classList.remove('hr-aktif-grup'));
                        document.querySelectorAll(`tbody[data-group-key="${groupKey}"]`).forEach(el => el.classList.add('hr-aktif-grup'));
                        body.classList.add('hr-izole-modu');
                        odakButon.textContent = '[Tümünü Göster]';
                    }
                }
            });
        }
    }

    function gruplariSirala() {
        const anaTablo = document.getElementById('table-body');
        if (!anaTablo) return;
        const fragment = document.createDocumentFragment();
        const islenmisler = new Set();
        function grubuOlustur(plan) {
            if (islenmisler.has(plan.name)) return [];
            const grupElementleri = [];
            plan.children.sort((a, b) => a.name.localeCompare(b.name)).forEach(child => {
                if (child.isMaster) grupElementleri.push(...grubuOlustur(child));
            });
            plan.children.sort((a, b) => a.name.localeCompare(b.name)).forEach(child => {
                if (!child.isMaster) { grupElementleri.push(child.element); islenmisler.add(child.name); }
            });
            grupElementleri.push(plan.element);
            islenmisler.add(plan.name);
            return grupElementleri;
        }
        const kokMasterlar = Array.from(tumPlanlar.values()).filter(p => p.isMaster && !p.isChild && p.name.trim().toLowerCase() !== 'ana fiyat');
        kokMasterlar.sort((a, b) => a.name.localeCompare(b.name)).forEach(plan => {
            grubuOlustur(plan).forEach(el => fragment.appendChild(el));
        });
        const anaFiyatPlan = Array.from(tumPlanlar.values()).find(p => p.name.trim().toLowerCase() === 'ana fiyat');
        const anaFiyatGrubu = anaFiyatPlan ? grubuOlustur(anaFiyatPlan) : [];
        const bagimsizPlanlar = Array.from(tumPlanlar.values()).filter(plan => !islenmisler.has(plan.name)).map(plan => plan.element);

        anaTablo.innerHTML = '';
        bagimsizPlanlar.forEach(el => fragment.insertBefore(el, fragment.firstChild));
        fragment.append(...anaFiyatGrubu);
        anaTablo.appendChild(fragment);
    }

    async function kisiFarklariniGoster() {
        let hedefler = [];
        document.querySelectorAll('#table-body > tbody.rate-plan-row-group').forEach(planElement => {
            const planAdi = planElement.querySelector('tr.master h5 > a')?.textContent.trim();
            if(planAdi) {
                const plan = tumPlanlar.get(planAdi);
                if (plan && plan.isMaster) {
                    planElement.querySelectorAll('tr.child.rateItem a').forEach(link => hedefler.push(link));
                }
            }
        });

        const existingInfo = document.querySelector('.occupancy-info');
        if (existingInfo) {
            document.querySelectorAll('.occupancy-info').forEach(el => el.remove());
            document.getElementById('hub-status-text').textContent = 'Kişi farkları gizlendi';
            setTimeout(() => {
                document.getElementById('hub-status-text').textContent = 'Hazır';
            }, 2000);
            return;
        }

        if (hedefler.length === 0) {
            alert('Master plan bulunamadı. Bu araç rate plans sayfasında çalışır.');
            return;
        }

        hedefler.reverse();

        document.getElementById('hub-status-text').textContent = `0/${hedefler.length} yükleniyor...`;
        let processedCount = 0;

        for (const hedefLink of hedefler) {
            const satir = hedefLink.closest('tr');
            let infoSpan = satir ? satir.querySelector('.occupancy-info') : null;
            if (!infoSpan) {
                infoSpan = document.createElement('small');
                infoSpan.className = 'occupancy-info';
                infoSpan.style.cssText = 'display: block; color: #007bff; font-weight: 500; margin-top: 4px;';
                if (hedefLink.parentElement) hedefLink.parentElement.appendChild(infoSpan);
            }
            infoSpan.textContent = 'Yükleniyor...';
            const url = hedefLink.href;
            const goster = (farklar) => {
                if (farklar && farklar.length > 0) {
                    infoSpan.textContent = farklar.join(' | ');
                    infoSpan.style.color = '#007bff';
                    infoSpan.style.fontWeight = '500';
                } else {
                    infoSpan.textContent = 'Kişi farkı tanımlanmamış.';
                    infoSpan.style.color = '#6c757d';
                    infoSpan.style.fontWeight = 'normal';
                }
            };
            try {
                if (sayfaCache.has(url)) {
                    goster(sayfaCache.get(url));
                } else {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const htmlText = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlText, 'text/html');
                    const fiyatSatirlari = doc.querySelectorAll('#guest_based_prices_table > tr');
                    let farklar = [];
                    fiyatSatirlari.forEach(row => {
                        const kisiBadge = row.querySelector('.badge.badge-info');
                        const fiyatInput = row.querySelector('input[name*="[preferred_amount]"][data-base-reference="#variant_price"]');
                        if (kisiBadge && fiyatInput && fiyatInput.value !== '0') {
                            const kisiSayisi = kisiBadge.textContent.trim();
                            const temizlenmisDeger = fiyatInput.value.replace(/\./g, '').replace(',', '.');
                            let fiyatDegeri = parseFloat(temizlenmisDeger) || 0;
                            const formatlanmisFiyat = new Intl.NumberFormat('tr-TR').format(fiyatDegeri);
                            const fiyatTipiSelect = row.querySelector('select[name*="[preferred_type]"]');
                            const isaretSelect = row.querySelector('select.field_adjustment_select');
                            const isaret = (isaretSelect && isaretSelect.value === '-1') ? '-' : '+';
                            const tip = (fiyatTipiSelect && fiyatTipiSelect.value === 'flat_percent') ? '%' : '₺';
                            if (fiyatDegeri !== 0) farklar.push(`👤${kisiSayisi} Kişi: ${isaret}${formatlanmisFiyat}${tip}`);
                        }
                    });
                    sayfaCache.set(url, farklar);
                    goster(farklar);
                }
            } catch (error) {
                console.error(`Veri çekilirken hata oluştu (${url}):`, error);
                infoSpan.textContent = 'Hata: Veri çekilemedi.';
                infoSpan.style.color = 'red';
            }
            processedCount++;
            document.getElementById('hub-status-text').textContent = `${processedCount}/${hedefler.length} yüklendi`;
            await new Promise(resolve => setTimeout(resolve, isteklerArasiBekleme));
        }
        document.getElementById('hub-status-text').textContent = 'Kişi farkları yüklendi';
        setTimeout(() => {
            document.getElementById('hub-status-text').textContent = 'Hazır';
        }, 3000);
    }

    async function tumSayfalariYukle() {
        const links = [...new Set([...document.querySelectorAll('.pagination li:not(.active):not(.next_page):not(.last) a')].map(a => a.href))];
        if (links.length === 0) {
            alert('Yüklenecek başka sayfa yok.');
            return;
        }

        if (!confirm(`${links.length} sayfa yüklenecek. Bu işlem zaman alabilir. Devam etmek istiyor musunuz?`)) {
            return;
        }

        const anaTablo = document.getElementById('table-body');
        if (!anaTablo) {
            alert('Ana tablo bulunamadı! Bu araç rate plans sayfasında çalışır.');
            return;
        }

        for (let i = 0; i < links.length; i++) {
            document.getElementById('hub-status-text').textContent = `${i + 1}/${links.length} sayfa yükleniyor...`;
            try {
                const res = await fetch(links[i]);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const fragment = document.createDocumentFragment();
                doc.querySelectorAll('tbody.rate-plan-row-group').forEach(tb => fragment.appendChild(tb));
                anaTablo.appendChild(fragment);
                await new Promise(r => setTimeout(r, 200));
            } catch (e) {
                console.error('Sayfa yüklenemedi:', links[i], e);
                alert('Hata! Bazı sayfalar yüklenemedi.');
                break;
            }
        }

        document.querySelector('.pagination')?.remove();

        document.getElementById('hub-status-text').textContent = 'Tüm sayfalar yüklendi. Yeniden taranıyor...';
        tamYenileme();

        setTimeout(() => {
            document.getElementById('hub-status-text').textContent = 'Hazır';
        }, 3000);
    }

    function executePricingPlans(action) {
        try {
            document.getElementById('hub-status-text').textContent = `${action} çalışıyor...`;

            switch(action) {
                case 'load-all-pages':
                    tumSayfalariYukle();
                    break;

                case 'repaint-plans':
                    tamYenileme();
                    alert('Fiyat planları yeniden tarandı, renklendi ve sıralandı.');
                    document.getElementById('hub-status-text').textContent = 'Hazır';
                    break;

                case 'show-occupancy':
                    kisiFarklariniGoster();
                    break;
            }

        } catch (error) {
            console.error('ÖHS execution error:', error);
            document.getElementById('hub-status-text').textContent = 'Hata oluştu';
            alert(`İşlem sırasında hata: ${error.message}`);
        }
    }

    // Auto-initialize ÖHS features on rate plans pages
    function initializeOHSFeatures() {
        const tableBody = document.getElementById('table-body');
        const ratePlanGroups = document.querySelectorAll('tbody.rate-plan-row-group');

        if (tableBody && ratePlanGroups.length > 0) {
            setTimeout(() => {
                tamYenileme();
            }, 1000);
        }
    }

    // ===== GELİŞMİŞ AYARLAR FONKSİYONLARI (HİBRİT) =====
    function executeAdvancedSettings(action) {
        try {
            document.getElementById('hub-status-text').textContent = `${action} çalışıyor...`;

            switch(action) {
                case 'toggle-advanced':
                    // Basit - prompt kalsın
                    const links = document.querySelectorAll('.advanced-settings a');
                    if (links.length === 0) {
                        alert("Gelişmiş ayarlar bulunamadı. Bu araç mapping sayfalarında çalışır.");
                        return;
                    }
                    const shouldOpen = !links[0].closest('.advanced-settings').classList.contains('active');
                    links.forEach(link => {
                        const setting = link.closest('.advanced-settings');
                        if ((shouldOpen && !setting.classList.contains('active')) ||
                            (!shouldOpen && setting.classList.contains('active'))) {
                            link.click();
                        }
                    });
                    alert(`Gelişmiş ayarlar ${shouldOpen ? 'açıldı' : 'kapatıldı'}.`);
                    break;

                case 'bulk-readonly':
                    // Modal kullan
                    supplyHubInstance.showBulkReadonlyModal();
                    break;

                case 'bulk-adjustment':
                    // Modal kullan
                    supplyHubInstance.showBulkAdjustmentModal();
                    break;

                case 'audit-standard-rate':
                    // Basit - confirm yeterli
                    const srhrItems = Array.from(document.querySelectorAll('.list-item')).filter(item =>
                        item.querySelector('.five.main-channel')?.textContent.trim().toLowerCase().includes('standard rate hr')
                    );

                    if (srhrItems.length === 0) {
                        alert("Sayfada 'Standard Rate Hr' içeren bir fiyat planı bulunamadı.");
                        return;
                    }

                    if (!confirm(`${srhrItems.length} adet "Standard Rate Hr" planı bulundu. Standart ayarlara göre düzenlensin mi?`)) {
                        return;
                    }

                    srhrItems.forEach(item => {
                        const advancedSettings = item.querySelector('.advanced-settings-container');
                        if (!advancedSettings) return;

                        const adjValueInput = advancedSettings.querySelector('.consider_data_sign');
                        if (adjValueInput && adjValueInput.value !== '0') {
                            adjValueInput.value = '0';
                            adjValueInput.dispatchEvent(new Event('change', { bubbles: true }));
                        }

                        const commissionInput = advancedSettings.querySelector('input[name*="[commission_amount]"]');
                        if (commissionInput && commissionInput.value !== '0') {
                            commissionInput.value = '0';
                            commissionInput.dispatchEvent(new Event('change', { bubbles: true }));
                        }

                        const stopSellCheckbox = advancedSettings.querySelector('.stop_sell_check');
                        if (stopSellCheckbox && stopSellCheckbox.checked) {
                            stopSellCheckbox.click();
                        }

                        const readOnlyCheckbox = advancedSettings.querySelector('.read-only-checkbox');
                        if (readOnlyCheckbox && readOnlyCheckbox.checked) {
                            readOnlyCheckbox.click();
                        }

                        const masterRateRadio = advancedSettings.querySelector('.master-radio-button');
                        if (masterRateRadio && !masterRateRadio.checked) {
                            masterRateRadio.click();
                        }

                        // YENİ: Oda eşleştirmesini "Gönderme" olarak ayarla
    const rateValueSelect = item.querySelector('.five select[name*="[rate_value]"]');
    if (rateValueSelect && rateValueSelect.value !== '-1_-1_false') {
        rateValueSelect.value = '-1_-1_false';
        rateValueSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
                    });

                    alert(`${srhrItems.length} adet "Standard Rate Hr" planı kontrol edildi ve standartlara uygun hale getirildi.`);
                    break;
            }

            document.getElementById('hub-status-text').textContent = 'Hazır';
        } catch (error) {
            console.error('Advanced Settings execution error:', error);
            document.getElementById('hub-status-text').textContent = 'Hata oluştu';
            alert(`İşlem sırasında hata: ${error.message}`);
        }
    }

    // ===== MAPPING FONKSİYONLARI =====
    function executeMapping(action) {
        try {
            document.getElementById('hub-status-text').textContent = `${action} çalışıyor...`;

            switch(action) {
                case 'sorting':
                    if (typeof $ === 'undefined') {
                        alert('Bu araç için jQuery gereklidir.');
                        return;
                    }

                    function reOrderForSorting(elem) {
                        var baseSelect = $(elem);
                        var selectedText = baseSelect.find('option:selected').text();
                        var childSelect = baseSelect.parents('.mapping-item').find('.list-container .five select');
                        childSelect.each(function(i, select) {
                            var label = selectedText;
                            var firstOption = select.querySelectorAll('optgroup[label=""]');
                            var optgroups = select.querySelectorAll('optgroup[label*="' + label + '"]');
                            optgroups.forEach(function(e) { e.remove(); });
                            $(select).prepend(optgroups);
                            $(select).prepend(firstOption);
                            $(select).trigger('change');
                        });
                    }

                    const targetElements = document.querySelectorAll('.mapping-item .mapping-header select.variant_id_select.availability-select');
                    if (targetElements.length === 0) {
                        alert("Sıralama yapılacak 'Müsaitlik' seçme kutusu bulunamadı.");
                        return;
                    }
                    targetElements.forEach(availSelect => { reOrderForSorting(availSelect); });
                    alert("Listeler yeniden sıralandı!");
                    break;

                case 'coloring':
                    document.querySelectorAll('.list-item.arrow-animation.clearfix').forEach((element, index) => {
                        element.style.backgroundColor = (index % 2 === 0) ? 'white' : '#dddddd';
                    });
                    alert("Liste öğeleri renklendirildi!");
                    break;

                case 'expand':
                    document.querySelectorAll('select[name^="store_channel_premium"]').forEach(selectElement => {
                        const currentWidth = parseFloat(getComputedStyle(selectElement).width);
                        if (!isNaN(currentWidth)) {
                            selectElement.style.width = (currentWidth + 450) + 'px';
                        }
                    });
                    alert("İlgili seçme kutuları genişletildi!");
                    break;

                case 'filter-rooms':
                    if (typeof $ === 'undefined') {
                        alert('Bu araç için jQuery gereklidir.');
                        return;
                    }

                    function filterToShowMatchingRooms(elem) {
                        var baseSelect = $(elem);
                        var selectedText = baseSelect.find('option:selected').text();
                        var childSelects = baseSelect.parents('.mapping-item').find('.list-container .five select');
                        childSelects.each(function(i, select) {
                            var labelToMatch = selectedText;
                            var allOptgroups = select.querySelectorAll('optgroup');
                            allOptgroups.forEach(function(optgroup) {
                                var optgroupLabel = optgroup.getAttribute('label') || "";
                                var preserveOptgroup = $(optgroup).find('option[value="-1_-1_false"]').length > 0;
                                var isEmptyLabelOptgroup = optgroupLabel === "";
                                var labelMatches = optgroupLabel.includes(labelToMatch);
                                var shouldShow = isEmptyLabelOptgroup || preserveOptgroup || labelMatches;
                                if (shouldShow) {
                                    $(optgroup).show();
                                    $(optgroup).find('option').show();
                                } else {
                                    $(optgroup).hide();
                                    $(optgroup).find('option').hide();
                                }
                            });
                        });
                    }

                    const availabilitySelects = document.querySelectorAll('.mapping-item .mapping-header select.variant_id_select.availability-select');
                    if (availabilitySelects.length === 0) {
                        alert("Filtreleme için ana 'Müsaitlik' seçme kutusu bulunamadı.");
                        return;
                    }

                    $(document).off('change.supplyHubFilter').on('change.supplyHubFilter', '.mapping-item .mapping-header select.variant_id_select.availability-select', function(event) {
                        filterToShowMatchingRooms(event.target);
                    });

                    availabilitySelects.forEach(availabilitySelectElement => {
                        filterToShowMatchingRooms(availabilitySelectElement);
                    });
                    alert("Odalar seçime göre filtrelendi!");
                    break;
            }

            document.getElementById('hub-status-text').textContent = 'Hazır';
        } catch (error) {
            console.error('Mapping execution error:', error);
            document.getElementById('hub-status-text').textContent = 'Hata oluştu';
            alert(`İşlem sırasında hata: ${error.message}`);
        }
    }

    // ===== GELİŞMİŞ GÜNCELLEMELER FONKSİYONLARI =====
    function executeAdvanced(action) {
        try {
            document.getElementById('hub-status-text').textContent = `${action} çalışıyor...`;

            switch(action) {
                case 'show-price-only':
                    document.querySelectorAll('tr').forEach(function(row) {
                        if (row.classList.contains('tr_false') && row.classList.contains('smart')) {
                            row.remove();
                        } else if (row.textContent.includes('Bağlı rate') && !row.classList.contains('tr_true')) {
                            let previousRow = row.previousElementSibling;
                            if (previousRow && previousRow.tagName === 'TR' &&
                                previousRow.classList.contains('tr_false') &&
                                previousRow.classList.contains('rate_title_row')) {
                                previousRow.remove();
                            }
                            row.remove();
                        }
                        row.querySelectorAll('td').forEach(function(td) {
                            td.querySelectorAll('.input-group').forEach(function(inputGroup) {
                                if (inputGroup.querySelector('.input-group-addon[title="Müsaitlik"]')) {
                                    inputGroup.remove();
                                }
                            });
                            td.querySelectorAll('[class^="icon"]').forEach(function(iconElement) {
                                if (iconElement.nextSibling && iconElement.nextSibling.nodeType === Node.TEXT_NODE) {
                                    iconElement.nextSibling.remove();
                                }
                                iconElement.remove();
                            });
                        });
                    });
                    alert("Sadece fiyat bilgileri gösteriliyor.");
                    break;

                case 'show-availability-only':
                    document.querySelectorAll('.summary .calendar-icon-wrap.icon-align-center').forEach(function(element) {
                        let parentParagraph = element.closest('p');
                        if (parentParagraph) parentParagraph.remove();
                    });
                    document.querySelectorAll('.summary .price').forEach(function(element) {
                        element.remove();
                    });
                    document.querySelectorAll('tr.tr_false.all_child_rates.hide').forEach(function(element) {
                        element.remove();
                    });
                    document.querySelectorAll('tr.tr_false.smart').forEach(function(element) {
                        element.remove();
                    });
                    document.querySelectorAll('tr.tr_false').forEach(function(row) {
                        if (row.querySelector('div.all_child_rates.hide')) {
                            row.remove();
                        }
                    });
                    document.querySelectorAll('tr.tr_false.rate_title_row').forEach(function(row) {
                        if (!row.querySelector('p.no-margin')) {
                            row.remove();
                        }
                    });
                    document.querySelectorAll('div.input-group').forEach(function(element) {
                        let inputElement = element.querySelector('input[placeholder="Baz fiyat"]');
                        if (inputElement) {
                            element.remove();
                        }
                    });
                    alert("Sadece müsaitlik bilgileri gösteriliyor.");
                    break;

                case 'availability-check':
                    document.querySelectorAll('tr.rate_title_row').forEach(function(row) {
                        if (row.querySelector('.supply-availability-checker')) return;

                        const container = document.createElement('div');
                        container.className = 'supply-availability-checker';
                        container.style.cssText = 'margin-top: 10px; padding: 10px; border: 1px dashed #ccc; border-radius: 5px;';

                        container.innerHTML = `
                            <label style="margin-right: 10px;">Tanımlanan Müsaitlik:</label>
                            <input type="text" placeholder="Oda Sayısı" style="width: 100px; margin-right: 10px; padding: 5px;">
                            <button style="padding: 5px 10px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Kontrol Et</button>
                        `;

                        if (row.querySelector('td')) {
                            row.querySelector('td').appendChild(container);
                        }

                        const button = container.querySelector('button');
                        const input = container.querySelector('input');

                        button.addEventListener('click', function(event) {
                            event.preventDefault();
                            event.stopPropagation();

                            row.querySelectorAll('span.musaitlik-result').forEach(function(oldResult) {
                                oldResult.remove();
                            });
                            row.querySelectorAll('[id^="for_resource_resource_for_room_"]').forEach(function(parentElement) {
                                parentElement.style.backgroundColor = '';
                                parentElement.style.boxShadow = '';
                            });

                            const physicalRoomCount = parseInt(input.value, 10);
                            if (isNaN(physicalRoomCount)) {
                                alert("Lütfen geçerli bir sayı girin.");
                                return;
                            }

                            const availabilityElements = row.querySelectorAll('i.icon-home.calendar-icon-wrap');
                            const reservationElements = row.querySelectorAll('i.icon-calendar-o.calendar-icon-wrap');

                            availabilityElements.forEach(function(availabilityElement, index) {
                                if (index < reservationElements.length) {
                                    const reservationElement = reservationElements[index];
                                    const availabilityCount = parseInt(availabilityElement.nextSibling.textContent.trim().replace(':', ''), 10);
                                    const reservationCount = parseInt(reservationElement.nextSibling.textContent.trim().replace(':', ''), 10);

                                    if (physicalRoomCount !== (availabilityCount + reservationCount)) {
                                        const result = physicalRoomCount - reservationCount;
                                        const resultSpan = document.createElement('span');
                                        resultSpan.classList.add('musaitlik-result');
                                        resultSpan.style.cssText = 'color: #2196F3; font-size: 18px; font-weight: bold;';
                                        resultSpan.textContent = ` (${result})`;
                                        availabilityElement.parentElement.appendChild(resultSpan);

                                        const parentElement = availabilityElement.closest('[id^="for_resource_resource_for_room_"]');
                                        if (parentElement) {
                                            parentElement.style.backgroundColor = 'white';
                                            parentElement.style.boxShadow = 'inset 0 0 0 2px red';
                                        }
                                    }
                                }
                            });
                        });
                    });
                    alert("Müsaitlik kontrolü arayüzü eklendi.");
                    break;
            }

            document.getElementById('hub-status-text').textContent = 'Hazır';
        } catch (error) {
            console.error('Advanced execution error:', error);
            document.getElementById('hub-status-text').textContent = 'Hata oluştu';
            alert(`İşlem sırasında hata: ${error.message}`);
        }
    }

    // ===== BASİT GÜNCELLEMELER FONKSİYONLARI =====
    function executeSimple(action) {
        try {
            document.getElementById('hub-status-text').textContent = `${action} çalışıyor...`;

            switch(action) {
                case 'show-more':
                    const links = document.querySelectorAll('a[class^="more_resource_"]');
                    if (links.length === 0) {
                        alert("'Daha Fazla' linki bulunamadı.");
                        return;
                    }
                    links.forEach(function(link) { link.click(); });
                    alert(`Toplam ${links.length} adet 'Daha Fazla' linkine tıklandı.`);
                    break;

                case 'price-only':
                    document.querySelectorAll('tr').forEach(function(row) {
                        if (row.classList.contains('tr_false') && row.classList.contains('smart')) {
                            row.remove();
                        } else if (row.textContent.includes('Bağlı rate') && !row.classList.contains('tr_true')) {
                            let previousRow = row.previousElementSibling;
                            if (previousRow && previousRow.tagName === 'TR') {
                                if (previousRow.classList.contains('tr_false') && previousRow.classList.contains('rate_title_row')) {
                                    previousRow.remove();
                                }
                            }
                            row.remove();
                        } else {
                            row.querySelectorAll('td').forEach(function(td) {
                                td.querySelectorAll('.input-group').forEach(function(inputGroup) {
                                    var availabilityLabel = inputGroup.querySelector('.input-group-addon[title="Müsaitlik"]');
                                    if (availabilityLabel) {
                                        inputGroup.childNodes.forEach(function(child) {
                                            if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'A') {
                                                child.remove();
                                            }
                                        });
                                    }
                                });
                                td.querySelectorAll('[class^="icon"]').forEach(function(iconElement) {
                                    if (!iconElement.closest('a')) {
                                        if (iconElement.nextSibling && iconElement.nextSibling.nodeType === Node.TEXT_NODE) {
                                            iconElement.nextSibling.remove();
                                        }
                                        iconElement.remove();
                                    }
                                });
                            });
                        }
                    });
                    alert("Sadece fiyat bilgileri gösteriliyor.");
                    break;

                case 'debug-errors':
                    document.querySelectorAll('a[class^="more_resource_"]').forEach(function(link) {
                        link.click();
                    });

                    setTimeout(function() {
                        let errorCount = 0;
                        document.querySelectorAll('td').forEach(function(tdElement) {
                            var errorIcon = tdElement.querySelector('i.iconPosition.iconRed.icon-remove');
                            if (errorIcon) {
                                tdElement.style.boxShadow = 'inset 0 0 0 2px red';
                                errorCount++;
                            }
                        });
                        alert(`Hata ayıklama tamamlandı. Toplam ${errorCount} adet hatalı hücre bulundu ve işaretlendi.`);
                        document.getElementById('hub-status-text').textContent = 'Hazır';
                    }, 7000);
                    return;
            }

            document.getElementById('hub-status-text').textContent = 'Hazır';
        } catch (error) {
            console.error('Simple execution error:', error);
            document.getElementById('hub-status-text').textContent = 'Hata oluştu';
            alert(`İşlem sırasında hata: ${error.message}`);
        }
    }

// ===== GALLERY FONKSİYONLARI =====
async function startGalleryTagging() {
    const tagToAdd = 'gallery';
    const photos = document.querySelectorAll('.item.img-container');
    if (photos.length === 0) {
        alert("Etiketlenecek fotoğraf bulunamadı.");
        return;
    }
    if (!confirm(`${photos.length} adet fotoğrafa "${tagToAdd}" etiketi eklenecek. Onaylıyor musunuz?`)) {
        return;
    }
    if (typeof GM_setValue !== 'undefined') {
        await GM_setValue('gallery-tagging-active', true);
        await GM_setValue('gallery-current-index', 0);
        await GM_setValue('gallery-total-photos', photos.length);
    }
    alert('Otomatik etiketleme başlatıldı. Sayfa yenilenecek...');
    location.reload();
}

async function stopGalleryTagging() {
    if (typeof GM_deleteValue !== 'undefined') {
        await GM_deleteValue('gallery-tagging-active');
        await GM_deleteValue('gallery-current-index');
        await GM_deleteValue('gallery-total-photos');
    }
    alert('Etiketleme durduruldu.');
    location.reload();
}

// Gallery auto-processing (sayfa yüklendiğinde kontrol et)
async function handleGalleryAutoProcessing() {
    // Element bulunana kadar bekleyen fonksiyon
    const waitForElement = (selector, timeout = 10000) => {
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(interval);
                    resolve(element);
                }
            }, 100);
            setTimeout(() => {
                clearInterval(interval);
                reject(new Error(`Element "${selector}" bulunamadı.`));
            }, timeout);
        });
    };

    if (typeof GM_getValue === 'undefined') return;

    const isActive = await GM_getValue('gallery-tagging-active', false);
    if (!isActive) return;

    const currentIndex = await GM_getValue('gallery-current-index', 0);
    const totalPhotos = await GM_getValue('gallery-total-photos', 0);

    if (currentIndex >= totalPhotos) {
        await GM_deleteValue('gallery-tagging-active');
        alert('Tüm fotoğraflar etiketlendi!');
        return;
    }

    // Auto-processing logic
    const editButtons = document.querySelectorAll('.item.img-container .icon.edit a');
    const currentButton = editButtons[currentIndex];

    if (currentButton) {
        await GM_setValue('gallery-current-index', currentIndex + 1);
        currentButton.click();

        setTimeout(async () => {
            try {
                const tagInput = await waitForElement('#defaultModal .tagit-new input');
                tagInput.value = 'gallery';
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    bubbles: true
                });
                tagInput.dispatchEvent(enterEvent);

                await new Promise(r => setTimeout(r, 200));
                const saveButton = await waitForElement('#defaultModal input[type="submit"][value="Kaydet"]');
                saveButton.click();

            } catch (error) {
                console.error('Gallery tagging error:', error);
                // Hata durumunda işlemi durdur
                await GM_deleteValue('gallery-tagging-active');
                await GM_deleteValue('gallery-current-index');
                await GM_deleteValue('gallery-total-photos');
            }
        }, 1000);
    }
}

    // ===== ANA BAŞLATMA =====
    function initializeSupplyHub() {
        // Supply Hub'ı oluştur
        const hub = new SupplyHub();

        // Global instance olarak kaydet
        window.supplyHubInstance = hub;
        supplyHubInstance = hub;

        // Modülleri kaydet (öncelik sırasına göre)
        hub.registerModule(MappingModule);
        hub.registerModule(AdvancedSettingsModule);
        hub.registerModule(PricingPlansModule);
        hub.registerModule(AdvancedUpdatesModule);
        hub.registerModule(SimpleUpdatesModule);
        hub.registerModule(GalleryModule);

        // Hub'ı başlat
        hub.initialize();

        // Gallery auto-processing kontrolü
        handleGalleryAutoProcessing();

        // ÖHS özelliklerini otomatik başlat
        initializeOHSFeatures();

        console.log('Supply Hub (Hibrit Modal) başlatıldı!');
    }

    // Sayfa yüklendiğinde başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSupplyHub);
    } else {
        initializeSupplyHub();
    }

    })();
